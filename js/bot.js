
// message types for bot
const mt_Typing = "typing";
const mt_Disconnect = "disconnect";
const mt_Error = "error";
const mt_Message = "message";
const mt_Email = "email";

const typingCheckRate = 2000;


class Bot {
    constructor(settings, search, update_ui) {
        this.ws_base = settings.ws_base;
        this.update_ui = update_ui;
        this.settings = settings;
        this.search = search;
        this.is_connected = false;    // connected to endpoint?
        this.message_list = [];  // conversation list
        this.stompClient = null;

        // could the bot answer the question
        this.hasResult = true;
        this.isQuerying = false;

        // do we know this user's email?
        this.knowEmail = false;
        this.askForEmailAddress = false;

        // is the operator busy typing?
        this.operatorTyping = false;

        // typing checking
        this.typing_last_seen = 0;

        // voice / speech
        this.voice_enabled = ui_settings.bot_voice_enabled;

        this.selected_kb = null;
        this.selected_kbId = null;
        this.selected_sid = null;

        // what is the bot window display doing?
        this.window_maximized = true;
    }

    // connect to the system
    ws_connect() {
        var self = this;
        if (!this.is_connected && this.ws_base) {
            // this is the socket end-point
            var socket = new SockJS(this.ws_base);
            this.stompClient = Stomp.over(socket);
            this.stompClient.connect({},
                function (frame) {
                    self.stompClient.subscribe('/chat/' + SemanticSearch.getClientId(), function (answer) {
                        self.receiveData(JSON.parse(answer.body));
                    });
                    self.setConnected(true);
                },
                (err) => {
                    console.error(err);
                    this.setConnected(false);
                });
        }
    }

    setConnected(is_connected) {
        this.is_connected = is_connected;
        this.hasResult = true;

        if (!is_connected) {
            if (this.stompClient !== null) {
                this.stompClient.disconnect();
                this.stompClient = null;
            }
            console.log("ws-disconnected");
            setTimeout(this.ws_connect.bind(this), 5000); // try and re-connect as a one-off in 5 seconds
            // checking typing timeout
            setInterval(this.typingTick.bind(this), typingCheckRate);

        } else {
            console.log("ws-connected");
            this.stompClient.debug = null;
        }
        this.refresh();
    }


    // minimize or maximize the bot chat window
    min_max_bot_window_click() {
        this.window_maximized = !this.window_maximized;
        this.refresh();
    }


    // is the operator still typing?
    typingTick() {
        if (this.operatorTyping && (this.typing_last_seen + typingCheckRate) < new Date().getTime()) {
            this.operatorTyping = false;
            this.refresh();
        }
    }

    refresh() {
        if (this.update_ui) {
            this.update_ui(this);
        }
    }


    showError(title, errStr) {
        this.hasResult = false;
        this.search.error = errStr;
        this.refresh();
    }


    receiveData(data, origin) {
        if (data) {
            this.hasResult = true;
            if (data.messageType === mt_Error && data.error.length > 0) {
                this.showError("error", data.error);

            } else {

                // operator is typing message received
                if (data.messageType === mt_Typing) {
                    this.operatorTyping = true;
                    this.typing_last_seen = new Date().getTime();
                    this.hasResult = false;
                    this.askForEmailAddress = false;
                    this.refresh();

                } else if (data.messageType === mt_Message) {

                    // only output "can't find it" info if search came up empty
                    if (data.text !== ui_settings.system_no_results_reply) {
                        this.message_list.push({
                            "text": data.text, "origin": "simsage",
                            "urlList": data.urlList, "imageList": data.imageList, "time": new Date()
                        });
                        this.hasResult = data.hasResult;

                        if (!this.knowEmail && data.knowEmail) {
                            this.knowEmail = data.knowEmail;
                        }

                        // do we want to ask for their email address?
                        this.askForEmailAddress = !this.hasResult && this.search.num_results <= 0 &&
                            !this.knowEmail && ui_settings.bot_ask_email;

                        if (this.voice_enabled) {
                            let synth = window.speechSynthesis;
                            let voices = synth.getVoices();
                            if (synth && voices && voices.length > 0) {
                                const text = this.strip(data.text);
                                console.log('speaking:' + text);
                                var msg = new SpeechSynthesisUtterance(text);
                                msg.voice = voices[0];
                                synth.speak(msg);
                            }
                        }
                        this.window_maximized = true; // force the window open again
                        this.refresh();

                    } else if (this.message_list.length > 0) {
                        // otherwise - remove the user's text - there is a result - no need for this
                        this.message_list = this.message_list.slice(0, this.message_list.length - 1);
                        this.refresh();
                    }

                }
            }
        }
    }

    sendEmail() {
        let emailAddress = $("#email").val();
        if (emailAddress && emailAddress.length > 0 && emailAddress.indexOf("@") > 0 && this.search && this.search.kb) {
            this.stompClient.send("/ws/ops/email", {},
                JSON.stringify({
                    'messageType': mt_Email,
                    'organisationId': settings.organisationId,
                    'kbList': [{"kbId": this.search.kb.id, "sid": this.search.kb.sid}],
                    'clientId': SemanticSearch.getClientId(),
                    'emailAddress': emailAddress,
                }));
            this.hasResult = false;
            this.knowEmail = true;
            this.refresh();
        }
    }

    sendEmailKey(event) {
        if (event && event.keyCode === 13) {
            this.sendEmail();
        }
    }

    bot_message_list_to_html() {
        return botMessageListToHtmlHelper(this.message_list, this.search.error, this.operatorTyping, this.askForEmailAddress);
    }

    // return true if our messages have a response from SimSage in them
    has_simsage_answer() {
        for (const msg of this.message_list) {
            if (msg && msg.origin === "simsage") {
                return true;
            }
        }
        return false;
    }

    do_ask_bot(text) {
        if (this.is_connected && text.length > 0 && this.search && this.search.kb && !this.isQuerying) {
            this.isQuerying = true;
            this.stompClient.send("/ws/ops/query", {},
                JSON.stringify({
                    'messageType': mt_Message,
                    'organisationId': settings.organisationId,
                    'kbList': [{"kbId": this.search.kb.id, "sid": this.search.kb.sid}],
                    'clientId': SemanticSearch.getClientId(),
                    'semanticSearch': false, // we've got this built in already
                    'query': text,
                    numResults: 1,
                    scoreThreshold: ui_settings.bot_threshold,
                }));
            this.hasResult = false;
            this.askForEmailAddress = false;
            this.message_list.push({"text": text, "origin": "user", "time": new Date()});
            this.refresh();

            // wait a short while before allowing queries again
            setTimeout(() => {
                this.isQuerying = false;
            }, 250);
        }
    }

    // remove html tags using an invisible div
    strip(html) {
        var tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }


}



// timeout for office 365 sessions
const session_timeout_in_mins = 59;

//
// manage a SimSage connection
//
class SimSageCommon {

    constructor() {
        this.was_connected = false; // previous connection state
        this.is_connected = false;    // connected to endpoint?
        this.stompClient = null;      // the connection
        this.ws_base = settings.ws_base;    // endpoint
        // are we busy doing something (communicating with the outside world)
        this.busy = false;
        // error message
        this.error = '';
        this.searching = false;     // was the engine performing a search or other duties?
        this.connection_retry_count = 1;
        // kb information
        this.kb_list = [];
        this.kb = null;
        this.domainId = ''; // the selected domain
        this.is_typing = false; // are we receiving a "typing" message?
        this.typing_last_seen = 0; // last time
        // assigned operator
        this.assignedOperatorId = '';
        this.signed_in = false;
    }

    // do nothing - overwritten
    refresh() {
        console.error('refresh() not overwritten');
    }

    // notify of an is-typing (true/false) event and refresh on state-change
    isTyping(isTyping) {
        const now = SimSageCommon.getSystemTime();
        if (isTyping) {
            this.typing_last_seen = now + 2000;
            if (!this.is_typing) {
                this.is_typing = isTyping;
                this.refresh();
            }
        } else if (this.typing_last_seen < now) {
            this.is_typing = false;
            this.refresh();
        }
    }

    // the user of this search interface is typing
    clientIsTyping() {
        if (this.assignedOperatorId && this.assignedOperatorId.length > 0) {
            const data = {
                fromId: SimSageCommon.getClientId(),
                toId: this.assignedOperatorId,
                isTyping: true
            };
            this.send_message('/ws/ops/typing', data);
        }
    }

    // do nothing - overwritten
    receive_ws_data() {
        console.error('receive_ws_data() not overwritten');
    }

    // close the error dialog - remove any error settings
    close_error() {
        this.error = '';
        this.searching = false;
    }

    // connect to SimSage
    ws_connect() {
        const self = this;
        if (!this.is_connected && this.ws_base) {
            // this is the socket end-point
            const socket = new SockJS(this.ws_base);
            this.stompClient = Stomp.over(socket);
            this.stompClient.connect({},
                function (frame) {
                    self.stompClient.subscribe('/chat/' + SimSageCommon.getClientId(), function (answer) {
                        self.receive_ws_data(JSON.parse(answer.body));
                    });
                    self.set_connected(true);
                },
                (err) => {
                    console.error(err);
                    this.set_connected(false);
                });
        }
    }

    set_connected(is_connected) {
        console.log('is_connected:' + is_connected);
        this.is_connected = is_connected;
        if (!is_connected) {
            if (this.stompClient !== null) {
                this.stompClient.disconnect();
                this.stompClient = null;
            }
            if (this.connection_retry_count > 1) {
                this.error = 'not connected, trying to re-connect, please wait (try ' + this.connection_retry_count + ')';
            }
            setTimeout(this.ws_connect.bind(this), 5000); // try and re-connect as a one-off in 5 seconds
            this.connection_retry_count += 1;

        } else {
            this.was_connected = false;
            this.error = '';
            this.connection_retry_count = 1;
            this.stompClient.debug = null;
        }
        this.refresh();
    }

    send_message(endPoint, data) {
        if (this.is_connected) {
            this.error = '';
            this.stompClient.send(endPoint, {}, JSON.stringify(data));
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    // domain helpers

    // return a list of domains (or empty list) for the selected kb
    getDomainListForCurrentKB() {
        if (this.kb && this.kb.domainList) {
            return this.kb.domainList;
        }
        return [];
    }

    // get the first (and for now the only) AAD domain you can find - or return null
    getAADDomain() {
        if (this.kb && this.kb.domainList) {
            for (const domain of this.kb.domainList) {
                if (domain.domainType === 'aad') {
                    domain.kbId = this.kb.id;
                    return domain;
                }
            }
        }
        return null;
    }

    // setup all AD domains (not AAD)
    setup_domains() {
        const ctrl = document.getElementById("ddDomain");
        let html_str = "";
        const domain_list = this.getDomainListForCurrentKB();
        for (const domain of domain_list) {
            if (domain.domainType === 'ad') {
                html_str += "<option value='" + domain.domainId + "'>" + domain.name + "</option>";
            }
        }
        if (domain_list.length > 0) {
            this.domainId = domain_list[0].domainId;
        }
        ctrl.innerHTML = html_str;
    }

    // get the knowledge-base information for this organisation (set in settings.js)
    getKbs() {
        this.searching = false;  // we're not performing a search
        const self = this;
        const url = settings.base_url + '/knowledgebase/search/info/' + encodeURIComponent(settings.organisationId);

        this.error = '';
        this.busy = true;

        this.refresh(); // notify ui

        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': settings.api_version,
            },
            'type': 'GET',
            'url': url,
            'dataType': 'json',
            'success': function (data) {
                self.kb_list = data.kbList;
                if (self.kb_list.length > 0) {
                    self.kb = self.kb_list[0];
                    self.setup_domains();
                    self.setup_office_365_user();
                }
                self.error = "";
                self.connection_retry_count = 1;
                self.busy = false;
                self.refresh();

                // setup is-typing check
                window.setInterval(() => self.isTyping(false), 1000);
            }

        }).fail(function (err) {
            console.error(JSON.stringify(err));
            if (err && err["readyState"] === 0 && err["status"] === 0) {
                self.error = "Server not responding, not connected.  Trying again in 5 seconds...  [try " + self.connection_retry_count + "]";
                self.connection_retry_count += 1;
                window.setTimeout(() => self.getKbs(), 5000);
            } else {
                self.error = err;
            }
            self.busy = false;
            self.refresh();
        });
    }


    // ask the platform to provide access to an operator now
    getOperatorHelp() {
        this.searching = false;  // we're not performing a search
        const self = this;
        const kb_list = [];
        for (const kb of this.kb_list) {
            if (this.kb && this.kb.id === kb.id) { // filter on selected kb
                kb_list.push({"kbId": kb.id, "sid": kb.sid});
            }
        }
        const data = {
            "organisationId": settings.organisationId,
            "kbList": kb_list,
            "clientId": SimSageCommon.getClientId(),
        };

        this.error = '';
        this.busy = true;
        this.refresh(); // notify ui

        if (this.assignedOperatorId.length === 0) { // call?
            const url = settings.base_url + '/ops/contact/operator';
            jQuery.ajax({
                headers: {
                    'Content-Type': 'application/json',
                    'API-Version': settings.api_version,
                },
                'type': 'POST',
                'data': JSON.stringify(data),
                'url': url,
                'dataType': 'json',
                'success': function (data) {
                    // no organisationId - meaning - no operator available
                    if (!data.organisationId || data.organisationId.length === 0) {
                        self.error = ui_settings.operator_message;
                    } else {
                        self.error = "";
                    }
                    self.busy = false;
                    // set the assigned operator
                    self.assignedOperatorId = data.assignedOperatorId;
                    self.refresh();
                }

            }).fail(function (err) {
                console.error(JSON.stringify(err));
                if (err && err["readyState"] === 0 && err["status"] === 0) {
                    self.error = "Server not responding, not connected.";
                } else {
                    self.error = err;
                }
                self.busy = false;
                self.refresh();
            });
        } else {
            // or disconnect?
            const url = settings.base_url + '/ops/disconnect/operator';
            jQuery.ajax({
                headers: {
                    'Content-Type': 'application/json',
                    'API-Version': settings.api_version,
                },
                'type': 'POST',
                'data': JSON.stringify(data),
                'url': url,
                'dataType': 'json',
                'success': function (data) {
                    self.error = "";
                    self.busy = false;
                    // set the assigned operator
                    self.assignedOperatorId = '';
                    self.refresh();
                }

            }).fail(function (err) {
                console.error(JSON.stringify(err));
                if (err && err["readyState"] === 0 && err["status"] === 0) {
                    self.error = "Server not responding, not connected.";
                } else {
                    self.error = err;
                }
                self.busy = false;
                self.refresh();
            });
        }
    }

    sign_out() {
        this.searching = false;  // we're not performing a search
        this.stompClient.send("/ws/ops/ad/sign-out", {},
            JSON.stringify({
                'organisationId': settings.organisationId,
                'kbList': [{'kbId': this.kb.id, 'sid': this.kb.sid}],
                'clientId': SemanticSearch.getClientId(),
                'domainId': this.domainId,
            }));
        this.error = '';
        this.refresh();
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    // static helpers

    // create a random guid
    static guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    // do we hav access to local-storage?
    static hasLocalStorage(){
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch(e) {
            return false;
        }
    }

    // get or create a session based client id for SimSage usage
    static getClientId() {
        let clientId = "";
        const key = 'simsearch_client_id';
        const hasLs = SimSageCommon.hasLocalStorage();
        if (hasLs) {
            clientId = localStorage.getItem(key);
        }
        if (!clientId || clientId.length === 0) {
            clientId = SimSageCommon.guid(); // create a new client id
            if (hasLs) {
                localStorage.setItem(key, clientId);
            }
        }
        return clientId;
    }

    /**
     * setup the office 365 user if they don't exist yet, and we have a code
     */
    setup_office_365_user() {
        const user = this.getOffice365User(); // do we have an office 365 user object?
        if (!user) { // no?
            const domain = this.getAADDomain(); // make sure we have a domain to go to
            if (domain) {
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');  // do we have a code pending in the URL?
                if (code) {
                    this.searching = false;  // we're not performing a search
                    const url = settings.base_url + '/auth/sign-in/office365';
                    const self = this;
                    const kbList = [];
                    for (const item of this.kb_list) {
                        kbList.push({"kbId": item.id, "sid": item.sid});
                    }
                    // use this code to now sign-in and get the user's details
                    const data = {"code": code, "redirectUrl": encodeURIComponent(domain.redirectUrl),
                                  "clientId": SimSageCommon.getClientId(), "msClientId": domain.clientId,
                                  "organisationId": settings.organisationId, "kbList": kbList
                    };
                    jQuery.ajax({
                        headers: {
                            'Content-Type': 'application/json',
                            'API-Version': '1',
                        },
                        'type': 'POST',
                        'data': JSON.stringify(data),
                        'dataType': "json",
                        "contentType": "application/json",
                        'url': url,
                        'success': function (data) {
                            const signedInUSer = {"name": data.displayName, "email": data.email};
                            self.setOffice365User(signedInUSer);
                            window.location.href = domain.redirectUrl;
                            self.signed_in = true;
                            self.refresh();
                        }
                    }).fail(function (err) {
                        window.location.href = domain.redirectUrl;
                        console.error(err);
                        self.signed_in = false;
                        self.refresh();
                        alert('office 365 sign-in failed');
                    });
                }
            }

        } else {
            // we already have a valid office-365 user - assume we've signed in
            this.signed_in = true;
        }
    }

    // get the existing office 365 user (or null)
    getOffice365User() {
        const key = 'simsearch_office_365_user';
        const hasLs = SimSageCommon.hasLocalStorage();
        if (hasLs) {
            let data = JSON.parse(localStorage.getItem(key));
            const now = new Date().getTime();
            if (data && data.expiry && now < data.expiry) {
                const to = session_timeout_in_mins * 60000;
                data.expiry = now + to; // 1 hour timeout
                this.setOffice365User(data);
                return data;
            } else {
                // expired
                this.removeOffice365User();
            }
        }
        return null;
    }

    // get or create a session based client id for SimSage usage
    setOffice365User(data) {
        const key = 'simsearch_office_365_user';
        const hasLs = SimSageCommon.hasLocalStorage();
        if (hasLs) {
            const to = session_timeout_in_mins * 60000;
            data.expiry = new Date().getTime() + to; // 1 hour timeout
            localStorage.setItem(key, JSON.stringify(data));
        }
    }

    // get or create a session based client id for SimSage usage
    removeOffice365User() {
        const key = 'simsearch_office_365_user';
        const hasLs = SimSageCommon.hasLocalStorage();
        if (hasLs) {
            localStorage.removeItem(key);
        }
    }

    // get a name from a url, either 'link' or 'image'
    static get_url_name(url) {
        if (url && url.length > 0) {
            // image or page?
            const name = url.toLowerCase().trim();
            for (const image_extn of ui_settings.image_types) {
                if (name.endsWith(image_extn)) {
                    return "image";
                }
            }
            return "link";
        }
        return "";
    }

    // clear a session
    static clearClientId() {
        const key = 'simsearch_client_id';
        const hasLs = SimSageCommon.hasLocalStorage();
        if (hasLs) {
            localStorage.removeItem(key);
            this.sign_out();
            return true;
        }
        return false;
    }

    // replace highlight items from SimSage with style items for the UI display
    static highlight(str) {
        let str2 = str.replace(/{hl1:}/g, "<span class='hl1'>");
        str2 = str2.replace(/{hl2:}/g, "<span class='hl2'>");
        str2 = str2.replace(/{hl3:}/g, "<span class='hl3'>");
        str2 = str2.replace(/{:hl1}/g, "</span>");
        str2 = str2.replace(/{:hl2}/g, "</span>");
        str2 = str2.replace(/{:hl3}/g, "</span>");
        return str2;
    }

    // make sure a string doesn't exceed a certain size - otherwise cut it down
    static adjust_size(str) {
        if (str.length > 20) {
            return str.substr(0,10) + "..." + str.substr(str.length - 10);
        }
        return str;
    }

    // join string items in a list together with spaces
    static join(list) {
        let str = '';
        for (const item of list) {
            str += ' ' + item;
        }
        return str.trim();
    }

    // if this is a syn-set and its selections, return those
    static getSynSet(context_item) {
        if (context_item.synSetLemma && context_item.synSetLemma.length > 0 && context_item.synSetCloud) {
            const word = context_item.synSetLemma;
            return {"word": word.toLowerCase().trim(), "clouds": context_item.synSetCloud};
        }
        return null;
    }

    // return the unique list of words in text_str as a list
    static getUniqueWordsAsList(text_str) {
        const parts = text_str.split(" ");
        const newList = [];
        const duplicates = {};
        for (const _part of parts) {
            const part = _part.trim().toLowerCase();
            if (part.length > 0) {
                if (!duplicates.hasOwnProperty(part)) {
                    duplicates[part] = 1;
                    newList.push(_part.trim());
                }
            }
        }
        return newList;
    }

    // get current time in milli-seconds
    static getSystemTime() {
        return new Date().getTime();
    }

}


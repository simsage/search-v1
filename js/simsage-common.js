
// timeout for office 365 sessions
const session_timeout_in_mins = 59;

//
// manage a SimSage connection
//
class SimSageCommon {

    constructor() {
        this.is_connected = false;    // connected to endpoint?
        this.stompClient = null;      // the connection
        this.ws_base = settings.ws_base;    // endpoint

        this.connection_retry_count = 1;
        // kb information
        this.kb_list = [];
        this.kb = null;
        this.sourceId = 0; // the selected domain
        this.is_typing = false; // are we receiving a "typing" message?
        this.typing_last_seen = 0; // last time
        // assigned operator
        this.assignedOperatorId = '';
        this.signed_in = false;

        // conversation list between operator, bots, and the user
        this.chat_list = [];
    }


    // get the knowledge-base information for this organisation (set in settings.js)
    init_simsage() {
        const self = this;
        const url = settings.base_url + '/knowledgebase/search/info/' + encodeURIComponent(settings.organisationId);

        busy(true);

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
                // wordpress override
                if (settings && settings.kbId && settings.kbId.length > 0) {
                    self.kb = {"name": "wordpress knowledge-base", "id": settings.kbId, "sourceList": []};
                    self.on_change_kb(self.kb.id);
                } else if (self.kb_list.length > 0) {
                    self.kb = self.kb_list[0];
                    self.on_change_kb(self.kb.id);
                    show_kb_dropdown();
                }
                error('');
                self.connection_retry_count = 1;
                busy(false);
                // connect to the socket system
                self.connect();
                // setup is-typing check
                window.setInterval(() => self.operator_is_typing(false), 1000);
            }

        }).fail(function (err) {
            if (self.connection_retry_count > 1) {
                error('not connected, trying to re-connect, please wait (try ' + self.connection_retry_count + ')');
            } else {
                error(err);
            }
            setTimeout(() => self.init_simsage(), 5000); // try and re-connect as a one-off in 5 seconds
            self.connection_retry_count += 1;
        });
    }


    // notify that the selected knowledge-base has changed
    on_change_kb(kb_id) {
        const ui_source_list = [];
        for (const kb of this.kb_list) {
            if (kb.id === kb_id) {
                this.kb = kb;
                for (const source of kb.sourceList) {
                    ui_source_list.push({"name": source.name, "id": source.sourceId})
                }
            }
        }
        // setup the drop down boxes in the UI
        setup_dropdowns(this.kb_list, ui_source_list);
        // deal with domains
        this.setup_domains();
        this.setup_office_365_user();
        // setup any potential domains
        this.change_domain();
    }

    // notify of an is-typing (true/false) event state change
    operator_is_typing(isTyping) {
        const now = SimSageCommon.get_system_time();
        if (isTyping) {
            this.typing_last_seen = now + 2000;
            if (!this.is_typing && isTyping) {
                this.is_typing = isTyping;
                update_chat_window(this.chat_list, this.is_typing);
            }
        } else if (this.typing_last_seen < now  && this.is_typing) {
            this.is_typing = false;
            update_chat_window(this.chat_list, this.is_typing);
        }
    }

    // the user of this search interface is typing
    user_is_typing() {
        if (this.assignedOperatorId && this.assignedOperatorId.length > 0) {
            const url = settings.base_url + '/ops/typing';
            const data = {
                fromId: SimSageCommon.get_client_id(),
                toId: this.assignedOperatorId,
                isTyping: true
            };
            jQuery.ajax({
                headers: {
                    'Content-Type': 'application/json',
                    'API-Version': settings.api_version,
                },
                'data': JSON.stringify(data),
                'type': 'POST',
                'url': url,
                'dataType': 'json',
                'success': function (data) {
                    // do nothing
                }

            }).fail(function (err) {
                // do nothing
            });
        }
    }

    // do nothing - overwritten
    receive_ws_data() {
        console.error('receive_ws_data() not overwritten');
    }

    // connect to SimSage, called from init_simsage()
    connect() {
        const self = this;
        if (!this.is_connected && this.ws_base) {
            // this is the socket end-point
            const socket = new SockJS(this.ws_base);
            this.stompClient = Stomp.over(socket);
            this.stompClient.connect({},
                function (frame) {
                    self.stompClient.subscribe('/chat/' + SimSageCommon.get_client_id(), function (answer) {
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
        this.is_connected = is_connected;
        if (!is_connected) {
            if (this.stompClient !== null) {
                this.stompClient.disconnect();
                this.stompClient = null;
            }
            if (this.connection_retry_count > 1) {
                error('not connected, trying to re-connect, please wait (try ' + this.connection_retry_count + ')');
            }
            setTimeout(this.connect.bind(this), 5000); // try and re-connect as a one-off in 5 seconds
            this.connection_retry_count += 1;

        } else {
            error('');
            this.connection_retry_count = 1;
            this.stompClient.debug = null;
            simsage_connected();
        }
    }

    // post a message to the operator end-points
    post_message(endPoint, data) {
        const url = settings.base_url + endPoint;
        const self = this;
        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': settings.api_version,
            },
            'data': JSON.stringify(data),
            'type': 'POST',
            'url': url,
            'dataType': 'json',
            'success': function (data) {
                self.receive_ws_data(data);
            }

        }).fail(function (err) {
            console.error(JSON.stringify(err));
        });
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    // domain helpers

    // return a list of domains (or empty list) for the selected kb
    get_domain_list_for_current_kb() {
        if (this.kb && this.kb.sourceList) {
            const list = [];
            for (const source of this.kb.sourceList) {
                if (source && source.domainType && source.domainType.length > 0) {
                    list.push(source);
                }
            }
            return list;
        }
        return [];
    }

    // get the first (and for now the only) AAD domain you can find - or return null
    get_azure_ad_domain() {
        if (this.kb && this.kb.sourceList) {
            for (const domain of this.kb.sourceList) {
                if (domain.domainType === 'aad') {
                    domain.kbId = this.kb.id;
                    return domain;
                }
            }
        }
        return null;
    }

    // get selected domain - or return null
    get_selected_domain(source_id) {
        if (this.kb && this.kb.sourceList) {
            for (let source of this.kb.sourceList) {
                if (source.sourceId == source_id) {
                    source.kbId = this.kb.id;
                    return source;
                }
            }
        }
        return null;
    }

    // setup all AD domains (not AAD)
    setup_domains() {
        const domain_list = this.get_domain_list_for_current_kb();
        const ui_domain_list = [];
        for (const domain of domain_list) {
            let domainType = "";
            if (domain.domainType === 'ad') {
                domainType = "Active Directory";
            } else if (domain.domainType === 'aad') {
                domainType = "Office 365";
            } else if (domain.domainType === 'simsage') {
                domainType = "SimSage";
            }
            if (domainType.length > 0) {
                ui_domain_list.push({"domain_type": domainType, "name": domain.name, "sourceId": domain.sourceId});
            }
        }
        if (ui_domain_list.length > 0) {
            this.sourceId = ui_domain_list[0].sourceId;
        }
        setup_sign_in(ui_domain_list);
    }

    // user changes the selected domain, return true if this domain requires a redirect authentication
    change_domain() {
        // this.sourceId = ctrl.value;
        // // what type of domain is this?
        // let domainType = "";
        // const domain_list = this.getDomainListForCurrentKB();
        // for (const domain of domain_list) {
        //     if (domain.sourceId == this.sourceId) {
        //         domainType = domain.domainType;
        //         break;
        //     }
        // }
        // const div_email = document.getElementById("divEmail");
        // const div_password = document.getElementById("divPassword");
        // const txt_email = document.getElementById("txtEmail");
        //
        // if (domainType === "aad") { // office365
        //     div_email.style.display = "none";
        //     div_password.style.display = "none";
        // } else {
        //     div_email.style.display = "";
        //     div_password.style.display = "";
        //     if (domainType === "simsage") {
        //         txt_email.placeholder = 'SimSage username';
        //     } else {
        //         txt_email.placeholder = 'Active-Directory username';
        //     }
        //     txt_email.focus();
        // }
    }

    // ask the platform to provide access to an operator now
    ask_operator_for_help() {
        const self = this;
        const kb_list = [];
        for (const kb of this.kb_list) {
            if (this.kb && this.kb.id === kb.id) { // filter on selected kb
                kb_list.push(kb.id);
            }
        }
        const data = {
            "organisationId": settings.organisationId,
            "kbList": kb_list,
            "clientId": SimSageCommon.get_client_id(),
        };

        error('');
        busy(true);

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
                        error(settings.operator_message);
                    } else {
                        error('');
                    }
                    busy(false);
                    // set the assigned operator
                    self.assignedOperatorId = data.assignedOperatorId;
                }

            }).fail(function (err) {
                error(err);
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
                    error('');
                    busy(false);
                    // set the assigned operator
                    self.assignedOperatorId = '';
                }

            }).fail(function (err) {
                error(err);
            });
        }
    }

    // do the actual sign-in
    sign_in(source_id, user_name, password) {
        this.sourceId = source_id; // set local source-id
        const domain = this.get_selected_domain(source_id);
        if (domain && domain.domainType === 'aad') { // azure ad
            const user = this.get_office365_user();
            if (!user) {
                // do we already have the code to sign-in?
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                if (!code) {
                    window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=' +
                        domain.clientId + '&response_type=code&redirect_uri=' +
                        encodeURIComponent(domain.redirectUrl) + '&scope=User.ReadBasic.All+offline_access+openid+profile' +
                        '&state=' + SemanticSearch.get_client_id();
                } else {
                    // login this user, using the code
                    this.setup_office_365_user();
                }
            } else {
                // we have a user - assume the client wants to sign-out
                this.remove_office365_user();
                this.signed_in = false;
                error('');
            }
        } else if (domain && user_name && user_name.length > 0 && password && password.length > 0 && this.kb) {
            busy(true);
            error('');
            const self = this;
            const url = settings.base_url + '/ops/ad/sign-in';
            const adSignInData = {
                'organisationId': settings.organisationId,
                'kbList': [this.kb.id],
                'clientId': SemanticSearch.get_client_id(),
                'sourceId': this.sourceId,
                'userName': user_name,
                'password': password,
            };
            jQuery.ajax({
                headers: {
                    'Content-Type': 'application/json',
                    'API-Version': settings.api_version,
                },
                'data': JSON.stringify(adSignInData),
                'type': 'POST',
                'url': url,
                'dataType': 'json',
                'success': function (data) {
                    busy(false);
                    self.receive_ws_data(data);
                }

            }).fail(function (err) {
                error(err);
            });
        }
    }

    sign_out() {
        error('');
        const self = this;
        busy(true);
        this.remove_office365_user();
        const url = settings.base_url + '/ops/ad/sign-out';
        const signOutData = {
            'organisationId': settings.organisationId,
            'kbList': [this.kb.id],
            'clientId': SemanticSearch.get_client_id(),
            'sourceId': this.sourceId,
        };
        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': settings.api_version,
            },
            'data': JSON.stringify(signOutData),
            'type': 'POST',
            'url': url,
            'dataType': 'json',
            'success': function (data) {
                busy(false);
                self.receive_ws_data(data);
            }

        }).fail(function (err) {
            error(err);
        });
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
    static has_local_storage(){
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
    static get_client_id() {
        let clientId = "";
        const key = 'simsearch_client_id';
        const hasLs = SimSageCommon.has_local_storage();
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
        const user = this.get_office365_user(); // do we have an office 365 user object?
        if (!user) { // no?
            const domain = this.get_azure_ad_domain(); // make sure we have a domain to go to
            if (domain) {
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');  // do we have a code pending in the URL?
                if (code) {
                    const url = settings.base_url + '/auth/sign-in/office365';
                    const self = this;
                    const kbList = [];
                    for (const item of this.kb_list) {
                        kbList.push(item.id);
                    }
                    // use this code to now sign-in and get the user's details
                    const data = {"code": code, "redirectUrl": encodeURIComponent(domain.redirectUrl),
                                  "clientId": SimSageCommon.get_client_id(), "msClientId": domain.clientId,
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
                            self.set_office365_user(signedInUSer);
                            window.location.href = domain.redirectUrl;
                            self.signed_in = true;
                        }
                    }).fail(function (err) {
                        window.location.href = domain.redirectUrl;
                        console.error(err);
                        self.signed_in = false;
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
    get_office365_user() {
        const key = 'simsearch_office_365_user';
        const hasLs = SimSageCommon.has_local_storage();
        if (hasLs) {
            let data = JSON.parse(localStorage.getItem(key));
            const now = SimSageCommon.get_system_time();
            if (data && data.expiry && now < data.expiry) {
                const to = session_timeout_in_mins * 60000;
                data.expiry = now + to; // 1 hour timeout
                this.set_office365_user(data);
                return data;
            } else {
                // expired
                this.remove_office365_user();
            }
        }
        return null;
    }

    // get or create a session based client id for SimSage usage
    set_office365_user(data) {
        const key = 'simsearch_office_365_user';
        const hasLs = SimSageCommon.has_local_storage();
        if (hasLs) {
            const to = session_timeout_in_mins * 60000;
            data.expiry = SimSageCommon.get_system_time() + to; // 1 hour timeout
            localStorage.setItem(key, JSON.stringify(data));
        }
    }

    // get or create a session based client id for SimSage usage
    remove_office365_user() {
        const key = 'simsearch_office_365_user';
        const hasLs = SimSageCommon.has_local_storage();
        if (hasLs) {
            localStorage.removeItem(key);
        }
    }

    // get a name from a url, either 'link' or 'image'
    static get_url_name(url) {
        if (url && url.length > 0) {
            // image or page?
            const name = url.toLowerCase().trim();
            for (const image_extn of settings.image_types) {
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
        const hasLs = SimSageCommon.has_local_storage();
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
    static get_synset(context_item) {
        if (context_item.synSetLemma && context_item.synSetLemma.length > 0 && context_item.synSetCloud) {
            const word = context_item.synSetLemma;
            return {"word": word.toLowerCase().trim(), "clouds": context_item.synSetCloud};
        }
        return null;
    }

    // return the unique list of words in text_str as a list
    static get_unique_words_as_list(text_str) {
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

    // get current time since 1970 in milli-seconds
    static get_system_time() {
        return new Date().getTime();
    }

}


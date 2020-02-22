//
// Semantic Search helper class
//

// ws-response message types
const mt_Disconnect = "disconnect";
const mt_Error = "error";
const mt_Message = "message";
const mt_Email = "email";
const mt_IsTyping = "typing";
const mt_SignIn = "sign-in";
const mt_SignOut = "sign-out";
const mt_SpellingSuggest = "spelling-suggest";

// semantic search class
class SemanticSearch extends SimSageCommon {

    constructor(update_ui) {
        super();
        this.update_ui = update_ui;

        // the current semantic search set
        this.semantic_search_results = [];
        this.semantic_search_result_map = {};

        // pagination for semantic search
        this.page = 0;
        this.num_results = -1;
        this.num_pages = 0;

        this.prev_query = ''; // shard logic: what was asked previously
        this.shard_size_list = [];

        // bot details
        this.bot_text = '';
        this.bot_buttons = [];
        this.bubble_visible = true; // is the bot visible?

        // semantic set (categories on the side from semantic search results)
        this.semantic_set = {};
        this.context_stack = [];            // syn-set management
        this.selected_syn_sets = {};
        this.syn_sets_seen = {};

        // details page
        this.show_details = false;
        this.details_html = '';

        // selected view for semantic search
        this.view = 'lines';

        // advanced filter visibility
        this.has_advanced_selection = false;
        this.show_advanced_search = false;

        // advanced filter settings
        this.fileType = [];
        this.title = [];
        this.url = [];
        this.author = [];
        this.source = null; // selected source

        // the user's current query
        this.search_query = '';

        // do we know this person's email addreess already?
        this.knowEmail = false;

        // sign-in details
        this.show_signin = false;
        this.session_id = '';
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    // perform the semantic search
    do_semantic_search(text) {
        if (this.kb) {
            const url = settings.base_url + '/ops/query';
            const self = this;
            this.error = '';

            text = this.clean_query_text(text);
            const search_query_str = this.semantic_search_query_str(text);
            if (search_query_str !== '()') {
                this.searching = true;  // we're searching!
                this.search_query = text;
                this.show_advanced_search = false;
                this.busy = true;
                let source_id = '';
                if (this.source !== null) {
                    source_id = this.source.sourceId;
                }

                const clientQuery = {
                    'organisationId': settings.organisationId,
                    'kbList': [{'kbId': this.kb.id, 'sid': this.kb.sid}],
                    'clientId': SemanticSearch.getClientId(),
                    'semanticSearch': true,     // always a search
                    'query': search_query_str,  // search query
                    'queryText': text,          // raw text
                    'numResults': 1,              // bot results
                    'scoreThreshold': ui_settings.bot_threshold,
                    'page': this.page,
                    'pageSize': ui_settings.page_size,
                    'shardSizeList': this.shard_size_list,
                    'fragmentCount': ui_settings.fragment_count,
                    'maxWordDistance': ui_settings.max_word_distance,
                    'searchThreshold': ui_settings.score_threshold,
                    'spellingSuggest': ui_settings.use_spelling_suggest,
                    'sourceId': source_id,
                };

                jQuery.ajax({
                    headers: {
                        'Content-Type': 'application/json',
                        'API-Version': ui_settings.api_version,
                    },
                    'data': JSON.stringify(clientQuery),
                    'type': 'POST',
                    'url': url,
                    'dataType': 'json',
                    'success': function (data) {
                        self.receive_ws_data(data);
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

                this.refresh();

            } else {
                this.error = "Please enter a query to start searching.";
                this.refresh();
            }
        } else {
            this.refresh();
        }
    }

    // overwrite: call refresh ui
    refresh() {
        if (this.update_ui) {
            this.update_ui(this);
        }
    }

    // correct the spelling
    correct_spelling(text) {
        document.getElementById("txtSearch").value = text;
        this.bot_text = '';
        this.bot_buttons = [];
        this.do_semantic_search(text);
    }

    close_bot_window() {
        this.bot_text = '';
        this.bot_buttons = [];
        this.refresh();
    }

    visit(url) {
        if (url && url.length > 0) {
            window.open(url, '_blank');
        }
    }

    // get a name from a url
    get_url_name(url) {
        if (url && url.length > 0) {
            const i1 = url.lastIndexOf('/');
            if (i1 > 0) {
                const name = url.substring(i1 + 1).trim();
                if (name.length === 0) {
                    const strip_list = ["http://www.", "https://www.", "http://", "https://"];
                    for (const strip of strip_list) {
                        if (url.startsWith(strip)) {
                            const subName = url.substring(strip.length);
                            const i2 = subName.indexOf('.');
                            if (i2 > 0) {
                                return subName.substring(0, i2);
                            }
                            return name;
                        }
                    }
                    return name;
                }
                const i2 = name.indexOf('.');
                if (i2 > 0) {
                    return name.substring(0, i2);
                }
                return name;
            }
        }
        return url;
    }

    // overwrite: generic web socket receiver
    receive_ws_data(data) {
        this.busy = false;
        if (data) {
            if (data.messageType === mt_Error && data.error.length > 0) {
                this.searching = false;
                this.error = data.error;  // set an error
                this.refresh();

            } else if (data.messageType === mt_Disconnect) {
                this.searching = false;
                this.assignedOperatorId = ''; // disconnect any operator
                this.refresh();

            } else if (data.messageType === mt_SignIn) {
                this.searching = false;
                if (data.errorMessage && data.errorMessage.length > 0) {
                    this.error = data.errorMessage;  // set an error
                    this.signed_in = false;
                } else {
                    // sign-in successful
                    this.signed_in = true;
                    this.close_sign_in();
                }
                this.refresh();

            } else if (data.messageType === mt_IsTyping) {
                this.isTyping(data.fromIsTyping);

            } else if (data.messageType === mt_SpellingSuggest) {
                // speech bubble popup with actions
                this.searching = false;
                this.bot_text = "Did you mean: " + data.text;
                this.bot_buttons = [];
                this.bot_buttons.push({text: "yes", action: 'search.correct_spelling("' + data.text + '");'});
                this.bot_buttons.push({text: "no", action: 'search.close_bot_window();'});
                this.refresh();


            } else if (data.messageType === mt_SignOut) {

                this.searching = false;
                if (data.errorMessage && data.errorMessage.length > 0) {
                    this.error = data.errorMessage;  // set an error
                } else {
                    // sign-in successful
                    this.show_signin = false;
                    this.signed_in = false;
                    this.close_sign_in();
                }
                this.refresh();

            } else if (data.messageType === mt_Message) {

                const self = this;
                this.bot_text = '';
                this.is_typing = false;
                this.semantic_search_results = [];
                this.semantic_search_result_map = {};
                this.semantic_set = {};
                this.context_stack = []; // includes syn_sets of selected_syn_sets
                this.bot_buttons = [];
                // set the assigned operator
                this.assignedOperatorId = data.assignedOperatorId;
                if (this.assignedOperatorId == null) { // compatibility with older versions of SimSage
                    this.assignedOperatorId = '';
                }

                // did we get semantic search results?
                if (data.resultList) {

                    this.shard_size_list = data.shardSizeList;
                    this.semantic_set = data.semanticSet;
                    this.context_stack = data.contextStack;
                    data.resultList.map(function (sr) {

                        if (!sr.botResult) {
                            // enhance search result for display
                            sr['index'] = 0;  // inner offset index
                            sr['num_results'] = sr.textList.length;
                            self.semantic_search_results.push(sr);  // add item
                            self.semantic_search_result_map[sr.url] = sr;
                        }

                    });
                    this.busy = false;
                    this.num_results = data.totalDocumentCount;
                    const divided = data.totalDocumentCount / ui_settings.page_size;
                    self.num_pages = parseInt(divided);
                    if (parseInt(divided) < divided) {
                        self.num_pages += 1;
                    }
                }

                // bot result?
                if (data.hasResult && data.text && data.text.length > 0) {
                    this.bot_text = data.text;
                    if (data.urlList && data.urlList.length > 0) {
                        for (const url of data.urlList) {
                            if (url.trim().length > 0) {
                                for (const sub_url of url.split(' ')) {
                                    const url_name = this.get_url_name(sub_url);
                                    this.bot_buttons.push({
                                        text: url_name,
                                        action: 'search.visit("' + sub_url + '");'
                                    });
                                }
                            }
                        }
                    }
                } else {
                    // no bot results - can we ask about a syn-set not yet seen / selected?
                    if (Array.isArray(this.context_stack)) {
                        for (const context_item of this.context_stack) {
                            const syn_set = SimSageCommon.getSynSet(context_item);
                            const search_words = {};
                            const search_word_list = SimSageCommon.getUniqueWordsAsList(this.search_query);
                            for (const search_word of search_word_list) {
                                search_words[search_word.toLowerCase()] = 1;
                            }
                            if (syn_set) {
                                const word = syn_set["word"];
                                const clouds = syn_set["clouds"];
                                if (!this.syn_sets_seen[word] && clouds.length > 1 && search_words[word]) {
                                    // add a question for the bot
                                    this.bot_text = "What type of <b>" + word + "</b> are you looking for?";
                                    this.bot_buttons = [];
                                    for (const i in clouds) {
                                        if (clouds.hasOwnProperty(i)) {
                                            this.bot_buttons.push({
                                                text: clouds[i],
                                                action: 'search.select_syn_set("' + word + '", ' + i + ');'
                                            });
                                        }
                                    }
                                    this.bot_buttons.push({
                                        text: "all",
                                        action: 'search.select_syn_set("' + word + '", -1);'
                                    });
                                    break;
                                }
                            }
                        }
                    }
                }

                // copy the know email flag from our results
                if (!this.knowEmail && data.knowEmail) {
                    this.knowEmail = data.knowEmail;
                }

                this.refresh();
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    // switch to text view in search ui
    text_view() {
        this.view = 'lines';
        this.refresh();
    }

    // switch to image view in search ui
    image_view() {
        this.view = 'images';
        this.refresh();
    }


    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // no results render system and its email handler

    no_results() {
        return render_no_results(ui_settings.ask_email, this.knowEmail);
    }

    send_email() {
        let emailAddress = document.getElementById("email").value;
        if (emailAddress && emailAddress.length > 0 && emailAddress.indexOf("@") > 0) {
            this.searching = false;  // we're not performing a search
            this.stompClient.send("/ws/ops/email", {},
                JSON.stringify({
                    'messageType': mt_Email,
                    'organisationId': settings.organisationId,
                    'kbList': [{'kbId': this.kb.id, 'sid': this.kb.sid}],
                    'clientId': SemanticSearch.getClientId(),
                    'emailAddress': emailAddress,
                }));
            this.error = '';
            this.knowEmail = true;
            this.refresh();
        }
    }

    // key handling for the email popup control inside the bot window
    email_keypress(event) {
        if (event && event.keyCode === 13) {
            this.send_email();
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // sign in system

    // do the actual sign-in
    sign_in(user_name, password) {
        if (user_name && user_name.length > 0 && password && password.length > 0 && this.kb) {
            this.searching = false;  // we're not performing a search
            this.stompClient.send("/ws/ops/ad/sign-in", {},
                JSON.stringify({
                    'organisationId': settings.organisationId,
                    'kbList': [{'kbId': this.kb.id, 'sid': this.kb.sid}],
                    'clientId': SemanticSearch.getClientId(),
                    'domainId': this.domainId,
                    'userName': user_name,
                    'password': password,
                }));
            this.error = '';
            this.refresh();
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

    // sign-in or out
    show_sign_in() {
        this.searching = false;  // we're not performing a search
        const office365Domain = this.getAADDomain();
        if (office365Domain) {
            const user = SimSageCommon.getOffice365User();
            if (!user) {
                // do we already have the code to sign-in?
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                if (!code) {
                    window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=' +
                        office365Domain.clientId + '&response_type=code&redirect_uri=' +
                        encodeURIComponent(office365Domain.redirectUrl) + '&scope=User.ReadBasic.All+offline_access+openid+profile' +
                        '&state=' + SemanticSearch.getClientId();
                } else {
                    // login this user, using the code
                    this.setup_office_365_user();
                }
            } else {
                // we have a user - assume the client wants to sign-out
                SimSageCommon.removeOffice365User();
                this.signed_in = false;
                this.error = '';
                this.refresh();
            }

        } else {
            if (this.session_id === '') {
                this.show_signin = true;
            } else {
                // do a sign-out
                this.show_signin = false;
                this.session_id = '';
            }
            this.refresh();
        }
    }

    close_sign_in() {
        this.searching = false;  // we're not performing a search
        this.show_signin = false;
        this.refresh();
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // bot display

    // hide the bot response
    hide_speech_bubble() {
        this.searching = false;  // we're not performing a search
        this.bubble_visible = false;
        this.refresh();
    }


    // visit the previous text snippet of a single search result
    doInnerPrev(url) {
        const sr = this.semantic_search_result_map[url];
        if (sr && sr.index > 0) {
            sr.index -= 1;
            if (sr.index === 0)
                sr.message = '\n' + sr.response;
            else
                sr.message = '\n' + sr.textList[sr.index - 1];
            this.refresh();
        }
    }

    // visit the next text snippet of a single search result
    doInnerNext(url) {
        const sr = this.semantic_search_result_map[url];
        if (sr && sr.index + 1 < sr.num_results) {
            sr.index += 1;
            sr.message = '\n' + sr.textList[sr.index - 1];
            this.refresh();
        }
    }

    // pagination - previous page set
    prevPage() {
        if (this.page > 0) {
            this.page -= 1;
            this.do_semantic_search(this.search_query);
        }
    }

    // pagination - next page set
    nextPage() {
        if ((this.page + 1) < this.num_pages) {
            this.page += 1;
            this.do_semantic_search(this.search_query);
        }
    }

    // reset the variables used in determining pagination if the query has changed
    reset_pagination() {
        if (this.search_query !== this.prev_query) {
            this.prev_query = this.search_query;
            this.page = 0;  // reset to page 0
            this.shard_size_list = [];
        }
        this.bot_url = '';
        this.bot_text = '';
        this.bubble_visible = true;
        this.semantic_search_results = [];
    }

    // remove duplicate strings from body search text and add synset items
    process_body_string(text) {
        const parts = SimSageCommon.getUniqueWordsAsList(text);
        const newList = [];
        for (const _part of parts) {
            const part = _part.trim().toLowerCase();
            const synSet = this.selected_syn_sets[part];
            if (typeof synSet !== 'undefined' && parseInt(synSet) >= 0) {
                newList.push(_part.trim() + '/' + synSet);
            } else {
                newList.push(_part.trim());
            }
        }
        return newList.join(" ");
    }

    // clean text - remove characters we use for special purposes
    clean_query_text(text) {
        // remove any / : ( ) characters from text first
        text = text.replace(/\//g, ' ');
        text = text.replace(/\)/g, ' ');
        text = text.replace(/\(/g, ' ');
        return text.replace(/:/g, ' ');
    }

    // get a semantic search query string for all the filters etc.
    semantic_search_query_str(text) {
        let query = "(";
        let needsAnd = false;
        if (text.length > 0) {
            query += "body: " + this.process_body_string(text);
            needsAnd = true;
        }
        if (this.url.length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in this.url) {
                if (i > 0) {
                    query += " and "
                }
                query += "url: " + this.url[i];
            }
            query += ") "
        }
        if (this.title.length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in this.title) {
                if (i > 0) {
                    query += " and "
                }
                query += "title: " + this.title[i];
            }
            query += ") "
        }
        if (this.author.length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in this.author) {
                if (i > 0) {
                    query += " and "
                }
                query += "author: " + this.author[i];
            }
            query += ") "
        }
        if (this.fileType.length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in this.fileType) {
                if (i > 0) {
                    query += " or "
                }
                query += "type: " + this.fileType[i];
            }
            query += ") "
        }
        query += ")";
        return query;
    }

    /////////////////////////////////////////////////////////////////////////////////////////

    // select a semantic category item and modify the query string accordingly
    select_semantic(semantic_item, search_text_id) {
        const search_ctrl = document.getElementById(search_text_id);
        let text_list = search_ctrl.value.split(' ');
        let found = false;
        for (const item of text_list) {
            if (item.toLowerCase() === semantic_item.toLowerCase()) {
                found = true;
            }
        }
        // reconstruct the input
        const new_text_list = [];
        if (found) {
            // remove it
            for (const item of text_list) {
                if (item.toLowerCase() !== semantic_item.toLowerCase()) {
                    new_text_list.push(item);
                }
            }
        } else {
            // copy old list and add new item
            for (const item of text_list) {
                new_text_list.push(item);
            }
            new_text_list.push(semantic_item);
        }
        search_ctrl.value = SemanticSearch.join(new_text_list);
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    // syn-set context management

    // select a syn-set
    select_syn_set(word, value) {
        this.selected_syn_sets[word.toLowerCase().trim()] = value;
        this.syn_sets_seen[word.toLowerCase().trim()] = 1; // mark it as 'seen' and done
        this.bot_text = "";
        this.bot_buttons = [];
        this.do_semantic_search(this.search_query);
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    // advanced search filter get and controllers

    // get the html for the search results neatly drawn out for the UI
    get_semantic_search_html() {
        const num_results = this.semantic_search_results.length;
        if (num_results > 0 && this.kb && this.kb.id) {
            const organisation_id = settings.organisationId;
            const kb_id = this.kb.id;
            let list = this.semantic_search_results.slice(); // copy
            let html_list = [];
            if (this.view === 'lines') {
                html_list.push(render_rhs_containers(this.context_stack, this.selected_syn_sets, this.semantic_set));
                const base_url = settings.base_url;
                list.map(function (h) {
                    const text = SemanticSearch.highlight(h.textList[h.index]);
                    html_list.push(render_result(organisation_id, kb_id, h.index, h.title, h.author, h.url, h.urlId,
                                              h.num_results, text, base_url));
                });

            } else if (this.view === 'images') {
                html_list.push(render_rhs_containers(this.context_stack, this.selected_syn_sets, this.semantic_set));
                const base_url = settings.base_url;
                list.map(function (h) {
                    const text = SemanticSearch.highlight(h.textList[h.index]);
                    html_list.push(render_result_images(organisation_id, kb_id, h.index, h.title, h.author, h.url, h.urlId,
                                                     h.num_results, text, base_url));
                });
            }
            html_list.push(render_pagination(this.page, this.num_pages, this.busy, this.num_results));
            html_list.push('</div>');
            return html_list.join('\n');
        }
        return "";
    }

    // do we have any results to display?
    get_has_results() {
        const num_results = this.semantic_search_results.length;
        return (this.kb && this.kb.id && (num_results > 0 || this.bot_text.length > 0));
    }

    // show advanced filter menu
    toggle_advanced_search() {
        this.show_advanced_search = !this.show_advanced_search;
        this.refresh();
    }

    // hide advanced filter menu
    hide_advanced_search() {
        this.show_advanced_search = false;
        this.refresh();
    }

    // get the knowledge base options for the advanced filter ui
    kbOptions() {
        let str = "";
        for (const kb of this.kb_list) {
            str += "<option value='" + kb.id + "'>" + kb.name + "</option>";
        }
        return str;
    }

    // get the source options for the advanced filter ui
    sourceOptions() {
        let str = "<option value=''>any</option>";
        if (this.kb !== null && this.kb.sourceList) {
            for (const source of this.kb.sourceList) {
                str += "<option value='" + source.sourceId + "'>" + source.name + "</option>";
            }
        }
        return str;
    }

    // select a knowledge-base item through the advanced filter ui
    set_kb(id) {
        this.kb = null;
        if (id) {
            for (const kb of this.kb_list) {
                if (kb.id === id) {
                    this.kb = kb;
                    break;
                }
            }
            this.setup_domains(); // change in domains
        }
    }

    // select a source item through the advanced filter ui
    set_source(id) {
        this.source = null;
        if (id && this.kb && this.kb.sourceList) {
            for (const source of this.kb.sourceList) {
                if (source.sourceId == id) {
                    this.source = source;
                    break;
                }
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    // details dialog box

    // show the details page on screen
    showDetails(url_id, url) {
        const num_results = this.semantic_search_results.length;
        const organisation_id = settings.organisationId;
        const kb_id = this.kb.id;
        const base_url = settings.base_url;
        const document = this.semantic_search_result_map[url];
        const text = SemanticSearch.highlight(document.textList[document.index]);
        this.details_html = render_details(base_url, organisation_id, kb_id, url_id, document, text, this.search_query);
        this.show_details = true;
        this.refresh();
    }

    // close the details page on screen
    closeDetails() {
        this.details_html = '';
        this.show_details = false;
        this.refresh();
    }

}

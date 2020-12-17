// image base for wp
image_base = '';

// the search bar at the top
let search_control = {

    // ws-response message types
    mt_Disconnect: "disconnect",
    mt_Error: "error",
    mt_Message: "message",
    mt_Email: "email",
    mt_IsTyping: "typing",
    mt_SignIn: "sign-in",
    mt_SignOut: "sign-out",
    mt_OperatorAvailable: "operator-available",
    mt_OperatorChat: "operator-chat",
    mt_OperatorMessage: "operator-message",

    kb_list: [],        // list of knowledge-bases
    kb: null,           // the selected knowledge-base
    source_list: [],    // list of sources
    source: null,       // the selected source

    is_busy: false,     // is the system busy?

    connection_retry_count: 1,  // retry-count for any errors and need to connect

    assigned_operator_id: "",   // the id of an assigned operator
    client_typing_last_seen: 0, // timer for typing
    typing_timeout: 1500,       // typing animation timeout in ms
    typing_repeat_timeout: 750, // don't send too many is-typing requests to the server
    operator_count: 0,          // how many operators available
    chat_list: [],              // list of chat messages

    is_custom_render: false,        // is this a custom render display?
    filters_visible: false,         // are the filters visible

    semantic_search_results: [],    // semantic search results
    semantic_search_result_map: {}, // url => semantic_search_result
    semantic_search_result_map_id: {}, // urlId => semantic_search_result

    // single instance
    instantiate() {
        // add other modules
        jQuery.extend(this, common_functions);
        jQuery.extend(this, search_options_control);
        jQuery.extend(this, no_results);
        jQuery.extend(this, search_details);
        jQuery.extend(this, sign_in_control);
        jQuery.extend(this, spelling_control);
        jQuery.extend(this, search_bot);
        jQuery.extend(this, pagination_control);
        jQuery.extend(this, chat_control);
        jQuery.extend(this, search_results_control);
        jQuery.extend(this, domain_control);
        return this;
    },

    // clear the search text and filters
    clear_search: function() {
        jQuery(".search-text").val("");
        this.clear_all();
        if (this.is_custom_render) {
            this.do_search();
        } else {
            this.clear_search_results();
            this.reset_pagination("");
            this.render_pagination();
        }
    },

    // perform a search
    do_search: function() {
        let self = this;
        let text = jQuery(".search-text").val();
        if (this.kb && (this.is_custom_render || text.trim() !== '')) {
            // do we need to reset the pagination?
            this.reset_pagination(text);
            // create the query and clear the errors
            this.error('');
            text = cleanup_query_text(text);
            let search_query_str = super_search_query_str(text, this.get_search_options_data(), this.is_custom_render);
            // console.log(search_query_str);
            if (search_query_str !== '()') {
                search.search_query = text;
                this.busy(true);
                let sourceId = "";
                if (this.source && this.source.id) {
                    sourceId = this.source.id;
                }
                let clientQuery = {
                    'organisationId': settings.organisationId,
                    'kbList': [this.kb.id],
                    'clientId': this.get_client_id(),
                    'semanticSearch': true,     // always a search
                    'query': search_query_str,  // search query
                    'queryText': text,          // raw text
                    'numResults': 1,              // bot results
                    'scoreThreshold': settings.bot_threshold,
                    'page': this.page,
                    'pageSize': this.page_size,
                    'shardSizeList': this.shard_size_list,
                    'fragmentCount': settings.fragment_count,
                    'maxWordDistance': settings.max_word_distance,
                    'spellingSuggest': settings.use_spelling_suggest,
                    'contextLabel': settings.context_label,
                    'contextMatchBoost': settings.context_match_boost,
                    'sourceId': sourceId,
                };
                this.post_message('/api/ops/query', clientQuery, function(data) {
                    self.receive_search_results(data);
                });

            } else if (!this.is_custom_render) {
                this.error("Please enter a query to start searching.");
            } else {
                console.debug('is_custom_render: empty query');
            }

        } else if (!this.kb) {
            this.error("Server not responding, not connected.");

        } else if (!this.is_custom_render && text.trim() === '') {
            this.render_pagination();
        }
    },

    // process a SimSage search result
    receive_search_results: function(data) {
        let self = this;
        if (data.messageType === this.mt_Message) {
            this.is_typing = false;
            this.semantic_search_results = [];
            this.semantic_search_result_map = {};
            this.semantic_search_result_map_id = {};
            this.spelling_suggestion = data.spellingCorrection; // set spelling suggestion if we have one

            // set the assigned operator
            if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                this.assigned_operator_id = data.assignedOperatorId;
                if (data.operatorName) {
                    this.operator_name = data.operatorName;
                } else {
                    this.operator_name = '';
                }
            }

            // did we get semantic search results?
            if (data.resultList) {
                this.shard_size_list = data.shardSizeList;
                set_display_categories(data.semanticSet);
                set_syn_sets(data.contextStack);
                data.resultList.map(function (sr) {
                    if (!sr.botResult) {
                        // enhance search result for display
                        if (sr.textIndex >= 0 && sr.textIndex < sr.textList.length) {
                            sr['index'] = sr.textIndex;  // inner offset index
                        } else {
                            sr['index'] = 0;  // inner offset index
                        }
                        sr['num_results'] = sr.textList.length;
                        self.semantic_search_results.push(sr);  // add item
                        self.semantic_search_result_map[sr.url] = sr;
                        self.semantic_search_result_map_id[sr.urlId] = sr;
                    }
                });
                this.num_results = data.totalDocumentCount;
                let divided = data.totalDocumentCount / this.page_size;
                this.num_pages = parseInt("" + divided);
                if (parseInt("" + divided) < divided) {
                    this.num_pages += 1;
                }
            }

            // did we get an bot reply?
            let dt = this.unix_time_convert(new Date().getTime());
            if (data.hasResult && data.text && data.text.length > 0) {
                // setup the bot
                this.show_bot(data.text, data.urlList);
            }

            // copy the know email flag from our results
            if (!this.know_email && data.knowEmail) {
                this.know_email = data.knowEmail;
            }

            // no results?
            if (!data.hasResult) {
                // hide
                this.hide_search_results();
                // did we get assigned an operator?
                if (this.assigned_operator_id && this.assigned_operator_id.length > 0) {
                    let text = this.operator_name ? "you are chatting with " + this.operator_name :
                        "you are chatting with an Operator"
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: text
                    });
                    this.update_chat_window();
                    this.show_chat_button(true, this.chat_list.length > 0);
                    this.show_chat();

                } else if (!this.is_custom_render) {
                    // don't show no-search results for a custom render
                    this.show_no_search_results();
                }

            } else if (this.semantic_search_results && this.semantic_search_results.length > 0) {
                // hide if no actual results
                this.render_search_results();
                this.show_search_results();
            }
        } // if message-type is right
    },

    search_typing: function(event) {
        if (event.keyCode === 13) {
            this.do_search();
        }
    },

    busy: function(is_busy) {
        this.is_busy = is_busy;
    },

    on_change_kb: function (kb_id) {
        if (kb_id === undefined) {
            kb_id = jQuery(".dd-knowledge-base").val();
        }
        this.source_list = [];
        this.is_custom_render = false;
        for (let i in this.kb_list) {
            if (this.kb_list.hasOwnProperty(i)) {
                let kb = this.kb_list[i];
                if (kb.id == kb_id) {
                    this.kb = kb;
                    for (let j in kb.sourceList) {
                        if (kb.sourceList.hasOwnProperty(j)) {
                            let source = kb.sourceList[j];
                            this.source_list.push({"name": source.name, "id": source.sourceId, "category_list": source.categoryList});
                        }
                    }
                    // select a default source if there is only one
                    if (this.source_list.length === 1) {
                        this.on_change_source(this.source_list[0].id);
                    }
                }
            }
        }
        // setup the drop down boxes in the UI
        this.setup_dropdowns();
        // deal with domains
        this.setup_domains();
        this.setup_office_365_user();
        // setup any potential domains
        this.change_domain(null);
        if (this.kb_list.length > 1)
            jQuery(".knowledge-base-selector").show();
        else
            jQuery(".knowledge-base-selector").hide();
    },

    // change source by id
    on_change_source: function(source_id) {
        // make sure we have a valid source-id
        if (source_id === undefined) {
            source_id = jQuery(".dd-source").val();
        }
        this.source = null;
        this.is_custom_render = false;
        simsage_sort_list = [];
        simsage_control_list = [];
        for (let i in this.source_list) {
            if (this.source_list.hasOwnProperty(i)) {
                let source = this.source_list[i];
                if (source.id == source_id) {
                    this.source = source;
                    // force display of filters if db system
                    if (source.category_list && source.category_list.length > 0) {
                        this.filters_visible = true;
                        this.is_custom_render = true;
                        this.page_size = settings.page_size_custom;
                        setup_controls(source.category_list);  // our special controller
                        this.show_pagination(); // needed for sorting etc.
                    }
                } // if is correct source
            }
        }
        // setup the drop down boxes in the UI
        this.setup_dropdowns();
        // deal with domains
        this.setup_domains();
        this.setup_office_365_user();
        // setup any potential domains
        this.change_domain(null);
        if (!this.is_custom_render) {
            this.hide_search_results(); // hide otherwise
        } else {
            this.do_search();
        }
        this.render_pagination();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// control taking care of the search options on screen (advanced search menu)
//
let search_options_control = {
    visible: settings.show_advanced_filter, // is the menu visible at all?
    menu_visible: false, // is the attached menu showing?
    open: false,  // is the menu open or closed?

    // single instance, setup with a set of knowledge-bases
    setup_search_options() {
        if (!this.visible) {
            jQuery(".search-options-button").hide();
        } else {
            jQuery(".search-options-button").show();
        }
        jQuery(".filter-box-view").hide();
    },

    // perform the initial startup setup
    init: function() {
        let self = this;
        console.log("simsage init");
        this.setup_search_options();
        this.setup_dropdowns();
        this.render_pagination();
        // setup a polyfill for IE 11 functions we use
        this.ie11_polyfill();
        // set a placeholder?
        if (settings && settings.search_placeholder && settings.search_placeholder.length > 0) {
            jQuery(".search-text").attr("placeholder", settings.search_placeholder);
        }

        // monitor the ESC key to close dialog boxes
        jQuery(document).on('keydown', function(event) {
            if (event.key === "Escape" || event.key === "Esc") {
                const err_ctrl = jQuery(".error-dialog-box");
                if (err_ctrl.is(":visible")) {
                    err_ctrl.hide();
                } else {
                    search.close_chat();
                    search.close_search_details();
                    search.hide_menu();
                    search.close_sign_in();
                    search.close_no_search_results();
                    search.close_bot();
                }
            }
        });

        let url = '/api/knowledgebase/search/info/' + encodeURIComponent(settings.organisationId) + '/' + encodeURIComponent(this.get_client_id());
        this.get_message(url, function(data) {
            self.kb_list = data.kbList;
            self.operator_count = data.operatorCount;
            // get any previously assigned operator on refresh
            self.assigned_operator_id = '';
            if (data.assignedOperatorId) {
                self.assigned_operator_id = data.assignedOperatorId;
            }
            self.operator_name = '';
            if (data.operatorName) {
                self.operator_name = data.operatorName;
            }
            self.show_chat_button(settings.operator_enabled && (self.operator_count > 0 || (self.assigned_operator_id && self.assigned_operator_id.length > 0)),
                self.chat_list.length > 0);
            // wordpress override
            if (settings && settings.kbId && settings.kbId.length > 0) {
                self.kb = {"name": "wordpress knowledge-base", "id": settings.kbId, "sourceList": []};
                self.on_change_kb(this.kb.id);
            } else if (self.kb_list.length > 0) {
                self.kb = self.kb_list[0];
                self.on_change_kb(self.kb.id);
            }
            self.error('');
            self.connection_retry_count = 1;
            self.busy(false);
            if (settings.operator_enabled) {
                // connect to the socket system
                self.connect_ws();
                // setup is-typing check
                window.setInterval(function () {
                    self.operator_was_typing(false)
                }, 1000);
            }
        }, function(err) {
            console.log(err);
            if (self.connection_retry_count > 1) {
                self.error('not connected, trying to re-connect, please wait (try ' + self.connection_retry_count + ')');
            } else {
                self.error(err);
            }
            setTimeout(function() { self.init() }, 5000); // try and re-connect as a one-off in 5 seconds
            self.connection_retry_count += 1;
        });
    },

    // return the search metadata based on the selections
    get_search_options_data: function() {
        return {
            "document_type": jQuery('label.document-type-sel select').val().split(','),
            "kb": jQuery('label.knowledge-base-sel select').val(),
            "title": [jQuery('.title-text').val()],
            "url": [jQuery('.url-text').val()],
            "author": [jQuery('.author-text').val()],
        };
    },

    reset_document_type: function() {
        jQuery('label.document-type-sel select').val("");
    },

    clear_all: function() {
        this.reset_document_type();
        jQuery(".title-text").val("");
        jQuery(".url-text").val("");
        jQuery(".author-text").val("");
    },

    toggle_menu: function() {
        this.menu_visible = !this.menu_visible;
        if (this.menu_visible) {
            jQuery(".filter-box-view").show();
        } else {
            jQuery(".filter-box-view").hide();
        }
    },

    // setup the advanced menu drop-down lists
    setup_dropdowns: function() {
        this.setup_kb_list();
        this.set_source_list();
    },

    // render and set a kb list {"name": ..., "id": ....}
    setup_kb_list: function() {
        let str = "";
        if (this.kb_list && this.kb_list.length > 0) {
            for (let i in this.kb_list) {
                if (this.kb_list.hasOwnProperty(i)) {
                    let kb = this.kb_list[i];
                    if (kb && this.kb && kb.id === this.kb.id) {
                        str += "<option value=\"" + this.esc_html(kb.id) + "\" selected>" + this.esc_html(kb.name) + "</option>";
                    } else {
                        str += "<option value=\"" + this.esc_html(kb.id) + "\">" + this.esc_html(kb.name) + "</option>";
                    }
                }
            }
        }
        jQuery(".dd-knowledge-base").html(str);
    },

    // render and set the contents of the source drop-down list {"name": ..., "id": ...}
    set_source_list: function() {
        let str = "<option value=\"\">All Sources</option>";
        if (this.source_list && this.source_list.length > 0) {
            for (let i in this.source_list) {
                if (this.source_list.hasOwnProperty(i)) {
                    let source = this.source_list[i];
                    if (this.source && source && this.source.id === source.id) {
                        str += "<option value=\"" + this.esc_html(source.id) + "\" selected>" + this.esc_html(source.name) + "</option>";
                    } else {
                        str += "<option value=\"" + this.esc_html(source.id) + "\">" + this.esc_html(source.name) + "</option>";
                    }
                }
            }
        }
        jQuery(".dd-source").html(str);
    },

    hide_menu: function(event) {
        if (event) {
            event.stopPropagation();
        }
        this.menu_visible = false;
        jQuery(".filter-box-view").hide();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the no-results handling
//
let no_results = {

    know_email: false,

    // single instance
    instantiate() {
        jQuery.extend(this, common_functions);
        return this;
    },
    email_typing: function(event) {
        if (event.keyCode === 13) {
            do_email();
        }
    },
    // user asks for help
    do_email: function() {
        let self = this;
        let email_address = jQuery(".email-text").val();
        if (email_address && this.validate_email(email_address.trim())) {
            this.error('');
            let emailMessage = {
                'messageType': this.mt_Email,
                'organisationId': settings.organisationId,
                'kbList': [this.get_kb_id()],
                'clientId': this.get_client_id(),
                'emailAddress': email_address,
            };
            this.post_message('/api/ops/email', emailMessage, function(data) {
                self.receive_ws_data(data);
            });
        } else {
            this.error("invalid email address");
        }
    },

    show_no_search_results: function() {
        jQuery(".no-search-results").show();
        if (this.know_email) {
            jQuery(".ask-email-box").hide();
            jQuery(".ask-emailed-box").show();
        } else {
            jQuery(".ask-email-box").show();
            jQuery(".ask-emailed-box").hide();
        }
    },

    close_no_search_results: function() {
        jQuery(".no-search-results").hide();
    },
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// search details display, single instance
//
let search_details = {
    // helper: render a single detail of the details view
    render_single_detail: function(label, text) {
        let str = "<div class=\"row-height align-top\">\n" +
            "<span class=\"label\" title=\"[label]\">[label]</span><span class=\"text\" title=\"[text]\">[text]</span>\n" +
            "</div>\n"
        str = str
            .replace(/\[label]/g, this.esc_html(label))
            .replace(/\[text]/g, this.esc_html(text));
        return str;
    },

    // helper: render a single detail, but with a clickable url
    render_single_detail_url: function(label, url) {
        let str = "<div class=\"row-height align-top\">\n" +
            "<span class=\"label\" title=\"[label]\">[label]</span><span class=\"url\" onclick=\"window.open('[url]', '_blank')\" title=\"[text]\">[text]</span>\n" +
            "</div>\n"
        str = str
            .replace(/\[label]/g, this.esc_html(label))
            .replace(/\[text]/g, this.esc_html(url));
        return str;
    },

    get_preview_url: function() {
        return settings.base_url + '/api/document/preview/' + settings.organisationId + '/' + this.kb.id + '/' +
            this.get_client_id();
    },

    // render the details of a single result
    render_details_view: function(result) {
        if (result) {
            let str = "<table class=\"details-table\">\n" +
                "<tbody><tr class=\"align-top whole-row\">\n" +
                "<td class=\"align-top row-1\">\n";
            str += this.render_single_detail_url("url", result.url);
            if (result.title) {
                str += this.render_single_detail("title", result.title);
            }
            if (result.urlId > 0) {
                str += this.render_single_detail("document id", result.urlId);
            }
            if (result.author) {
                str += this.render_single_detail("author", result.author);
            }
            if (result.documentType) {
                str += this.render_single_detail("document type", result.documentType);
            }
            if (result.binarySize > 0) {
                str += this.render_single_detail("document byte-size", this.size_to_str(result.binarySize));
            }
            if (result.textSize > 0) {
                str += this.render_single_detail("text byte-size", this.size_to_str(result.textSize));
            }
            if (result.source) {
                str += this.render_single_detail("source/origin", result.source);
            }
            if (result.created > 0) {
                str += this.render_single_detail("document created date/time", this.unix_time_convert(result.created));
            }
            if (result.lastModified > 0) {
                str += this.render_single_detail("document last-modified date/time", this.unix_time_convert(result.lastModified));
            }
            if (result.uploaded > 0) {
                str += this.render_single_detail("pipeline last-crawled date/time", this.unix_time_convert(result.uploaded));
            }
            if (result.converted > 0) {
                str += this.render_single_detail("pipeline last-converted date/time", this.unix_time_convert(result.converted));
            }
            if (result.parsed > 0) {
                str += this.render_single_detail("pipeline last-parsed date/time", this.unix_time_convert(result.parsed));
            }
            if (result.indexed > 0) {
                str += this.render_single_detail("pipeline last-indexed date/time", this.unix_time_convert(result.indexed));
            }
            if (result.previewed > 0) {
                str += this.render_single_detail("pipeline last-preview date/time", this.unix_time_convert(result.previewed));
            }
            if (result.numSentences > 0) {
                str += this.render_single_detail("number of sentences", result.numSentences);
            }
            if (result.numWords > 0) {
                str += this.render_single_detail("number of words", result.numWords);
            }
            if (result.numRelationships > 0) {
                str += this.render_single_detail("number of relationships", result.numRelationships);
            }
            for (let key in result.metadata) {
                // check if the property/key is defined in the object itself, not in parent
                if (key.indexOf('{') === -1 && result.metadata.hasOwnProperty(key)) {
                    let value = result.metadata[key];
                    if (value.indexOf("<") === -1) { // no tags or anything allowed - don't render
                        str += this.render_single_detail(key, value);
                    }
                }
            }
            str += "</td>\n" +
                "<td rowspan=\"20\" class=\"image-row align-top\">\n" +
                "<img src=\"[image]\" class=\"preview-image\" alt=\"page preview\" />\n" +
                "</td>\n" +
                "</tr>\n" +
                "</tbody>\n" +
                "</table>\n";
            str = str
                .replace(/\[url]/g,this. esc_html(result.url))
                .replace(/\[image]/g, this.get_preview_url() + '/' + this.esc_html(result.urlId) + '/0');
            jQuery(".detail-table").html(str);
        } else {
            jQuery(".detail-table").html("");
        }
    },

    show_search_details_by_id: function(result_id) {
        if (this.semantic_search_result_map_id && this.semantic_search_result_map_id.hasOwnProperty(result_id)) {
            this.show_search_details(this.semantic_search_result_map_id[result_id]);
        }
    },

    show_search_details: function(result) {
        this.render_details_view(result);
        jQuery(".search-details-view").show();
    },

    close_search_details: function() {
        jQuery(".search-details-view").hide();
    }

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// control for signing into SimSage
//
let sign_in_control = {

    show_sign_in: function() {
        jQuery(".search-sign-in").show();
    },

    setup_domains: function() {
    },

    setup_office_365_user: function() {
    },

    // setup any potential domains
    change_domain: function(domain) {
    },

    do_sign_in: function() {
        alert("todo: do_sign_in");
    },

    close_sign_in: function() {
        jQuery(".password").val("");
        jQuery(".search-sign-in").hide();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// control taking care of the search options on screen
//
let spelling_control = {

    text: "",

    show_spelling_suggestion: function(text) {
        if (text && text.length > 0) {
            this.text = this.esc_html(text);
            jQuery(".spelling-label-text").html("Did you mean, " + this.text + "?");
            jQuery(".spelling-box-view").show();
        }
    },

    use_spelling_suggestion: function() {
        if (this.text && this.text.length > 0) {
            jQuery(".search-text").val(this.text);
        }
    },

    close_spelling_suggestion: function() {
        jQuery(".spelling-box-view").hide();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the bot display
//
let search_bot = {

    // single instance
    instantiate() {
        jQuery.extend(this, common_functions);
        return this;
    },

    show_bot: function(text, link_list) {
        jQuery(".bot-reply-text").html(this.esc_html(text));
        let time = this.unix_time_convert(new Date().getTime());
        jQuery(".bot-label-text").html("Bot, " + time);
        jQuery(".bot-box-view").show();
        if (link_list && link_list.length > 0) {
            for (let i in link_list) {
                let link = link_list[i];
                if (link) {

                }
            }
            jQuery(".bot-links").html("");
        } else {
            jQuery(".bot-links").html("");
        }
    },
    close_bot: function() {
        jQuery(".bot-reply-text").html("");
        jQuery(".bot-box-view").hide();
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the pagination control
//
let pagination_control = {

    // pagination
    num_pages: 0,       // search result information
    num_results: 0,
    page: 0,            // current page
    page_size: settings.page_size,      // the size of pages

    selected_view: "text",          // the text or image view for non-custom render displays
    last_query: "",
    shard_size_list: [],            // sharding list

    do_change_page_size: function() {
        this.page_size = parseInt(jQuery(".dd-page-size").val());
        this.do_search();
    },

    do_change_sort: function() {
        let sort_id = jQuery(".dd-sort").val();
        for (let i in simsage_sort_list) {
            simsage_sort_list[i].selected = (i == sort_id);
        }
        this.do_search();
    },

    select_text_view: function() {
        this.selected_view = "text";
        this.do_search();
    },

    select_image_view: function() {
        this.selected_view = "image";
        this.do_search();
    },

    prev_page: function() {
        if (this.page > 0) {
            this.page -= 1;
            this.do_search();
        }
    },

    next_page: function() {
        if ((this.page + 1) < this.num_pages) {
            this.page += 1;
            this.do_search();
        }
    },

    show_pagination: function() {
        jQuery(".pagination-box").show();
    },

    // reset the variables used in determining pagination if the query has changed
    reset_pagination: function(query_text) {
        if (this.last_query !== query_text) {
            this.last_query = query_text;
            this.page = 0;  // reset to page 0
            this.num_pages = 0;
            this.num_results = 0;
            this.shard_size_list = [];
            this.semantic_search_results = [];
            this.semantic_search_result_map = {};
            this.semantic_search_result_map_id = {};
        }
    },

    // render the pagination on-screen
    render_pagination: function() {
        let num_pages = this.num_pages > 0 ? this.num_pages : 1;
        let num_results = this.num_results + " results";
        if (this.num_results === 0) {
            num_results = "no results";
        } else if (this.num_results === 1) {
            num_results = "one result";
        }
        let page_str = "page " + (this.page + 1) + " of " + num_pages;
        let ps = this.page_size;
        let str = "<span class=\"pagination-text\" title=\"" + num_results + "\">" + num_results + "</span>\n" +
            "<span class=\"pagination-text page-size-sel\" title=\"\">\n" +
            "<label>\n" +
            "<select name=\"page-size\" class=\"page-size-select dd-page-size\" tabindex=\"0\" onchange=\"search.do_change_page_size()\" title=\"set the number of results per page\">\n" +
            "<option value=\"5\" " + (ps===5 ? "selected" : "") + ">5 results per page</option>\n" +
            "<option value=\"10\" " + (ps===10 ? "selected" : "") + ">10 results per page</option>\n" +
            "<option value=\"15\" " + (ps===15 ? "selected" : "") + ">15 results per page</option>\n" +
            "<option value=\"20\" " + (ps===20 ? "selected" : "") + ">20 results per page</option>\n" +
            "</select><span class=\"dd-chevron-2\" title=\"please click on the text\">&#x2304;</span>\n" +
            "</label>\n" +
            "</span>\n";

        if (this.page > 0) {
            str += "<span class=\"prev-page-box pagination-left\" title=\"go to the previous page\" onclick=\"search.prev_page()\">\n" +
                "<span class=\"arrow-enabled\" alt=\"previous page\">&#x2190;</span>\n" +
                "</span>\n";
        } else {
            str += "<span class=\"prev-page-box-disabled pagination-left\" title=\"there is no previous page\">\n" +
                "<span class=\"arrow-disabled\" alt=\"previous page disabled\">&#x2190;</span>\n" +
                "</span>\n";
        }

        str += "<span class=\"pagination-text\" title=\"" + page_str + "\">" + page_str + "</span>\n";
        if (this.page + 1 < this.num_pages) {
            str += "<span class=\"next-page-box\" title=\"go to the next page\" onclick=\"search.next_page()\">" +
                "<span class=\"arrow-enabled\" alt=\"next page\">&#x2192;</span>\n" +
                "</span>\n";
        } else {
            str += "<span class=\"next-page-box-disabled\" title=\"there is no next page\">" +
                "<span class=\"arrow-disabled\" alt=\"next page disabled\">&#x2192;</span>\n" +
                "</span>\n";
        }

        str += "<span class=\"view-type-box\">\n";

        // sorting if this is a database
        if (this.is_custom_render && simsage_sort_list.length > 0) {
            str += "<span class=\"sort-text\" title=\"sort by\">\n" +
                "<label>\n" +
                "<select name=\"sort-by\" class=\"sort-select dd-sort\" tabindex=\"0\" onchange=\"search.do_change_sort()\" title=\"set the sort order of results\">\n";
            for (let i in simsage_sort_list) {
                if (simsage_sort_list.hasOwnProperty(i)) {
                    let sort = simsage_sort_list[i];
                    str += "<option value=\"" + i + "\" " + (sort.selected ? "selected" : "") + ">" + sort.name + "</option>\n";
                }
            }
            str += "</select><span class=\"dd-chevron\" title=\"please click on the text\">&#x2304;</span>\n" +
                "</label>\n" +
                "</span>\n";
        }

        if (!this.is_custom_render && this.selected_view === "text") {
            str += "<span class=\"pagination-text view-results-as-box\" title=\"view results as\">View results as: </span>\n";
            str +=
                "<span class=\"view-text-outer-box text-view\" tabindex=\"0\" title=\"text view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"search.select_text_view()\">\n" +
                "<span class=\"view-text-box\">&nbsp;</span>\n" +
                "<span class=\"view-results-as-text\">Text</span>\n" +
                "</span>\n";

            str +=
                "<span class=\"view-images-box-disabled image-view\" tabindex=\"0\" title=\"image view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"search.select_image_view()\">\n" +
                "<span class=\"view-image-box-disabled\">&nbsp;</span>\n" +
                "<span class=\"view-results-as-text-disabled\">Image</span>\n" +
                "</span>\n";
        } else if (!this.is_custom_render) {
            str += "<span class=\"pagination-text view-results-as-box\" title=\"view results as\">View results as: </span>\n";
            str +=
                "<span class=\"view-text-outer-box-disabled text-view\" tabindex=\"0\" title=\"text view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"search.select_text_view()\">\n" +
                "<span class=\"view-text-box-disabled\">&nbsp;</span>\n" +
                "<span class=\"view-results-as-text-disabled\">Text</span>\n" +
                "</span>\n";

            str +=
                "<span class=\"view-images-box image-view\" tabindex=\"0\" title=\"image view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"search.select_image_view()\">\n" +
                "<span class=\"view-image-box\">&nbsp;</span>\n" +
                "<span class=\"view-results-as-text\">Image</span>\n" +
                "</span>\n";
        }

        str += "</span>\n";
        jQuery(".pagination-box").html(str);
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// chat control button and text dialog
//

let chat_control = {

    // async chat sockets
    is_ws_connected: false,                        // connected to endpoint?
    stompClient: null,                          // the connection
    ws_base: settings.base_url + '/ws-api',     // endpoint

    close_chat: function() {
        jQuery(".operator-chat-box-view").hide();
    },

    show_chat: function() {
        let ctrl = jQuery(".operator-chat-box-view");
        if (ctrl.is(":visible")) {
            ctrl.hide();
        } else {
            ctrl.show();
        }
    },

    do_chat: function() {
        let ctrl = jQuery(".chat-text");
        let text = ctrl.val();
        let self = this;
        if (this.kb && text.trim().length > 0) {
            let data = {
                organisationId: settings.organisationId,
                kbList: [this.kb.id],
                clientId: this.get_client_id(),
                assignedOperatorId: this.assigned_operator_id,
                text: text,
            };
            // add an entry into the chat_list
            this.chat_list.push({
                timeStamp: new Date().getTime(),
                isSimSage: false,
                text: text,
                urlList: [],
            });
            ctrl.val("");
            this.update_chat_window();
            this.post_message('/api/ops/client/chat', data, function(data) {
                self.receive_ws_data(data);
            });
        }
    },

    user_is_typing: function() {
        let now = new Date().getTime();
        if (this.assigned_operator_id && this.assigned_operator_id.length > 0 && this.client_typing_last_seen < now) {
            this.client_typing_last_seen = now + this.typing_repeat_timeout;
            let data = {
                fromId: this.get_client_id(),
                toId: this.assigned_operator_id,
                isTyping: true
            };
            search.post_message('/api/ops/typing', data, function(data) {
            });
        }
    },

    chat_typing: function(event) {
        let ctrl = jQuery(".chat-text");
        let button = jQuery(".chat-button-control");
        if (ctrl.val().trim().length === 0) {
            button.removeClass("chat-button");
            button.addClass("chat-button-disabled");
        } else {
            if (event.keyCode === 13) {
                button.removeClass("chat-button");
                button.addClass("chat-button-disabled");
                this.do_chat();
            } else {
                button.removeClass("chat-button-disabled");
                button.addClass("chat-button");
                this.user_is_typing();
            }
        }
    },

    operator_was_typing: function(is_typing) {
        let now = new Date().getTime();
        if (is_typing) {
            this.operator_typing_last_seen = now + this.typing_timeout;
            if (!this.operator_typing && is_typing) {
                this.operator_typing = is_typing;
                this.update_chat_window();
            }
        } else if (this.operator_typing_last_seen < now  && this.operator_typing) {
            this.operator_typing = false;
            this.update_chat_window();
        }
    },

    // render an operator part of the conversation
    render_chat: function(chat) {
        let time_str = chat.timeStamp ? search.unix_time_convert(chat.timeStamp) : "";
        if (chat.isSpecialMessage) {
            return "<div class=\"disconnected-box\">\n" +
                   "<div class=\"disconnected-line\">\n" +
                   "<span class=\"disconnected-label\">" + this.esc_html(chat.text) + "</span>\n" +
                   "<span class=\"hyphen\">-</span>\n" +
                   "<span class=\"time\">" + time_str + "</span>\n" +
                   "</div>\n" +
                   "</div>\n";
        } else {
            let text_str = this.esc_html(chat.text ? chat.text : "");
            if (chat.isSimSage) {
                let operator_name = this.operator_name ? this.operator_name : "Operator";
                let url_str = "";
                if (chat.urlList) {
                    for (let j in chat.urlList) {
                        if (chat.urlList.hasOwnProperty(j)) {
                            let url = this.esc_html(chat.urlList[j]);
                            url_str += "<div class=\"url\" title=\"" + url + "\" onclick=\"window.open('" + url + "', '_blank');\">" + url + "</div>\n"
                        }
                    }
                }
                return "<div class=\"operator-box\">\n" +
                       "<div class=\"operator-line\">\n" +
                       "<span class=\"operator-label\">" + operator_name + "</span>\n" +
                       "<span class=\"hyphen\">-</span>\n" +
                       "<span class=\"time\">" + time_str + "</span>\n" +
                       "</div>\n" +
                       "<div class=\"operator-text-box\">\n" +
                       "<div class=\"operator-text\">" + text_str + "</div>\n" +
                       url_str +
                       "</div>\n" +
                       "</div>\n";
            } else {
                return "<div class=\"user-box\">\n" +
                       "<div class=\"user-line\">\n" +
                       "<span class=\"user-label\">You</span>\n" +
                       "<span class=\"hyphen\">-</span>\n" +
                       "<span class=\"time\">" + time_str + "</span>\n" +
                       "</div>\n" +
                       "<div class=\"user-text\">" + text_str + "</div>\n" +
                       "</div>\n";
            }
        }
    },

    render_typing_dots: function() {
        return "<div class=\"left-box-white\">\n" +
               "<span class=\"typing-dots-box\"><img src=\"" + image_base + "images/dots.gif\" class=\"typing-dots-image\" alt=\"typing\" /></span>\n" +
               "</div>\n";
    },

    render_chats: function() {
        let str = "";
        for (let i in this.chat_list) {
            if (this.chat_list.hasOwnProperty(i)) {
                str += this.render_chat(this.chat_list[i]);
            }
        }
        if (this.operator_typing) {
            str += this.render_typing_dots();
        }
        return str;
    },

    update_chat_window: function() {
        let ctrl = jQuery(".chat-table");
        ctrl.html(this.render_chats());
        // scroll to bottom of chat window to make the most recent message visible
        ctrl.animate({scrollTop: ctrl.prop("scrollHeight")}, 10);
    },

    // show or hide the chat button with the visible flag
    show_chat_button: function(has_operator, has_chat_messages) {
        this.nop();
        if (has_operator || has_chat_messages) {
            jQuery(".chat-button-at-bottom").show();
            // so we no longer have an operator, but have some history in the chat
            // just disable the button - change its colour
            let cc = jQuery(".chat-container");
            let cwu = jQuery(".chat-with-us-text");
            let ci = jQuery(".chat-with-us-image");
            let cwit = jQuery(".chat-with-us-online");
            if (!has_operator) {
                cc.removeClass("online");
                cc.addClass("offline");
                cwu.removeClass("chat-with-us-text-box-online");
                cwu.addClass("chat-with-us-text-box-online-disabled");
                ci.attr("src", image_base + "images/chat-grey.svg");
                cwit.attr("title", "all Operators offline");
            } else {
                cc.addClass("online");
                cc.removeClass("offline");
                cwu.addClass("chat-with-us-text-box-online");
                cwu.removeClass("chat-with-us-text-box-online-disabled");
                ci.attr("src", image_base + "images/chat-white.svg");
                cwit.attr("title", "Chat with us");
            }
        } else {
            jQuery(".chat-button-at-bottom").hide();
        }
    },

    // connect to SimSage for async-socket chat
    connect_ws: function() {
        if (!this.is_ws_connected) {
            let self = this;
            // this is the socket end-point
            let socket = new SockJS(this.ws_base);
            this.stompClient = Stomp.over(socket);
            this.stompClient.connect({},
                function () {
                    self.stompClient.subscribe('/chat/' + self.get_client_id(), function (answer) {
                        self.receive_ws_data(JSON.parse(answer.body));
                    });
                    self.set_ws_connected(true);
                },
                function(err) {
                    console.error(err);
                    self.set_ws_connected(false);
                });
        }
    },

    // set the connection status of the chat system - and try and reconnect on fail
    set_ws_connected: function(is_ws_connected) {
        this.is_ws_connected = is_ws_connected;
        if (!is_ws_connected) {
            if (this.stompClient !== null) {
                this.stompClient.disconnect();
                this.stompClient = null;
            }
            if (this.connection_retry_count > 1) {
                this.error('not connected, trying to re-connect, please wait (try ' + this.connection_retry_count + ')');
            }
            setTimeout(this.connect_ws, 5000); // try and re-connect as a one-off in 5 seconds
            this.connection_retry_count += 1;

        } else {
            this.error('');
            this.connection_retry_count = 1;
            this.stompClient.debug = null;
        }
    },

    // overwrite: generic web socket receiver
    receive_ws_data: function(data) {
        this.busy(false);
        if (data) {
            if (data.messageType === this.mt_Error && data.error.length > 0) {
                this.error(data.error);  // set an error

            } else if (data.messageType === this.mt_Disconnect) {
                this.assigned_operator_id = ''; // disconnect any operator
                this.operator_name = '';
                this.operator_typing = false;
                // add disconnected message if we've been typing
                if (this.chat_list && this.chat_list.length > 0) {
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: "operator disconnected"
                    });
                }
                this.update_chat_window();

            } else if (data.messageType === this.mt_Email) {
                this.know_email = true;

            } else if (data.messageType === this.mt_SignIn) {
                if (data.errorMessage && data.errorMessage.length > 0) {
                    error(data.errorMessage);  // set an error
                    this.signed_in = false;
                } else {
                    // sign-in successful
                    this.signed_in = true;
                    this.sign_in_status(true);
                }
                // todo: show we have signed in

            } else if (data.messageType === this.mt_IsTyping) {
                this.operator_was_typing(true);

            } else if (data.messageType === this.mt_SignOut) {
                if (data.errorMessage && data.errorMessage.length > 0) {
                    this.error(data.errorMessage);  // set an error
                } else {
                    // sign-in successful
                    this.signed_in = false;
                    this.sign_in_status(false);
                }

            } else if (data.messageType === this.mt_OperatorAvailable) {
                // we're notified about a change in availability of the number of operators
                this.operator_count = data.operatorCount;
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                }
                this.show_chat_button(this.operator_count > 0 || (this.assigned_operator_id && this.assigned_operator_id.length > 0),
                    this.chat_list.length > 0);

            } else if (data.messageType === this.mt_OperatorChat) {
                // we're notified about a change in availability of the number of operators
                this.operator_count = data.operatorCount;
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                    if (data.operatorName) {
                        this.operator_name = data.operatorName;
                    } else {
                        this.operator_name = '';
                    }
                } else {
                    // no available operators
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: "no operators available"
                    });
                }
                this.update_chat_window();
                this.show_chat_button(this.operator_count > 0 || (this.assigned_operator_id && this.assigned_operator_id.length > 0),
                    this.chat_list.length > 0);

            } else if (data.messageType === this.mt_OperatorMessage) {

                // set the assigned operator
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                }
                // add an entry into the chat_list
                if (data.text && data.text.length > 0) {
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSimSage: true,
                        text: data.text,
                        urlList: [],
                    });
                    this.operator_typing = false;
                    this.update_chat_window();
                }

            } else if (data.messageType === this.mt_Message) {
                this.is_typing = false;
                // set the assigned operator
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                    if (data.operatorName) {
                        this.operator_name = data.operatorName;
                    } else {
                        this.operator_name = '';
                    }
                }
                // copy the know email flag from our results
                if (!this.know_email && data.knowEmail) {
                    this.know_email = data.knowEmail;
                }
            }
        }
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// render search results
//

let search_results_control = {

    show_search_results: function() {
        jQuery(".search-display").show();
        this.close_no_search_results();
    },

    hide_search_results: function() {
        if (!this.is_custom_render) {
            jQuery(".search-display").hide();
        } else {
            // just empty the search results if this is a db display
            jQuery(".search-results-text").html("");
        }
    },

    prev_fragment: function(id) {
        if (this.semantic_search_result_map_id && this.semantic_search_result_map_id.hasOwnProperty(id)) {
            let result = this.semantic_search_result_map_id[id];
            if (result && result.textIndex > 0) {
                result.textIndex -= 1;
                this.render_search_results();
            }
        }
    },

    next_fragment: function(id) {
        if (this.semantic_search_result_map_id && this.semantic_search_result_map_id.hasOwnProperty(id)) {
            let result = this.semantic_search_result_map_id[id];
            if (result && result.textIndex + 1 < result.textList.length) {
                result.textIndex += 1;
                this.render_search_results();
            }
        }
    },

    render_single_text_search_result: function(id, url, title, fragment, fragment_index, num_fragments) {
        let str = "<div class=\"search-result\">\n" +
            "<div title=\"visit [url]\" class=\"search-text-width\">\n" +
            "<a href=\"[url]\" target=\"_blank\"><span class=\"url-text\">[split-url]</span></a>\n" +
            "<div title=\"visit [url]\" onclick=\"visit_url('[url]');\" class=\"more-details\"><span class=\"title-text\">[title]</span></div>\n" +
            "<div><span class=\"result-text\">[fragment]</span></div>\n" +
            "<div class=\"navigate-td\">\n";
        if (fragment_index > 0) {
            str += "<span class=\"navigate-left\" tabindex=\"0\" title=\"view the previous relevant fragment in this document\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"search.prev_fragment([id]);\"><img src=\"" + image_base + "images/left.svg\" class=\"navigate-left-image\" alt=\"previous\" /></span>\n";
        } else {
            str += "<span class=\"no-navigate-left\" tabindex=\"0\" title=\"there is no previous fragment in this document\"><img src=\"" + image_base + "images/left-disabled.svg\" class=\"navigate-left-image\" alt=\"no previous\" /></span>\n";
        }
        if ((fragment_index + 1) < num_fragments) {
            str += "<span class=\"navigate-right\" tabindex=\"0\" title=\"view the next relevant fragment in this document\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"search.next_fragment([id]);\"><img src=\"" + image_base + "images/right.svg\" class=\"navigate-right-image\" alt=\"next\" /></span>\n";
        } else {
            str += "<span class=\"no-navigate-right\" tabindex=\"0\" title=\"there is no next fragment in this document\"><img src=\"" + image_base + "images/right-disabled.svg\" class=\"navigate-right-image\" alt=\"no next\" /></span>\n";
        }
        str += "<span class=\"navigate-text\" title=\"Scroll through other relevant search results on this page\">Scroll through other relevant search results on this page</span>\n" +
            "</div>\n" +
            "</div>\n" +
            "<div title=\"view more details\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"search.show_search_details_by_id([id]);\" tabindex=\"0\" class=\"search-image-width\">\n" +
            "<img src=\"[thumbnail_src]\" alt=\"[title]\" class=\"result-image\"/>\n" +
            "</div>\n" +
            "</div>\n";
        let fragment_str = this.esc_html(fragment)
            .replace(/{hl1:}/g, "<span class='hl1'>")
            .replace(/{:hl1}/g, "</span>")
            .replace(/{hl2:}/g, "<span class='hl2'>")
            .replace(/{:hl2}/g, "</span>");
        str = str
            .replace(/\[url]/g, this.esc_html(url))
            .replace(/\[split-url]/g, this.esc_html(url))
            .replace(/\[id]/g, this.esc_html(id))
            .replace(/\[thumbnail_src]/g, this.get_preview_url() + '/' + this.esc_html(id) + '/-1')
            .replace(/\[title]/g, title && title.length > 0 ? this.esc_html(title) : "(no title)")
            .replace(/\[fragment]/g, fragment_str);
        return str;
    },

    // Render a single search-database result
    render_single_search_db_result: function(id, url, title, html) {
        return html;
    },

    // render a single image result
    render_single_image_search_result: function(id, url, title) {
        let str = "<div class=\"image-result\">" +
            "<div class=\"image-image\" title=\"[title]\" onclick=\"search.show_search_details_by_id([id]);\">\n" +
            "<img src=\"[thumbnail_src]\" alt=\"image\" class=\"result-image-image\"/>\n" +
            "</div>\n" +
            "<div class=\"image-text\" title=\"[title]\" onclick=\"search.show_search_details_by_id([id]);\">\n" +
            "[title-short]\n" +
            "</div>\n" +
            "</div>\n";
        let title_short = search.adjust_size(title, 40);
        str = str
            .replace(/\[url]/g, url)
            .replace(/\[id]/g, id)
            .replace(/\[thumbnail_src]/g, this.get_preview_url() + '/' + id + '/0')
            .replace(/\[title-short]/g, title_short && title_short.length > 0 ? title_short : "(no title)")
            .replace(/\[title]/g, title && title.length > 0 ? title : "(no title)");
        return str;
    },

    get_url_id_from_url: function(url) {
        if (this.semantic_search_result_map.hasOwnProperty(url)) {
            let sr = this.semantic_search_result_map[url];
            if (sr && sr.url === url) {
                return sr.urlId;
            }
        }
        return 0;
    },

    get_image_url_by_doc_url: function(url) {
        // set the image for this item
        let urlId = this.get_url_id_from_url(url);
        return settings.base_url + "/api/document/preview/" +
            settings.organisationId + "/" + this.kb.id + "/" +
            this.get_client_id() + "/" + urlId + "/-1";
    },

    // update images from ids, ratings, and search result highlighting in records
    update_database_gui: function() {
        let self = this;
        jQuery("div.db-record-rating").each(function() {
            // Get the value
            let val = parseFloat(jQuery(this).html());
            // Make sure that the value is in 0 - 5 range, multiply to get width
            let size = Math.floor(Math.max(0, (Math.min(5, val))));
            let starStr = "";
            for (let i = size; i < 5; i++) {
                starStr += "&#x2606;"
            }
            for (let i = 0; i < size; i++) {
                starStr += "&#x2605;"
            }
            // Replace the numerical value with stars
            jQuery(this).html(starStr);
        });
        jQuery("div.db-record-price").each(function() {
            let val = parseFloat(jQuery(this).html().trim());
            if (val === Math.floor(val)) {
                val = val * 0.01;
            }
            // Replace the numerical value with stars
            $(this).html(settings.currency_symbol + val.toFixed(2));
        });
        jQuery("div.db-image").each(function() {
            let val = jQuery(this).html().trim();
            let url = self.get_image_url_by_doc_url(val);
            $(this).html("<img src='" + url + "' class='db-image-size' alt='image'/>");
        });
        // fill in span hl1 and hl2
        jQuery(".search-results-text").each(function() {
            let val = jQuery(this).html().trim();
            val = val.replace(/{hl1:}/g, "<span class='hl1'>");
            val = val.replace(/{:hl1}/g, "</span>");
            val = val.replace(/{hl2:}/g, "<span class='hl2'>");
            val = val.replace(/{:hl2}/g, "</span>");
            $(this).html(val);
        });
    },

    clear_search_results: function() {
        jQuery(".search-results-td").html("");
    },

    // return some hard-wired search results - repeated
    render_search_results: function() {
        if (this.is_custom_render) {
            // render a set of DB records
            let reverse_list = this.semantic_search_results; // JSON.parse(JSON.stringify(search.semantic_search_results.reverse()));
            let str = "";
            for (let i in reverse_list) {
                if (reverse_list.hasOwnProperty(i)) {
                    let result = reverse_list[i];
                    if (result.url && result.textList && result.textList.length > 0) {
                        str += this.render_single_search_db_result(result.urlId, result.url, result.title, result.textList[0]);
                    }
                }
            }
            jQuery(".search-results-td").html(str);

        } else if (this.selected_view === "text") {

            let str = "";
            for (let i in this.semantic_search_results) {
                if (this.semantic_search_results.hasOwnProperty(i)) {
                    let result = this.semantic_search_results[i];
                    if (result.url) {
                        str += this.render_single_text_search_result(result.urlId, result.url, result.title,
                            result.textList[result.textIndex], result.textIndex, result.textList.length);
                    }
                }
            }
            jQuery(".search-results-td").html(str);

        } else {
            let str = "";
            for (let i in this.semantic_search_results) {
                if (this.semantic_search_results.hasOwnProperty(i)) {
                    let result = this.semantic_search_results[i];
                    if (result.url) {
                        str += this.render_single_image_search_result(result.urlId, result.url, result.title);
                    }
                }
            }
            str += "<div class=\"end-marker-images\"></div>\n";
            jQuery(".search-results-td").html(str);
        }
        this.update_database_gui();
        this.render_pagination();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the no-results handling
//

let domain_control = {

    signed_in: false, // are we signed into a domain or something?

    do_change_domain: function() {
        // // what type of domain is this?
        // let domainType = "";
        // let domain_list = search.getDomainListForCurrentKB();
        // for (let domain of domain_list) {
        //     if (domain.sourceId == search.sourceId) {
        //         domainType = domain.domainType;
        //         break;
        //     }
        // }
        // let div_email = document.getElementById("divEmail");
        // let div_password = document.getElementById("divPassword");
        // let txt_email = document.getElementById("txtEmail");
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
    },

    show_sign_in: function() {
        if (this.source) {
            jQuery(".sign-in-title").html("sign-in to \"" +
                this.esc_html(this.source.name) + ", " +
                this.esc_html(this.source.domainType) + "\"");
            jQuery(".search-sign-in").show();
        }
    },

    // get or create a session based client id for SimSage usage
    set_office365_user: function(data) {
        let key = 'simsearch_office_365_user';
        let hasLs = search.has_local_storage();
        if (hasLs) {
            let to = search.session_timeout_in_mins * 60000;
            data.expiry = new Date().getTime() + to; // 1 hour timeout
            localStorage.setItem(key, JSON.stringify(data));
        }
    },

    // get or create a session based client id for SimSage usage
    remove_office365_user: function() {
        let key = 'simsearch_office_365_user';
        let hasLs = search.has_local_storage();
        if (hasLs) {
            localStorage.removeItem(key);
        }
    },

    // do the actual sign-in
    do_sign_in: function() {
        let self = this;
        if (this.source) {
            let user_name = jQuery(".sign-in-user-name").val();
            let password = jQuery(".sign-in-password").val();
            let domain = { sourceId: this.source.id, domain: this.source.name, domain_type: this.source.domainType };
            if (domain.domainType === 'aad') { // azure ad
                let user = this.get_office365_user();
                if (!user) {
                    // do we already have the code to sign-in?
                    let urlParams = new URLSearchParams(window.location.search);
                    let code = urlParams.get('code');
                    if (!code) {
                        window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=' +
                            domain.clientId + '&response_type=code&redirect_uri=' +
                            encodeURIComponent(domain.redirectUrl) + '&scope=User.ReadBasic.All+offline_access+openid+profile' +
                            '&state=' + this.get_client_id();
                    } else {
                        // login this user, using the code
                        this.setup_office_365_user();
                    }
                } else {
                    // we have a user - assume the client wants to sign-out
                    this.remove_office365_user();
                    this.signed_in = false;
                    this.error('');
                }
            } else if (user_name && user_name.length > 0 && password && password.length > 0 && this.kb) {
                this.busy(true);
                this.error('');
                let adSignInData = {
                    'organisationId': settings.organisationId,
                    'kbList': [this.kb.id],
                    'clientId': this.get_client_id(),
                    'sourceId': this.source.id,
                    'userName': user_name,
                    'password': password,
                };
                search.post_message('/api/ops/ad/sign-in', adSignInData, function (data) {
                    self.receive_ws_data(data, false);
                });
            }
        }
    },

    do_sign_out: function() {
        let self = this;
        this.error('');
        if (this.kb && this.source) {
            this.busy(true);
            this.remove_office365_user();
            let signOutData = {
                'organisationId': settings.organisationId,
                'kbList': [this.kb.id],
                'clientId': this.get_client_id(),
                'sourceId': this.source.id,
            };
            this.post_message('/api/ops/ad/sign-out', signOutData, function (data) {
                self.receive_ws_data(data);
            });
        }
    },

}


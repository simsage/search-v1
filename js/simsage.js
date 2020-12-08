// ws-response message types
let mt_Disconnect = "disconnect";
let mt_Error = "error";
let mt_Message = "message";
let mt_Email = "email";
let mt_IsTyping = "typing";
let mt_SignIn = "sign-in";
let mt_SignOut = "sign-out";
let mt_OperatorAvailable = "operator-available";
let mt_OperatorChat = "operator-chat";
let mt_OperatorMessage = "operator-message";

// db category types
let cat_type_plain = "category";
let cat_type_two_level = "two level category";
let cat_type_star_rating = "star rating";
let num_type_money = "monetary x 100 range";
let num_type_range = "number range";
let num_type_if_true = "select if true";

//
// SimSage class, IE 11 compatible
//
let search = {

    selected_view: "text",
    page: 0,
    num_results: 0,
    page_size: 5,
    num_pages: 0,

    // the currency display symbol
    currency_symbol: "$",

    // how many items maximum to display for a level on category source
    source_level_one_categories_max_items: 5,

    // timeout for office 365 sessions
    session_timeout_in_mins: 59,

    // typing animation timeout in ms
    typing_timeout: 1500,
    // don't send too many is-typing requests to the server
    typing_repeat_timeout: 750,

    is_connected: false,    // connected to endpoint?
    stompClient: null,      // the connection
    ws_base: settings.base_url + '/ws-api',    // endpoint

    connection_retry_count: 1,

    last_query: "",
    search_query: "",
    advanced_filter: {},
    semantic_search_results: [],
    // the bot result if any {who, what when, url_list}
    bot_data: null,
    shard_size_list: [],
    semantic_set: {},
    syn_sets_seen: {},
    // list of ambiguous items to pick from
    synset_list: [],
    selected_syn_sets: {},
    selected_sliders: {},
    know_email: false,

    // category filters
    filters_visible: false,

    // kb information
    kb_list: [],
    kb: null,
    source_list: [],
    sourceId: 0,                        // the selected source
    is_db_source: false,                // is the current source a db source?
    sort_list: [],                      // list of sort details {"name": "", "selected": false}
    source: null,
    operator_typing: false,             // are we receiving a "typing" message?
    operator_typing_last_seen: 0,       // last time operator was seen typing
    client_typing_last_seen: 0,

    // assigned operator
    assignedOperatorId: '',
    operator_name: '',
    operator_count: 0,
    signed_in: false,

    // conversation list between operator, bots, and the user
    chat_list: [],


    // perform a new search
    do_search: function(text, filter) {
        if (search.kb && (search.is_db_source || text.trim() !== '')) {
            // do we need to reset the pagination?
            search.reset_pagination(text);
            filter["db"] = search.add_db_filters(filter);
            search.advanced_filter = filter; // copy
            // create the query and clear the errors
            error('');

            text = search.cleanup_query_text(text);
            let search_query_str = search.semantic_search_query_str(text, filter);
            console.log(search_query_str);
            if (search_query_str !== '()') {
                search.search_query = text;
                busy(true);

                let clientQuery = {
                    'organisationId': settings.organisationId,
                    'kbList': [search.kb.id],
                    'clientId': search.get_client_id(),
                    'semanticSearch': true,     // always a search
                    'query': search_query_str,  // search query
                    'queryText': text,          // raw text
                    'numResults': 1,              // bot results
                    'scoreThreshold': settings.bot_threshold,
                    'page': search.page,
                    'pageSize': search.page_size,
                    'shardSizeList': search.shard_size_list,
                    'fragmentCount': settings.fragment_count,
                    'maxWordDistance': settings.max_word_distance,
                    'spellingSuggest': settings.use_spelling_suggest,
                    'contextLabel': settings.context_label,
                    'contextMatchBoost': settings.context_match_boost,
                    'sourceId': search.sourceId,
                };
                search.post_message('/api/ops/query', clientQuery, function(data) {
                    search.receive_ws_data(data, true);
                });

            } else {
                error("Please enter a query to start searching.");
            }
        } else if (!search.kb) {
            error("Server not responding, not connected.");
        }
    },

    // return the current search text
    get_search_text: function() {
        return search.search_query;
    },

    // overwrite: generic web socket receiver
    receive_ws_data: function(data, is_search) {
        busy(false);
        //console.log(data);
        if (data) {
            if (data.messageType === mt_Error && data.error.length > 0) {
                error(data.error);  // set an error

            } else if (data.messageType === mt_Disconnect) {
                search.assignedOperatorId = ''; // disconnect any operator
                search.operator_name = '';
                search.operator_typing = false;
                // add disconnected message if we've been typing
                if (search.chat_list && search.chat_list.length > 0) {
                    search.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: "operator disconnected"
                    });
                }
                update_chat_window();

            } else if (data.messageType === mt_Email) {
                search.know_email = true;
                hide_email();

            } else if (data.messageType === mt_SignIn) {
                if (data.errorMessage && data.errorMessage.length > 0) {
                    error(data.errorMessage);  // set an error
                    search.signed_in = false;
                } else {
                    // sign-in successful
                    search.signed_in = true;
                    sign_in_status(true);
                }
                // todo: show we have signed in

            } else if (data.messageType === mt_IsTyping) {
                search.operator_was_typing(true);

            } else if (data.messageType === mt_SignOut) {
                if (data.errorMessage && data.errorMessage.length > 0) {
                    error(data.errorMessage);  // set an error
                } else {
                    // sign-in successful
                    search.signed_in = false;
                    sign_in_status(false);
                }

            } else if (data.messageType === mt_OperatorAvailable) {
                // we're notified about a change in availability of the number of operators
                search.operator_count = data.operatorCount;
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    search.assignedOperatorId = data.assignedOperatorId;
                }
                show_chat_button(search.operator_count > 0 || (search.assignedOperatorId && search.assignedOperatorId.length > 0),
                    search.chat_list.length > 0);

            } else if (data.messageType === mt_OperatorChat) {
                // we're notified about a change in availability of the number of operators
                search.operator_count = data.operatorCount;
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    search.assignedOperatorId = data.assignedOperatorId;
                    if (data.operatorName) {
                        search.operator_name = data.operatorName;
                    } else {
                        search.operator_name = '';
                    }
                } else {
                    // no available operators
                    search.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: "no operators available"
                    });
                }
                update_chat_window();
                show_chat_button(search.operator_count > 0 || (search.assignedOperatorId && search.assignedOperatorId.length > 0),
                    search.chat_list.length > 0);

            } else if (data.messageType === mt_OperatorMessage) {

                // set the assigned operator
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    search.assignedOperatorId = data.assignedOperatorId;
                }
                // add an entry into the chat_list
                if (data.text && data.text.length > 0) {
                    search.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSimSage: true,
                        text: data.text,
                        urlList: [],
                    });
                    search.operator_typing = false;
                    update_chat_window();
                }

            } else if (data.messageType === mt_Message) {
                search.is_typing = false;

                if (is_search) {
                    search.semantic_search_results = [];
                    search.semantic_search_result_map = {};
                    search.semantic_set = {};
                    search.synset_list = []; // includes syn_sets of selected_syn_sets
                    search.spelling_suggestion = data.spellingCorrection; // set spelling suggestion if we have one
                }

                // set the assigned operator
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    search.assignedOperatorId = data.assignedOperatorId;
                    if (data.operatorName) {
                        search.operator_name = data.operatorName;
                    } else {
                        search.operator_name = '';
                    }
                }

                // did we get semantic search results?
                if (is_search && data.resultList) {
                    search.shard_size_list = data.shardSizeList;
                    search.semantic_set = data.semanticSet;
                    search.synset_list = data.contextStack;
                    data.resultList.map(function(sr) {
                        if (!sr.botResult) {
                            // enhance search result for display
                            if (sr.textIndex >= 0 && sr.textIndex < sr.textList.length) {
                                sr['index'] = sr.textIndex;  // inner offset index
                            } else {
                                sr['index'] = 0;  // inner offset index
                            }
                            sr['num_results'] = sr.textList.length;
                            search.semantic_search_results.push(sr);  // add item
                            search.semantic_search_result_map[sr.url] = sr;
                        }
                    });
                    search.num_results = data.totalDocumentCount;
                    let divided = data.totalDocumentCount / search.page_size;
                    search.num_pages = parseInt("" + divided);
                    if (parseInt("" + divided) < divided) {
                        search.num_pages += 1;
                    }
                }

                // did we get an bot reply?
                if (is_search) {
                    let dt = search.unix_time_convert(new Date().getTime());
                    search.bot_data = null;
                    if (data.hasResult && data.text && data.text.length > 0) {
                        search.bot_data = {"who": "Bot", "what": data.text, "when": dt, "url_list": []};
                        for (let i in data.urlList) {
                            if (data.urlList.hasOwnProperty(i)) {
                                search.bot_data.url_list.push(data.urlList[i]);
                            }
                        }
                    }
                }

                // copy the know email flag from our results
                if (!search.know_email && data.knowEmail) {
                    search.know_email = data.knowEmail;
                }

                // no results?
                if (is_search && !data.hasResult) {
                    // hide
                    hide_search_results();
                    // did we get assigned an operator?
                    if (search.assignedOperatorId && search.assignedOperatorId.length > 0) {
                        let text = search.operator_name ? "you are chatting with " + search.operator_name :
                            "you are chatting with an Operator"
                        search.chat_list.push({
                            timeStamp: new Date().getTime(),
                            isSpecialMessage: true,
                            text: text
                        });
                        update_chat_window();
                        show_chat_button(true, search.chat_list.length > 0);
                        show_chat();

                    } else {
                        show_no_results();
                    }

                } else if (is_search && search.semantic_search_results.length > 0) {
                    // hide if no actual results
                    show_search_results();
                }

                update_ui();
            }
        }
    },

    // get a preview url for the currently selected knowledge base
    get_preview_url: function() {
        return settings.base_url + '/api/document/preview/' + settings.organisationId + '/' + search.kb.id + '/' +
            search.get_client_id();
    },

    // change the number of items per page
    change_page_size: function(page_size) {
        search.page = 0;  // reset to page 0
        search.num_pages = 0;
        search.shard_size_list = [];
        search.page_size = parseInt(page_size);
        do_search();
    },

    // select the sort method
    change_sort: function(index) {
        for (let i in search.sort_list) {
            search.sort_list[i].selected = (i == index);
        }
    },

    // clear all search data and reset pagination
    clear_all_results: function() {
        search.last_query = "";
        search.num_results = 0;
        search.page = 0;  // reset to page 0
        search.num_pages = 0;
        search.shard_size_list = [];
        search.semantic_search_results = [];
        search.semantic_set = {};
        search.bot_data = null;
    },

    // reset the variables used in determining pagination if the query has changed
    reset_pagination: function(query_text) {
        if (search.last_query !== query_text) {
            search.last_query = query_text;
            search.page = 0;  // reset to page 0
            search.num_pages = 0;
            search.shard_size_list = [];
        }
        search.semantic_search_results = [];
        search.semantic_set = {};
    },

    // clean text - remove characters we use for special purposes
    cleanup_query_text: function(text) {
        // remove any : ( ) characters from text first (but not from http: and https:)
        text = text.replace(/\)/g, ' ');
        text = text.replace(/\(/g, ' ');
        text = text.replace(/:/g, ' ');
        text = text.replace(/http \/\//g, 'http://');
        text = text.replace(/https \/\//g, 'https://');
        return text;
    },

    // add text to the operator conversations
    do_chat: function(text) {
        if (search.kb && text.trim().length > 0) {
            let data = {
                organisationId: settings.organisationId,
                kbList: [search.kb.id],
                clientId: search.get_client_id(),
                assignedOperatorId: search.assignedOperatorId,
                text: text,
            };
            // add an entry into the chat_list
            search.chat_list.push({
                timeStamp: new Date().getTime(),
                isSimSage: false,
                text: text,
                urlList: [],
            });
            update_chat_window();
            search.post_message('/api/ops/client/chat', data, function(data) {
                search.receive_ws_data(data);
            });
        }
    },

    // user asks for help
    do_email: function(email_address) {
        if (email_address && email_address.trim().length > 0 && email_address.indexOf("@") > 0) {
            error('');
            let emailMessage = {
                'messageType': mt_Email,
                'organisationId': settings.organisationId,
                'kbList': [search.kb.id],
                'clientId': search.get_client_id(),
                'emailAddress': email_address,
            };
            search.post_message('/api/ops/email', emailMessage, function(data) {
                search.receive_ws_data(data, false);
            });
        }
    },

    // feedback to connected operator that the user is typing
    operator_was_typing: function(is_typing) {
        let now = new Date().getTime();
        if (is_typing) {
            search.operator_typing_last_seen = now + search.typing_timeout;
            if (!search.operator_typing && is_typing) {
                search.operator_typing = is_typing;
                update_chat_window();
            }
        } else if (search.operator_typing_last_seen < now  && search.operator_typing) {
            search.operator_typing = false;
            update_chat_window();
        }
    },

    // the user of this search interface is typing, send a message to SimSage
    user_is_typing: function() {
        let now = new Date().getTime();
        if (search.assignedOperatorId && search.assignedOperatorId.length > 0 && search.client_typing_last_seen < now) {
            search.client_typing_last_seen = now + search.typing_repeat_timeout;
            let data = {
                fromId: search.get_client_id(),
                toId: search.assignedOperatorId,
                isTyping: true
            };
            search.post_message('/api/ops/typing', data, function(data) {
            });
        }
    },

    // go to the previous page in the result set
    prev_page: function() {
        if (search.page > 0) {
            search.page -= 1;
            search.do_search(search.search_query, search.advanced_filter);
        }
    },

    // go to the next page in the result set
    next_page: function() {
        if ((search.page + 1) < search.num_pages) {
            search.page += 1;
            search.do_search(search.search_query, search.advanced_filter);
        }
    },

    // go to a specific page in the result set
    view_page: function(page) {
        alert("todo: implement view_page(" + page + ");");
    },

    // select a syn
    select_syn_set: function(word, index) {
        search.selected_syn_sets[word] = index;
    },

    // return a map with the selected syn-sets
    get_selected_syn_sets: function() {
        return search.selected_syn_sets;
    },

    // return a selected result by it's id from the list
    get_result_by_id: function(id) {
        for (let i in search.semantic_search_results) {
            if (search.semantic_search_results.hasOwnProperty(i)) {
                let sr = search.semantic_search_results[i];
                if (sr.urlId === id) {
                    return sr;
                }
            }
        }
        return null;
    },

    // return a result's urlId given a url
    get_url_id_from_url: function(url) {
        for (let i in search.semantic_search_results) {
            if (search.semantic_search_results.hasOwnProperty(i)) {
                let sr = search.semantic_search_results[i];
                if (sr.url === url) {
                    return sr.urlId;
                }
            }
        }
        return 0;
    },

    // turn a url into a preview image
    get_image_url_by_doc_url: function(url) {
        // set the image for this item
        let urlId = search.get_url_id_from_url(url);
        return settings.base_url + "/api/document/preview/" +
            settings.organisationId + "/" + search.kb.id + "/" +
            search.get_client_id() + "/" + urlId + "/-1";
    },

    set_selected_view: function(view_id) {
        search.selected_view = view_id;
    },

    // return true if the system has some bot results
    has_bot_results: function() {
        return search.bot_data && search.bot_data.when && search.bot_data.what;
    },

    has_spelling_suggestion: function() {
        return search.spelling_suggestion && search.spelling_suggestion.length > 0;
    },

    // replace the user's text with the spelling suggestion
    use_spelling_suggestion: function() {
        search.last_query = search.search_query;
        search.search_query = search.spelling_suggestion;
    },

    // return true if the system has some search results
    has_search_results: function() {
        return search.semantic_search_results && search.semantic_search_results.length > 0;
    },

    // return the query text of the last query
    get_search_query: function() {
        return search.adjust_size(search.search_query);
    },

    // return if we know the user's email address already
    know_users_email: function() {
        return search.know_email;
    },

    toggle_filters: function() {
        search.filters_visible = !search.filters_visible;
    },

    // add the search filters to the advanced filter structure
    add_db_filters: function() {
        if (!search.source || !search.is_db_source)
            return {}; // so source selected or not a db?
        let data = {};
        for (let i in search.source_list) {
            let source = search.source_list[i];
            if (source.id == search.sourceId) {
                for (let j in source.category_list) {
                    let md = source.category_list[j];
                    if (md.key === cat_type_plain || md.key === cat_type_two_level) {
                        let cats = search.get_category_selections(md);
                        if (cats.length > 0) {
                            data[md.metadata] = ["category"];
                            data[md.metadata].push(...cats);
                        }
                    } else if (md.key === cat_type_star_rating) {
                        if (md.rating !== undefined && md.rating >= 0 && md.rating <= 5) {
                            data[md.metadata] = ["rating", "" + md.rating];
                        }

                    } else if (md.key === num_type_money || md.key === num_type_range) {
                        let slider_name = "slider-" + md.metadata;
                        if (search.selected_sliders.hasOwnProperty(slider_name)) {
                            let slider = search.selected_sliders[slider_name];
                            // has changed positions?
                            if (slider.min_value > slider.min || slider.max_value < slider.max) {
                                data[md.metadata] = ["range", "" + slider.min_value, "" + slider.max_value];
                            }
                        }
                    }
                }
            }
        }
        // set the right sort type and metadata field
        for (let i in search.sort_list) {
            let sort_item = search.sort_list[i];
            if (sort_item.selected && sort_item["metadata"] !== '') {
                let md = sort_item["metadata"];
                data["sort"] = {};
                data["sort"][md] = sort_item["sort"];
                break;
            }
        }
        return data;
    },

    // return a list of selection items for a plain category selection system
    get_category_selections: function(cat) {
        let selection = [];
        if (cat && cat.items) {
            for (let i1 in cat.items) {
                let ci1 = cat.items[i1];
                if (ci1.selected) {
                    let has_l2_selection = false;
                    if (ci1.items) {
                        for (let i2 in ci1.items) {
                            let ci2 = ci1.items[i2];
                            if (ci2.selected) {
                                has_l2_selection = true;
                                selection.push(ci1.name + "::" + ci2.name);
                            }
                        }
                    }
                    if (!has_l2_selection) {
                        selection.push(ci1.name);
                    }
                }
            }
        }
        return selection;
    },

    // reset all filters for all sources
    clear_filters: function() {
        for (let i in search.source_list) {
            if (search.source_list.hasOwnProperty(i)) {
                let source = search.source_list[i];
                if (source.category_list && source.category_list.length > 0) {
                    for (let j in source.category_list) {
                        if (source.category_list.hasOwnProperty(j)) {
                            let md = source.category_list[j];
                            if (md.minValue || md.maxValue) {
                                md.left = md.minValue;
                                md.right = md.maxValue;
                            }
                            let slider_name = "slider-" + md.metadata;
                            if (search.selected_sliders.hasOwnProperty(slider_name)) {
                                let slider = search.selected_sliders[slider_name];
                                slider.min_value = slider.min;
                                slider.max_value = slider.max;
                            }
                            md.rating = -1;
                            if (md.items) {
                                for (let ci1 in md.items) {
                                    if (md.items.hasOwnProperty(ci1)) {
                                        md.items[ci1].selected = false;
                                        if (md.items[ci1].items) {
                                            let l2_items = md.items[ci1].items;
                                            for (let ci2 in l2_items) {
                                                if (l2_items.hasOwnProperty(ci2)) {
                                                    l2_items[ci2].selected = false;
                                                }
                                            }
                                        }
                                    }
                                }
                            } // if has items (level 1)

                        } // if categories has own property
                    } // for each category
                } // if has categories
            } // for each source
        }
        setup_categories();
    },

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // render dynamic HTML for the page content items

    // Render a single search-text result
    render_single_search_text_result: function(id, url, title, fragment, fragment_index, num_fragments) {
        let str = "<div class=\"search-result\">\n" +
            "          <div title=\"visit [url]\" class=\"search-text-width\">\n" +
            "              <a href=\"[url]\" target=\"_blank\"><span class=\"url-text\">[split-url]</span></a>\n" +
            "              <div title=\"visit [url]\" onclick=\"visit_url('[url]');\" class=\"more-details\"><span class=\"title-text\">[title]</span></div>\n" +
            "              <div><span class=\"result-text\">[fragment]</span></div>\n" +
            "              <div class=\"navigate-td\">\n";
        if (fragment_index > 0) {
            str += "              <span class=\"navigate-left\" title=\"view the previous relevant fragment in this document\" onclick=\"prev_fragment([id]);\"><img src=\"" + image_base + "images/left.svg\" class=\"navigate-left-image\" alt=\"previous\" /></span>\n";
        } else {
            str += "              <span class=\"no-navigate-left\" title=\"there is no previous fragment in this document\"><img src=\"" + image_base + "images/left-disabled.svg\" class=\"navigate-left-image\" alt=\"no previous\" /></span>\n";
        }
        if ((fragment_index + 1) < num_fragments) {
            str += "              <span class=\"navigate-right\" title=\"view the next relevant fragment in this document\" onclick=\"next_fragment([id]);\"><img src=\"" + image_base + "images/right.svg\" class=\"navigate-right-image\" alt=\"next\" /></span>\n";
        } else {
            str += "              <span class=\"no-navigate-right\" title=\"there is no next fragment in this document\"><img src=\"" + image_base + "images/right-disabled.svg\" class=\"navigate-right-image\" alt=\"no next\" /></span>\n";
        }
        str += "              <span class=\"navigate-text\" title=\"Scroll through other relevant search results on this page\">Scroll through other relevant search results on this page</span>\n" +
            "              </div>\n" +
            "          </div>\n" +

            "          <div title=\"view more details\" onclick=\"show_details([id]);\" class=\"search-image-width\">\n" +
            "              <img src=\"[thumbnail_src]\" alt=\"[title]\" class=\"result-image\"/>\n" +
            "          </div>\n" +
            "</div>\n";
        let fragment_str = esc_html(fragment)
            .replace(/{hl1:}/g, "<span class='hl1'>")
            .replace(/{:hl1}/g, "</span>")
            .replace(/{hl2:}/g, "<span class='hl2'>")
            .replace(/{:hl2}/g, "</span>");
        str = str
            .replace(/\[url]/g, esc_html(url))
            .replace(/\[split-url]/g, esc_html(url))
            .replace(/\[id]/g, esc_html(id))
            .replace(/\[thumbnail_src]/g, search.get_preview_url() + '/' + esc_html(id) + '/-1')
            .replace(/\[title]/g, title && title.length > 0 ? esc_html(title) : "(no title)")
            .replace(/\[fragment]/g, fragment_str);
        return str;
    },

    // Render a single search-database result
    render_single_search_db_result: function(id, url, title, html) {
        return "<div class='db-record'>" + html + "</div>";
    },

    // render a single image result
    render_search_image_result: function(id, url, title) {
        let str = "<div class=\"image-result\">" +
            "  <div class=\"image-image\" title=\"[title]\" onclick=\"show_details([id]);\">\n" +
            "    <img src=\"[thumbnail_src]\" alt=\"image\" class=\"result-image-image\"/>\n" +
            "  </div>\n" +
            "  <div class=\"image-text\" title=\"[title]\" onclick=\"show_details([id]);\">\n" +
            "    [title-short]\n" +
            "  </div>\n" +
            "</div>\n";
        let title_short = search.adjust_size(title, 40);
        str = str
            .replace(/\[url]/g, url)
            .replace(/\[id]/g, id)
            .replace(/\[thumbnail_src]/g, search.get_preview_url() + '/' + id + '/0')
            .replace(/\[title-short]/g, title_short && title_short.length > 0 ? title_short : "(no title)")
            .replace(/\[title]/g, title && title.length > 0 ? title : "(no title)");
        return str;
    },

    // return some hard-wired search results - repeated
    render_search_results: function() {
        if (search.is_db_source) {
            // render a set of DB records
            let reverse_list = search.semantic_search_results; // JSON.parse(JSON.stringify(search.semantic_search_results.reverse()));
            let str = "";
            for (let i in reverse_list) {
                if (reverse_list.hasOwnProperty(i)) {
                    let result = reverse_list[i];
                    if (result.url && result.textList && result.textList.length > 0) {
                        str += search.render_single_search_db_result(result.urlId, result.url, result.title, result.textList[0]);
                    }
                }
            }
            return str;

        } else if (search.selected_view === "text") {

            let str = "";
            for (let i in search.semantic_search_results) {
                if (search.semantic_search_results.hasOwnProperty(i)) {
                    let result = search.semantic_search_results[i];
                    if (result.url) {
                        str += search.render_single_search_text_result(result.urlId, result.url, result.title,
                            result.textList[result.textIndex], result.textIndex, result.textList.length);
                    }
                }
            }
            return str;

        } else {
            let str = "";
            for (let i in search.semantic_search_results) {
                if (search.semantic_search_results.hasOwnProperty(i)) {
                    let result = search.semantic_search_results[i];
                    if (result.url) {
                        str += search.render_search_image_result(result.urlId, result.url, result.title);
                    }
                }
            }
            str += "    <div class=\"end-marker-images\"></div>\n";
            return str;
        }
    },

    // render the pagination on-screen
    render_pagination: function() {
        let num_pages = search.num_pages > 0 ? search.num_pages : 1;
        let num_results = search.num_results + " results";
        if (search.num_results === 0) {
            num_results = "no results";
        } else if (search.num_results === 1) {
            num_results = "one result";
        }
        let page_str = "page " + (search.page + 1) + " of " + num_pages;
        let ps = search.page_size;
        let str = "         <span class=\"pagination-text\" title=\"" + num_results + "\">" + num_results + "</span>\n" +
            "            <span class=\"pagination-text page-size-sel\" title=\"\">\n" +
            "                <label>\n" +
            "                    <select name=\"page-size\" class=\"page-size-select dd-page-size\" onchange=\"do_change_page_size()\" title=\"set the number of results per page\">\n" +
            "                        <option value=\"5\" " + (ps===5 ? "selected" : "") + ">5 results per page</option>\n" +
            "                        <option value=\"10\" " + (ps===10 ? "selected" : "") + ">10 results per page</option>\n" +
            "                        <option value=\"15\" " + (ps===15 ? "selected" : "") + ">15 results per page</option>\n" +
            "                        <option value=\"20\" " + (ps===20 ? "selected" : "") + ">20 results per page</option>\n" +
            "                    </select><span class=\"dd-chevron-2\" title=\"please click on the text\">&#x2304;</span>\n" +
            "                </label>\n" +
            "            </span>\n";

        if (search.page > 0) {
            str += "         <span class=\"prev-page-box pagination-left\" title=\"go to the previous page\" onclick=\"prev_page()\">\n" +
                "                <span class=\"arrow-enabled\" alt=\"previous page\">&#x2190;</span>\n" +
                "            </span>\n";
        } else {
            str += "         <span class=\"prev-page-box-disabled pagination-left\" title=\"there is no previous page\">\n" +
                "                <span class=\"arrow-disabled\" alt=\"previous page disabled\">&#x2190;</span>\n" +
                "            </span>\n";
        }

        str += "         <span class=\"pagination-text\" title=\"" + page_str + "\">" + page_str + "</span>\n";
        // "            <span class=\"pagination-text\" title=\"page 2\"><a href=\"\" onclick=\"select_page(2);\">2</a></span>\n" +
        // "            <span class=\"pagination-text\" title=\"\">...</span>\n" +
        // "            <span class=\"pagination-text\" title=\"page 42\"><a href=\"\" onclick=\"select_page(42);\">42</a></span>\n" +
        // "            <span class=\"pagination-text\" title=\"page 43\"><a href=\"\" onclick=\"select_page(43);\">43</a></span>\n" +

        if (search.page + 1 < search.num_pages) {
            str += "         <span class=\"next-page-box\" title=\"go to the next page\" onclick=\"next_page()\">" +
                "                <span class=\"arrow-enabled\" alt=\"next page\">&#x2192;</span>\n" +
                "            </span>\n";
        } else {
            str += "         <span class=\"next-page-box-disabled\" title=\"there is no next page\">" +
                "                <span class=\"arrow-disabled\" alt=\"next page disabled\">&#x2192;</span>\n" +
                "            </span>\n";
        }

        str += "            <span class=\"view-type-box\">\n";

        // sorting if this is a database
        if (search.is_db_source && search.sort_list.length > 0) {
            str += "         <span class=\"sort-text\" title=\"sort by\">\n" +
                "                <label>\n" +
                "                    <select name=\"sort-by\" class=\"sort-select dd-sort\" onchange=\"do_change_sort()\" title=\"set the sort order of results\">\n";
            for (let i in search.sort_list) {
                if (search.sort_list.hasOwnProperty(i)) {
                    let sort = search.sort_list[i];
                    str += "<option value=\"" + i + "\" " + (sort.selected ? "selected" : "") + ">" + sort.name + "</option>\n";
                }
            }
            str += "                 </select><span class=\"dd-chevron\" title=\"please click on the text\">&#x2304;</span>\n" +
                "                </label>\n" +
                "            </span>\n";
        }

        if (!search.is_db_source && search.selected_view === "text") {
            str += "         <span class=\"pagination-text view-results-as-box\" title=\"view results as\">View results as: </span>\n";
            str +=
                "                <span class=\"view-text-outer-box text-view\" title=\"text view\" onclick=\"select_text_view()\">\n" +
                "                    <span class=\"view-text-box\">&nbsp;</span>\n" +
                "                    <span class=\"view-results-as-text\">Text</span>\n" +
                "                </span>\n";

            str +=
                "                <span class=\"view-images-box-disabled image-view\" title=\"image view\" onclick=\"select_image_view()\">\n" +
                "                    <span class=\"view-image-box-disabled\">&nbsp;</span>\n" +
                "                    <span class=\"view-results-as-text-disabled\">Image</span>\n" +
                "                </span>\n";
        } else if (!search.is_db_source) {
            str += "         <span class=\"pagination-text view-results-as-box\" title=\"view results as\">View results as: </span>\n";
            str +=
                "                <span class=\"view-text-outer-box-disabled text-view\" title=\"text view\" onclick=\"select_text_view()\">\n" +
                "                    <span class=\"view-text-box-disabled\">&nbsp;</span>\n" +
                "                    <span class=\"view-results-as-text-disabled\">Text</span>\n" +
                "                </span>\n";

            str +=
                "                <span class=\"view-images-box image-view\" title=\"image view\" onclick=\"select_image_view()\">\n" +
                "                    <span class=\"view-image-box\">&nbsp;</span>\n" +
                "                    <span class=\"view-results-as-text\">Image</span>\n" +
                "                </span>\n";
        }

        str += "            </span>\n";
        return str;
    },

    // render a single detail of the details view
    render_single_detail: function(label, text) {
        let str = "" +
            "    <div class=\"row-height align-top\">\n" +
            "            <span class=\"label\" title=\"[label]\">[label]</span><span class=\"text\" title=\"[text]\">[text]</span>\n" +
            "    </div>\n"
        str = str
            .replace(/\[label]/g, esc_html(label))
            .replace(/\[text]/g, esc_html(text));
        return str;
    },

    // render a single detail, but with a clickable url
    render_single_detail_url: function(label, url) {
        let str = "" +
            "    <div class=\"row-height align-top\">\n" +
            "            <span class=\"label\" title=\"[label]\">[label]</span><span class=\"url\" onclick=\"window.open('[url]', '_blank')\" title=\"[text]\">[text]</span>\n" +
            "    </div>\n"
        str = str
            .replace(/\[label]/g, esc_html(label))
            .replace(/\[text]/g, esc_html(url));
        return str;
    },

    // render the details popup window content
    render_details_view: function(url_id) {
        let result = search.get_result_by_id(url_id);
        if (result === null) return "";
        let str = "          <table class=\"details-table\">\n" +
            "                    <tbody><tr class=\"align-top whole-row\">\n" +
            "                        <td class=\"align-top row-1\">\n";
        str += search.render_single_detail_url("url", result.url);
        if (result.title) {
            str += search.render_single_detail("title", result.title);
        }
        if (result.urlId > 0) {
            str += search.render_single_detail("document id", result.urlId);
        }
        if (result.author) {
            str += search.render_single_detail("author", result.author);
        }
        if (result.documentType) {
            str += search.render_single_detail("document type", result.documentType);
        }
        if (result.binarySize > 0) {
            str += search.render_single_detail("document byte-size", search.size_to_str(result.binarySize));
        }
        if (result.textSize > 0) {
            str += search.render_single_detail("text byte-size", search.size_to_str(result.textSize));
        }
        if (result.source) {
            str += search.render_single_detail("source/origin", result.source);
        }
        if (result.created > 0) {
            str += search.render_single_detail("document created date/time", search.unix_time_convert(result.created));
        }
        if (result.lastModified > 0) {
            str += search.render_single_detail("document last-modified date/time", search.unix_time_convert(result.lastModified));
        }
        if (result.uploaded > 0) {
            str += search.render_single_detail("pipeline last-crawled date/time", search.unix_time_convert(result.uploaded));
        }
        if (result.converted > 0) {
            str += search.render_single_detail("pipeline last-converted date/time", search.unix_time_convert(result.converted));
        }
        if (result.parsed > 0) {
            str += search.render_single_detail("pipeline last-parsed date/time", search.unix_time_convert(result.parsed));
        }
        if (result.indexed > 0) {
            str += search.render_single_detail("pipeline last-indexed date/time", search.unix_time_convert(result.indexed));
        }
        if (result.previewed > 0) {
            str += search.render_single_detail("pipeline last-preview date/time", search.unix_time_convert(result.previewed));
        }
        if (result.numSentences > 0) {
            str += search.render_single_detail("number of sentences", result.numSentences);
        }
        if (result.numWords > 0) {
            str += search.render_single_detail("number of words", result.numWords);
        }
        if (result.numRelationships > 0) {
            str += search.render_single_detail("number of relationships", result.numRelationships);
        }
        for (let key in result.metadata) {
            // check if the property/key is defined in the object itself, not in parent
            if (key.indexOf('{') === -1 && result.metadata.hasOwnProperty(key)) {
                let value = result.metadata[key];
                if (value.indexOf("<") === -1) { // no tags or anything allowed - don't render
                    str += search.render_single_detail(key, value);
                }
            }
        }
        str += "                 </td>\n" +
            "                        <td rowspan=\"20\" class=\"image-row align-top\">\n" +
            "                            <img src=\"[image]\" class=\"preview-image\" alt=\"page preview\" />\n" +
            "                        </td>\n" +
            "                    </tr>\n" +
            "                    </tbody>\n" +
            "                </table>\n";
        str = str
            .replace(/\[url]/g, esc_html(result.url))
            .replace(/\[image]/g, search.get_preview_url() + '/' + esc_html(url_id) + '/0');
        return str;
    },


    // render a single category item
    render_single_category_item: function(title, item_obj_list) {
        let str = "<div class=\"category-item\">\n" +
            "  <div class=\"category-title\" title=\"" + title + "\">" + title + "</div>\n";
        for (let i in item_obj_list) {
            if (item_obj_list.hasOwnProperty(i)) {
                let item = item_obj_list[i];
                let frequency_str = "";
                if (item.frequency > 1) {
                    frequency_str = " (" + item.frequency + ")";
                }
                str += "<div class=\"category-text\" title=\"further refine your search using " + item.word + "\"" +
                    " onclick=\"add_text_to_search('" + esc_html(item.word) + "');\">" + search.adjust_size(esc_html(item.word), 20) + frequency_str + "</div>\n";
            }
        }
        str += "</div>\n";
        return str;
    },

    // render a synset
    render_single_synset: function(synset) {
        let result = [];
        let syn_set = search.get_synset(synset);
        if (syn_set) {
            let word = syn_set["word"];
            let clouds = syn_set["clouds"];
            let selected = search.selected_syn_sets[word.toLowerCase().trim()];
            if (clouds.length > 1) {
                result.push('<div class="synset-entry">');
                result.push('<div class="synset-title" title="select different meanings of \'' + word +'\'">' + word + '</div>');
                result.push('<select class="synset-selector" onchange=\'select_syn_set("' + word + '",this.selectedIndex - 1);\'>');
                result.push('<option value="-1">all meanings</option>');
                for (let i in clouds) {
                    if (clouds.hasOwnProperty(i)) {
                        if (selected === i) {
                            result.push('<option value="' + i + '" selected>' + clouds[i] + '</option>');
                        } else {
                            result.push('<option value="' + i + '">' + clouds[i] + '</option>');
                        }
                    }
                }
                result.push('</select>');
                result.push('</div>');
            }
        }
        return result.join('\n');
    },

    // render the rhs category item lists
    render_categories: function() {
        let str = "";
        for (let key in search.synset_list) {
            if (search.synset_list.hasOwnProperty(key)) {
                str += search.render_single_synset(search.synset_list[key]);
            }
        }
        let counter = 0;
        for (let key in search.semantic_set) {
            counter += 1;
        }
        if (search.source && search.source.category_list) {
            counter += search.source.category_list.length;
        }
        if (counter > 0) {
            if (search.filters_visible) {
                let triangle = "&#x25BC;"
                str += "<div><span class=\"category-items-dropdown-header\" onclick=\"toggle_filters()\">" + triangle + " Filters</span>";
                if (search.is_db_source) {
                    str += "<span class=\"category-clear-filters\" onclick=\"clear_filters()\" title=\"reset all items below to their default values\">&#x1f5d8; Clear filters</span>";
                }
                str += "</div>";

                // render categories
                if (search.source && search.source.category_list) {
                    for (let i in search.source.category_list) {
                        if (search.source.category_list.hasOwnProperty(i)) {
                            let cat = search.source.category_list[i];
                            if (cat) {
                                if (cat.key === cat_type_two_level && cat.displayName && cat.items && cat.items.length > 0) {
                                    str += search.source_category_render_two_level(cat);

                                } else if (cat.key === cat_type_star_rating && cat.displayName) {
                                    str += search.render_star_rating(cat);

                                } else if (cat.key === cat_type_plain && cat.displayName && cat.items && cat.items.length > 0) {
                                    str += search.source_category_render_one_level(cat);

                                } else if ((cat.key === num_type_money || cat.key === num_type_range) && cat.displayName) {
                                    str += search.render_slider(cat);
                                }

                            } // if cat is valid
                        } // if has own-property
                    } // for each source category list item
                } // if has valid category list

                // render semantics
                for (let key in search.semantic_set) {
                    if (search.semantic_set.hasOwnProperty(key)) {
                        str += search.render_single_category_item(key, search.semantic_set[key]);
                    }
                }

            } else {
                let triangle = "&#x25BA;"
                str += "<div><span class=\"category-items-dropdown-header\" onclick=\"toggle_filters()\">" + triangle + " Filters</span></div>"
            }
        }
        return str;
    },

    // render the rhs category item lists
    get_sliders: function() {
        let slider_list = [];
        if (search.filters_visible) {
            if (search.source && search.source.category_list) {
                for (let i in search.source.category_list) {
                    if (search.source.category_list.hasOwnProperty(i)) {
                        let cat = search.source.category_list[i];
                        if (cat) {
                            if ((cat.key === num_type_money || cat.key === num_type_range) && cat.displayName && cat.metadata) {
                                let slider = search.selected_sliders["slider-" + cat.metadata];
                                slider.metadata = "slider-" + cat.metadata;
                                slider_list.push(slider);
                            }

                        } // if cat is valid
                    } // if has own-property
                } // for each source category list item
            } // if has valid category list
        }
        return slider_list;
    },

    // render a two level category item set
    source_category_render_two_level(cat) {
        let str = "";
        if (cat && cat.key === cat_type_two_level && cat.displayName && cat.items && cat.items.length > 0) {
            str += "  <div class=\"title-box\">\n" +
                "       <div class=\"title\">" + esc_html(cat.displayName) + "</div>\n" +
                "     </div>\n"
            for (let ci1 in cat.items) {
                if (cat.items.hasOwnProperty(ci1)) {
                    let item1 = cat.items[ci1];
                    if (item1.selected) {
                        str += "  <div class=\"item-box\">\n" +
                            "       <div class=\"top-level-selected\" onclick=\"source_category2_select('" + esc_html(cat.displayName) + "', '" + esc_html(item1.name) + "', '" + esc_html(cat.key) + "')\">" +
                            "         <span class=\"level-one-arrow\" title=\"close category\">&#x25BC;</span>\n" +
                            "         <span class=\"category-head-selected\" title=\"" + esc_html(item1.name) + "\">" + esc_html(item1.name) + "</span>\n" +
                            "         <span class=\"number-box\" title=\"" + esc_html(item1.count) + "\">" + esc_html(item1.count) + "</span>\n" +
                            "       </div>\n";

                        if (item1.items && item1.items.length > 0) {
                            for (let ci2 in item1.items) {
                                if (item1.items.hasOwnProperty(ci2)) {
                                    let item2 = item1.items[ci2];
                                    let head_style = "category-head";
                                    if (item2.selected) {
                                        head_style = "category-head-selected";
                                    }
                                    str += "  <div class=\"level-two-ident\" onclick=\"source_category2_l2_select('" + esc_html(cat.displayName) + "', '" + esc_html(item2.name) + "', '" + esc_html(cat.key) + "')\">" +
                                        "       <span class=\"level-two-hyphen\">-</span>\n" +
                                        "       <span class=\"" + head_style + "\" title=\"" + esc_html(item2.name) + "\">" + esc_html(item2.name) + "</span>\n" +
                                        "       <span class=\"number-box\" title=\"" + esc_html(item2.count) + "\">" + esc_html(item2.count) + "</span>\n" +
                                        "     </div>\n"
                                }
                            }
                        }
                        str += "</div>\n";
                    } else {
                        str += "  <div class=\"item-box\" onclick=\"source_category2_select('" + esc_html(cat.displayName) + "', '" + esc_html(item1.name) + "', '" + esc_html(cat.key) + "')\">\n" +
                            "       <div><span class=\"not-selected\" title=\"open category\">&#x25BA;</span>\n" +
                            "         <span class=\"category-head\" title=\"" + esc_html(item1.name) + "\">" + esc_html(item1.name) + "</span>\n" +
                            "         <span class=\"number-box\" title=\"" + esc_html(item1.count) + "\">" + esc_html(item1.count) + "</span>\n" +
                            "       </div>\n" +
                            "     </div>\n";
                    }
                }
            }
        } // end of if two-level
        return  str;
    },

    // render a one level category item set
    source_category_render_one_level(cat) {
        let str = "";
        if (cat && cat.displayName && cat.items && cat.items.length > 0) {
            let dp = esc_html(cat.displayName);
            let dp_class = "text-" + dp.replace(/ /g, "-");
            let type = esc_html(cat.key);
            let filter_text = "";
            if (cat.filter) {
                filter_text = cat.filter;
            }
            let filter_lwr = filter_text.toLowerCase();
            str += "  <div class=\"title-box\">\n" +
                "       <div class=\"title\">" + dp + "</div>\n" +
                "     </div>\n" +
                "     <div class=\"search-box\">\n" +
                "       <label><input type=\"text\" class=\"" + dp_class + "\" placeholder=\"Search for " + dp + "...\" value=\"" + filter_text + "\" onkeyup=\"set_one_level_filter('" + dp + "', '" + type + "', '" + dp_class + "');\" /></label>\n" +
                "     </div>\n";

            let item_counter = 0;
            for (let ci1 in cat.items) {
                if (cat.items.hasOwnProperty(ci1)) {
                    let item1 = cat.items[ci1];
                    if (filter_text.length === 0 || item1.name.toLowerCase().indexOf(filter_lwr) >= 0) {
                        if (item1.selected) {
                            str += "  <div class=\"item-box\">\n" +
                                "       <div class=\"top-level-selected\" onclick=\"source_category1_select('" + dp + "', '" + esc_html(item1.name) + "', '" + type + "')\">" +
                                "         <span class=\"single-level-box\" title=\"close category\"><input type=\"checkbox\" class=\"single-level-cb-selected\" /></span>\n" +
                                "         <span class=\"category-head-selected\" title=\"" + esc_html(item1.name) + "\">" + esc_html(item1.name) + "</span>\n" +
                                "         <span class=\"number-box\" title=\"" + esc_html(item1.count) + "\">" + esc_html(item1.count) + "</span>\n" +
                                "       </div>\n" +
                                "     </div>\n";
                            item_counter += 1;
                        }
                    }
                }
            } // for each selected item

            // the non selected items, if there is still room
            for (let ci1 in cat.items) {
                if (cat.items.hasOwnProperty(ci1)) {
                    let item1 = cat.items[ci1];
                    if (filter_text.length === 0 || item1.name.toLowerCase().indexOf(filter_lwr) >= 0) {
                        if (!item1.selected && item_counter < search.source_level_one_categories_max_items) {
                            str += "  <div class=\"item-box\" onclick=\"source_category1_select('" + dp + "', '" + esc_html(item1.name) + "', '" + type + "')\">\n" +
                                "       <div><span class=\"single-level-box\" title=\"open category\"><input type=\"checkbox\" class=\"single-level-cb\" /></span>\n" +
                                "         <span class=\"category-head\" title=\"" + esc_html(item1.name) + "\">" + esc_html(item1.name) + "</span>\n" +
                                "         <span class=\"number-box\" title=\"" + esc_html(item1.count) + "\">" + esc_html(item1.count) + "</span>\n" +
                                "       </div>\n" +
                                "     </div>\n";
                            item_counter += 1;
                        }
                    }
                    // enough items displayed
                    if (item_counter >= search.source_level_one_categories_max_items) {
                        break;
                    }
                }
            } // for each no-selected item

        } // end of if plain
        return  str;
    },

    // render a star rating system
    render_star_rating: function(cat) {
        let dp = esc_html(cat.displayName);
        let ss = "&#x2605;"
        let sc = "&#x2606;"
        let c = ["star-row", "star-row", "star-row", "star-row", "star-row", "star-row"];
        if (cat.rating >= 0 && cat.rating <= 5) {
            c[cat.rating] = "star-row-selected";
        }
        let str = "  <div class=\"ratings-box\">\n" +
            "            <div class=\"star-title-box\">\n" +
            "                <div class=\"title\">" + esc_html(cat.displayName) + "</div>\n" +
            "            </div>\n\n" +
            "            <div class=\"star-box\">\n" +
            "                <div class=\""+c[5]+"\" onclick=\"select_rating('" + dp + "', 5)\">" + ss + ss + ss + ss + ss + "</div>\n" +
            "                <div class=\""+c[4]+"\" onclick=\"select_rating('" + dp + "', 4)\">" + sc + ss + ss + ss + ss + "</div>\n" +
            "                <div class=\""+c[3]+"\" onclick=\"select_rating('" + dp + "', 3)\">" + sc + sc + ss + ss + ss + "</div>\n" +
            "                <div class=\""+c[2]+"\" onclick=\"select_rating('" + dp + "', 2)\">" + sc + sc + sc + ss + ss + "</div>\n" +
            "                <div class=\""+c[1]+"\" onclick=\"select_rating('" + dp + "', 1)\">" + sc + sc + sc + sc + ss + "</div>\n" +
            "                <div class=\""+c[0]+"\" onclick=\"select_rating('" + dp + "', 0)\">" + sc + sc + sc + sc + sc + "</div>\n" +
            "            </div>\n" +
            "        </div>\n";
        return str;
    },

    // render a range slider
    render_slider: function(cat) {
        let title = cat.displayName;
        let dp_class = "slider-" + cat.metadata;
        if (search.selected_sliders.hasOwnProperty(dp_class)) {
            let slider = search.selected_sliders[dp_class];
            return "   <div class=\"slider-item-box\">\n" +
                "            <div class=\"slider-title-box\">\n" +
                "                <div class=\"title\">" + esc_html(title) + "</div>\n" +
                "            </div>\n\n" +
                "            <div class=\"slider-values\">\n" +
                "                <div class=\"" + dp_class + "-value\"></div>\n" +
                "            </div>\n\n" +
                "            <div class=\"slider-body\">\n" +
                "               <div class=\"" + dp_class + "\">\n" +
                "               </div>\n" +
                "            </div>\n" +
                "        </div>\n";
        }
        return "";
    },

    // start the process of moving a slider button
    set_slider: function(metadata, min, max) {
        if (metadata && search.selected_sliders.hasOwnProperty(metadata)) {
            let slider = search.selected_sliders[metadata];
            slider["min_value"] = min;
            slider["max_value"] = max;
            if (slider.min < min || slider.max > max) {
                do_search();
            }
        }
    },

    // select a star-rating row
    select_rating: function(display_name, rating) {
        if (display_name) {
            let cat = search.get_source_category_by_name_type(display_name, cat_type_star_rating, null);
            if (cat) {
                // not set?
                if (cat.rating === undefined) {
                    cat.rating = rating;
                } else if (cat.rating === rating) { // click again?  de-select
                    cat.rating = -1;
                } else {
                    cat.rating = rating; // just set
                }
            }
        }
    },

    // select an item in a one level tree
    source_category1_select: function(display_name, category_name, category_type) {
        let cat = search.get_source_category_by_name_type(display_name, category_type, null);
        if (cat && cat.items) {
            for (let j in cat.items) {
                if (cat.items.hasOwnProperty(j)) {
                    let item1 = cat.items[j];
                    if (item1.name === category_name) {
                        item1.selected = !item1.selected;
                    }
                }
            }
        }
    },

    // select a category level 1 item in a two level tree
    source_category2_select: function(display_name, category_name, category_type) {
        let cat = search.get_source_category_by_name_type(display_name, category_type, null);
        if (cat && cat.items) {
            for (let j in cat.items) {
                if (cat.items.hasOwnProperty(j)) {
                    let item1 = cat.items[j];
                    if (item1.name === category_name) {
                        item1.selected = !item1.selected;
                    } else {
                        item1.selected = false;
                    }
                    if (!item1.selected && item1.items) {
                        for (let i in item1.items) {
                            if (item1.items.hasOwnProperty(i)) {
                                item1.items[i].selected = false;
                            }
                        }
                    }
                }
            }
        }
    },

    // select a category level 2 item in a two level tree
    source_category2_l2_select: function(display_name, category_name, category_type) {
        let cat = search.get_source_category_by_name_type(display_name, category_type, null);
        if (cat && cat.items) {
            for (let j in cat.items) {
                if (cat.items.hasOwnProperty(j)) {
                    let item1 = cat.items[j];
                    if (item1.items) {
                        for (let i in item1.items) {
                            if (item1.items.hasOwnProperty(i)) {
                                let item2 = item1.items[i];
                                if (item2.name === category_name) {
                                    item2.selected = !item2.selected;
                                } else {
                                    item2.selected = false;
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    set_one_level_filter: function(display_name, category_type, filter_text) {
        let cat = search.get_source_category_by_name_type(display_name, category_type, null);
        if (cat) {
            cat.filter = filter_text;
        }
    },

    // return the category of a source by display_name / type, null on fail
    get_source_category_by_name_type(display_name, category_type, category_type_2) {
        if (search.source && search.source.category_list) {
            for (let i in search.source.category_list) {
                if (search.source.category_list.hasOwnProperty(i)) {
                    let cat = search.source.category_list[i];
                    if (cat.displayName === display_name && (cat.key === category_type || cat.key === category_type_2)) {
                        return cat;
                    }
                }
            }
        }
        return null;
    },

    // render an operator part of the conversation
    render_chat: function(chat) {
        let time_str = chat.timeStamp ? search.unix_time_convert(chat.timeStamp) : "";
        if (chat.isSpecialMessage) {
            return "             <div class=\"disconnected-box\">\n" +
                "                        <div class=\"disconnected-line\">\n" +
                "                            <span class=\"disconnected-label\">" + esc_html(chat.text) + "</span>\n" +
                "                            <span class=\"hyphen\">-</span>\n" +
                "                            <span class=\"time\">" + time_str + "</span>\n" +
                "                        </div>\n" +
                "                    </div>\n";
        } else {
            let text_str = esc_html(chat.text ? chat.text : "");
            if (chat.isSimSage) {
                let operator_name = search.operator_name ? search.operator_name : "Operator";
                let url_str = "";
                if (chat.urlList) {
                    for (let j in chat.urlList) {
                        if (chat.urlList.hasOwnProperty(j)) {
                            let url = esc_html(chat.urlList[j]);
                            url_str += "<div class=\"url\" title=\"" + url + "\" onclick=\"window.open('" + url + "', '_blank');\">" + url + "</div>\n"
                        }
                    }
                }
                return "                 <div class=\"operator-box\">\n" +
                    "                        <div class=\"operator-line\">\n" +
                    "                            <span class=\"operator-label\">" + operator_name + "</span>\n" +
                    "                            <span class=\"hyphen\">-</span>\n" +
                    "                            <span class=\"time\">" + time_str + "</span>\n" +
                    "                        </div>\n" +
                    "                        <div class=\"operator-text-box\">\n" +
                    "                            <div class=\"operator-text\">" + text_str + "</div>\n" +
                    url_str +
                    "                        </div>\n" +
                    "                    </div>\n";
            } else {
                return "             <div class=\"user-box\">\n" +
                    "                        <div class=\"user-line\">\n" +
                    "                            <span class=\"user-label\">You</span>\n" +
                    "                            <span class=\"hyphen\">-</span>\n" +
                    "                            <span class=\"time\">" + time_str + "</span>\n" +
                    "                        </div>\n" +
                    "                        <div class=\"user-text\">" + text_str + "</div>\n" +
                    "                    </div>\n";
            }
        }
    },

    render_typing_dots: function() {
        return "     <div class=\"left-box-white\">\n" +
            "            <span class=\"typing-dots-box\"><img src=\"" + image_base + "images/dots.gif\" class=\"typing-dots-image\" alt=\"typing\" /></span>\n" +
            "        </div>\n";
    },

    // render some sample operator chat text
    render_chats: function() {
        let str = "";
        for (let i in search.chat_list) {
            if (search.chat_list.hasOwnProperty(i)) {
                str += search.render_chat(search.chat_list[i]);
            }
        }
        if (search.operator_typing) {
            str += search.render_typing_dots();
        }
        return str;
    },

    // render the available knowledge-bases
    render_kbs: function() {
        let str1 = "";
        for (let i in search.kb_list) {
            if (search.kb_list.hasOwnProperty(i)) {
                let kb = search.kb_list[i];
                if (search.kb && search.kb.id === kb.id) {
                    str1 += "<option value=\"" + esc_html(kb.id) + "\" selected>" + esc_html(kb.name) + "</option>";
                } else {
                    str1 += "<option value=\"" + esc_html(kb.id) + "\">" + esc_html(kb.name) + "</option>";
                }
            }
        }
        return str1;
    },

    // render the sources for the selected knowledge-base
    render_sources: function() {
        let str2 = "<option value=\"\">All Sources</option>";
        for (let i in search.source_list) {
            if (search.source_list.hasOwnProperty(i)) {
                let source = search.source_list[i];
                if (search.source && search.source.id === source.id) {
                    str2 += "<option value=\"" + esc_html(source.id) + "\" selected>" + esc_html(source.name) + "</option>";
                } else {
                    str2 += "<option value=\"" + esc_html(source.id) + "\">" + esc_html(source.name) + "</option>";
                }
            }
        }
        return str2;
    },

    // render the bot balloon text for an example SimSage bot answer
    render_bot: function() {
        if (search.has_bot_results()) {
            let str = "      <div class=\"speech-bubble\">\n" +
                "                <span onclick=\"close_bot()\" title=\"Close\" class=\"close-box\">\n" +
                "                    <img src=\"" + image_base + "images/close.svg\" class=\"close-image\" alt=\"close\" />\n" +
                "                </span>\n" +
                "                <div class=\"title\">\n" +
                "                    <span class=\"bot-image-box\">\n" +
                "                        <img src=\"" + image_base + "images/person.svg\" class=\"bot-image\" alt=\"bot\" />\n" +
                "                    </span>\n" +
                "                    <span class=\"bot-label-text\" title=\"Bot\">Bot,&nbsp;" + search.bot_data.when + "</span>\n" +
                "                </div>\n" +
                "                <div class=\"bot-text\">\n" +
                "                    <span class=\"bot-reply-text\">" + esc_html(search.bot_data.what) + "</span>\n" +
                "                </div>\n";
            for (let i in search.bot_data.url_list) {
                if (search.bot_data.url_list.hasOwnProperty(i)) {
                    let url = esc_html(search.bot_data.url_list[i]);
                    str += "             <div class=\"bot-link\">\n" +
                        "                    <span class=\"bot-link-text\" title=\"open " + url + "\" onclick=\"window.open('" + url + "', '_blank');\">" + url + "</span>\n" +
                        "                </div>\n";
                }
            }
            str += "         </div>\n";
            return str;
        }
        return "";
    },

    // render a spelling suggestion
    render_spelling_suggestion: function() {
        if (search.has_spelling_suggestion()) {
            let str = "      <div class=\"speech-bubble\">\n" +
                "                <span onclick=\"close_spelling_suggestion()\" title=\"Close\" class=\"close-box\">\n" +
                "                    <img src=\"" + image_base + "images/close.svg\" class=\"close-image\" alt=\"close\" />\n" +
                "                </span>\n" +
                "                <div class=\"title\">\n" +
                "                    <span class=\"spelling-label-text\" title=\"Did you mean...\">Did you mean,&nbsp;\"" + search.spelling_suggestion + "\"?</span>\n" +
                "                </div>\n" +
                "                <div class='button-box'>" +
                "                    <button class='yes-button' value='yes' title='yes' onclick='use_spelling_suggestion()'>yes</button>" +
                "                    <button class='no-button' value='no' title='no' onclick='close_spelling_suggestion()'>no</button>" +
                "                </div>" +
                "            </div>\n";
            return str;
        }
        return "";
    },


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // get the knowledge-base information for this organisation (set in settings.js)
    init_simsage: function() {
        console.log("simsage init");
        // setup a polyfill for IE 11 functions we use
        search.ie11_polyfill();
        let url = settings.base_url + '/api/knowledgebase/search/info/' + encodeURIComponent(settings.organisationId) + '/' + encodeURIComponent(search.get_client_id());
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
                search.kb_list = data.kbList;
                search.operator_count = data.operatorCount;
                show_chat_button(search.operator_count > 0 || (search.assignedOperatorId && search.assignedOperatorId.length > 0),
                    search.chat_list.length > 0);
                // wordpress override
                if (settings && settings.kbId && settings.kbId.length > 0) {
                    search.kb = {"name": "wordpress knowledge-base", "id": settings.kbId, "sourceList": []};
                    search.on_change_kb(search.kb.id);
                } else if (search.kb_list.length > 0) {
                    search.kb = search.kb_list[0];
                    search.on_change_kb(search.kb.id);
                    show_kb_dropdown();
                }
                error('');
                search.connection_retry_count = 1;
                busy(false);
                // connect to the socket system
                search.connect();
                // setup is-typing check
                window.setInterval(function() {search.operator_was_typing(false)}, 1000);
                // update the UI
                update_ui();
            }

        }).fail(function (err) {
            if (search.connection_retry_count > 1) {
                error('not connected, trying to re-connect, please wait (try ' + search.connection_retry_count + ')');
            } else {
                error(err);
            }
            setTimeout(function() { search.init_simsage() }, 5000); // try and re-connect as a one-off in 5 seconds
            search.connection_retry_count += 1;
        });
    },


    // notify that the selected knowledge-base has changed
    on_change_kb: function(kb_id) {
        search.source_list = [];
        search.is_db_source = false;
        for (let i in search.kb_list) {
            if (search.kb_list.hasOwnProperty(i)) {
                let kb = search.kb_list[i];
                if (kb.id === kb_id) {
                    search.kb = kb;
                    for (let j in kb.sourceList) {
                        if (kb.sourceList.hasOwnProperty(j)) {
                            let source = kb.sourceList[j];
                            search.source_list.push({"name": source.name, "id": source.sourceId,
                                                     "category_list": source.categoryList})
                        }
                    }
                    // select a default source if there is only one
                    if (search.source_list.length === 1) {
                        search.on_change_source(search.source_list[0].id);
                    }
                }
            }
        }
        // setup the drop down boxes in the UI
        setup_dropdowns();
        // deal with domains
        search.setup_domains();
        search.setup_office_365_user();
        // setup any potential domains
        search.change_domain(null);
    },

    // UI changes selected source
    on_change_source: function(source_id) {
        search.sourceId = source_id;
        search.source = null;
        search.is_db_source = false;
        search.sort_list = [];
        search.selected_sliders = {};
        for (let i in search.source_list) {
            if (search.source_list.hasOwnProperty(i)) {
                let source = search.source_list[i];
                if (source.id == source_id) {
                    search.source = source;
                    // force display of filters if db system
                    if (source.category_list && source.category_list.length > 0) {
                        search.filters_visible = true;
                        search.is_db_source = true;
                        search.page_size = 10;
                        // setup sorting if applicable
                        for (let j in source.category_list) {
                            if (source.category_list.hasOwnProperty(j)) {
                                let md = source.category_list[j];
                                if (md.sort && md.sortAscText && md.sortDescText) {
                                    search.sort_list.push({"name": md.sortAscText, "metadata": md.metadata, "sort": "asc", "selected": md.sortDefault === "asc"});
                                    search.sort_list.push({"name": md.sortDescText, "metadata": md.metadata, "sort": "desc", "selected": md.sortDefault === "desc"});
                                }
                                if (md.key === num_type_money || md.key === num_type_range) {
                                    let monetary = (md.key === num_type_money);
                                    let min_value = md.minValue;
                                    let max_value = md.maxValue;
                                    min_value = Math.floor(min_value);
                                    max_value = Math.ceil(max_value);
                                    // set the min / max values
                                    search.selected_sliders["slider-" + md.metadata] = {"min": min_value, "min_value": min_value,
                                                                                        "max": max_value, "max_value": max_value,
                                                                                        "currency": search.currency_symbol, "monetary": monetary};
                                }
                            }
                        } // for each category
                        show_pagination(); // needed for sorting etc.
                    }
                } // if is correct source
            }
        }
        if (!search.is_db_source) {
            hide_search_results(); // hide otherwise
        } else {
            do_search();
        }
    },

    get_is_db: function() {
        return search.is_db_source;
    },

    // connect to SimSage, called from init_simsage()
    connect: function() {
        if (!search.is_connected) {
            // this is the socket end-point
            let socket = new SockJS(search.ws_base);
            search.stompClient = Stomp.over(socket);
            search.stompClient.connect({},
                function () {
                    search.stompClient.subscribe('/chat/' + search.get_client_id(), function (answer) {
                        search.receive_ws_data(JSON.parse(answer.body), false);
                    });
                    search.set_connected(true);
                },
                function(err) {
                    console.error(err);
                    search.set_connected(false);
                });
        }
    },

    set_connected: function(is_connected) {
        search.is_connected = is_connected;
        if (!is_connected) {
            if (search.stompClient !== null) {
                search.stompClient.disconnect();
                search.stompClient = null;
            }
            if (search.connection_retry_count > 1) {
                error('not connected, trying to re-connect, please wait (try ' + search.connection_retry_count + ')');
            }
            setTimeout(search.connect, 5000); // try and re-connect as a one-off in 5 seconds
            search.connection_retry_count += 1;

        } else {
            error('');
            search.connection_retry_count = 1;
            search.stompClient.debug = null;
        }
    },

    // post a message to the operator end-points
    post_message: function(endPoint, data, callback) {
        let url = settings.base_url + endPoint;
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
                if (callback) {
                    callback(data);
                }
            }
        }).fail(function (err) {
            console.error(JSON.stringify(err));
            error(err);
        });
    },

    // return a list of domains (or empty list) for the selected kb
    get_domain_list_for_current_kb: function() {
        if (search.kb && search.kb.sourceList) {
            let list = [];
            for (let i in search.kb.sourceList) {
                if (search.kb.sourceList.hasOwnProperty(i)) {
                    let source = search.kb.sourceList[i];
                    if (source && source.domainType && source.domainType.length > 0) {
                        list.push(source);
                    }
                }
            }
            return list;
        }
        return [];
    },

    // get the first (and for now the only) AAD domain you can find - or return null
    get_azure_ad_domain: function() {
        if (search.kb && search.kb.sourceList) {
            for (let i in search.kb.sourceList) {
                if (search.kb.sourceList.hasOwnProperty(i)) {
                    let domain = search.kb.sourceList[i];
                    if (domain.domainType === 'aad') {
                        domain.kbId = search.kb.id;
                        return domain;
                    }
                }
            }
        }
        return null;
    },

    // get selected domain - or return empty source
    get_selected_domain: function() {
        if (search.kb && search.kb.sourceList) {
            for (let i in search.kb.sourceList) {
                if (search.kb.sourceList.hasOwnProperty(i)) {
                    let source = search.kb.sourceList[i];
                    if (parseInt(source.sourceId) === parseInt(search.sourceId)) {
                        source.kbId = search.kb.id;
                        return { sourceId: source.sourceId, domain: source.name, domain_type: source.domainType };
                    }
                }
            }
        }
        return {sourceId: 0, domain: "", domain_type: ""};
    },

    // setup all AD domains (not AAD)
    setup_domains: function() {
        let domain_list = search.get_domain_list_for_current_kb();
        let ui_domain_list = [];
        for (let i in domain_list) {
            if (domain_list.hasOwnProperty(i)) {
                let domain = domain_list[i];
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
        }
        if (ui_domain_list.length > 0) {
            search.sourceId = ui_domain_list[0].sourceId;
        }
        setup_sign_in(ui_domain_list);
    },

    // user changes the selected domain, return true if this domain requires a redirect authentication
    change_domain: function(domain_id) {
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

    // create a random guid
    guid: function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    },

    // do we hav access to local-storage?
    has_local_storage: function() {
        try {
            let test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch(e) {
            return false;
        }
    },

    // get or create a session based client id for SimSage usage
    get_client_id: function() {
        let clientId = "";
        let key = 'simsearch_client_id';
        let hasLs = search.has_local_storage();
        if (hasLs) {
            clientId = localStorage.getItem(key);
        }
        if (!clientId || clientId.length === 0) {
            clientId = search.guid(); // create a new client id
            if (hasLs) {
                localStorage.setItem(key, clientId);
            }
        }
        return clientId;
    },

    // do the actual sign-in
    do_sign_in: function(source_id, user_name, password) {
        search.sourceId = source_id; // set local source-id
        let domain = search.get_selected_domain(source_id);
        if (domain && domain.domainType === 'aad') { // azure ad
            let user = search.get_office365_user();
            if (!user) {
                // do we already have the code to sign-in?
                let urlParams = new URLSearchParams(window.location.search);
                let code = urlParams.get('code');
                if (!code) {
                    window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=' +
                        domain.clientId + '&response_type=code&redirect_uri=' +
                        encodeURIComponent(domain.redirectUrl) + '&scope=User.ReadBasic.All+offline_access+openid+profile' +
                        '&state=' + search.get_client_id();
                } else {
                    // login this user, using the code
                    search.setup_office_365_user();
                }
            } else {
                // we have a user - assume the client wants to sign-out
                search.remove_office365_user();
                search.signed_in = false;
                error('');
            }
        } else if (domain && user_name && user_name.length > 0 && password && password.length > 0 && search.kb) {
            busy(true);
            error('');
            let adSignInData = {
                'organisationId': settings.organisationId,
                'kbList': [search.kb.id],
                'clientId': search.get_client_id(),
                'sourceId': search.sourceId,
                'userName': user_name,
                'password': password,
            };
            search.post_message('/api/ops/ad/sign-in', adSignInData, function(data) {
                search.receive_ws_data(data, false);
            });
        }
    },

    do_sign_out: function() {
        error('');
        busy(true);
        search.remove_office365_user();
        let signOutData = {
            'organisationId': settings.organisationId,
            'kbList': [search.kb.id],
            'clientId': search.get_client_id(),
            'sourceId': search.sourceId,
        };
        search.post_message('/api/ops/ad/sign-out', signOutData, function(data) {
            search.receive_ws_data(data, false);
        });
    },

    /**
     * setup the office 365 user if they don't exist yet, and we have a code
     */
    setup_office_365_user: function() {
        let user = search.get_office365_user(); // do we have an office 365 user object?
        if (!user) { // no?
            let domain = search.get_azure_ad_domain(); // make sure we have a domain to go to
            if (domain) {
                let urlParams = new URLSearchParams(window.location.search);
                let code = urlParams.get('code');  // do we have a code pending in the URL?
                if (code) {
                    let url = settings.base_url + '/auth/sign-in/office365';
                    let kbList = [];
                    for (let i in search.kb_list) {
                        if (search.kb_list.hasOwnProperty(i)) {
                            kbList.push(search.kb_list[i].id);
                        }
                    }
                    // use this code to now sign-in and get the user's details
                    let data = {"code": code, "redirectUrl": encodeURIComponent(domain.redirectUrl),
                        "clientId": search.get_client_id(), "msClientId": domain.clientId,
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
                            let signedInUSer = {"name": data.displayName, "email": data.email};
                            search.set_office365_user(signedInUSer);
                            window.location.href = domain.redirectUrl;
                            search.signed_in = true;
                        }
                    }).fail(function (err) {
                        window.location.href = domain.redirectUrl;
                        console.error(err);
                        search.signed_in = false;
                        alert('office 365 sign-in failed');
                    });
                }
            }

        } else {
            // we already have a valid office-365 user - assume we've signed in
            search.signed_in = true;
        }
    },

    // get the existing office 365 user (or null)
    get_office365_user: function() {
        let key = 'simsearch_office_365_user';
        let hasLs = search.has_local_storage();
        if (hasLs) {
            let data = JSON.parse(localStorage.getItem(key));
            let now = new Date().getTime();
            if (data && data.expiry && now < data.expiry) {
                let to = search.session_timeout_in_mins * 60000;
                data.expiry = now + to; // 1 hour timeout
                search.set_office365_user(data);
                return data;
            } else {
                // expired
                search.remove_office365_user();
            }
        }
        return null;
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

    // get a name from a url, either 'link' or 'image'
    get_url_name: function(url) {
        if (url && url.length > 0) {
            // image or page?
            let name = url.toLowerCase().trim();
            for (let i in settings.image_types) {
                if (settings.image_types.hasOwnProperty(i)) {
                    let image_extn = settings.image_types[i];
                    if (name.endsWith(image_extn)) {
                        return "image";
                    }
                }
            }
            return "link";
        }
        return "";
    },

    // clear a session
    clearClientId: function() {
        let key = 'simsearch_client_id';
        let hasLs = search.has_local_storage();
        if (hasLs) {
            localStorage.removeItem(key);
            search.do_sign_out();
            return true;
        }
        return false;
    },

    // replace highlight items from SimSage with style items for the UI display
    highlight: function(str) {
        let str2 = str.replace(/{hl1:}/g, "<span class='hl1'>");
        str2 = str2.replace(/{hl2:}/g, "<span class='hl2'>");
        str2 = str2.replace(/{hl3:}/g, "<span class='hl3'>");
        str2 = str2.replace(/{:hl1}/g, "</span>");
        str2 = str2.replace(/{:hl2}/g, "</span>");
        str2 = str2.replace(/{:hl3}/g, "</span>");
        return str2;
    },

    // make sure a string doesn't exceed a certain size - otherwise cut it down
    adjust_size: function(str) {
        if (str.length > 20) {
            return str.substr(0,10) + "..." + str.substr(str.length - 10);
        }
        return str;
    },

    /**
     * helper - pad the number with a leading 0 for two digit numbers
     *
     * @param item          a number
     * @returns {string}    the number with a loading zero or not
     */
    pad2: function(item) {
        return ("" + item).padStart(2, '0');
    },


    /**
     * helper - convert unix timestamp to string if it's for a reasonable time in the future
     *
     * @param timestamp     a long value
     * @returns {string}    the long value as a date string
     */
    unix_time_convert: function(timestamp) {
        if (timestamp > 1000) {
            let a = new Date(timestamp);
            let year = a.getFullYear();
            let month = a.getMonth() + 1;
            let date = a.getDate();
            let hour = a.getHours();
            let min = a.getMinutes();
            let sec = a.getSeconds();
            return year + '/' + search.pad2(month) + '/' + search.pad2(date) + ' ' + search.pad2(hour) + ':' + search.pad2(min) + ':' + search.pad2(sec);
        }
        return "";
    },


    /**
     * helper - convert byte size to Kb, Mb, Gb
     *
     * @param size          the size, a number
     * @returns string      the adjusted string with KB/MB/GB in it
     */
    size_to_str: function(size) {
        if (size < 1024) {
            return size;
        } else if (size < 1024000) {
            return Math.floor(size / 1000) + "KB";
        } else if (size < 1024000000) {
            return Math.floor(size / 1000000) + "MB";
        } else {
            return Math.floor(size / 1000000000) + "GB";
        }
    },


    // join string items in a list together with spaces
    join: function(list) {
        let str = '';
        for (let i in list) {
            if (list.hasOwnProperty(i)) {
                str += ' ' + list[i];
            }
        }
        return str.trim();
    },

    // if this is a syn-set and its selections, return those
    get_synset: function(context_item) {
        if (context_item.synSetLemma && context_item.synSetLemma.length > 0 && context_item.synSetCloud) {
            let word = context_item.synSetLemma;
            return {"word": word.toLowerCase().trim(), "clouds": context_item.synSetCloud};
        }
        return null;
    },

    // return the unique list of words in text_str as a list
    get_unique_words_as_list: function(text_str) {
        let parts = text_str.split(" ");
        let newList = [];
        let duplicates = {};
        for (let i in parts) {
            if (parts.hasOwnProperty(i)) {
                let _part = parts[i];
                let part = _part.trim().toLowerCase();
                if (part.length > 0) {
                    if (!duplicates.hasOwnProperty(part)) {
                        duplicates[part] = 1;
                        newList.push(_part.trim());
                    }
                }
            }
        }
        return newList;
    },

    // remove duplicate strings from body search text and add synset items
    process_body_string: function(text, selected_syn_sets) {
        let parts = search.get_unique_words_as_list(text);
        let newList = [];
        for (let i in parts) {
            if (parts.hasOwnProperty(i)) {
                let _part = parts[i];
                let part = _part.trim().toLowerCase();
                if (selected_syn_sets) {
                    let synSet = selected_syn_sets[part];
                    if (typeof synSet !== 'undefined' && parseInt(synSet) >= 0) {
                        newList.push(_part.trim() + '/' + synSet);
                    } else {
                        newList.push(_part.trim());
                    }
                }
            }
        }
        return newList.join(" ");
    },

    // get a semantic search query string for all the filters etc.
    semantic_search_query_str: function(text, af) {
        let query = "(";
        let needsAnd = false;
        if (text.length > 0) {
            query += "body: " + search.process_body_string(text, af["syn-sets"]);
            needsAnd = true;
        }
        if (af.url && af.url.length > 0 && af.url[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (let i in af.url) {
                if (i > 0) {
                    query += " and "
                }
                if (af.url.hasOwnProperty(i)) {
                    query += "url: " + af.url[i];
                }
            }
            query += ") "
        }
        if (af.title && af.title.length > 0 && af.title[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (let i in af.title) {
                if (i > 0) {
                    query += " and "
                }
                if (af.title.hasOwnProperty(i)) {
                    query += "title: " + af.title[i];
                }
            }
            query += ") "
        }
        if (af.author && af.author.length > 0 && af.author[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (let i in af.author) {
                if (i > 0) {
                    query += " and "
                }
                if (af.author.hasOwnProperty(i)) {
                    query += "author: " + af.author[i];
                }
            }
            query += ") "
        }
        if (af.document_type && af.document_type.length > 0 && af.document_type[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (let i in af.document_type) {
                if (i > 0) {
                    query += " or "
                }
                if (af.document_type.hasOwnProperty(i)) {
                    query += "type: " + af.document_type[i];
                }
            }
            query += ") "
        }
        // db parameters?
        if (search.is_db_source && af["db"]) {
            let db = af["db"];
            let sort = null;
            for (let metadata in db) {
                if (db.hasOwnProperty(metadata)) {
                    let item = db[metadata];
                    if (metadata === "sort") {
                        sort = item;
                    } else {
                        if (item[0] === "range") {
                            if (needsAnd)
                                query += " and range("
                            else
                                query += " range("
                            needsAnd = true;
                            query += metadata + "," + item[1] + "," + item[2] + ")";

                        } else if (item[0] === "rating") {
                            if (needsAnd)
                                query += " and doc("
                            else
                                query += " doc("
                            needsAnd = true;
                            query += metadata + "," + item[1] + ")";

                        } else {

                            let has_brackets = false;
                            if (item.length > 2) {
                                has_brackets = true;
                                if (needsAnd)
                                    query += " and ("
                                else
                                    query += " ("
                            } else {
                                if (needsAnd)
                                    query += " and "
                                else
                                    query += " "
                            }
                            needsAnd = true;
                            for (let i in item) {
                                if (i > 0) {
                                    if (i > 1) {
                                        query += " or ";
                                    }
                                    query += "doc(" + metadata + "," + item[i] + ")"
                                }
                            }
                            if (has_brackets)
                                query += ")"
                        }
                    } // else if not sort
                } // if has md item
            } // for each md item
            if (sort !== null) {
                if (needsAnd)
                    query += " and "
                else
                    query += " "
                for (let i in sort) {
                    query += "sort(" + i + "," + sort[i] + ") ";
                }
            }
        }
        query += ")";
        return query;
    },

    // valid an email address
    validate_email: function(email) {
        let i1 = email.indexOf('@');
        if (i1 > 0) {
            let i2 = email.lastIndexOf('.');
            return (i2 > i1) && i2 + 2 < email.length;
        }
        return false;
    },

    ie11_polyfill: function() {
        if (!String.prototype.padStart) {
            String.prototype.padStart = function padStart(targetLength,padString) {
                targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
                padString = String((typeof padString !== 'undefined' ? padString : ' '));
                if (this.length > targetLength) {
                    return String(this);
                }
                else {
                    targetLength = targetLength-this.length;
                    if (targetLength > padString.length) {
                        padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
                    }
                    return padString.slice(0,targetLength) + String(this);
                }
            }
        }
    },

}

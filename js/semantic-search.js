//
// Semantic Search
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

    constructor() {
        super();
        this.session_id = '';
        this.selected_syn_sets = {};

        this.page = 0;
        this.num_results = 0;
        this.num_pages = 0;
        this.chat_closed_for_last_query = false;
        this.last_query = "";
        this.advanced_filter = {};
        this.semantic_search_results = [];
        this.semantic_set = {};
        this.syn_sets_seen = {};
        // list of ambiguous items to pick from
        this.synset_list = [];

        // operator's id if we're chatting with someone
        this.assignedOperatorId = '';
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    // add a chat message and then do a normal search
    do_chat(page, text, advanced_filter) {
        if (text.trim() !== '') {
            // and do the search
            this.do_semantic_search(page, text, advanced_filter, true);
            // show the updated chat window
            update_ui(this.page, this.num_pages, this.num_results, this.semantic_search_results,
                this.semantic_set, this.synset_list, this.chat_list, false,
                !this.chat_closed_for_last_query, this.is_typing);
            // clear any text - after the chat
            clear_search();
        }
    }

    // perform the semantic search
    do_semantic_search(page, text, advanced_filter, add_text_to_chat) {
        if (this.kb && text && text.trim() !== '') {
            if (add_text_to_chat) {
                // add the user's text to the chat stream
                const dt = unix_time_convert(SimSageCommon.get_system_time());
                const user_chat = {"who": "You", "what": text, "when": dt};
                this.chat_list.push(user_chat)
            }

            // do we need to reset the pagination?
            this.reset_pagination(page, text);
            this.advanced_filter = advanced_filter; // copy
            // create the query and clear the errors
            const url = settings.base_url + '/ops/query';
            error('');

            text = this.cleanup_query_text(text);
            const search_query_str = this.semantic_search_query_str(text, advanced_filter);
            console.log(search_query_str);
            if (search_query_str !== '()') {
                this.search_query = text;
                this.show_advanced_search = false;
                this.show_details = false;
                busy(true);
                let source_id = '';
                if (advanced_filter.source_id && advanced_filter.source_id.length > 0) {
                    source_id = advanced_filter.source_id;
                }

                const clientQuery = {
                    'organisationId': settings.organisationId,
                    'kbList': [this.kb.id],
                    'clientId': SemanticSearch.get_client_id(),
                    'semanticSearch': true,     // always a search
                    'query': search_query_str,  // search query
                    'queryText': text,          // raw text
                    'numResults': 1,              // bot results
                    'scoreThreshold': settings.bot_threshold,
                    'page': this.page,
                    'pageSize': settings.page_size,
                    'shardSizeList': this.shard_size_list,
                    'fragmentCount': settings.fragment_count,
                    'maxWordDistance': settings.max_word_distance,
                    'spellingSuggest': settings.use_spelling_suggest,
                    'contextLabel': settings.context_label,
                    'contextMatchBoost': settings.context_match_boost,
                    'sourceId': source_id,
                };

                jQuery.ajax({
                    headers: {
                        'Content-Type': 'application/json',
                        'API-Version': settings.api_version,
                    },
                    'data': JSON.stringify(clientQuery),
                    'type': 'POST',
                    'url': url,
                    'dataType': 'json',
                    'success': function (data) {
                        busy(false);
                    }

                }).fail(function (err) {
                    error(err);
                });

            } else {
                error("Please enter a query to start searching.");
            }
        } else if (!this.kb) {
            error("Server not responding, not connected.");
        }
    }

    // get a preview url for the currently selected knowledge base
    get_preview_url() {
        return settings.base_url + '/document/preview/' + settings.organisationId + '/' + this.kb.id + '/' +
               SemanticSearch.get_client_id();
    }

    // reset the variables used in determining pagination if the query has changed
    reset_pagination(page, query_text) {
        if (this.last_query !== query_text) {
            this.last_query = query_text;
            this.page = 0;  // reset to page 0
            this.num_pages = 0;
            this.chat_closed_for_last_query = false;
            this.shard_size_list = [];
        } else {
            this.page = page;
        }
        this.semantic_search_results = [];
        this.semantic_set = {};
    }

    close_query_window() {
        this.chat_closed_for_last_query = true;
    }

    // pagination - previous page set
    prev_page() {
        if (this.page > 0) {
            this.page -= 1;
            this.do_semantic_search(this.page, this.search_query, this.advanced_filter, false);
        }
    }

    // pagination - next page set
    next_page() {
        if ((this.page + 1) < this.num_pages) {
            this.page += 1;
            this.do_semantic_search(this.page, this.search_query, this.advanced_filter, false);
        }
    }

    // overwrite: call refresh ui
    refresh() {
    }

    // correct the spelling
    correct_spelling(text) {
        document.getElementById("txtSearch").value = text;
        this.do_semantic_search(this.page, this.search_query, this.advanced_filter, true);
    }

    // overwrite: generic web socket receiver
    receive_ws_data(data) {
        busy(false);
        if (data) {
            if (data.messageType === mt_Error && data.error.length > 0) {
                error(data.error);  // set an error

            } else if (data.messageType === mt_Disconnect) {
                this.assignedOperatorId = ''; // disconnect any operator

            } else if (data.messageType === mt_Email) {
                this.knowEmail = true;

            } else if (data.messageType === mt_SignIn) {
                if (data.errorMessage && data.errorMessage.length > 0) {
                    error(data.errorMessage);  // set an error
                    this.signed_in = false;
                } else {
                    // sign-in successful
                    this.signed_in = true;
                    sign_in_status(true);
                }
                // todo: show we have signed in

            } else if (data.messageType === mt_IsTyping) {
                this.operator_is_typing(data.fromIsTyping);

            } else if (data.messageType === mt_SpellingSuggest) {
                // speech bubble popup with actions
                // this.bot_text = "Did you mean: " + data.text;
                // todo: spelling suggest

            } else if (data.messageType === mt_SignOut) {

                if (data.errorMessage && data.errorMessage.length > 0) {
                    error(data.errorMessage);  // set an error
                } else {
                    // sign-in successful
                    this.signed_in = false;
                    sign_in_status(false);
                }
                // todo: show user signed out

            } else if (data.messageType === mt_Message) {

                const self = this;
                this.is_typing = false;
                this.semantic_search_results = [];
                this.semantic_search_result_map = {};
                this.semantic_set = {};
                this.synset_list = []; // includes syn_sets of selected_syn_sets
                // set the assigned operator
                this.assignedOperatorId = data.assignedOperatorId;
                if (this.assignedOperatorId == null) { // compatibility with older versions of SimSage
                    this.assignedOperatorId = '';
                }

                // did we get semantic search results?
                if (data.resultList) {

                    const self = this;
                    this.shard_size_list = data.shardSizeList;
                    this.semantic_set = data.semanticSet;
                    this.synset_list = data.contextStack;
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
                        }

                    });
                    this.num_results = data.totalDocumentCount;
                    const divided = data.totalDocumentCount / settings.page_size;
                    this.num_pages = parseInt(divided);
                    if (parseInt(divided) < divided) {
                        this.num_pages += 1;
                    }
                }

                // did we get an NLP result?
                const nlp_reply = [];
                const dt = unix_time_convert(SimSageCommon.get_system_time());
                if (data.hasResult && data.text && data.text.length > 0) {
                    const nlp_data = {"who": "Bot", "what": data.text, "when": dt};
                    const url_list = [];
                    nlp_reply.push(nlp_data);
                    this.chat_list.push(nlp_data)
                    if (data.urlList && data.urlList.length > 0) {
                        for (const url of data.urlList) {
                            if (url.trim().length > 0) {
                                for (const sub_url of url.split(' ')) {
                                    url_list.push(sub_url);
                                }
                            }
                        }
                    }
                    if (url_list.length > 0) {
                        nlp_data.what += "<br/>";
                    }
                    for (const url of url_list) {
                        nlp_data.what += render_url(url);
                    }

                }

                // copy the know email flag from our results
                if (!this.knowEmail && data.knowEmail) {
                    this.knowEmail = data.knowEmail;
                }

                const has_chat = (this.assignedOperatorId.length > 0);
                if (data.hasResult || has_chat) {
                    update_ui(this.page, this.num_pages, this.num_results, this.semantic_search_results,
                              this.semantic_set, this.synset_list, this.chat_list, false,
                        (nlp_reply.length > 0 || has_chat), this.is_typing);

                } else {
                    update_ui(0, 0, 0, [], {}, [], [],
                        true, false, false);
                }

            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // send an email to the server for more contact / answering a query

    send_email(emailAddress) {
        if (emailAddress && emailAddress.trim().length > 0 && emailAddress.indexOf("@") > 0) {
            error('');
            const self = this;
            const url = settings.base_url + '/ops/email';
            const emailMessage = {
                'messageType': mt_Email,
                'organisationId': settings.organisationId,
                'kbList': [this.kb.id],
                'clientId': SemanticSearch.get_client_id(),
                'emailAddress': emailAddress,
            };
            jQuery.ajax({
                headers: {
                    'Content-Type': 'application/json',
                    'API-Version': settings.api_version,
                },
                'data': JSON.stringify(emailMessage),
                'type': 'POST',
                'url': url,
                'dataType': 'json',
                'success': function (data) {
                    self.receive_ws_data(data);
                }

            }).fail(function (err) {
                error(err);
            });
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    // remove duplicate strings from body search text and add synset items
    process_body_string(text, selected_syn_sets) {
        const parts = SimSageCommon.get_unique_words_as_list(text);
        const newList = [];
        for (const _part of parts) {
            const part = _part.trim().toLowerCase();
            if (selected_syn_sets) {
                const synSet = selected_syn_sets[part];
                if (typeof synSet !== 'undefined' && parseInt(synSet) >= 0) {
                    newList.push(_part.trim() + '/' + synSet);
                } else {
                    newList.push(_part.trim());
                }
            }
        }
        return newList.join(" ");
    }

    // clean text - remove characters we use for special purposes
    cleanup_query_text(text) {
        // remove any : ( ) characters from text first (but not from http: and https:)
        text = text.replace(/\)/g, ' ');
        text = text.replace(/\(/g, ' ');
        text = text.replace(/:/g, ' ');
        text = text.replace(/http \/\//g, 'http://');
        text = text.replace(/https \/\//g, 'https://');
        return text;
    }

    // get a semantic search query string for all the filters etc.
    semantic_search_query_str(text, af) {
        let query = "(";
        let needsAnd = false;
        if (text.length > 0) {
            query += "body: " + this.process_body_string(text, af["syn-sets"]);
            needsAnd = true;
        }
        if (af.url && af.url.length > 0 && af.url[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in af.url) {
                if (i > 0) {
                    query += " and "
                }
                query += "url: " + this.url[i];
            }
            query += ") "
        }
        if (af.title && af.title.length > 0 && af.title[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in af.title) {
                if (i > 0) {
                    query += " and "
                }
                query += "title: " + af.title[i];
            }
            query += ") "
        }
        if (af.author && af.author.length > 0 && af.author[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in af.author) {
                if (i > 0) {
                    query += " and "
                }
                query += "author: " + af.author[i];
            }
            query += ") "
        }
        if (af.document_type && af.document_type.length > 0 && af.document_type[0].length > 0) {
            if (needsAnd)
                query += " and (";
            else
                query += " (";
            needsAnd = true;
            for (const i in af.document_type) {
                if (i > 0) {
                    query += " or "
                }
                query += "type: " + af.document_type[i];
            }
            query += ") "
        }
        query += ")";
        return query;
    }

}


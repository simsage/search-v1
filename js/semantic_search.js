//
// Semantic Search helper class
//

class SemanticSearch {

    constructor(settings, update_ui, search_control) {
        this.settings = settings;
        this.update_ui = update_ui;
        this.search_control = search_control;

        // the current semantic search set
        this.current_text = '';  // current search text
        this.semantic_search_results = [];
        this.semantic_search_result_map = {};

        // pagination for semantic search
        this.page = 0;
        this.num_results = -1;
        this.num_pages = 0;

        this.prev_query = ''; // shard logic: what was asked previously
        this.shard_size_list = [];

        // are we busy searching?
        this.busy = false;

        // error message
        this.error = '';

        this.fileType = [];
        this.title = [];
        this.url = [];
        this.author = [];
        this.kb_list = [];
        this.kb = null;
        this.source = null;

        // semantic set
        this.semantic_set = {};

        // details view
        this.show_details = false;
        this.details_html = '';

        // advanced search menu visibility
        this.has_advanced_selection = false;
        this.show_advanced_search = false;
        this.view = 'lines';
    }

    text_view() {
        this.view = 'lines';
        this.refresh();
    }

    image_view() {
        this.view = 'images';
        this.refresh();
    }

    // load the initial information needed for semantic search from the server
    getSemanticSearchInfo() {
        const self = this;
        const url = this.settings.base_url + '/knowledgebase/search/info/' + encodeURIComponent(this.settings.organisationId);

        this.error = '';
        this.busy = true;

        this.refresh(); // notify ui

        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': this.settings.api_version,
            },
            'type': 'GET',
            'url': url,
            'dataType': 'json',
            'success': function (data) {
                self.kb_list = data.kbList;
                if (self.kb_list.length > 0) {
                    self.kb = self.kb_list[0];
                }
                self.busy = false;
                self.refresh();
            }

        })
        .fail(function (err) {
            console.error(JSON.stringify(err));
            self.error = err;
            self.busy = false;
            self.refresh();
        });
    }

    refresh() {
        if (this.update_ui) {
            this.update_ui(this);
        }
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
            this.do_semantic_search(this.current_text);
        }
    }

    // pagination - next page set
    nextPage() {
        if ((this.page + 1) < this.num_pages) {
            this.page += 1;
            this.do_semantic_search(this.current_text);
        }
    }

    // reset the variables used in determining pagination if the query has changed
    reset_pagination() {
        if (this.current_text !== this.prev_query) {
            this.prev_query = this.current_text;
            this.page = 0;  // reset to page 0
            this.shard_size_list = [];
        }
    }

    toggle_advanced_search() {
        this.show_advanced_search = !this.show_advanced_search;
        this.refresh();
    }

    hide_advanced_search() {
        this.show_advanced_search = false;
        this.refresh();
    }

    // perform a semantic search
    do_semantic_search(text) {
        let query = "(";
        let needsAnd = false;
        if (text.length > 0) {
            query += "body: " + text;
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
                    query += " or "
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
                    query += " or "
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
                    query += " or "
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
        if (query.length <= 2) {
            alert('please enter a search query');
            return;
        }

        this.show_advanced_search = false;
        let source_id = '';
        if (this.source !== null) {
            source_id = this.source.id;
        }

        let searchObj = {
            'organisationId': this.settings.organisationId,
            'kbList': [{"kbId": this.kb.id, "sid": this.kb.sid}],
            'source': source_id,
            'botQuery': text,
            'superSearch': query,
            'page': this.page,
            'pageSize': search_settings.page_size,
            'fragmentCount': search_settings.fragment_count,
            'maxWordDistance': search_settings.max_word_distance,
            'shardSizeList': this.shard_size_list,
            'scoreThreshold': search_settings.score_threshold,
            'askBot': search_settings.ask_bot,
            'botThreshold': search_settings.bot_threshold,
        };

        const self = this;
        const url = this.settings.base_url + '/semantic/search/anonymous';

        this.current_text = text;  // reset test to search for
        this.error = '';
        this.busy = true;

        this.refresh(); // notify ui

        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'Security-Id': this.settings.sid,
                'Client-Id': SemanticSearch.getClientId(),
                'API-Version': this.settings.api_version,
            },
            'type': 'PUT',
            'url': url,
            'data': JSON.stringify(searchObj),
            'dataType': 'json',
            'success': function (data) {

                self.semantic_search_results = [];
                self.semantic_search_result_map = {};
                self.semantic_set = {};

                if (data && data.resultList) {

                    self.shard_size_list = data.shardSizeList;
                    self.semantic_set = data.semanticSet;
                    data.resultList.map(function (sr) {
                        // enhance search result for display
                        sr['index'] = 0;  // inner offset index
                        sr['num_results'] = sr.textList.length;

                        self.semantic_search_results.push(sr);  // add item
                        self.semantic_search_result_map[sr.url] = sr;
                    });
                    self.busy = false;
                    self.num_results = data.totalDocumentCount;
                    const divided = data.totalDocumentCount / search_settings.page_size;
                    self.num_pages = parseInt(divided);
                    if (parseInt(divided) < divided) {
                        self.num_pages += 1;
                    }
                }
                self.refresh();
            }

        })
        .fail(function (err) {
            self.semantic_search_results = [];
            self.semantic_search_result_map = {};
            console.error(JSON.stringify(err));
            self.error = err;
            self.busy = false;
            self.refresh();
        });
    }

    // access the semantic set menu as a set of html items
    get_semantic_set_html() {
        return this.semantic_html;
    }

    select(semantic_item) {
        let text_list = this.search_control.val().split(' ');
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
        this.search_control.val(SemanticSearch.join(new_text_list));
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

    // get the html for the search results neatly drawn out
    get_semantic_search_html() {
        const num_results = this.semantic_search_results.length;
        if (num_results > 0 && this.kb && this.kb.id) {
            const organisation_id = this.settings.organisationId;
            const kb_id = this.kb.id;
            let list = this.semantic_search_results.slice(); // copy
            let gen_html = '';
            if (this.view === 'lines') {
                gen_html = '<div class="search-background">';
                gen_html += render_semantics(this.semantic_set);
                const base_url = this.settings.base_url;
                list.map(function (h) {
                    if (h.botResult) {
                        gen_html += render_bot(h.url, h.textList[0]);
                    } else {
                        const text = SemanticSearch.highlight(h.textList[h.index]);
                        gen_html += render_result(organisation_id, kb_id, h.index, h.title, h.author, h.url, h.urlId,
                                                  h.num_results, text, base_url);
                    }
                });

            } else if (this.view === 'images') {
                gen_html = '<div class="search-background">';
                gen_html += render_semantics(this.semantic_set);
                const base_url = this.settings.base_url;
                list.map(function (h) {
                    if (h.botResult) {
                        gen_html += render_bot(h.url, h.textList[0]);
                    } else {
                        const text = SemanticSearch.highlight(h.textList[h.index]);
                        gen_html += render_result_images(organisation_id, kb_id, h.index, h.title, h.author, h.url, h.urlId,
                                                         h.num_results, text, base_url);
                    }
                });

            }
            gen_html += render_pagination(this.page, this.num_pages, this.busy, this.num_results);
            gen_html += '</div>';
            return gen_html;
        }
        return "";
    }

    static highlight(str) {
        let str2 = str.replace(/{hl1:}/g, "<span class='hl1'>");
        str2 = str2.replace(/{hl2:}/g, "<span class='hl2'>");
        str2 = str2.replace(/{hl3:}/g, "<span class='hl3'>");
        str2 = str2.replace(/{:hl1}/g, "</span>");
        str2 = str2.replace(/{:hl2}/g, "</span>");
        str2 = str2.replace(/{:hl3}/g, "</span>");
        return str2;
    }

    // get the knowledge base options
    kbOptions() {
        let str = "";
        for (const kb of this.kb_list) {
            str += "<option value='" + kb.id + "'>" + kb.name + "</option>";
        }
        return str;
    }

    // get the source options
    sourceOptions() {
        let str = "<option value=''>any</option>";
        if (this.kb !== null && this.kb.sourceList) {
            for (const source of this.kb.sourceList) {
                str += "<option value='" + source.id + "'>" + source.name + "</option>";
            }
        }
        return str;
    }

    set_kb(id) {
        this.kb = null;
        if (id) {
            for (const kb of this.kb_list) {
                if (kb.id === id) {
                    this.kb = kb;
                    break;
                }
            }
        }
    }

    set_source(id) {
        this.source = null;
        if (id && this.kb && this.kb.sourceList) {
            for (const source of this.kb.sourceList) {
                if (source.id === id) {
                    this.source = source;
                    break;
                }
            }
        }
    }

    showDetails(url_id, url) {
        const organisation_id = this.settings.organisationId;
        const kb_id = this.kb.id;
        const base_url = this.settings.base_url;
        const document = this.semantic_search_result_map[url];
        this.details_html = render_details(base_url, organisation_id, kb_id, url_id, document);
        this.show_details = true;
        this.refresh();
    }

    closeDetails() {
        this.details_html = '';
        this.show_details = false;
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
        const hasLs = SemanticSearch.hasLocalStorage();
        if (hasLs) {
            clientId = localStorage.getItem(key);
        }
        if (!clientId || clientId.length === 0) {
            clientId = SemanticSearch.guid(); // create a new client id
            if (hasLs) {
                localStorage.setItem(key, clientId);
            }
        }
        return clientId;
    }

}

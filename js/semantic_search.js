//
// Semantic Search helper class
//

class SemanticSearch {

    constructor(settings, update_ui) {
        this.settings = settings;
        this.update_ui = update_ui;

        // the current semantic search set
        this.current_text = '';  // current search text
        this.semantic_search_results = [];
        this.semantic_search_result_map = {};

        // pagination for semantic search
        this.page = 0;
        this.num_results = -1;
        this.num_pages = 0;

        // are we busy searching?
        this.busy = false;

        // error message
        this.error = '';

        this.fileType = [];
        this.title = [];
        this.url = [];
        this.author = [];
        this.kb = settings.kbList[0];
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

    // perform a semantic search
    do_semantic_search(text) {

        let query = "(body: " + text;
        if (this.url.length > 0) {
            query += " and (";
            for (const i in this.url) {
                if (i > 0) {
                    query += " or "
                }
                query += "url: " + this.url[i];
            }
            query += ") "
        }
        if (this.title.length > 0) {
            query += " and (";
            for (const i in this.title) {
                if (i > 0) {
                    query += " or "
                }
                query += "title: " + this.title[i];
            }
            query += ") "
        }
        if (this.author.length > 0) {
            query += " and (";
            for (const i in this.author) {
                if (i > 0) {
                    query += " or "
                }
                query += "author: " + this.author[i];
            }
            query += ") "
        }
        if (this.fileType.length > 0) {
            query += " and (";
            for (const i in this.fileType) {
                if (i > 0) {
                    query += " or "
                }
                query += "type: " + this.fileType[i];
            }
            query += ") "
        }
        query += ")";

        let searchObj = {
            'organisationId': this.settings.organisationId,
            'kbList': [{kbId: this.kb.kbId, sid: this.kb.sid}],
            'botQuery': text,
            'superSearch': query,
            'page': this.page,
            'fragmentCount': search_settings.fragment_count,
            'maxWordDistance': search_settings.max_word_distance,
            'numResults': search_settings.page_size,
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

                if (data && data.resultList) {

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

    // get the html for the search results neatly drawn out
    get_semantic_search_html() {
        let list = this.semantic_search_results.slice(); // copy
        let gen_html = '';
        list.map(function (h) {
            if (h.botResult) {
                gen_html += '<div class="bot-capsule">';
                gen_html += '<div class="bot-simsage-logo">';
                gen_html += '<img class="bot-simsage-logo-size" src="images/tinman.svg" alt="SimSage" />';
                gen_html += '</div>';
                gen_html += '<div class="bot-msg">';
                gen_html += h.textList[0];
                gen_html += '</div>';
                if (h.url.length > 0) {
                    gen_html += '<div class="bot-link">';
                    gen_html += '<a href="' + h.url + '" target="_blank">' + h.url + '</a>';
                    gen_html += '</div>';
                }
                gen_html += '</div>';

            } else {
                gen_html += '<div class="chat-capsule">';

                // inner navigation
                gen_html += "<div class='searchInsideNav'>";
                gen_html += "    <div onclick='doInnerPrev(\"" + h.url + "\")'";
                if (h.index > 0)
                    gen_html += "         class='insideNavButtonStyle'>&lt;</div>";
                else
                    gen_html += "         class='insideNavButtonStyleDisabled'>&lt;</div>";
                gen_html += "    <div onclick='doInnerNext(\"" + h.url + "\")'";
                if (h.index + 1 < h.num_results)
                    gen_html += "         class='insideNavButtonStyle'>&gt;</div>";
                else
                    gen_html += "         class='insideNavButtonStyleDisabled'>&gt;</div>";
                gen_html += "</div>";

                gen_html += '<div class="chat-title">' + h.title;
                if (h.author && h.author.length > 0) {
                    gen_html += " (" + h.author + ")"
                }
                gen_html += '</div>';

                gen_html += '<div class="chat-msg">';
                gen_html += SemanticSearch.highlight(h.textList[h.index]);
                gen_html += '</div>';
                if (h.url.indexOf("\\\\") === 0) {
                    gen_html += '<div class="chat-url" onclick="alert(\'cannot open a UNC path\');">' + h.url + '</div>';
                } else {
                    gen_html += '<div class="chat-url" onclick="openUrl(\'' + h.url + '\')">' + h.url + '</div>';
                }
                gen_html += '</div>';
            }
        });

        // add pagination at the bottom
        gen_html += '<div class="paginationNav">';
        const classStr1 = ((this.page > 0) && !this.busy) ? "paginationButton" : "paginationButtonDisabled";
        gen_html += '    <div id="btnPrev" class="' + classStr1 + '" onclick="prevPage()">prev</div>';
        const classStr2 = (((this.page + 1) < this.num_pages) && !this.busy) ? "paginationButton" : "paginationButtonDisabled";
        gen_html += '    <div id="btnNext" class="' + classStr2 + '" onclick="nextPage()">next</div>';
        gen_html += '</div>';

        return gen_html;
    }


    static highlight(str) {
        str = str.replace(/{hl1:}/g, "<span class='hl1'>");
        str = str.replace(/{hl2:}/g, "<span class='hl2'>");
        str = str.replace(/{hl3:}/g, "<span class='hl3'>");
        str = str.replace(/{:hl1}/g, "</span>");
        str = str.replace(/{:hl2}/g, "</span>");
        str = str.replace(/{:hl3}/g, "</span>");
        return str;
    }

    // get the knowledge base options
    static kbOptions() {
        let str = "";
        for (const index in settings.kbList) {
            const item = settings.kbList[index];
            str += "<option value='" + index + "'>" + item.name + "</option>";
        }
        return str;
    }

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
    hasLocalStorage(){
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
    getClientId() {
        let clientId = "";
        const key = 'simsearch_client_id';
        const hasLs = this.hasLocalStorage();
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

//
// Semantic Search helper class
//


const kPageSize = 10;  // how many results per page


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
        this.page_size = kPageSize;

        // are we busy searching?
        this.busy = false;

        // error message
        this.error = '';
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
        if (this.page_size === this.semantic_search_results.length) {
            this.page += 1;
            this.do_semantic_search(this.current_text);
        }
    }

    // perform a semantic search
    do_semantic_search(text) {

        let searchObj = {
            'organisationId': this.settings.organisationId,
            'kbId': this.settings.kbId,
            'securityId': this.settings.sid,
            'keywords': text,
            'page': this.page,
            'numResults': this.page_size,
            'scoreThreshold': 0.0
        };

        const self = this;
        const url = this.settings.base_url + '/semantic/search/anonymous';

        this.page = 0;  // reset to page 0
        this.current_text = text;  // reset test to search for
        this.semantic_search_results = [];
        this.semantic_search_result_map = {};
        this.error = '';
        this.busy = true;

        this.refresh(); // notify ui

        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'Security-Id': this.settings.sid,
                'Customer-Id': SemanticSearch.getClientId(),
                'API-Version': this.settings.api_version,
            },
            'type': 'PUT',
            'url': url,
            'data': JSON.stringify(searchObj),
            'dataType': 'json',
            'success': function (data) {

                if (data && data.resultList) {

                    data.resultList.map(function (sr) {
                        // enhance search result for display
                        sr['index'] = 0;  // inner offset index
                        sr['num_results'] = sr.textList.length;

                        self.semantic_search_results.push(sr);  // add item
                        self.semantic_search_result_map[sr.url] = sr;
                    });
                    self.busy = false;
                    self.refresh();
                }
            }

        })
        .fail(function (err) {
            console.error(JSON.stringify(err));
            self.error = err;
            self.busy = false;
            self.refresh();
        });
    }

    // get the html for the search results neatly drawn out
    get_semantic_search_html() {
        let reverse = this.semantic_search_results.slice(); // copy
        reverse.reverse();

        const self = this;
        let gen_html = '';
        reverse.map(function (h) {
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

            gen_html += '<div class="chat-url">' + h.url + '</div>';
            gen_html += '<div class="chat-msg">';
            gen_html += SemanticSearch.highlight(h.textList[h.index]);
            gen_html += '</div>';
            gen_html += '</div>';
            gen_html += '<br clear="both" />';
        });

        // add pagination at the bottom
        gen_html += '<div class="paginationNav">';
        const classStr1 = this.page > 0 ? "paginationButton" : "paginationButtonDisabled";
        gen_html += '    <div class="' + classStr1 + '" onclick="prevPage()">prev</div>';
        const classStr2 = reverse.length === this.page_size ? "paginationButton" : "paginationButtonDisabled";
        gen_html += '    <div class="' + classStr2 + '" onclick="nextPage()">next</div>';
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

    // create a random guid
    static guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    // get or create a session based client id for SimSage usage
    static getClientId() {
        var clientId = localStorage.getItem("simsearch_client_id");
        if (!clientId || clientId.length === 0) {
            clientId = SemanticSearch.guid(); // create a new client id
            localStorage.setItem("simsearch_client_id", clientId);
        }
        return clientId;
    }

}

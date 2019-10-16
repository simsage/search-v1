/**
 * change the size of a string to not exceed max-size
 * @param str
 * @param max_size
 */
function adjust_size(str, max_size) {
    if (str.length > max_size) {
        const half = Math.floor(max_size / 2);
        return str.substr(0,half) + "..." + str.substr(str.length - half);
    }
    return str;
}

function pad2(item) {
    return ("" + item).padStart(2, '0');
}

/* convert unix timestamp to string */
function unix_time_to_str(timestamp) {
    if (timestamp !== 0) {
        const a = new Date(timestamp);
        const year = a.getFullYear();
        const month = a.getMonth() + 1;
        const date = a.getDate();
        const hour = a.getHours();
        const min = a.getMinutes();
        const sec = a.getSeconds();
        return year + '/' + pad2(month) + '/' + pad2(date) + ' ' + pad2(hour) + ':' + pad2(min) + ':' + pad2(sec);
    }
    return "";
}


/* convert byte size to Kb, Mb, Gb */
function size_to_str(size) {
    if (size < 1024) {
        return size;
    } else if (size < 1024000) {
        return Math.floor(size / 1000) + "KB";
    } else if (size < 1024000000) {
        return Math.floor(size / 1000000) + "MB";
    } else {
        return Math.floor(size / 1000000000) + "GB";
    }
}


/*
 * render a single search result - replacing text as needed for a thing called a "search" object
 * callbacks:
 *   search.prev(id)     move to the previous record if available
 *   search.next(id)     move to the next record if available
 */
function render_result(organisation_id, kb_id, id, title, author, url, url_id, num_results, text, system_url) {
    const image_url = system_url + '/document/preview/' + organisation_id + '/' + kb_id + '/' + url_id + '/-1';
    let result_str = '\
		<div id={id} class="search-result">\
		    <div class="search-text-container">\
			    <div class="search-title" title="{title}" onclick="search.showDetails({url_id}, {url_str})">{title}</div>\
			    <div class="search-container">\
				    <div class="search-left-right">';

    if (id > 0) {
        result_str += '<div class="search-nav"><img src="images/left.svg" alt="left" onclick="search.doInnerPrev({url_str})" /></div>';
    } else {
        result_str += '<div class="search-nav-disabled"><img src="images/left.svg" alt="left" /></div>';
    }
    if (id + 1 < num_results) {
        result_str += '<div class="search-nav"><img src="images/right.svg" alt="right" onclick="search.doInnerNext({url_str})" /></div>'
    } else {
        result_str += '<div class="search-nav-disabled"><img src="images/right.svg" alt="right" /></div>';
    }
    result_str += '\
				    </div>\
				    <div class="search-text">{text}</div>\
			    </div>\
                <div class="search-url">\
                    <a href="{url}" title="{url}" target="_blank">{display_url}</a>\
                </div>\
			</div>\
			<div class="preview-image-container"><img src="' + image_url + '" class="preview-image" alt="preview" \
			     title="view document details" onclick="search.showDetails({url_id}, {url_str})"/></div>\
        </div>';

    if (title.length === 0) {
        title = "(no title)";
    }
    return result_str
        .replace(/{title}/g, title)
        .replace(/{text}/g, text)
        .replace(/{url}/g, url)
        .replace(/{url_id}/g, "'" + url_id + "'")
        .replace(/{url_str}/g, "'" + url + "'")
        .replace(/{display_url}/g, adjust_size(url, 100))
        .replace(/{id}/g, "'" + id + "'");
}

/*
 * render a single search result image - replacing text as needed for a thing called a "search" object
 * callbacks:
 *   search.prev(id)     move to the previous record if available
 *   search.next(id)     move to the next record if available
 */
function render_result_images(organisation_id, kb_id, id, title, author, url, url_id, num_results, text, system_url) {
    const image_url = system_url + '/document/preview/' + organisation_id + '/' + kb_id + '/' + url_id + '/-1';
    let result_str = '\
		<div id={id} class="search-result-2">\
		    <div class="search-container-2">\
			<div class="preview-image-container-2"><img src="' + image_url + '" class="preview-image-2" alt="preview" \
			     title="view document details" onclick="search.showDetails({url_id}, {url_str})"/></div>\
			</div>\
			<div class="search-title-2" title="{title}" onclick="window.open({url_str}, {blank})">{title}</div>\
		</div>';

    if (title.length === 0) {
        title = "(no title)";
    }
    return result_str
        .replace(/{title}/g, title)
        .replace(/{text}/g, text)
        .replace(/{url}/g, url)
        .replace(/{blank}/g, "'_blank'")
        .replace(/{url_id}/g, "'" + url_id + "'")
        .replace(/{url_str}/g, "'" + url + "'")
        .replace(/{display_url}/g, adjust_size(url, 100))
        .replace(/{id}/g, "'" + id + "'");
}

/**
 * render pages
 *
 * @param page
 * @param num_pages
 * @param busy
 * @param num_results
 * @returns {string}
 */
function render_pagination(page, num_pages, busy, num_results) {
    // add pagination at the bottom
    const pages_text = num_results + " results, page " + (page + 1) + " of " + num_pages;
    let result_str = '<div class="pagination">';
    result_str += '  <div class="pagination-text">' + pages_text + '</div>';
    result_str += '  <div class="prev-next">';
    const classStr1 = ((page > 0) && !busy) ? "pagination_button" : "pagination_button_disabled";
    result_str += '    <div id="btnPrev" class="' + classStr1 + '" onclick="search.prevPage()"><img src="images/left.svg" class="page-nav-arrow-left" alt="left" /> prev</div>';
    const classStr2 = (((page + 1) < num_pages) && !busy) ? "pagination_button" : "pagination_button_disabled";
    result_str += '    <div id="btnNext" class="' + classStr2 + '" onclick="search.nextPage()">next <img src="images/right.svg" class="page-nav-arrow-right" alt="right" /></div>';
    result_str += '  </div>';
    result_str += '</div>';
    return result_str;
}

/**
 * render bot text
 * @param url
 * @param text
 * @returns {string}
 */
function render_bot(url, text) {
    let result_str = '<div class="bot-capsule">' +
        '<div class="bot-simsage-logo">' +
        '<img class="bot-simsage-logo-size" src="images/tinman.svg" alt="SimSage" />' +
        '</div>' +
        '<div class="bot-msg">{text}</div>' +
        '<div class="bot-link"><a href="{url}" target="_blank">{url}</a></div>' +
        '</div>';

    return result_str
        .replace(/{text}/g, text)
        .replace(/{url}/g, url);
}

function render_semantics(semantic_set) {
    let result_str = '';

    const key_list = [];
    for (const key in semantic_set) {
        key_list.push(key);
    }
    if (key_list.length > 0) {
        result_str += '<div class="semantic-container">';
        result_str += '<div class="semantic-entry">';
        key_list.sort();
        for (const key of key_list) {
            if (semantic_set.hasOwnProperty(key)) {
                const item_list = semantic_set[key];
                if (item_list.length > 0) {
                    result_str += '<div class="semantic-title">' + key + '</div>';
                    for (const item of item_list) {
                        result_str += '<div class="semantic-text" title="' + item + '" onclick="search.select(\'' + item + '\')">';
                        result_str += adjust_size(item, 20) + '</div>';
                    }
                }
            }
        }
        result_str += '</div>';
        result_str += '</div>';
    }
    return result_str;
}

/* render an advanced view for a document */
function render_details(system_url, organisation_id, kb_id, url_id, document) {
    const image_url = system_url + '/document/preview/' + organisation_id + '/' + kb_id + '/' + url_id + '/0';
    let result_str = '\
                                <div class="details-title">Details\
                                    <div class="details-close-container"><img class="details-close-image" src="images/close.svg" alt="close" title="close dialog" onclick="search.closeDetails()" /></div></div>\
                                <div class="details-pane">\
                                  <div class="details-text">\
                                    <div class="details-item">\
                                      <div class="details-label">url</div>\
                                      <div class="details-label-text">{url}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">title</div>\
                                      <div class="details-label-text">{title}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">author</div>\
                                      <div class="details-label-text">{author}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">document type</div>\
                                      <div class="details-label-text">{document_type}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">document size</div>\
                                      <div class="details-label-text">{document_size}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">source</div>\
                                      <div class="details-label-text">{source}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">created</div>\
                                      <div class="details-label-text">{created}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">last modified</div>\
                                      <div class="details-label-text">{last_modified}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">last crawled</div>\
                                      <div class="details-label-text">{last_crawled}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">sentence count</div>\
                                      <div class="details-label-text">{num_sentences}</div>\
                                    </div>\
                                    <div class="details-item">\
                                      <div class="details-label">word count</div>\
                                      <div class="details-label-text">{num_words}</div>\
                                    </div>\
                                  </div>\
                                  <div class="details-preview-image-box">\
                                    <img src="{image_url}" alt="page preview" class="details-preview-image" title="page preview" />\
                                  </div>\
                                </div>\
                                <div class="details-navigation"></div>\
    ';
    return result_str
        .replace(/{title}/g, adjust_size(document.title, 50))
        .replace(/{author}/g, adjust_size(document.author, 50))
        .replace(/{url}/g, adjust_size(document.url, 50))
        .replace(/{document_type}/g, document.documentType)
        .replace(/{document_size}/g, size_to_str(document.binarySize))
        .replace(/{num_sentences}/g, document.numSentences)
        .replace(/{num_words}/g, document.numWords)
        .replace(/{source}/g, document.source)
        .replace(/{last_modified}/g, unix_time_to_str(document.lastModified))
        .replace(/{last_crawled}/g, unix_time_to_str(document.uploaded))
        .replace(/{created}/g, unix_time_to_str(document.created))
        .replace(/{image_url}/g, image_url);
}

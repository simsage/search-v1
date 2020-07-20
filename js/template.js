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


/**
 * render a bot button
 * @param text the text to display in the button
 * @param action the action to perform
 */
function render_button(text, action) {
    return "<div class='bot-button' title='" + text + "' onclick='" + action + "'>" + text + "</div>";
}



/*
 * render a single search result - replacing text as needed for a thing called a "search" object
 * callbacks:
 *   search.prev(id)     move to the previous record if available
 *   search.next(id)     move to the next record if available
 */
function render_result(organisation_id, kb_id, id, title, author, url, url_id, num_results, text, system_url) {
    const client_id = SemanticSearch.getClientId();
    const image_url = system_url + '/document/preview/' + organisation_id + '/' + kb_id + '/' + client_id + '/' + url_id + '/-1';
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
                <div class="search-url" style="clear: both;">\
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
    const client_id = SemanticSearch.getClientId();
    const image_url = system_url + '/document/preview/' + organisation_id + '/' + kb_id + '/' + client_id + '/' + url_id + '/-1';
    let result_str = '\
		<div id={id} class="search-result-images">\
		    <div class="search-container-images">\
			<div class="preview-image-container-images"><img src="' + image_url + '" class="preview-image-big" alt="preview" \
			     title="view document details" onclick="search.showDetails({url_id}, {url_str})"/></div>\
			</div>\
			<div class="search-title-images" title="{title}" onclick="window.open({url_str}, {blank})">{title}</div>\
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

// render the buttons at the bottom of the bot bubble
function render_buttons(bot_buttons) {
    if (bot_buttons && bot_buttons.length > 0) {
        const list = [];
        for (const button of bot_buttons) {
            list.push(render_button(button.text, button.action));
        }
        return list.join("\n");
    }
    return "";
}

// render a busy message (animating dots)
function render_simsage_busy() {
    return  "<div class=\"busy-image-container\"><img class=\"busy-image\" src=\"images/dots.gif\" alt=\"please wait\"></div>\n";
}

/**
 * apply all render items to the controls set-out for the bot bubble
 * @param search
 * @param bot_display_ctrl
 * @param bot_text_ctrl
 * @param bot_buttons_ctrl
 */
function render_bot(search, bot_display_ctrl, bot_text_ctrl, bot_buttons_ctrl) {
    if (((search.bot_text && search.bot_text.length > 0) || search.is_typing) && search.bubble_visible) {
        bot_display_ctrl.show();
        if (search.is_typing) {
            bot_text_ctrl.html(search.bot_text + "<br\>" + render_simsage_busy());
        } else {
            bot_text_ctrl.html(search.bot_text);
        }
        bot_buttons_ctrl.html(render_buttons(search.bot_buttons));
    } else {
        bot_display_ctrl.hide();
    }
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


// render both the semantics and the context of items on the rhs of the screen
function render_rhs_containers(context_stack, selected_syn_sets, semantic_set) {
    const result = [];
    result.push('<div class="search-background">');
    result.push('<div class="semantic-container">');
    result.push(render_context(context_stack, selected_syn_sets));
    result.push('<div class="spacer"></div>');
    result.push(render_semantics(semantic_set));
    result.push('</div>');
    return result.join('\n');
}


function render_semantics(semantic_set) {
    const result = [];
    const key_list = [];
    for (const key in semantic_set) {
        key_list.push(key);
    }
    key_list.sort();
    for (const key of key_list) {
        result.push('<div class="semantic-entry">');
        result.push('<div class="semantic-title">' + key + '</div>');
        if (semantic_set.hasOwnProperty(key)) {
            const item_list = semantic_set[key];
            if (item_list.length > 0) {
                for (const item of item_list) {
                    let count = '';
                    if (item.frequency > 1) {
                        count += ' (' + item.frequency + ')';
                    }
                    result.push('<div class="semantic-text" title="' + item.word + count + '" onclick="search.select_semantic(\'' + item.word + '\', \'txtSearch\')">');
                    result.push(adjust_size(item.word, 20) + count + '</div>');
                }
            }
        }
        result.push('</div>');
    }
    return result.join('\n');
}

// render the context selection system
function render_context(context_stack, selected_syn_sets) {
    const result = [];
    if (context_stack && context_stack.length > 0) {
        for (const context_str of context_stack) {
            const syn_set = SimSageCommon.getSynSet(context_str);
            if (syn_set) {
                const word = syn_set["word"];
                const clouds = syn_set["clouds"];
                const selected = selected_syn_sets[word.toLowerCase().trim()];
                if (clouds.length > 1) {
                    result.push('<div class="context-entry">');
                    result.push('<div class="context-title">');
                    result.push('<select class="synset-selector" onchange=\'search.select_syn_set("' + word + '",this.selectedIndex - 1);\'>');
                    result.push('<option value="-1">all</option>');
                    for (const i in clouds) {
                        if (clouds.hasOwnProperty(i)) {
                            if (selected == i) {
                                result.push('<option value="' + i + '" selected>' + clouds[i] + '</option>');
                            } else {
                                result.push('<option value="' + i + '">' + clouds[i] + '</option>');
                            }
                        }
                    }
                    result.push('</select>' + word + '</div>');
                    result.push('</div>');
                }
            }
        }
    }
    return result.join('\n');
}


/* render a "no results found" page - and optionally ask for an email address */
function render_no_results(ask_for_email, know_email) {
    if (ask_for_email && !know_email) {
        return render_get_user_email()
    } else if (ask_for_email && know_email) {
        return render_have_user_email();
    } else {
        return  "<div class=\"no-email-ask\">" + ui_settings.no_email_message + "\n<br/></div>";
    }
}

/* render getting the user's email address (asking for) */
function render_get_user_email() {
    return  "<div class=\"email-ask\">" + ui_settings.email_message + "\n<br/>" +
        "<input class='email-address' id='email' onkeypress='search.email_keypress(event)' type='text' placeholder='Email Address' />" +
        "<div class='send-email-button' onclick='search.send_email()' title='send email'></div></div>"
}

/* render getting the user's email address (asking for) */
function render_have_user_email() {
    return  "<div class=\"no-email-ask\">" + ui_settings.have_email_message + "\n<br/></div>";
}

/* render an advanced view for a document */
function render_details(system_url, organisation_id, kb_id, url_id, document, text, query) {
    const client_id = SemanticSearch.getClientId();
    const image_url = system_url + '/document/preview/' + organisation_id + '/' + kb_id + '/' + client_id + '/' + url_id + '/0';
    let result_str = '\
                        <div class="details-title">Details\
                            <div class="details-close-container"><img class="details-close-image" src="images/close.svg" alt="close" title="close dialog" onclick="search.closeDetails()" /></div>\
                        </div>\
                        <div class="details-pane">\
                          <div class="details-text">\
                            <div class="details-item">\
                              <div class="details-label">url</div>\
                              <div class="details-label-text-url" title="{url}" onclick="window.open({url_str},{blank})">{display_url}</div>\
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
                            </div>';

    for (const key in document.metadata) {
        // check if the property/key is defined in the object itself, not in parent
        if (key.indexOf('{') === -1 && document.metadata.hasOwnProperty(key)) {
            const value = document.metadata[key];
            if (value.indexOf("<") === -1) { // no tags or anything allowed - don't render
                result_str += ' <div class="details-item"> \
                              <div class="details-label" title="' + key + '">' + adjust_size(key, 14) + '</div> \
                              <div class="details-label-text" title="' + value + '">' + adjust_size(value, 32) + '</div> \
                            </div>';
            }
        }
    }

    result_str += '\
                            <div class="details-item">\
                              <div class="details-label">search query</div>\
                              <div class="details-label-text">{query}</div>\
                            </div>\
                            <div class="details-item-text">\
                                <div class="search-container-summary">{text}</div>\
                            </div>\
                          </div>\
                          <div class="details-preview-image-box">\
                            <img src="{image_url}" alt="page preview" class="details-preview-image" title="page preview" />\
                          </div>\
                        </div>\
                        <div class="details-navigation"></div>';

    return result_str
        .replace(/{title}/g, adjust_size(document.title, 50))
        .replace(/{text}/g, text)
        .replace(/{query}/g, query)
        .replace(/{author}/g, adjust_size(document.author, 50))
        .replace(/{display_url}/g, adjust_size(document.url, 50))
        .replace(/{url_str}/g, "'" + document.url + "'")
        .replace(/{blank}/g, "'_blank'")
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

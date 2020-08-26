/**
 * helper - pad the number with a leading 0 for two digit numbers
 *
 * @param item          a number
 * @returns {string}    the number with a loading zero or not
 */
function pad2(item) {
    return ("" + item).padStart(2, '0');
}


/**
 * helper - convert unix timestamp to string if it's for a reasonable time in the future
 *
 * @param timestamp     a long value
 * @returns {string}    the long value as a date string
 */
function unix_time_convert(timestamp){
    if (timestamp > 1000) {
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


/**
 * helper - convert byte size to Kb, Mb, Gb
 *
 * @param size          the size, a number
 * @returns string      the adjusted string with KB/MB/GB in it
 */
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
 * helper - change the size of a string to not exceed max-size
 *
 * @param str           the string to look at
 * @param max_size      the max_size before changing the string
 */
function adjust_size(str, max_size) {
    if (str.length > max_size) {
        const half = Math.floor(max_size / 2);
        return str.substr(0,half) + "..." + str.substr(str.length - half);
    }
    return str;
}


/**
 * get a result item from a list by urlId
 *
 * @param url_id        the url id of the item we're looking for
 * @param result_list   the list of items to look in
 * @returns {null}      the item, or null if dne
 */
function get_result_by_id(url_id, result_list) {
    let result = null;
    for (const item of result_list) {
        if (item.urlId === url_id) {
            result = item;
            break;
        }
    }
    return result;
}


/**
 * replace < and > in a string to make it html safe
 * @param str the string to act on
 * @return the escaped string
 */
function esc_html(str) {
    if (typeof str === 'string' || str instanceof String) {
        return str
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
    }
    return str;
}


/**
 * split a url by adding extra spaces around / _ -
 * @param url the url string
 * @return the same string with some spaces added to it
 */
function split(url) {
    return url
        .replace(/\//g, "/ ")
        .replace(/-/g, "- ")
        .replace(/_/g, "_ ")
}


/**
 * render the query that didn't yield any results
 */
function render_no_results(str) {
    return esc_html(adjust_size(str, 30));
}


/**
 * render a simple url in a span
 */
function render_url(url) {
    return "<br/>" +
        "<span class=\"url\" title=\"" + url + "\" onclick=\"window.open('" + url + "', '_blank');\">" + url + "</span>";
}

/**
 * Render a single search-text result
 *
 * @param id                int: numeric id / index of the result
 * @param url               the url string of the result (https:// ...)
 * @param title             the title of this result item
 * @param fragment          the highlight text fragment for this result
 * @param fragment_index    int: the current fragment selected (its index)
 * @param num_fragments     int: the number of fragments in this search result
 * @returns {string} the html to render for this search-result
 */
function render_search_text_result(id, url, title, fragment, fragment_index, num_fragments) {
    let str = "<div class=\"search-result\">\n" +
        "    <table class=\"search-result-inside-table\">\n" +
        "    <tbody class=\"search-result-inside-table\">\n" +
        "        <tr class=\"tr-1\">\n" +
        "            <td title=\"visit [url]>\" class=\"search-text-width\">\n" +
        "                <a href=\"[url]\" target=\"_blank\"><span class=\"url-text\">[split-url]</span></a>\n" +
        "            </td>\n" +
        "            <td rowspan=\"4\" title=\"view more details\" onclick=\"show_details([id]);\" class=\"search-image-width\">\n" +
        "                <img src=\"[thumbnail_src]\" alt=\"[title]\" class=\"result-image\"/>\n" +
        "            </td>\n" +
        "        </tr>\n" +
        "        <tr class=\"tr-1\">\n" +
        "            <td title=\"view more details\" onclick=\"show_details([id]);\"><span class=\"title-text\">[title]</span></td>\n" +
        "        </tr>\n" +
        "        <tr class=\"tr-1\">\n" +
        "            <td><span class=\"result-text\">[fragment]</span></td>\n" +
        "        </tr>\n" +
        "        <tr class=\"tr-1\">\n" +
        "            <td class=\"navigate-td\">\n";
        if (fragment_index > 0) {
            str += "                <span class=\"navigate-left\" title=\"view the previous relevant fragment in this document\" onclick=\"prev_fragment([id]);\"><img src=\"images/left.svg\" class=\"navigate-left-image\" alt=\"previous\" /></span>\n";
        } else {
            str += "                <span class=\"no-navigate-left\" title=\"there is no previous fragment in this document\"><img src=\"images/left-disabled.svg\" class=\"navigate-left-image\" alt=\"no previous\" /></span>\n";
        }
        if ((fragment_index + 1) < num_fragments) {
            str += "                <span class=\"navigate-right\" title=\"view the next relevant fragment in this document\" onclick=\"next_fragment([id]);\"><img src=\"images/right.svg\" class=\"navigate-right-image\" alt=\"next\" /></span>\n";
        } else {
            str += "                <span class=\"no-navigate-right\" title=\"there is no next fragment in this document\"><img src=\"images/right-disabled.svg\" class=\"navigate-right-image\" alt=\"no next\" /></span>\n";
        }
        str += "                <span class=\"navigate-text\" title=\"Scroll through other relevant search results on this page\">Scroll through other relevant search results on this page</span>\n" +
        "            </td>\n" +
        "        </tr>\n" +
        "    </tbody>\n" +
        "    </table>\n" +
        "</div>\n";
    const fragment_str = esc_html(fragment)
        .replace(/{hl1:}/g, "<span class='hl1'>")
        .replace(/{:hl1}/g, "</span>")
        .replace(/{hl2:}/g, "<span class='hl2'>")
        .replace(/{:hl2}/g, "</span>");
    str = str
        .replace(/\[url]/g, esc_html(url))
        .replace(/\[split-url]/g, esc_html(split(url)))
        .replace(/\[id]/g, esc_html(id))
        .replace(/\[thumbnail_src]/g, search.get_preview_url() + '/' + esc_html(id) + '/-1')
        .replace(/\[title]/g, title && title.length > 0 ? esc_html(title) : "(no title)")
        .replace(/\[fragment]/g, fragment_str);
    return str;
}


/**
 * Render a single search-text result
 *
 * @param id                int: numeric id / index of the result
 * @param url               the url string of the result (https:// ...)
 * @param title             the title of this result item
 * @returns {string} the html to render for this search-result
 */
function render_search_image_result(id, url, title) {
    let str = "<div class=\"image-result\">" +
        "  <div class=\"image-image\" title=\"[title]\" onclick=\"show_details([id]);\">\n" +
        "    <img src=\"[thumbnail_src]\" alt=\"image\" class=\"result-image-image\"/>\n" +
        "  </div>\n" +
        "  <div class=\"image-text\" title=\"[title]\" onclick=\"show_details([id]);\">\n" +
        "    [title-short]\n" +
        "  </div>\n" +
        "</div>\n";
    const title_short = adjust_size(title, 40);
    str = str
        .replace(/\[url]/g, url)
        .replace(/\[id]/g, id)
        .replace(/\[thumbnail_src]/g, search.get_preview_url() + '/' + id + '/0')
        .replace(/\[title-short]/g, title_short && title_short.length > 0 ? title_short : "(no title)")
        .replace(/\[title]/g, title && title.length > 0 ? title : "(no title)");
    return str;
}


/**
 * render a list of search results
 *
 * @param result_list   a list of {id, url, title, fragment[], index, thumbnail}
 * @param is_text_view  is this the text view or the image view we need to render?
 * @returns {string}    the html render string
 */
function render_search_results(result_list, is_text_view) {
    let str = "";
    if (!is_text_view) {
        str += "<div class=\"search-result-images\">\n";
    }
    for (const result of result_list) {
        if (result.url) {
            if (is_text_view) {
                str += render_search_text_result(result.urlId, result.url, result.title, result.textList[result.textIndex],
                                                 result.textIndex, result.textList.length);
            } else {
                str += render_search_image_result(result.urlId, result.url, result.title);
            }
        }
    }
    if (!is_text_view) {
        str += "<div class=\"end-marker-images\"></div></div>\n";
    }
    return str;
}


/**
 * Render pagination and image / text selectors on a page
 *
 * @param page          int: the page we're on
 * @param num_results   int: number of results in total
 * @param num_pages     int: the number of pages total
 * @param is_text_view  boolean: are we in text-view mode (otherwise image-view mode)
 * @returns {string}    html render string
 */
function render_pagination(page, num_results, num_pages, is_text_view) {
    let str = "";
    if (page > 0) {
        str += "<span class=\"prev-page-box\" title=\"go to the previous page\" onclick=\"prev_page()\"'>" +
               "<img src=\"images/prev-page.svg\" class=\"prev-page-image\" alt=\"previous page\"/></span>\n";
    } else {
        str += "<span class=\"prev-page-box-disabled\" title=\"there is no previous page\">" +
               "<img src=\"images/prev-page-disabled.svg\" class=\"prev-page-image\" alt=\"previous page disabled\"/></span>\n";
    }
    str += "<span class=\"pagination-text\" title=\"[pagination_text]\">[pagination_text]</span>\n";
    if ((page + 1) < num_pages) {
        str += "<span class=\"next-page-box\" title=\"go to the next page\" onclick=\"next_page()\">" +
               "<img src=\"images/next-page.svg\" class=\"next-page-image\" alt=\"next page\"/></span>\n";
    } else {
        str += "<span class=\"next-page-box-disabled\" title=\"there is no next page\">" +
               "<img src=\"images/next-page-disabled.svg\" class=\"next-page-image\" alt=\"next page disabled\"/></span>\n";
    }
    str += "<span class=\"view-type-box\">\n";
    if (is_text_view) {
        str += "<span class=\"view-text-box-selected\">" +
               "<img src=\"images/view-text-selected.svg\" class=\"view-text\" title=\"viewing text results\" alt=\"text\" /></span>\n";
        str += "<span class=\"view-image-box\">" +
               "<img src=\"images/view-thumbnails.svg\" class=\"view-image\" title=\"view thumbnails\" alt=\"thumbnails\" onclick=\"select_image_view()\"/></span>\n";

    } else {
        str += "<span class=\"view-text-box\">" +
               "<img src=\"images/view-text.svg\" class=\"view-text\" title=\"view text results\" alt=\"text\" onclick=\"select_text_view()\"/></span>\n";
        str += "<span class=\"view-image-box-selected\">" +
               "<img src=\"images/view-thumbnails-selected.svg\" class=\"view-image\" title=\"viewing thumbnails\" alt=\"thumbnails\" /></span>\n";
    }
    str += "</span>\n";

    let pagination_text = "";
    if (num_results === 1) {
        pagination_text = "page " + esc_html(page + 1) + " of " + esc_html(num_pages) + ", one result";
    } else {
        pagination_text = "page " + esc_html(page + 1) + " of " + esc_html(num_pages) + ", " + esc_html(num_results) + " results"
    }
    str = str.replace(/\[pagination_text]/g, pagination_text);
    return str;
}


/**
 * helper for render details, render a single detail for the detail view
 *
 * @param label         the text of the label of the detail
 * @param text          the text to display as part of the detail
 * @returns {string}    html string of the item
 */
function render_single_detail(label, text) {
    let str = "" +
        "    <div class=\"row-height align-top\">\n" +
    "            <span class=\"label\" title=\"[label]\">[label]</span><span class=\"text\" title=\"[text]\">[text]</span>\n" +
        "    </div>\n"
    str = str
        .replace(/\[label]/g, esc_html(label))
        .replace(/\[text]/g, esc_html(text));
    return str;
}


/**
 * helper for render details, render a single detail for the detail view, but as a url that is clickable
 *
 * @param label         the text of the label of the detail
 * @param url           the text/url to display as part of the detail
 * @returns {string}    html string of the item
 */
function render_single_detail_url(label, url) {
    let str = "" +
        "    <div class=\"row-height align-top\">\n" +
        "            <span class=\"label\" title=\"[label]\">[label]</span><span class=\"url\" onclick=\"window.open('[url]', '_blank')\" title=\"[text]\">[text]</span>\n" +
        "    </div>\n"
    str = str
        .replace(/\[label]/g, esc_html(label))
        .replace(/\[text]/g, esc_html(url));
    return str;
}


/**
 * render the details for a result
 *
 * @param url_id        the url_id of the item to look for
 * @param result_list   the list of results
 * @returns {string}    an html string that can be rendered
 */
function render_details(url_id, result_list) {
    let result = get_result_by_id(url_id, result_list);
    if (result === null) return "";
    let str = "<table>\n" +
        "    <tr class=\"align-top whole-row\">\n" +
        "        <td class=\"align-top row-1\">\n";

    str += render_single_detail_url("url", result.url);
    if (result.title) {
        str += render_single_detail("title", result.title);
    }
    if (result.urlId > 0) {
        str += render_single_detail("document id", result.urlId);
    }
    if (result.author) {
        str += render_single_detail("author", result.author);
    }
    if (result.documentType) {
        str += render_single_detail("document type", result.documentType);
    }
    if (result.binarySize > 0) {
        str += render_single_detail("document byte-size", size_to_str(result.binarySize));
    }
    if (result.textSize > 0) {
        str += render_single_detail("text byte-size", size_to_str(result.textSize));
    }
    if (result.source) {
        str += render_single_detail("source/origin", result.source);
    }
    if (result.created > 0) {
        str += render_single_detail("document created date/time", unix_time_convert(result.created));
    }
    if (result.lastModified > 0) {
        str += render_single_detail("document last-modified date/time", unix_time_convert(result.lastModified));
    }
    if (result.uploaded > 0) {
        str += render_single_detail("pipeline last-crawled date/time", unix_time_convert(result.uploaded));
    }
    if (result.converted > 0) {
        str += render_single_detail("pipeline last-converted date/time", unix_time_convert(result.converted));
    }
    if (result.parsed > 0) {
        str += render_single_detail("pipeline last-parsed date/time", unix_time_convert(result.parsed));
    }
    if (result.indexed > 0) {
        str += render_single_detail("pipeline last-indexed date/time", unix_time_convert(result.indexed));
    }
    if (result.previewed > 0) {
        str += render_single_detail("pipeline last-preview date/time", unix_time_convert(result.previewed));
    }
    if (result.numSentences > 0) {
        str += render_single_detail("number of sentences", result.numSentences);
    }
    if (result.numWords > 0) {
        str += render_single_detail("number of words", result.numWords);
    }
    if (result.numRelationships > 0) {
        str += render_single_detail("number of relationships", result.numRelationships);
    }
    for (const key in result.metadata) {
        // check if the property/key is defined in the object itself, not in parent
        if (key.indexOf('{') === -1 && result.metadata.hasOwnProperty(key)) {
            const value = result.metadata[key];
            if (value.indexOf("<") === -1) { // no tags or anything allowed - don't render
                str += render_single_detail("entity count: " + key, value);
            }
        }
    }
    str += "        </td>\n" +
        "        <td rowspan=\"20\" class=\"image-row align-top\">\n" +
        "            <img src=\"[image]\" class=\"preview-image\" alt=\"page preview\" />\n" +
        "        </td>\n" +
        "    </tr>\n" +
        "</table>\n";
    str = str
        .replace(/\[url]/g, esc_html(result.url))
        .replace(/\[image]/g, search.get_preview_url() + '/' + esc_html(result.urlId) + '/0');
    return str;
}


/**
 * render a single chat item for display in the chat dialog box
 *
 * @param chat_item     the item, {who: "", when: "", what: ""}
 * @returns {string}    html string
 */
function render_single_chat(chat_item) {
    let str = "";
    if (chat_item.who === "You" || chat_item.who === "you") {
        str = "<tr class=\"tr-1\">\n" +
            "    <td class=\"col-1\">\n" +
            "    </td>\n" +
            "    <td class=\"col-2\">\n" +
            "        <div class=\"right-box\">\n" +
            "            <span class=\"you-label\">[who]</span>\n" +
            "            <span class=\"hyphen\">-</span>\n" +
            "            <span class=\"you-time\">[when]</span>\n" +
            "            <div class=\"table-separator\"></div>\n" +
            "            <span class=\"you-text\">[what]</span>\n" +
            "        </div>\n" +
            "    </td>\n" +
            "</tr>\n";
    } else {
        str = "<tr class=\"tr-1\">\n" +
            "    <td class=\"col-1\">\n" +
            "        <div class=\"left-box\">\n" +
            "            <span class=\"bot-label\">[who]</span>\n" +
            "            <span class=\"hyphen\">-</span>\n" +
            "            <span class=\"bot-time\">[when]</span>\n" +
            "            <div class=\"table-separator\"></div>\n" +
            "            <span class=\"bot-text\">[what]</span>\n" +
            "        </div>\n" +
            "    </td>\n" +
            "    <td class=\"col-2\">\n" +
            "    </td>\n" +
            "</tr>\n";
    }
    str = str
        .replace(/\[who]/g, esc_html(chat_item.who))
        .replace(/\[when]/g, esc_html(chat_item.when))
        .replace(/\[what]/g, chat_item.what);
    return str;
}


/**
 * render three animating dots showing the operator is typing
 *
 * @returns {string}    html string
 */
function render_operator_is_typing() {
    return "<tr class=\"tr-1\">\n" +
            "    <td class=\"col-1\">\n" +
            "        <div class=\"left-box-white\">\n" +
            "            <span class=\"typing-dots-box\"><img src=\"images/dots.gif\" class=\"typing-dots-image\" alt=\"typing\" /></span>\n" +
            "        </div>\n" +
            "    </td>\n" +
            "    <td class=\"col-2\">\n" +
            "    </td>\n" +
            "</tr>\n";
}


/**
 * render all chat items from a list
 *
 * @param chat_item_list        a list of chat items
 * @param operator_is_typing    true if the operator is busy typing, show dots
 * @returns {string}            html string
 */
function render_chats(chat_item_list, operator_is_typing) {
    let str = "";
    for (const chat_item of chat_item_list) {
        str += render_single_chat(chat_item);
    }
    if (operator_is_typing) {
        str += render_operator_is_typing();
    }
    return str;
}


/**
 * render a single category item
 *
 * @param title             the title of the item
 * @param item_obj_list     a list of sub-items {}
 * @returns {string}        the render html
 */
function render_single_category_item(title, item_obj_list) {
    let str = "<div class=\"category-item\">\n" +
        "  <div class=\"category-title\" title=\"" + title + "\">" + title + "</div>\n";
    for (const item of item_obj_list) {
        let frequency_str = "";
        if (item.frequency > 1) {
            frequency_str = " (" + item.frequency + ")";
        }
        str += "<div class=\"category-text\" title=\"further refine your search using " + item.word + "\"" +
               " onclick=\"add_search('" + esc_html(item.word) + "');\">" + adjust_size(esc_html(item.word), 20) + frequency_str + "</div>\n";
    }
    str += "</div>\n";
    return str;
}


// render a synset
function render_single_synset(synset, selected_syn_sets) {
    const result = [];
    const syn_set = SimSageCommon.get_synset(synset);
    if (syn_set) {
        const word = syn_set["word"];
        const clouds = syn_set["clouds"];
        const selected = selected_syn_sets[word.toLowerCase().trim()];
        if (clouds.length > 1) {
            result.push('<div class="synset-entry">');
            result.push('<div class="synset-title" title="select different meanings of \'' + word +'\'">' + word + '</div>');
            result.push('<select class="synset-selector" onchange=\'select_syn_set("' + word + '",this.selectedIndex - 1);\'>');
            result.push('<option value="-1">all meanings</option>');
            for (const i in clouds) {
                if (clouds.hasOwnProperty(i)) {
                    if (selected == i) {
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
}


/**
 * Render a dictionary of category-items
 *
 * @param synset_list       the synsets
 * @param category_set      the set
 * @param selected_syn_sets the user's synset selection
 * @return {string}         the render HTML
 */
function render_category_items(synset_list, selected_syn_sets, category_set) {
    let str = "";
    for (const key in synset_list) {
        if (synset_list.hasOwnProperty(key)) {
            str += render_single_synset(synset_list[key], selected_syn_sets);
        }
    }
    for (const key in category_set) {
        if (category_set.hasOwnProperty(key)) {
            str += render_single_category_item(key, category_set[key]);
        }
    }
    return str;
}

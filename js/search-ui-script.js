

// call update_ui(0, 0, 0, [], {}, [], false, false, false) to draw the UI
// call setup_dropdowns([], []) to setup the advanced search kb and sources
// see: jQuery(document).ready() below for an example


// create an instance of our object
search = new SemanticSearch();

// callbacks fns to set to use this UI
callback = {
    do_search: (page, text, filter) => search.do_semantic_search(page, text, filter, true),
    do_chat: (page, text, filter) => search.do_chat(page, text, filter),
    do_email: (email) => search.send_email(email),
    do_sign_in: (source_id, user, password) => search.sign_in(source_id, user, password),
    do_sign_out: () => search.sign_out(),
    do_close_query_window: () => search.close_query_window(),
    change_kb: (kb_id) => search.on_change_kb(kb_id),
    user_is_typing: () => search.user_is_typing(),
    view_prev_page: () => search.prev_page(),
    view_next_page: () => search.next_page(),
}

//////////////////////////////////////////////////////////////////////////////////////
// private helpers and cache items

// text or image view?
is_text_view = true;

// pagination variables (cache)
page_cache = 0;
num_pages_cache = 0;
num_results_cache = 0;

// mouse x and y
mx = 0;
my = 0;

// the current query - cached
text_cache = "";

// data items - cache for the UI
result_list_cache = [];
conversation_list_cache = [];
category_set_cache = {};
domain_list_cache = [];
syn_set_list_cache = [];
selected_syn_sets = {};

// is the operator typing
is_typing_cache = false;


////////////////////////////////////////////////////////////////////////////////////////////
// JS logic for the item above

/**
 * update the UI, draw it
 *
 * @param page                  the page (starting at zero) we're on
 * @param num_pages             the number of pages in total
 * @param num_results           the total number of results found for this query
 * @param result_list           a list of search results
 * @param category_set          a list of semantic categories to display alongside the search results
 * @param synset_list           a set of synsets to be displayed for selection
 * @param conversation_list     a bot conversation list
 * @param show_not_found        display "no results found"?
 * @param has_chat              do we need to show the chat bot window?
 * @param is_typing             is the connected operator typing?
 */
function update_ui(page, num_pages, num_results, result_list, category_set,
                   synset_list, conversation_list, show_not_found, has_chat, is_typing) {
    // set locally for other update functions
    result_list_cache = result_list;
    conversation_list_cache = conversation_list;
    category_set_cache = category_set;
    syn_set_list_cache = synset_list;
    page_cache = page;
    num_pages_cache = num_pages;
    num_results_cache = num_results;

    if (!show_not_found) {
        if (result_list.length > 0) {
            jQuery(".search-results-td").html(render_search_results(result_list, is_text_view));
            jQuery(".category-items-td").html(render_category_items(synset_list, selected_syn_sets, category_set));
            jQuery(".search-results").show();
            jQuery(".no-search-results").hide();
            setup_pagination();
        } else {
            jQuery(".search-results").hide();
        }
        if (has_chat) {
            show_chat();
        }

        // update the content of the chat window in any case
        update_chat_window(conversation_list, is_typing);

    } else {
        jQuery(".not-found-words").html("\"" + render_no_results(text_cache) + "\"");
        jQuery(".search-results").hide();
        jQuery(".no-search-results").show();
    }
}


/**
 * setup the drop-down boxes for the advanced filter interface
 *
 * @param kb_list           a list of knowledge base items {id, name}
 * @param source_list       a list of source items {id, name}
 */
function setup_dropdowns(kb_list, source_list) {
    let str1 = "";
    for (const kb of kb_list) {
        str1 += "<option value=\"" + esc_html(kb.id) + "\">" + esc_html(kb.name) + "</option>";
    }
    jQuery(".dd-knowledge-base").html(str1);

    let str2 = "<option value=\"\">All Sources</option>";
    for (const source of source_list) {
        str2 += "<option value=\"" + esc_html(source.id) + "\">" + esc_html(source.name) + "</option>";
    }
    jQuery(".dd-source").html(str2);
}

// tell the system we are busy (or not)
function busy(is_busy) {
    if (is_busy) {
        jQuery(".search-table input").attr("disabled", true);
        jQuery(".operator-chat-box input").attr("disabled", true);
        jQuery(".filter-box input").attr("disabled", true);
        jQuery(".search-sign-in input").attr("disabled", true);
    } else {
        jQuery(".search-table input").removeAttr("disabled");
        jQuery(".operator-chat-box input").removeAttr("disabled");
        jQuery(".filter-box input").removeAttr("disabled");
        jQuery(".search-sign-in input").removeAttr("disabled");
    }
}

// we get notified that simsage has connected
function simsage_connected() {
}

// tell us there is an error
function error(err) {
    busy(false);
    if (err && err !== '') {
        let err_str = "";
        if (err && err["readyState"] === 0 && err["status"] === 0) {
            err_str = "Server not responding, not connected.";
        } else if (err && err["responseText"] && err["status"] > 299) {
            err_str = err["responseText"];
        } else {
            err_str = err;
        }
        if (err_str && err_str.trim && err_str.trim().length > 0) {
            jQuery(".error-text").html(esc_html(err_str));
            jQuery(".error-dialog-box").show();
        }
    } else {
        close_error();
    }
}
function close_error() {
    jQuery(".error-dialog-box").hide();
}

function close_no_results() {
    jQuery(".no-search-results").hide();
}

// user selects a syn-set to use
function select_syn_set(word, index) {
    selected_syn_sets[word] = index;
}

// set text focus on an item and make sure the text cursor is at the end of that field
function focus_text(ctrl) {
    const c = jQuery(ctrl);
    c.focus();
    c.val("");
    c.val(text_cache);
}
// a user decides to change their kb
function do_change_kb() {
    if (callback.change_kb) {
        callback.change_kb(jQuery(".dd-knowledge-base").val());
    }
}
// user wishes to view the previous page
function prev_page() {
    if (callback.view_prev_page) {
        callback.view_prev_page(page_cache, num_pages_cache, num_results_cache);
    }
}
// user wishes to view the next page
function next_page() {
    if (callback.view_next_page) {
        callback.view_next_page(page_cache, num_pages_cache, num_results_cache);
    }
}
// we just got a message that the operator's typing status has changed
function update_chat_window(chat_list, is_typing) {
    conversation_list_cache = chat_list;
    is_typing_cache = is_typing;
    const ct = jQuery(".chat-table:visible");
    if (ct.is(":visible")) {
        ct.html(render_chats(conversation_list_cache, is_typing_cache));
        ct.animate({scrollTop: ct.prop("scrollHeight")}, 10);
    }
}
// setup render pagination
function setup_pagination() {
    jQuery(".pagination-box").html(render_pagination(page_cache, num_results_cache,
        num_pages_cache, is_text_view));
}

// reset selection to default for a drop-down
function reset_selection(selection_class) {
    jQuery('label.' + selection_class + ' select').val("");
}

// reset all selections and text in the advanced search filter
function clear_all() {
    reset_selection('document-type-sel');
    reset_selection('source-sel');
    jQuery(".title-text").val("");
    jQuery(".url-text").val("");
    jQuery(".author-text").val("");
}
// return the values of the advanced filter box
function get_advanced_filter() {

    const parent_data = find_most_recent_parent(".search-options-chevron-box")
    if (parent_data.parent) {
        const parent = parent_data.parent;
        return {
            "document_type": parent.find('label.document-type-sel select').val().split(','),
            "kb": parent.find('label.knowledge-base-sel select').val(),
            "source_id": parent.find('label.source-sel select').val(),
            "title": [parent.find('.title-text').val()],
            "url": [parent.find('.url-text').val()],
            "author": [parent.find('.author-text').val()],
            "syn-sets": selected_syn_sets,
        };
    } else {
        return {
            "document_type": jQuery('label.document-type-sel select').val().split(','),
            "kb": jQuery('label.knowledge-base-sel select').val(),
            "source_id": jQuery('label.source-sel select').val(),
            "title": [jQuery('.title-text').val()],
            "url": [jQuery('.url-text').val()],
            "author": [jQuery('.author-text').val()],
            "syn-sets": selected_syn_sets,
        };
    }
}
// search results text-view
function select_text_view() {
    is_text_view = true;
    jQuery(".search-results-td").html(render_search_results(result_list_cache, is_text_view));
    setup_pagination();
}
// search results image-view
function select_image_view() {
    is_text_view = false;
    jQuery(".search-results-td").html(render_search_results(result_list_cache, is_text_view));
    setup_pagination();
}
// find the box closest to the mouse - for click and find actions
function find_closest_parent(parent_class) {
    // find the closest parent to the mouse position
    const boxes = jQuery(parent_class);
    let best_index = 0;
    let parent = null;
    if (boxes) {
        let best_distance = -1;
        boxes.each(function (index) {
            const offset = jQuery(this).offset();
            const dist_x = (offset.left - mx);
            const dist_y = (offset.top - my);
            const dist = dist_x * dist_x + dist_y * dist_y;
            if (best_distance === -1 || dist < best_distance) {
                best_distance = dist;
                best_index = index;
                parent = jQuery(this);
            }
        });
        if (parent.length) {
            const ts = parent.find(".time-stamp");
            if (ts) ts.val(SimSageCommon.get_system_time());
        }
    }
    return {"parent": parent, "index": best_index};
}
// find most recent parent
function find_most_recent_parent(parent_class) {
    // find the closest parent to the mouse position
    const boxes = jQuery(parent_class);
    let best_index = 0;
    let best_parent = null;
    if (boxes) {
        let best_time = -1;
        boxes.each(function (index) {
            const parent = jQuery(this);
            let time = 0;
            if (parent.length) {
                const ts = parent.find(".time-stamp");
                if (ts.length) {
                    time = parseInt(ts.val());
                }
            }
            if (best_time === -1 || time > best_time) {
                best_index = index;
                best_time = time;
                best_parent = parent;
            }
        });
    }
    return {"parent": best_parent, "index": best_index};
}
function click_chat() {
    nop();
    jQuery('.chat-with-us-second:visible').first().click()
}
// show the chat dialog and render its text and scroll down
function show_chat() {
    nop();
    // find the closest parent to the mouse position
    const parent_data = find_closest_parent(".chat-with-us")
    if (parent_data.parent) {
        const parent = parent_data.parent;
        const parent_index = parent_data.index;
        const offset = parent.offset();
        const box = parent.find(".operator-chat-box-view");
        box.css({top: offset.top + 22 + ((parent_index > 0) ? 34 : 0),
                 left: (offset.left - box.width()) + 150, position:'absolute'});
        box.show();

        // close other boxes
        jQuery(".filter-box-view").hide();
        jQuery(".search-details-view").hide();
        close_sign_in();
        const ct = jQuery(".chat-table:visible");
        if (ct.is(":visible")) {
            ct.html(render_chats(conversation_list_cache, is_typing_cache));
            ct.animate({scrollTop: ct.prop("scrollHeight")}, 10);
            const ctrl = jQuery(".chat-text");
            ctrl.val("");
            ctrl.focus();
        }
    }
    return false;
}
// close the chat dialog
function close_chat() {
    nop();
    jQuery(".operator-chat-box-view").hide();
    if (callback.do_close_query_window) {
        callback.do_close_query_window();
    }
    return false;
}
// for click events, stop propagating
function nop() {
    if (event) event.stopPropagation()
}
// show the advanced search filter
function show_filter() {
    nop();
    const parent_data = find_closest_parent(".search-options-chevron-box");
    if (parent_data && parent_data.parent) {
        const parent = parent_data.parent;
        const parent_index = parent_data.index;
        const offset = parent.offset();
        const box = parent.find(".filter-box-view");
        box.css({top: offset.top + 22 + ((parent_index > 0) ? 34 : 0),
                 left: offset.left - Math.floor(box.width() * 0.75), position:'absolute'});
        box.show();
        // hide other controls
        jQuery(".operator-chat-box-view").hide();
        jQuery(".search-details-view").hide();
        close_sign_in();
        focus_text(".chat-text");
    }
}
function click_filter() {
    nop();
    jQuery('.search-options-button:visible').first().click()
}
// close the advanced search filter
function close_filter() {
    nop();
    jQuery(".filter-box-view").hide();
}
// show all details for a particular result
function show_details(id) {
    jQuery(".filter-box-view").hide();
    jQuery(".operator-chat-box-view").hide();
    jQuery(".search-details-view").show();
    jQuery(".detail-table").html(render_details(id, result_list_cache));
}
// close the details view of a particular result
function close_details() {
    jQuery(".search-details-view").hide();
}
function show_kb_dropdown() {
    jQuery(".knowledge-base-selector").show();
}
// add a search term (or remove) to the search text from the semantics / categories box
function add_search(term) {
    let text = " " + text_cache + " ";
    if (text.indexOf(" " + term + " ") >= 0) {
        text = text.replace(" " + term + " ", " ");
    } else {
        text = text + " " + term;
    }
    text_cache = text.trim();
    do_search();
}
// fragment browser prev
function prev_fragment(id) {
    const result = get_result_by_id(id, result_list_cache);
    if (result != null) {
        if (result.textIndex > 0) {
            result.textIndex -= 1;
            jQuery(".search-results-td").html(render_search_results(result_list_cache, is_text_view));
        }
    }
}
// fragment browser next
function next_fragment(id) {
    const result = get_result_by_id(id, result_list_cache);
    if (result != null) {
        if (result.textIndex + 1 < result.textList.length) {
            result.textIndex += 1;
            jQuery(".search-results-td").html(render_search_results(result_list_cache, is_text_view));
        }
    }
}
// start a search
function do_search() {
    const af = get_advanced_filter(); // get advanced search options
    if (callback.do_search) {
        callback.do_search(page_cache, text_cache, af);
    }
}
// clear the search text input and filters
function clear_search() {
    text_cache = "";
    jQuery(".search-text").val("");
    jQuery(".chat-text").val("");
    // clear filters
    clear_all();
}
// send a chat message to the system
function do_chat() {
    const af = get_advanced_filter(); // get advanced search options
    jQuery(".search-text").val(text_cache);
    if (callback.do_chat) {
        callback.do_chat(page_cache, text_cache, af);
    }
}
// send an "email me" request to the server
function do_email() {
    const text = jQuery("label.email-address-text input").val();
    if (callback.do_email) {
        callback.do_email(text);
    }
}
// signal system that a client is typing on their keyboard
function user_is_typing() {
    if (callback.user_is_typing) {
        callback.user_is_typing();
    }
}
// test enter and/or typing on the search box
function search_typing(event, text) {
    text_cache = text;
    if (event.keyCode === 13) {
        do_search();
    }
}
// test enter and/or typing on the search box
function chat_typing(event, text) {
    text_cache = text;
    if (event.keyCode === 13) {
        do_chat();
    } else {
        user_is_typing();
    }
}
// test enter on email box
function email_typing(event) {
    if (event.keyCode === 13) {
        do_email();
    }
}
// simsage notifies the ui we have domains to sign-in to {sourceId, name (of source), domain_type}
function setup_sign_in(domain_list) {
    domain_list_cache = domain_list;
    jQuery(".sign-out-text").hide(); // always hidden until signed-in
    if (domain_list && domain_list.length > 0 && callback.do_sign_in) {
        let str = "";
        for (const domain of domain_list) {
            str += "<option value=\"" + esc_html(domain.sourceId) + "\">" + esc_html(domain.name) +
                " (" + esc_html(domain.domain_type) + ")</option>";
        }
        jQuery(".dd-sign-in").html(str);
        jQuery(".sign-in-box").show();
        jQuery(".sign-in-text").show();
    } else {
        jQuery(".sign-in-box").hide();
        jQuery(".sign-in-text").hide();
    }
}
// helper for sign-in
function get_selected_domain() {
    let selected_domain = null;
    const selected_source_id = jQuery('label.sign-in-sel select').val();
    for (const domain of domain_list_cache) {
        if (domain.sourceId == selected_source_id) {
            selected_domain = domain;
            break;
        }
    }
    return selected_domain;
}
// reset selection to default for a drop-down
function show_sign_in() {
    let selected_domain = get_selected_domain();
    if (selected_domain) {
        jQuery(".filter-box-view").hide();
        jQuery(".sign-in-title").html("sign-in to \"" + esc_html(selected_domain.name) + ", " +
                esc_html(selected_domain.domain_type) + "\"");
        jQuery(".search-sign-in").show();
        focus_text(".user-name");
    }
}
// tell simsage we'd like to sign-out
function do_sign_out() {
    if (callback.do_sign_out) {
        callback.do_sign_out();
    }
}
function close_sign_in() {
    jQuery(".search-sign-in").hide();
}
function do_sign_in() {
    let selected_domain = get_selected_domain();
    if (selected_domain && callback.do_sign_in) {
        callback.do_sign_in(selected_domain.sourceId, jQuery(".user-name").val(), jQuery(".password").val());
    }
}
// update the sign-in status (close), are we signed in or not?
function sign_in_status(signed_in) {
    jQuery(".search-sign-in").hide(); // in all cases, close the sign-in dialog
    // change the text on the filter dialog
    if (signed_in) {
        jQuery(".sign-out-text").show();
        jQuery(".sign-in-text").hide();
    } else {
        jQuery(".sign-in-text").show();
        jQuery(".sign-out-text").hide();
    }
}
// monitor the ESC key to close dialog boxes
jQuery(document).on('keydown', function(event) {
    if (event.key === "Escape") {
        const err_ctrl = jQuery(".error-dialog-box");
        if (err_ctrl.is(":visible")) {
            err_ctrl.hide();
        } else {
            close_chat();
            jQuery(".filter-box-view").hide();
            jQuery(".search-details-view").hide();
            jQuery(".search-sign-in").hide();
            jQuery(".no-search-results").hide();
        }
    }
});

jQuery(document).ready(function () {
    this.addEventListener('mousemove', (event) => {
        mx = event.pageX;
        my = event.pageY;
    });
    jQuery(window).resize(() => {
        // these need to hide while resizing the ui
        jQuery(".filter-box-view").hide();
        jQuery(".operator-chat-box-view").hide();
    });
    setup_dropdowns([], []);
    update_ui(0, 0, 0, [], {}, [],
        [], false, false, false);
    search.init_simsage();
    // set placeholder if set
    if (settings && settings.search_placeholder && settings.search_placeholder.length > 0) {
        jQuery(".search-text").attr("placeholder", settings.search_placeholder);
    }
});

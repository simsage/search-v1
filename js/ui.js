// mouse x and y, used by WordPress for multiple dialogs on screen
mx = 0;
my = 0;

// image base for wp
image_base = '';

// size of thumb-control on the min-max sliders
let min_max_thumb_size = 12;

// callbacks fns to set to use this UI
let callback = {
    do_search: function (text, filter) { search.do_search(text, filter) },
    do_chat: function(text) { search.do_chat(text) },
    is_valid_email: function(text) { return search.validate_email(text) },
    do_email: function(email) { search.do_email(email) },
    do_sign_in: function(source_id, user, password) { search.do_sign_in(source_id, user, password)},
    do_sign_out: function() { search.do_sign_out() },
    on_change_kb: function(kb_id) { search.on_change_kb(kb_id) },
    clear_all_results: function() { search.clear_all_results() },
    on_change_source: function(source_id) { search.on_change_source(source_id) },
    user_is_typing: function() { search.user_is_typing() },
    view_prev_page: function() { search.prev_page() },
    view_next_page: function() { search.next_page() },
    view_page: function(page) { search.view_page(page) },
    change_domain: function(domain_id) { search.change_domain(domain_id) },
    change_page_size: function(page_size) { search.change_page_size(page_size) },
    change_sort: function(sort_index) { search.change_sort(sort_index) },
    get_selected_domain: function() { return search.get_selected_domain() },
    get_search_text: function() { return search.get_search_text() },
    get_image_url_by_doc_url: function(url) { return search.get_image_url_by_doc_url(url) },
    get_sliders: function() { return search.get_sliders() },
    select_syn_set: function(word, index) { search.select_syn_set(word, index) },
    set_selected_view: function(view_id) { search.set_selected_view(view_id) },
    get_selected_syn_sets: function() { return search.get_selected_syn_sets() },
    get_result_by_id: function(id) { return search.get_result_by_id(id) },
    has_bot_results: function() { return search.has_bot_results() },
    has_search_results: function() { return search.has_search_results() },
    has_spelling_suggestion: function() { return search.has_spelling_suggestion() },
    use_spelling_suggestion: function() { search.use_spelling_suggestion() },
    get_search_query: function() { return search.get_search_query() },
    know_users_email: function() { return search.know_users_email() },
    toggle_filters: function() { search.toggle_filters() },
    clear_filters: function() { search.clear_filters() },
    get_is_db: function() { return search.get_is_db() },
    source_category1_select: function(display_name, category_name, category_type) { search.source_category1_select(display_name, category_name, category_type) },
    source_category2_select: function(display_name, category_name, category_type) { search.source_category2_select(display_name, category_name, category_type) },
    source_category2_l2_select: function(display_name, category_name, category_type) { search.source_category2_l2_select(display_name, category_name, category_type) },
    set_one_level_filter: function(display_name, category_type, filter_text) { search.set_one_level_filter(display_name, category_type, filter_text) },
    set_slider: function(metadata, min, max) { search.set_slider(metadata, min, max) },
    select_rating: function(display_name, rating) { search.select_rating(display_name, rating) },
    ////////////////////////////////////////////////////////////////////////////
    // render items
    render_search_results: function() { return search.render_search_results() },
    render_pagination: function() { return search.render_pagination() },
    render_details_view: function(url) { return search.render_details_view(url) },
    render_chats: function() { return search.render_chats() },
    render_bot: function() { return search.render_bot() },
    render_kbs: function() { return search.render_kbs() },
    render_categories: function() { return search.render_categories() },
    render_sources: function() { return search.render_sources() },
    render_spelling_suggestion: function() { return search.render_spelling_suggestion() }
}

// set text focus on an item and make sure the text cursor is at the end of that field
function focus_text(ctrl) {
    const c = jQuery(ctrl);
    c.focus();
    const txt = c.val();
    c.val("");
    c.val(txt);
}

// reset "a selection" (selection_class) to default for a drop-down
function reset_selection(selection_class) {
    jQuery('label.' + selection_class + ' select').val("");
}

// replace < and > to make a string html safe
function esc_html(str) {
    if (str) {
        if (typeof str === 'string' || str instanceof String) {
            str = str
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            str = str
                .replace(/&lt;br \/&gt;/g, "<br />");
            return str;
        } else {
            return str;
        }
    }
    return "";
}

// tell the ui we are busy (or not)
function busy(is_busy) {
    if (is_busy) {
        jQuery(".search-bar input").attr("disabled", true);
        jQuery(".operator-chat-box input").attr("disabled", true);
        jQuery(".filter-box input").attr("disabled", true);
        jQuery(".search-sign-in input").attr("disabled", true);
    } else {
        jQuery(".search-bar input").removeAttr("disabled");
        jQuery(".operator-chat-box input").removeAttr("disabled");
        jQuery(".filter-box input").removeAttr("disabled");
        jQuery(".search-sign-in input").removeAttr("disabled");
    }
}

// tell the UI there is an error
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
        close_error(); // empty or invalid error closes the error dialog
    }
}

// close the error dialog box
function close_error() {
    jQuery(".error-dialog-box").hide();
}

// show the advanced search filter
function show_filter() {
    nop();
    const ctrl = jQuery(".filter-box-view");
    if (ctrl.is(":visible")) {
        ctrl.hide();
    } else {
        ctrl.show();
    }
}

// close the filter dialog box
function close_filter() {
    jQuery(".filter-box-view").hide();
}

// show the kb drop-down inside the filter
function show_kb_dropdown() {
    jQuery(".knowledge-base-selector").show();
}

// show or hide the chat button with the visible flag
function show_chat_button(has_operator, has_chat_messages) {
    nop();
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
        close_chat();
    }
}

// click the chat button right bottom corner and show/hide dialog
function show_chat() {
    nop();
    const ctrl = jQuery(".operator-chat-box-view");
    if (ctrl.is(":visible")) {
        ctrl.hide();
    } else {
        ctrl.show();
        update_chat_window();
    }
}

// SimSage callback, we just got a message that the operator's typing status has changed or new chat text
function update_chat_window() {
    const ct = jQuery(".chat-table");
    ct.html(callback.render_chats());
    // scroll to bottom of chat window to make the most recent message visible
    ct.animate({scrollTop: ct.prop("scrollHeight")}, 10);
}

// close the dialog
function close_chat() {
    nop();
    jQuery(".operator-chat-box-view").hide();
}

// reset all selections and text in the advanced search filter
function clear_all() {
    reset_selection('document-type-sel');
    jQuery(".title-text").val("");
    jQuery(".url-text").val("");
    jQuery(".author-text").val("");
    close_spelling_suggestion();
}

// SimSage notifies the ui we have domains to sign-in to {sourceId, name (of source), domain_type}
function setup_sign_in(domain_list) {
    jQuery(".sign-out-text").hide(); // always hidden until signed-in
    if (domain_list && domain_list.length > 0) {
        let str = "";
        for (let i in domain_list) {
            let domain = domain_list[i];
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

// show the sign-in dialog
function show_sign_in() {
    jQuery(".sign-in-title").html("sign-in to \"" +
        esc_html(callback.get_selected_domain().domain) + ", " +
        esc_html(callback.get_selected_domain().domain_type) + "\"");
    jQuery(".search-sign-in").show();
    focus_text(".user-name");
}

// change the selected domain
function do_change_domain() {
    callback.change_domain(jQuery(".dd-sign-in").val());
}

// change the selected domain
function do_change_page_size() {
    callback.change_page_size(jQuery(".dd-page-size").val());
}

function do_change_sort() {
    callback.change_sort(parseInt(jQuery(".dd-sort").val()));
    do_search();
}

// close the sign-in dialog
function close_sign_in() {
    jQuery(".search-sign-in").hide();
    jQuery(".password").val("");
}

// perform sign-in authentication
function do_sign_in() {
    let selected_domain = callback.get_selected_domain();
    if (selected_domain) {
        callback.do_sign_in(selected_domain.sourceId, jQuery(".user-name").val(), jQuery(".password").val());
    }
}

// perform a sign-out
function do_sign_out() {
    callback.do_sign_out();
}

// SimSage updates the sign-in status (close), are we signed in or not?
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

// clear the search text input and filters
function clear_search() {
    jQuery(".search-text").val("");
    // clear filters
    clear_all();
    callback.clear_all_results();
    close_bot();
    hide_search_results();
    close_no_results();
    update_ui();
    do_search();
}

// user selects a syn-set to use
function select_syn_set(word, index) {
    callback.select_syn_set(word, index);
}

// return the values of the advanced filter box
function get_advanced_filter() {
    return {
        "document_type": jQuery('label.document-type-sel select').val().split(','),
        "kb": jQuery('label.knowledge-base-sel select').val(),
        "title": [jQuery('.title-text').val()],
        "url": [jQuery('.url-text').val()],
        "author": [jQuery('.author-text').val()],
        "syn-sets": callback.get_selected_syn_sets(),
    };
}

// start a SimSage search
function do_search() {
    const af = get_advanced_filter(); // get advanced search options
    callback.do_search(jQuery(".search-text").val().trim(), af);
}

// test enter and/or typing on the search box
function search_typing(event) {
    if (event.keyCode === 13) {
        do_search();
    }
}

// check the chat window text box for a cr
function chat_typing(event, text) {
    let ct = jQuery(".chat-text");
    let button = jQuery(".chat-button-control");
    if (ct.val().trim().length === 0) {
        button.removeClass("chat-button");
        button.addClass("chat-button-disabled");
    } else {
        if (event.keyCode === 13) {
            button.removeClass("chat-button");
            button.addClass("chat-button-disabled");
            do_chat();
        } else {
            button.removeClass("chat-button-disabled");
            button.addClass("chat-button");
            callback.user_is_typing();
        }
    }
}

// validate an email address and change the button accordingly
function validate_email() {
    const text = jQuery("label.email-address-text input").val();
    const button = jQuery(".email-send-button");
    if (callback.is_valid_email(text)) {
        button.removeClass("send-button-disabled");
        button.addClass("send-button");
    } else {
        button.removeClass("send-button");
        button.addClass("send-button-disabled");
    }
}

// test enter on email box
function email_typing(event) {
    if (event.keyCode === 13) {
        do_email();
    }
}

// send a user's chat message to SimSage
function do_chat() {
    let ct = jQuery(".chat-text");
    callback.do_chat(ct.val());
    ct.val("");
}

// for click events, stop propagating
function nop() {
    if (event) event.stopPropagation()
}

// show details view
function show_details(url) {
    close_filter();
    jQuery(".detail-table").html(callback.render_details_view(url));
    jQuery(".search-details-view").show();
}

// open a url in a new window
function visit_url(url) {
    window.open(url, '_blank');
}

// close the details view of a particular result
function close_details() {
    jQuery(".search-details-view").hide();
}

// go to the next page
function next_page() {
    callback.view_next_page();
}

// go to a previous page
function prev_page() {
    callback.view_prev_page();
}

// select an arbitrary page
function select_page(page) {
    callback.view_page(page);
}

function show_search_results() {
    jQuery(".search-display").show();
    close_no_results();
}

function show_pagination() {
    jQuery(".pagination-box").show();
    setup_pagination();
}

function hide_search_results() {
    if (!callback.get_is_db()) {
        jQuery(".search-display").hide();
    } else {
        // just empty the search results if this is a db display
        jQuery(".search-results-text").html("");
    }
}

// navigate to the previous fragment of text
function prev_fragment(id) {
    const result = callback.get_result_by_id(id);
    if (result != null) {
        if (result.textIndex > 0) {
            result.textIndex -= 1;
            jQuery(".search-results-td").html(callback.render_search_results());
        }
    }
}

// navigate to the next fragment of text of a result
function next_fragment(id) {
    const result = callback.get_result_by_id(id);
    if (result != null) {
        if (result.textIndex + 1 < result.textList.length) {
            result.textIndex += 1;
            jQuery(".search-results-td").html(callback.render_search_results());
        }
    }
}

// display the pagination html
function setup_pagination() {
    jQuery(".pagination-box").html(callback.render_pagination());
}

// change the type of view to 'text'
function select_text_view() {
    // manage the icons
    jQuery(".search-results-text").show();
    jQuery(".search-results-images").hide();
    jQuery(".text-view").removeAttr("disabled");
    jQuery(".image-view").attr("disabled", "true");
    // and render away
    callback.set_selected_view("text");
    jQuery(".search-results-td").html(callback.render_search_results());
    setup_pagination();
}

// change the type of view to 'image'
function select_image_view() {
    jQuery(".search-results-text").hide();
    jQuery(".search-results-images").show();
    jQuery(".image-view").removeAttr("disabled");
    jQuery(".text-view").attr("disabled", "true");
    // and render away
    callback.set_selected_view("image");
    jQuery(".search-results-td").html(callback.render_search_results());
    setup_pagination();
}

// a user decides to change their kb
function do_change_kb() {
    callback.on_change_kb(jQuery(".dd-knowledge-base").val());
}

// user changes selected source
function do_change_source() {
    callback.on_change_source(jQuery(".dd-source").val());
    setup_categories();
}

// add a search term (or remove) to the search text from the semantics / categories box
function add_text_to_search(term) {
    const ctrl = jQuery(".search-text");
    let text = " " + ctrl.val() + " ";
    if (text.indexOf(" " + term + " ") >= 0) {
        text = text.replace(" " + term + " ", " ");
    } else {
        text = text + " " + term;
    }
    ctrl.val(text.trim());
    focus_text('.search-text');
    do_search();
}

// try and send an email
function do_email() {
    const text = jQuery("label.email-address-text input").val();
    if (callback.is_valid_email(text)) {
        callback.do_email(text);
    }
}

// hide the ask for email message
function hide_email() {
    show_no_results();
}

// close the no results window
function close_no_results() {
    jQuery(".no-search-results").hide();
}

// show the no results found dialog
function show_no_results() {
    hide_search_results();
    jQuery(".not-found-words").html(callback.get_search_query());
    if (callback.know_users_email()) {
        jQuery(".ask-email-box").hide();
        jQuery(".ask-emailed-box").show();
    } else {
        jQuery(".ask-email-box").show();
        jQuery(".ask-emailed-box").hide();
    }
    if (!search.is_db_source) {
        jQuery(".no-search-results").show();
    }
}

// show the authoritative bot balloon
function show_bot() {
    close_no_results();
    jQuery(".bot-box").show();
}

// close the bot authoritative answer window
function close_bot() {
    jQuery(".bot-box").hide();
}

// setup the source categories if they exist
function setup_categories() {
    jQuery(".category-items-td").html(callback.render_categories());
}

// select a single level item
function source_category1_select(display_name, category_name, category_type) {
    callback.source_category1_select(display_name, category_name, category_type);
    setup_categories();
    do_search();
}

// set the filter for a UI source category
function set_one_level_filter(display_name, category_type, item_class) {
    let filter_text = $("." + item_class).val();
    callback.set_one_level_filter(display_name, category_type, filter_text);
    setup_categories();
    focus_text("." + item_class);
}

// select a source category item for a two level tree
function source_category2_select(display_name, category_name, category_type) {
    callback.source_category2_select(display_name, category_name, category_type);
    setup_categories();
    do_search();
}

// select a level 2 item from a source for a two level tree
function source_category2_l2_select(display_name, category_name, category_type) {
    callback.source_category2_l2_select(display_name, category_name, category_type);
    setup_categories();
    do_search();
}

// set a rating level
function select_rating(display_name, rating) {
    callback.select_rating(display_name, rating);
    setup_categories();
    do_search();
}

// change star numbers to actual renderings of stars, images, and pricing
function update_database_gui() {
    $("div.db-record-rating").each(function() {
        // Get the value
        let val = parseFloat($(this).html());
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
        $(this).html(starStr);
    });
    $("div.db-record-price").each(function() {
        let val = parseFloat($(this).html().trim());
        if (val === Math.floor(val)) {
            val = val * 0.01;
        }
        // Replace the numerical value with stars
        $(this).html(search.currency_symbol + val.toFixed(2));
    });
    $("div.db-image").each(function() {
        let val = $(this).html().trim();
        let url = callback.get_image_url_by_doc_url(val);
        $(this).html("<img src='" + url + "' class='db-image-size' alt='image'/>");
    });
    // fill in span hl1 and hl2
    $(".search-results-text").each(function() {
        let val = $(this).html().trim();
        val = val.replace(/{hl1:}/g, "<span class='hl1'>");
        val = val.replace(/{:hl1}/g, "</span>");
        val = val.replace(/{hl2:}/g, "<span class='hl2'>");
        val = val.replace(/{:hl2}/g, "</span>");
        $(this).html(val);
    });
}

// display the values of the slider
function display_slider_values(slider) {
    if (slider) {
        let left = parseInt(slider.min_value);
        let right = parseInt(slider.max_value);
        if (slider.monetary) {
            left = slider.currency + (parseInt(left) * 0.01).toFixed(2);
            right = slider.currency + (parseInt(right) * 0.01).toFixed(2);
        }
        $("." + slider.metadata + "-value").html(left + " - " + right);
    }
}

// SimSage wishes to update the entire UI, re-draw it
function update_ui() {
    setup_pagination();
    if (callback.has_search_results()) {
        show_search_results();
        jQuery(".search-results-td").html(callback.render_search_results());
        update_database_gui(); // set stars, images, and pricing from classes
    } else {
        hide_search_results();
    }
    if (callback.has_bot_results()) {
        show_bot();
        jQuery(".bot-box").html(callback.render_bot());
    } else {
        close_bot();
    }
    if (callback.has_spelling_suggestion()) {
        show_spelling_suggestion();
        jQuery(".spelling-box").html(callback.render_spelling_suggestion());
    } else {
        close_spelling_suggestion();
    }
    setup_categories();

    // init any sliders
    let slider_list = callback.get_sliders();
    for (let i in slider_list) {
        let slider = slider_list[i];
        if (slider.metadata) {
            let min = slider.min;
            let max = slider.max;
            let step = 1;
            if (slider.monetary) {
                min = Math.floor(slider.min * 0.01) * 100;
                max = Math.ceil(slider.max * 0.01) * 100;
                step = 10;
            }
            $("." + slider.metadata).slider({
                range: true,
                min: min,
                max: max,
                step: step,
                values: [slider.min_value, slider.max_value],
                slide: function(event, ui) {
                    slider.min_value = ui.values[0];
                    slider.max_value = ui.values[1];
                    display_slider_values(slider);
                },
                stop: function(event, ui) {
                    callback.set_slider(slider.metadata, ui.values[0], ui.values[1]);
                }
            });
            display_slider_values(slider);
        }
    }
}

// show a spelling suggestion / alternative
function show_spelling_suggestion() {
    jQuery(".spelling-box").show();
}

// close the spelling suggestion box
function close_spelling_suggestion() {
    jQuery(".spelling-box").hide();
}

// new search
function use_spelling_suggestion() {
    close_spelling_suggestion();
    callback.use_spelling_suggestion();
    jQuery(".search-text").val(callback.get_search_text());
    do_search();
}

// SimSage sets up the drop-down boxes for the advanced filter interface
function setup_dropdowns() {
    jQuery(".dd-knowledge-base").html(callback.render_kbs());
    jQuery(".dd-source").html(callback.render_sources());
}

// monitor the ESC key to close dialog boxes
jQuery(document).on('keydown', function(event) {
    if (event.key === "Escape" || event.key === "Esc") {
        const err_ctrl = jQuery(".error-dialog-box");
        if (err_ctrl.is(":visible")) {
            err_ctrl.hide();
        } else {
            close_chat();
            close_filter();
            close_details();
            close_sign_in();
            close_no_results();
        }
    }
});

function toggle_filters() {
    callback.toggle_filters();
    setup_categories();
}

function clear_filters() {
    callback.clear_filters();
    do_search();
}

// on ready add a mouse coord event listener
jQuery(document).ready(function () {
    this.addEventListener('mousemove', function(event) {
        mx = event.x;
        my = event.y;
    });
    // init empty
    setup_dropdowns();
    // set up the initial ui
    update_ui();

    // initialize SimSage
    search.init_simsage();

    // set a search-text placeholder if set
    if (settings && settings.search_placeholder && settings.search_placeholder.length > 0) {
        jQuery(".search-text").attr("placeholder", settings.search_placeholder);
    }
    // show the filter menu?
    if (settings && settings.show_advanced_filter) {
        jQuery(".search-options-button").show();
    } else {
        jQuery(".search-options-button").hide();
    }

});

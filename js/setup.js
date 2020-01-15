const search_ctrl = $("#txtSearch");
const no_results = $("#no-results");
const dd_kb = $("#ddKnowledgeBase");
const dd_source = $("#ddSource");
const btn_search = $("#btnSearch");
const results = $("#results");
const bot_display = $("#divBotBubble");
const bot_text = $("#divSpeechBubble");
const bot_url = $("#botUrl");
const details = $("#divDetails");
const advanced_search = $("#advancedSearch");
const poweredBy = $("#poweredBy");
const advanced_search_button = $("#advancedSearchButton");
const img_lines = $("#imgLines");
const img_pictures = $("#imgPictures");
const error_dialog = $("#dlgError");
const error_text = $("#txtError");
const btn_sign_in = $("#btnSignIn");
const txt_email = $("#txtEmail");
const sign_in_section = $("#imgSignIn");

// focus on the search field
search_ctrl.focus();

// escape do a few things
document.addEventListener('keydown', checkEscape);

// sign in visible?
if (ui_settings.show_sign_in) {
    sign_in_section.show();
}

// advanced search visible?
if (ui_settings.show_advanced_filter) {
    advanced_search_button.show();
}

// floating dialog for the bot?
if (ui_settings.bot_floating_dialog) {
    bot_display.removeClass("bubble-speech-container");
    bot_display.addClass("bubble-speech-container-floating");
}

function update_ui(search) {
    const busy = search.busy;
    if (search.error.length > 0) {
        error_text.html(search.error);
        error_dialog.show();
    } else {
        error_dialog.hide();
        if (!busy) {
            const html = search.get_semantic_search_html();
            results.html(html);
        }
    }

    if (!search.is_connected || busy) {
        search_ctrl.attr('disabled', 'true');
        btn_search.attr('disabled', 'true');
    } else {
        if (search_ctrl.attr('disabled')) {
            search_ctrl.removeAttr('disabled');
            btn_search.removeAttr('disabled');
            search_ctrl.focus();
        }
    }

    if (search.semantic_search_results.length > 0) {
        poweredBy.hide();
    } else {
        poweredBy.show();
    }
    dd_kb.html(search.kbOptions());
    if (search.kb && search.kb.id) {
        dd_kb.val(search.kb.id);
    }
    dd_source.html(search.sourceOptions());
    if (search.source && search.source.sourceId) {
        dd_source.val(search.source.sourceId);
    }
    if (!busy && search.is_connected) {
        if (search.show_details) {
            details.html(search.details_html);
            details.show();
        } else {
            details.hide();
        }
        if (search.show_advanced_search) {
            advanced_search.show();
        } else {
            advanced_search.hide();
        }
        if (search.has_advanced_selection) {
            advanced_search_button.removeClass("select-style");
            advanced_search_button.addClass("select-style-has-selection");
        } else {
            advanced_search_button.removeClass("select-style-has-selection");
            advanced_search_button.addClass("select-style");
        }
        // highlight selected view - text or images
        if (search.view === 'lines') {
            img_lines.removeClass("view-type");
            img_lines.addClass("view-type-selected");
            img_pictures.addClass("view-type");
            img_pictures.removeClass("view-type-selected");
        } else {
            img_lines.addClass("view-type");
            img_lines.removeClass("view-type-selected");
            img_pictures.addClass("view-type-selected");
            img_pictures.removeClass("view-type");
        }
        if (search.busy || !search.kb) {
            search_ctrl.attr("disabled", "true");
            btn_search.attr("disabled", "true");
        } else {
            if (search_ctrl.attr('disabled') === 'true') {
                search_ctrl.removeAttr("disabled");
                btn_search.removeAttr("disabled");
                search_ctrl.focus();
            }
        }
        if (search.session_id === '') {
            btn_sign_in.attr('src', 'images/signin.svg');
        } else {
            btn_sign_in.attr('src', 'images/signout.svg');
        }
        if (search.show_signin) {
            $(".sign-in-form-popup").show();
            txt_email.focus();
        } else {
            $(".sign-in-form-popup").hide();
        }
        // bot result?
        if (search.bot_text && search.bot_text.length > 0 && search.bubble_visible) {
            bot_display.show();
            bot_text.html(search.bot_text);
            bot_url.html(search.bot_url);
            bot_url.attr("href", search.bot_url);
        } else {
            bot_display.hide();
        }

        // no results at all?
        if (search.bot_text.length === 0 && search.semantic_search_results.length === 0 && search.search_query.length > 0) {
            no_results.show();
        } else {
            no_results.hide();
        }

    }
}

function hide_speech_bubble() {
    search.hide_speech_bubble();
}

// check escape key
function checkEscape(e) {
    if (e.code === 'Escape') {
        if (search.show_details) {
            search.show_details = false;
            details.hide();
        } else if (search.bubble_visible) {
            hide_speech_bubble();
        }
    }
}

const search = new SemanticSearch(update_ui);

// semantic search enter key check
function search_enter(event) {
    if (event.keyCode === 13) {
        search_click();
    }
}

// do a semantic search
function search_click() {
    if (search.kb && search.is_connected) {
        const search_text = search_ctrl.val();
        search.reset_pagination();
        search.do_semantic_search(search_text);
    }
}

function advanced_search_click() {
    if (search.kb) {
        search.toggle_advanced_search();
    }
}

function advanced_search_clear_click() {
    $("#txtTypeFilter").val("");
    $("#txtTitle").val("");
    $("#txtUrl").val("");
    $("#txtAuthor").val("");
    dd_source.val("");
    change_advanced_search();
}

function change_advanced_search() {
    search.fileType = [];
    search.kb = null;
    search.source = null;
    search.url = [];
    search.title = [];
    search.author = [];
    search.has_advanced_selection = false;

    const titleFilter = $("#txtTitle").val();
    const urlFilter = $("#txtUrl").val();
    const authorFilter = $("#txtAuthor").val();
    const typeFilter = $("#txtTypeFilter").val();

    const kb_id = dd_kb.val();
    if (kb_id && kb_id !== '') {
        search.set_kb(kb_id);
    }

    const source_id = dd_source.val();
    if (source_id) {
        search.set_source(source_id);
    }

    if (typeFilter.length > 0 || urlFilter.length > 0 || authorFilter.length > 0 || titleFilter.length > 0) {
        search.has_advanced_selection = true;
        $(".advanced-search-tick").css("display", "inline-block");
        if (typeFilter.length > 0)
            search.fileType = typeFilter.split(",");
        if (urlFilter.length > 0)
            search.url = urlFilter.split(",");
        if (titleFilter.length > 0)
            search.title = titleFilter.split(",");
        if (authorFilter.length > 0)
            search.author = authorFilter.split(",");
    } else {
        $(".advanced-search-tick").css("display", "none");
    }
}

// load initial document settings from server
$( document ).ready(function() {
    search.ws_connect(); // connect to SimSage
});

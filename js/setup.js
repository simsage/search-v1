const search_ctrl = $("#txtSearch");
const dd_kb = $("#ddKnowledgeBase");
const dd_source = $("#ddSource");
const btn_search = $("#btnSearch");
const results = $("#results");
const bot_results = $("#botResults");
const bot_chat = $("#chat");
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
const bot_max_min = $("#btnBotMaxMin");

search_ctrl.focus();

// sign in visible?
if (ui_settings.show_sign_in) {
    sign_in_section.show();
}

// advanced search visible?
if (ui_settings.show_advanced_filter) {
    advanced_search_button.show();
}

function update_bot_ui(bot) {
    if (bot && bot.search.error.length === 0) {
        if (ui_settings.bot_enabled && bot.has_simsage_answer()) {
            bot_results.show();

            const html = bot.bot_message_list_to_html();

            if (this.window_maximized) {
                if (bot_chat.hasClass("bot-chats-minimized")) {
                    bot_chat.html(html);
                    bot_chat.removeClass("bot-chats-minimized");
                    bot_chat.addClass("bot-chats");
                    bot_max_min.attr("title", "minimize this bot window");
                }
            } else {
                if (bot_chat.hasClass("bot-chats")) {
                    bot_chat.removeClass("bot-chats");
                    bot_chat.addClass("bot-chats-minimized");
                    bot_max_min.attr("title", "maximize this bot window");

                    // carefully timed with css effects (~ 60% less in time)
                    setTimeout(() => {
                        bot_chat.html("");
                    }, 300);
                }
            }

            if (this.window_maximized) {
                bot_chat.html(html);
            }

            // scroll to the bottom
            setTimeout(() => {
                let element = document.getElementById('chat');
                if (element) {
                    element.scrollTop = element.scrollHeight;
                }
            }, 100);
        }
    }
}

function update_ui(search) {
    if (search.error.length > 0) {
        error_text.html(search.error);
        error_dialog.show();
    } else {
        error_dialog.hide();
        const html = search.get_semantic_search_html();
        results.html(html);
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
    if (search.source && search.source.id) {
        dd_source.val(search.source.id);
    }
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
        search_ctrl.removeAttr("disabled");
        btn_search.removeAttr("disabled");
        search_ctrl.focus();
    }
    if (search.session_id === '') {
        btn_sign_in.attr('src', 'images/signin.svg');
    } else {
        btn_sign_in.attr('src', 'images/signout.svg');
    }
    if (search.show_signin) {
        $(".form-popup").show();
        txt_email.focus();
    } else {
        $(".form-popup").hide();
    }
}

const search = new SemanticSearch(settings, update_ui, search_ctrl);

// do we need a semantic bot?
let bot = null;
if (ui_settings.bot_enabled) {
    bot = new Bot(settings, search, update_bot_ui);
    bot.ws_connect(); // connect to server
}

// semantic search enter key check
function search_enter(event) {
    if (event.keyCode === 13) {
        search_click();
    }
}

// do a semantic search
function search_click() {
    if (search.kb) {
        const search_text = search_ctrl.val();
        search.reset_pagination();
        search.do_semantic_search(search_text);
        if (ui_settings.bot_enabled) {
            bot.do_ask_bot(search_text);
        }
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
    if (source_id && source_id !== '') {
        search.set_source(source_id);
    }

    console.log("change_advanced_search: 2");

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
    search.getSemanticSearchInfo();
});

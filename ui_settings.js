
// the search-settings for this application
ui_settings = {

    // number of results per page
    page_size: 6,
    // number of fragments per result max
    fragment_count : 5,
    // distance between hits before merging into one sentence
    max_word_distance: 20,
    // score cut-off
    score_threshold: 0.0,

    // ask bot too?
    bot_enabled: true,
    // floating container or in between search results
    bot_floating_dialog: false,
    // what a no result reply looks like
    system_no_results_reply: "Thanks for your question; we'll get back to you shortly.",
    // speak?
    bot_voice_enabled: false,
    // and how sensitive the bot response should be
    bot_threshold: 0.8125,

    // ask users for their email if nothing found?
    ask_email: true,
    // if we don't have their email, how should we ask for it?
    email_message: "<b>No results found</b><br/><br/>Would you mind giving me your email address so we can follow up with more information?",
    // if we don't have their email, how should we ask for it?
    have_email_message: "<b>No results found</b><br/><br/>Thanks for contacting us, we will get back to you shortly.",
    // not asking for an email address?
    no_email_message: "<b>No results found</b>",

    // show the advanced filter?
    show_advanced_filter: true,
};

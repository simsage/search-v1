
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
    // ask users for their email if nothing found?
    bot_ask_email: false,
    // if we don't have their email, how should we ask for it?
    bot_email_message: "Would you mind giving me your email address so we can follow up with more information?",
    // what a no result reply looks like
    system_no_results_reply: "Thanks for your question; we'll get back to you shortly.",
    // speak?
    bot_voice_enabled: false,
    // and how sensitive the bot response should be
    bot_threshold: 0.775,

    // enable people to login to SimSage?
    show_sign_in: false,
    // show the advanced filter?
    show_advanced_filter: true,

};

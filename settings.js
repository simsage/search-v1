
// the settings for this application - no trailing / on the base_url please
settings = {
    // the service layer end-point, change "localhost:8080" to ...
    base_url: 'https://<server>/api',
    // api version of ws_base
    api_version: 1,
    // web sockets platform endpoint for comms
    ws_base: 'https://<server>/ws-api',
    // the organisation's id to search
    organisationId: "<organisation>",

    // search settings
    page_size: 6,
    fragment_count: 3,
    max_word_distance: 20,
    use_spelling_suggest: false,
    context_label: '',
    context_match_boost: 0.02,
    // bot sensitivity - controls the A.I's replies - we suggest you don't change it!
    bot_threshold: 0.8125,
    // show the advanced filters?
    show_advanced_filter: true,
    // image types for link name display
    image_types: [".jpg", ".jpeg", ".png", ".gif", ".svg"],
    // placeholder for search
    search_placeholder: "",
};

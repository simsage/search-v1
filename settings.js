
// the settings for this application - no trailing / on the base_url please
let settings = {
    // the service layer end-point, change "<server>" to ... (no / at end)
    base_url: "https://<server>",
    // api version of ws_base
    api_version: 1,
    // the organisation's id to search, change "<organisation>" to...
    organisationId: "<organisation>",

    // search settings
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

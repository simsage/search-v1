
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

    // number of results per page
    page_size: 6,
    // number of fragments per result max
    fragment_count : 5,
    // distance between hits before merging into one sentence
    max_word_distance: 20,

    // if we don't have an operator available, tell the user thusly
    operator_message: "Sorry, there are currently no free operators for you to talk to.",
    // and how sensitive the bot response should be
    bot_threshold: 0.8125,

    // correct typos?
    use_spelling_suggest: false,
    // image types for link name display
    image_types: [".jpg", ".jpeg", ".png", ".gif", ".svg"],

    // context default (empty is not set / ignored)
    context_label: '',
    // how much to boost a context match by in percentage points
    context_match_boost: 0.02,
};

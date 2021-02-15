
# using SimSage search

## uglify (minify) js

installation: `npm install uglify-js -g`

usage: `uglifyjs --compress --mangle -- js/simsage-search.js > js/simsage-search.min.js`

## include SimSage styles and javascript in your own html

You can download all the files referenced below from this repository.

NB. you will need to copy all files in `js`, `css`, and `template` to your own site for this to work.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>SimSage Search Example Page</title>

    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- load jQuery and jQuery ui min required by SimSage (tested up to jQuery 3.4.1) [required] -->
    <script src="js/jquery-3.4.1.min.js"></script>
    <script src="js/jquery-ui.min.js"></script>
    <!-- if you're using our operator, you must include these two javascript files.  If not, you can leave these two files out -->
    <script src="js/sockjs.js"></script>
    <script src="js/stomp.js"></script>

    <!-- load the required jQuery-ui style-sheet [required] -->
    <link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css" />

    <!-- load SimSage style sheet [required] -->
    <link rel="stylesheet" type="text/css" href="css/simsage-search.css" />
    <!-- load SimSage javascript code [required] -->
    <script src="js/simsage-search.js"></script>

    <!-- load an example favorite icon for your page -->
    <link rel="icon" type="image/png" href="favicon.png" />

</head>
<body>

<!-- the SimSage search control holder, this is where the control goes after a successful init() -->
<div id="simsage-search-control">
</div>

<script lang="js">
    // create the SimSage, IE 11 compatible, class: do not change these variable names!
    simsage = simsage.instantiate();
    // init SimSage, after the document has loaded and load it into our example div "simsage-search-control"
    jQuery(document).ready(function () {
        simsage.init("#simsage-search-control", {
            // the SimSage api server - set to eg. https://cloud.simsage.ai   (no trailing /)
            base_url: 'https://cloud.simsage.ai',
            // your SimSage organisation id (a guid, eg. c276f883-e0c8-43ae-9119-df8b7df9c574)
            // you get this value after registering a SimSage account, this is your user id in our WordPress plugin
            organisation_id: 'c276f883-e0c8-43ae-9119-df8b7df9c574'
        });
    })
</script>

</body>

</html>
```

## other values that can be set with `simsage.init(control-id, { ...values });`

| variable | meaning | default value |
| --- | --- | --- |
| base_url | the SimSage remote search server you have an account with.  This will be an HTTPS:// connection and the server's URL starts with `cloud` | https://cloud.simsage.ai |
| organisation_id | all SimSage accounts have an organisation-id.  This value is a guid you get assigned when you register your account and uniquely represents search access to your data. | c276f883-e0c8-43ae-9119-df8b7df9c574 |
| operator_enabled | A boolean flag specifying `true` or `false` to tell SimSage to connect to the operator javascript-socket interfaces.  This will only work if your plan supports operators. | true |
| category_size | The number of items to display in the UI category displays per category. | 5 |
| page_size | The number of search results to return for a semantic-search | 5 |
| page_size_custom | The number of search results to return for a e-commerce searches | 10 |
| currency_symbol | The currency symbol to prefix monetary amounts with in e-commerce searches | $ |
| fragment_count | the number of sub-semantic search results to display for each search result | 3 |
| max_word_distance | If greater than zero, the maximum allowed distance of individual keywords in sentences for `hits` | 20 |
| use_spelling_suggest | A boolean flag specifying use of the SimSage spelling correction system | false |
| context_label | Obsolete, a forced context label for this search control's initial context value | (empty string) |
| context_match_boost | Obsolete, a score boost value to apply when context labels match on top of semantic-search scores | 0.02 |
| bot_threshold | SimSage's Q&A sensitivity, a value between 0.0 and 1.0.  If you set this number too low, you'll get nonsense responses, if you set it too high, you'll only get exact results.  | 0.8125 |
| show_advanced_filter | A boolean value specifying whether the UI should display the `Search options` drop down menu located left of the search-bar | true |
| search_placeholder | A `placeholder` HTML value for the SimSage search control. | (empty string) |
| is_wordpress | is this to be used in WordPress?  WordPress has a different render method. | false |
## test with a local http server (optional)
```
npm install http-server -g
http-server -p 4200 --cors --hot --host 0.0.0.0 --disableHostCheck true
```

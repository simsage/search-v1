
# using SimSage search

## include SimSage styles and javascript in your own html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Demo Page</title>

    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- load jQuery and jQuery ui min required by SimSage -->
    <script src="js/jquery-3.4.1.min.js"></script>
    <script src="js/jquery-ui.min.js"></script>

    <!-- load the required jQuery ui style-sheet -->
    <link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css" />

    <!-- load SimSage style sheet -->
    <link rel="stylesheet" type="text/css" href="css/simsage-search.css" />
    <!-- load SimSage javascript code -->
    <script src="js/simsage-search.js"></script>

    <!-- load an example favorite icon for your page -->
    <link rel="icon" type="image/png" href="favicon.png?v=1.0" />

</head>
<body>

<!-- the SimSage search control holder -->
<div id="simsage-search-control">
</div>

<script lang="js">
    // create the SimSage, IE 11 compatible, class: do not change these variable names!
    simsage = simsage.instantiate();
    // init SimSage, after the document has loaded and load it into our example div "simsage-search-control" 
    jQuery(document).ready(function () {
        simsage.init("#simsage-search-control", {
            // the SimSage api server - set to eg. https://cloud.simsage.ai   (no trailing /)
            base_url: 'http://localhost:8080',
            // the SimSage resources location - set to eg.  https://
            code_url: 'http://localhost:4201',
            // your SimSage organisation id (a guid, eg. d276f883-e1c8-43ee-9129-df8c7df9c575)
            // you get this value after registering a SimSage account, this is your user id
            organisation_id: 'c276f883-e0c8-43ae-9119-df8b7df9c574'
        });
    })
</script>

</body>

</html>
```

## test with a local http server (optional)
```
npm install http-server -g
http-server -p 4200 --cors --hot --host 0.0.0.0 --disableHostCheck true
```

// a set of custom controls used by SimSage to render metadata

// category type constants
let cat_type_plain = "category";
let cat_type_csv = "csv string";
let cat_type_two_level = "two level category";
let cat_type_star_rating = "star rating";
let num_type_money = "monetary x 100 range";
let num_type_range = "number range";
let num_type_if_true = "select if true";

// labels for no / yes in yes_no selectors
let yes_no_no = "no";
let yes_no_yes = "yes";

// triangle expanded and not-expanded
let triangle_open = "&#x25BC;"
let triangle_close = "&#x25BA;"

// global list of all the control instances
let simsage_control_list = [];
// for sorting
let simsage_sort_list = [];
// visibility of the controls (> Filters)
let controls_visible = true;

// execute "clear" on all the controls if they support it
function clear_controls() {
    for (let i in simsage_control_list) {
        let c = simsage_control_list[i];
        if (c.clear) c.clear();
    }
    if (search && search.do_search) search.do_search();
}

                                // is this a key CR or Space-bar event that should activate something?
function activation(event) {
    return (event && (event.keyCode === 13 || event.keyCode === 32));
}

// execute "get_metadata" on all the controls if they support it
function get_metadata() {
    let data = {};
    for (let i in simsage_control_list) {
        let c = simsage_control_list[i];
        if (c.get_metadata) c.get_metadata(data);
    }
    for (let i in simsage_sort_list) {
        let item = simsage_sort_list[i];
        if (item.selected && item.metadata && item.sort) {
            data["sort"] = [item.metadata, item.sort];
            break;
        }
    }
    return data;
}

// set the semantic-display categories dynamically
function set_display_categories(semantic_set) {
    for (let i in simsage_control_list) {
        let c = simsage_control_list[i];
        if (c.set_semantic_set) c.set_semantic_set(semantic_set);
    }
}

// set the syn-sets dynamically
function set_syn_sets(syn_sets) {
    for (let i in simsage_control_list) {
        let c = simsage_control_list[i];
        if (c.set_syn_sets) c.set_syn_sets(syn_sets);
    }
}

// show/hide filer controls
function toggle_filters() {
    controls_visible = !controls_visible;
    jQuery(".category-items-dropdown-header").html((controls_visible ? triangle_open : triangle_close) + " Filters");
    if (controls_visible)
        jQuery(".category-control-container").show();
    else
        jQuery(".category-control-container").hide();
}

// setup and render a list of controls according to their data
// only call this once on startup / document-ready
function setup_controls(control_data_list) {
    // setup render containers - the holders of each control by metadata-name
    let container_str = "<div class='no-select'>";
    container_str += "<span class=\"category-items-dropdown-header\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"toggle_filters()\" title='show or hide the filters'>" + (controls_visible ? triangle_open : triangle_close) + " Filters</span>";
    container_str += "<span class=\"category-clear-filters\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"clear_controls()\" title=\"reset all items below to their default values\">&#x1f5d8; Clear filters</span>";
    container_str += "</div>";

    container_str += "<div class='category-control-container no-select'>"
    // add syn-set container
    container_str += "<div class='syn-sets'></div>"
    // add controls according to their data requirements
    for (let i in control_data_list) {
        let c = control_data_list[i];
        if (c && c.metadata) {
            let ctrl_name = "c-" + c.metadata;
            container_str += "<div class='" + ctrl_name + "'></div>"
        }
    }
    // add semantic display category container
    container_str += "<div class='semantic-display-categories'></div>"
    container_str += "</div>"
    // this is the super parent of each control 'category-items-td'
    $(".category-items-td").html(container_str);
    // add the semantic set control
    simsage_control_list.push(syn_set_control.instantiate());
    // create the control data structures and instances that draw everything and keep state
    // these should all have unique metadata names
    for (let i in control_data_list) {
        let c = control_data_list[i];
        if (c && c.metadata) {
            if (c.key === cat_type_plain || c.key === cat_type_csv)
                simsage_control_list.push(one_level_control.instantiate(c));
            if (c.key === cat_type_two_level)
                simsage_control_list.push(two_level_control.instantiate(c));
            if (c.key === cat_type_star_rating)
                simsage_control_list.push(star_rating_control.instantiate(c));
            if (c.key === num_type_if_true)
                simsage_control_list.push(yes_no_control.instantiate(c));
            if (c.key === num_type_range || c.key === num_type_money)
                simsage_control_list.push(slider_control.instantiate(c));
        }
    }
    // add the semantic set control
    simsage_control_list.push(display_categories_control.instantiate());
    // setup sorting if applicable
    for (let j in control_data_list) {
        if (control_data_list.hasOwnProperty(j)) {
            let md = control_data_list[j];
            if (md.sort && md.sortDescText) {
                simsage_sort_list.push({"name": md.sortDescText, "metadata": md.metadata, "sort": "desc", "selected": md.sortDefault === "desc"});
            }
            if (md.sort && md.sortAscText) {
                simsage_sort_list.push({"name": md.sortAscText, "metadata": md.metadata, "sort": "asc", "selected": md.sortDefault === "asc"});
            }
        }
    } // for each category

    // check the sort has at least one item selected - if not - selected the first one we come across
    if (simsage_sort_list.length > 0) {
        let selected = -1;
        for (let j in simsage_sort_list) {
            if (simsage_sort_list[j].selected) {
                selected = j;
            }
        }
        if (selected === -1) {
            simsage_sort_list[0].selected = true;
        }
    }

    // render each control for the first time - they'll take care of their own rendering after that
    for (let i in simsage_control_list) {
        let c = simsage_control_list[i];
        c.render();
    }
    // any controls that support/need setup: get that done now
    for (let i in simsage_control_list) {
        let c = simsage_control_list[i];
        if (c.setup_control) c.setup_control();
    }
}
// set of support functions used by each control - and copied into each control by setup
let common_functions = {
    // strings that are too big are clipped
    adjust_size: function(str) {
        if (str.length > 20) {
            return str.substr(0,20) + "...";
        }
        return str;
    },
    // replace < and > to make a string html safe
    esc_html: function(str) {
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
    },
    ie11_polyfill: function() {
        if (!String.prototype.padStart) {
            String.prototype.padStart = function padStart(targetLength, padString) {
                targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
                padString = String((typeof padString !== 'undefined' ? padString : ' '));
                if (this.length > targetLength) {
                    return String(this);
                }
                else {
                    targetLength = targetLength-this.length;
                    if (targetLength > padString.length) {
                        padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
                    }
                    return padString.slice(0,targetLength) + String(this);
                }
            }
        }
    },
    s4: function() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    },
    guid: function() {
        return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + this.s4() + this.s4();
    },
    has_local_storage: function() {
        try {
            let test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch(e) {
            return false;
        }
    },
    get_client_id() {
        let clientId = "";
        let key = 'simsearch_client_id';
        let hasLs = this.has_local_storage();
        if (hasLs) {
            clientId = localStorage.getItem(key);
        }
        if (!clientId || clientId.length === 0) {
            clientId = this.guid(); // create a new client id
            if (hasLs) {
                localStorage.setItem(key, clientId);
            }
        }
        return clientId;
    },
    get_kb() {
        if (search && search.kb) {
            return search.kb;
        }
        return null;
    },
    get_kb_id() {
        let kb = this.get_kb();
        if (kb && kb.id) {
            return kb.id;
        }
        return null;
    },
    // valid an email address
    validate_email: function(email) {
        let i1 = email.indexOf('@');
        if (i1 > 0) {
            let i2 = email.lastIndexOf('.');
            return (i2 > i1) && i2 + 2 < email.length;
        }
        return false;
    },
    // set text focus on an item and make sure the text cursor is at the end of that field
    focus_text: function(ctrl) {
        const c = jQuery(ctrl);
        c.focus();
        const txt = c.val();
        c.val("");
        c.val(txt);
    },
    // for click events, stop propagating
    nop: function() {
        if (event) event.stopPropagation();
    },
    // show an error message
    error: function(err) {
        if (err) {
            jQuery(".error-dialog-box").show();

            let err_str = "";
            if (err && err["readyState"] === 0 && err["status"] === 0) {
                err_str = "Server not responding, not connected.";
            } else if (err && err["responseText"] && err["status"] > 299) {
                err_str = err["responseText"];
            } else {
                err_str = err;
            }
            jQuery(".error-text").html(this.esc_html(err_str));

        } else {
            this.close_error();
        }
    },
    // close the error display
    close_error: function() {
        jQuery(".error-text").val("");
        jQuery(".error-dialog-box").hide();
    },
    size_to_str: function(size) {
        if (size < 1024) {
            return size;
        } else if (size < 1024000) {
            return Math.floor(size / 1000) + "KB";
        } else if (size < 1024000000) {
            return Math.floor(size / 1000000) + "MB";
        } else {
            return Math.floor(size / 1000000000) + "GB";
        }
    },
    pad2: function(item) {
        return ("" + item).padStart(2, '0');
    },
    unix_time_convert: function(timestamp) {
        if (timestamp > 1000) {
            let a = new Date(timestamp);
            let year = a.getFullYear();
            let month = a.getMonth() + 1;
            let date = a.getDate();
            let hour = a.getHours();
            let min = a.getMinutes();
            let sec = a.getSeconds();
            return year + '/' + this.pad2(month) + '/' + this.pad2(date) + ' ' + this.pad2(hour) + ':' + this.pad2(min) + ':' + this.pad2(sec);
        }
        return "";
    },
    // post a message to the operator end-points
    post_message: function(endPoint, data, callback) {
        let url = settings.base_url + endPoint;
        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': settings.api_version,
            },
            'data': JSON.stringify(data),
            'type': 'POST',
            'url': url,
            'dataType': 'json',
            'success': function (data) {
                if (callback) {
                    callback(data);
                }
            }
        }).fail(function (err) {
            console.error(JSON.stringify(err));
            this.error(err);
        });
    },
    // get a message
    get_message: function(endPoint, callback_success, callback_fail) {
        let url = settings.base_url + endPoint;
        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': settings.api_version,
            },
            'type': 'GET',
            'url': url,
            'dataType': 'json',
            'success': function (data) {
                if (callback_success) {
                    callback_success(data);
                }
            }
        }).fail(function (err) {
            if (callback_fail) {
                callback_fail(err);
            } else {
                console.error(JSON.stringify(err));
                this.error(err);
            }
        });
    },
}

// generic execute on a control, given metadata, find the control and exec fn(p1,p2)
// where p1 and p2 are optional parameters to fn()
function exec(fn, metadata, p1, p2) {
    for (let i in simsage_control_list) {
        let c = simsage_control_list[i];
        if (c && c.metadata === metadata) {
            if (c && c[fn]) c[fn](p1, p2);
        }
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// a one level display categories control
//
let one_level_control = {

    displayName: "",
    items: [], // selected: boolean, name: string, count: int, items: []
    filter: "",
    metadata: "",
    category_size: settings.category_size,

    instantiate(cat) {
        let copy = jQuery.extend({}, one_level_control);
        jQuery.extend(copy, common_functions);
        copy.displayName = cat.displayName;
        if (cat.items) {
            copy.items = JSON.parse(JSON.stringify(cat.items));
            for (let i in copy.items) {
                copy.items[i].selected = false;
            }
        } else {
            copy.items = [];
        }
        copy.filter = cat.filter;
        copy.metadata = cat.metadata;
        if (cat.category_size) {
            copy.category_size = cat.category_size;
        }
        return copy;
    },

    // reset this control
    clear() {
        for (let j in this.items) {
            this.items[j].selected = false;
        }
        this.render();
    },

    // add metadata description for this control to data[this.metadata]
    get_metadata: function(data) {
        if (data) {
            let selection = [];
            for (let i1 in this.items) {
                let ci1 = this.items[i1];
                if (ci1 && ci1.selected && ci1.name) {
                    selection.push(ci1.name);
                }
            }
            if (selection.length > 0) {
                data[this.metadata] = ["category"];
                data[this.metadata].push(...selection);
            }
        }
    },

    toggle_category() {
        if (this.category_size <= 0) {
            this.category_size = settings.category_size;
        } else {
            this.category_size = 0;
        }
        this.render();
    },

    set_filter() {
        let item_class = ".t-" + this.metadata;
        this.filter = jQuery(item_class).val();
        this.render();
        exec('focus_text', this.metadata, item_class);
    },

    select_category(category_name) {
        for (let j in this.items) {
            let item1 = this.items[j];
            if (item1.name === category_name) {
                item1.selected = !item1.selected;
            }
        }
        this.render();
        if (search && search.do_search) search.do_search();
    },

    // render a one level category item set
    render() {
        let str = "";
        if (this.displayName && this.items && this.items.length > 0) {
            let dp = this.esc_html(this.displayName);
            let search_text = "Search for " + dp + "...";
            let category_size = this.category_size;
            let triangle = category_size > 0 ? "&#x25BA; " : "&#x25BC ";
            let filter_text = "";
            if (this.filter) {
                filter_text = this.filter;
            }
            let filter_lwr = filter_text.toLowerCase();
            str += "<div class=\"title-box\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('toggle_category','" + this.metadata + "')\">\n" +
                "<div class=\"title\">" + triangle + dp + "</div>\n" +
                "</div>\n" +
                "<div class=\"search-box\">\n" +
                "<label><input type=\"text\" class=\"t-" + this.metadata + "\" placeholder=\"" + search_text + "\" value=\"" +
                filter_text + "\" onkeyup=\"exec('set_filter','" + this.metadata + "');\" /></label>\n" +
                "</div>\n";

            let item_counter = 0;
            let has_more = false;
            let filter_active = filter_text.length > 0;
            // the non selected items, if there is still room
            for (let ci1 in this.items) {
                if (this.items.hasOwnProperty(ci1)) {
                    let item1 = this.items[ci1];
                    if (!filter_active || item1.name.toLowerCase().indexOf(filter_lwr) >= 0 || item1.selected) {
                        if (item1.selected) {
                            str += "<div class=\"item-box\">\n" +
                                "<div class=\"top-level-selected\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_category','" +this.metadata + "', '" + this.esc_html(item1.name) + "')\">" +
                                "<span class=\"single-level-box\" title=\"close category\"><input type=\"checkbox\" class=\"single-level-cb-selected\" /></span>\n" +
                                "<span class=\"category-head-selected\" title=\"" + this.esc_html(item1.name) + "\">" + this.esc_html(item1.name) + "</span>\n" +
                                "<span class=\"number-box\" title=\"" + this.esc_html(item1.count) + "\">" + this.esc_html(item1.count) + "</span>\n" +
                                "</div>\n" +
                                "</div>\n";
                        } else {
                            str += "<div class=\"item-box\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_category','" + this.metadata + "', '" + this.esc_html(item1.name) + "')\">\n" +
                                "<div><span class=\"single-level-box\" title=\"open category\"><input type=\"checkbox\" class=\"single-level-cb\" /></span>\n" +
                                "<span class=\"category-head\" title=\"" + this.esc_html(item1.name) + "\">" + this.esc_html(item1.name) + "</span>\n" +
                                "<span class=\"number-box\" title=\"" + this.esc_html(item1.count) + "\">" + this.esc_html(item1.count) + "</span>\n" +
                                "</div>\n" +
                                "</div>\n";
                        }
                        item_counter += 1;
                    }
                    // enough items displayed
                    if (!filter_active && category_size > 0 && item_counter >= category_size) {
                        has_more = true;
                        break;
                    }
                }
            } // for each no-selected item

            // render ellipsis
            if (has_more) {
                str += "<div class=\"ellipsis-box\" title=\"there are more items, please use the '" + search_text + "' box to find the item you're looking for\"" +
                    " tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('toggle_category','" + this.metadata + "');\">...</div>";
            }

        } // end of if plain
        jQuery(".c-" + this.metadata).html(str);
    }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// a two level display categories control
//
let two_level_control = {

    displayName: "",
    items: [], // selected: boolean, name: string, count: int, items: []
    filter: "",
    metadata: "",
    category_size: settings.category_size,

    instantiate(cat) {
        let copy = jQuery.extend({}, two_level_control);
        jQuery.extend(copy, common_functions);
        copy.displayName = cat.displayName;
        if (cat.items) {
            copy.items = JSON.parse(JSON.stringify(cat.items));
            for (let i in copy.items) {
                let item1 = copy.items[i];
                item1.selected = false;
                if (item1.items) {
                    for (let j in item1.items) {
                        item1.items[j].selected = false;
                    }
                }
            }
        } else {
            copy.items = [];
        }
        copy.filter = cat.filter;
        copy.metadata = cat.metadata;
        if (cat.category_size) {
            copy.category_size = cat.category_size;
        }
        return copy;
    },

    // reset this control
    clear() {
        for (let i in this.items) {
            let item1 = this.items[i];
            item1.selected = false;
            if (item1.items) {
                for (let j in item1.items) {
                    item1.items[j].selected = false;
                }
            }
        }
        this.render();
    },

    // add metadata description for this control to data[this.metadata]
    get_metadata: function(data) {
        if (data) {
            let selection = [];
            for (let i1 in this.items) {
                let ci1 = this.items[i1];
                if (ci1 && ci1.selected) {
                    let has_l2_selection = false;
                    if (ci1.items) {
                        for (let i2 in ci1.items) {
                            let ci2 = ci1.items[i2];
                            if (ci2.selected) {
                                has_l2_selection = true;
                                selection.push(ci1.name + "::" + ci2.name);
                            }
                        }
                    }
                    if (!has_l2_selection) {
                        selection.push(ci1.name);
                    }
                }
            }
            if (selection.length > 0) {
                data[this.metadata] = ["category"];
                data[this.metadata].push(...selection);
            }
        }
    },

    toggle_category() {
        if (this.category_size <= 0) {
            this.category_size = settings.category_size;
        } else {
            this.category_size = 0;
        }
        this.render();
    },

    set_filter() {
        let item_class = ".t-" + this.metadata;
        this.filter = jQuery(item_class).val();
        this.render();
        exec('focus_text', this.metadata, item_class);
    },

    select_category_1(category_name) {
        if (this.items) {
            for (let j in this.items) {
                let item1 = this.items[j];
                if (item1.name === category_name) {
                    item1.selected = !item1.selected;
                } else {
                    item1.selected = false;
                }
                if (!item1.selected && item1.items) {
                    for (let i in item1.items) {
                        item1.items[i].selected = false;
                    }
                }
            }
        }
        this.render();
        if (search && search.do_search) search.do_search();
    },

    select_category_2(category_name) {
        if (this.items) {
            for (let j in this.items) {
                let item1 = this.items[j];
                if (item1.items) {
                    for (let i in item1.items) {
                        let item2 = item1.items[i];
                        if (item2.name === category_name) {
                            item2.selected = !item2.selected;
                        } else {
                            item2.selected = false;
                        }
                    }
                }
            }
        }
        this.render();
        if (search && search.do_search) search.do_search();
    },

    // render a two level category item set
    render() {
        let str = "";
        if (this.displayName && this.items && this.items.length > 0) {
            let dp = this.esc_html(this.displayName);
            let search_text = "Search for " + dp + "...";
            let filter_text = "";
            if (this.filter) {
                filter_text = this.filter;
            }
            let category_size = this.category_size;
            let triangle = category_size > 0 ? "&#x25BA; " : "&#x25BC ";
            let filter_lwr = filter_text.toLowerCase();
            str += "<div class=\"title-box\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('toggle_category','" + this.metadata + "')\">\n" +
                "<div class=\"title\">" + triangle + dp + "</div>\n" +
                "</div>\n" +
                "<div class=\"search-box\">\n" +
                "<label><input type=\"text\" class=\"t-" + this.metadata + "\" placeholder=\"" + search_text + "\" value=\"" +
                filter_text + "\" onkeyup=\"exec('set_filter','" + this.metadata + "');\" /></label>\n" +
                "</div>\n";
            // enough items displayed
            let item_counter = 0;
            let has_more = false;
            let filter_active = filter_text.length > 0;
            for (let ci1 in this.items) {
                let item1 = this.items[ci1];
                // is this item to be selected?
                let filter_selected = false;
                if (filter_active && item1.name.toLowerCase().indexOf(filter_lwr) >= 0) {
                    filter_selected = true;
                } else if (filter_active && item1.items && item1.items.length > 0) {
                    for (let ci2 in item1.items) {
                        if (item1.items.hasOwnProperty(ci2)) {
                            let item2 = item1.items[ci2];
                            if (filter_text.length === 0 || item2.name.toLowerCase().indexOf(filter_lwr) >= 0) {
                                filter_selected = true;
                            }
                        }
                    }
                }
                if (item1.selected) {
                    str += "<div class=\"item-box\">\n" +
                        "<div class=\"top-level-selected\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_category_1','" + this.metadata + "','" + this.esc_html(item1.name) + "')\">" +
                        "<span class=\"level-one-arrow\" title=\"close category\">&#x25BC;</span>\n" +
                        "<span class=\"category-head-selected\" title=\"" + this.esc_html(item1.name) + "\">" + this.esc_html(item1.name) + "</span>\n" +
                        "<span class=\"number-box\" title=\"" + this.esc_html(item1.count) + "\">" + this.esc_html(item1.count) + "</span>\n" +
                        "</div>\n";

                    if (item1.items && item1.items.length > 0) {
                        for (let ci2 in item1.items) {
                            let item2 = item1.items[ci2];
                            let head_style = "category-head";
                            if (item2.selected) {
                                head_style = "category-head-selected";
                            }
                            str += "<div class=\"level-two-ident\" onclick=\"exec('select_category_2','" + this.metadata + "','" + this.esc_html(item2.name) + "')\">" +
                                "<span class=\"level-two-hyphen\">-</span>\n" +
                                "<span class=\"" + head_style + "\" title=\"" + this.esc_html(item2.name) + "\">" + this.esc_html(item2.name) + "</span>\n" +
                                "<span class=\"number-box\" title=\"" + this.esc_html(item2.count) + "\">" + this.esc_html(item2.count) + "</span>\n" +
                                "</div>\n"
                        }
                    }
                    str += "</div>\n";
                } else if (filter_selected || (!filter_active && (category_size <= 0 || item_counter < category_size))) {
                    str += "<div class=\"item-box\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_category_1','" + this.metadata + "','" + this.esc_html(item1.name) + "')\">\n" +
                        "<div><span class=\"not-selected\" title=\"open category\">&#x25BA;</span>\n" +
                        "<span class=\"category-head\" title=\"" + this.esc_html(item1.name) + "\">" + this.esc_html(item1.name) + "</span>\n" +
                        "<span class=\"number-box\" title=\"" + this.esc_html(item1.count) + "\">" + this.esc_html(item1.count) + "</span>\n" +
                        "</div>\n" +
                        "</div>\n";
                } else {
                    has_more = true;
                }

                item_counter += 1;
            }
            // render ellipsis
            if (has_more && !filter_active) {
                str += "<div class=\"ellipsis-box\" title=\"there are more items, please use the '" + search_text + "' box to find the item you're looking for\"" +
                    " tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('toggle_category','" + this.metadata + "');\">...</div>";
            }
        } // end of if two-level
        jQuery(".c-" + this.metadata).html(str);
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// start-ratings control
//
let star_rating_control = {

    displayName: "",
    metadata: "",
    rating: -1, // no rating

    instantiate(cat) {
        let copy = jQuery.extend({}, star_rating_control);
        jQuery.extend(copy, common_functions);
        copy.displayName = cat.displayName;
        copy.metadata = cat.metadata;
        if (cat.rating) {
            copy.rating = cat.rating;
        }
        return copy;
    },

    // reset this control
    clear() {
        this.rating = -1;
        this.render();
    },

    // add metadata description for this control to data[this.metadata]
    get_metadata(data) {
        if (data && this.rating >= 0 && this.rating <= 5) {
            data[this.metadata] = ["rating", "" + this.rating];
        }
    },

    select_rating: function(rating) {
        // not set?
        if (this.rating === undefined) {
            this.rating = rating;
        } else if (this.rating === rating) { // click again?  de-select
            this.rating = -1;
        } else {
            this.rating = rating; // just set
        }
        this.render();
        if (search && search.do_search) search.do_search();
    },

    render: function() {
        let ss = "&#x2605;"
        let sc = "&#x2606;"
        let c = ["star-row", "star-row", "star-row", "star-row", "star-row", "star-row"];
        if (this.rating >= 0 && this.rating <= 5) {
            c[this.rating] = "star-row-selected";
        }
        let str = "<div class=\"ratings-box\">\n" +
            "<div class=\"star-title-box\">\n" +
            "<div class=\"title\">" + this.esc_html(this.displayName) + "</div>\n" +
            "</div>\n" +
            "<div class=\"star-box\">\n" +
            "<div class=\""+c[5]+"\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_rating','" + this.metadata + "', 5)\">" + ss + ss + ss + ss + ss + "</div>\n" +
            "<div class=\""+c[4]+"\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_rating','" + this.metadata + "', 4)\">" + sc + ss + ss + ss + ss + "</div>\n" +
            "<div class=\""+c[3]+"\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_rating','" + this.metadata + "', 3)\">" + sc + sc + ss + ss + ss + "</div>\n" +
            "<div class=\""+c[2]+"\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_rating','" + this.metadata + "', 2)\">" + sc + sc + sc + ss + ss + "</div>\n" +
            "<div class=\""+c[1]+"\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_rating','" + this.metadata + "', 1)\">" + sc + sc + sc + sc + ss + "</div>\n" +
            "<div class=\""+c[0]+"\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('select_rating','" + this.metadata + "', 0)\">" + sc + sc + sc + sc + sc + "</div>\n" +
            "</div>\n" +
            "</div>\n";
        jQuery(".c-" + this.metadata).html(str);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// yes no control
//
let yes_no_control = {

    displayName: "",
    metadata: "",
    value: 0.0,

    instantiate(cat) {
        let copy = jQuery.extend({}, yes_no_control);
        jQuery.extend(copy, common_functions);
        copy.displayName = cat.displayName;
        copy.metadata = cat.metadata;
        if (cat.value) {
            copy.value = cat.value;
        }
        return copy;
    },

    // reset this control
    clear() {
        this.value = 0.0;
        this.render();
    },

    // add metadata description for this control to data[this.metadata]
    get_metadata(data) {
        if (data && this.value > 0.0) {
            data[this.metadata] = ["yes"];
        }
    },

    toggle_value: function() {
        // not set?
        if (this.value === undefined) {
            this.value = 1.0;
        } else if (this.value === 0.0) { // click again?  de-select
            this.value = 1.0;
        } else {
            this.value = 0.0;
        }
        this.render();
        if (search && search.do_search) search.do_search();
    },

    // render a yes no slider
    render: function() {
        let title = this.displayName;
        let yes_no_str = yes_no_no;
        let toggle_str = "off ";
        if (this.value !== 0.0) {
            yes_no_str = yes_no_yes;
            toggle_str = "";
        }
        let str = "<div class=\"slider-item-box\">\n" +
            "<div class=\"slider-title-box\">\n" +
            "<div class=\"title\">" + this.esc_html(title) + "</div>\n" +
            "</div>\n\n" +
            "<div class=\"slider-body\">\n" +
            "<span class=\"toggle " + toggle_str + "\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('toggle_value','" + this.metadata + "','off')\">&#x2b24;</span>" +
            "<label class=\"toggle-label\">" + yes_no_str + "</label>\n" +
            "</div>\n" +
            "</div>\n";
        jQuery(".c-" + this.metadata).html(str);
    },


}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// double money slider
//
let slider_control = {

    // control properties
    displayName: "",
    metadata: "",
    min: 0.0,
    max: 0.0,
    min_value: 0.0,
    max_value: 0.0,
    monetary: false,
    currency_symbol: settings.currency_symbol,

    instantiate(cat) {
        let copy = jQuery.extend({}, slider_control);
        jQuery.extend(copy, common_functions); // add common utils for SimSage controls
        copy.displayName = cat.displayName;
        copy.metadata = cat.metadata;
        copy.monetary = cat.key === num_type_money;
        if (cat.minValue) {
            copy.min = cat.minValue;
        }
        copy.min_value = copy.min;
        if (cat.maxValue) {
            copy.max = cat.maxValue;
        }
        copy.max_value = copy.max;
        return copy;
    },

    // reset this control
    clear() {
        this.min_value = this.min;
        this.max_value = this.max;
        let ctrl = jQuery(".slider-" + this.metadata);
        ctrl.slider('values', 0, this.min);
        ctrl.slider('values', 1, this.max);
        this.display_values();
    },

    // add metadata description for this control to data[this.metadata]
    get_metadata(data) {
        if (data && this.min_value > this.min || this.max_value < this.max) {
            data[this.metadata] = ["range", "" + this.min_value, "" + this.max_value];
        }
    },

    display_values: function() {
        let left = parseInt(this.min_value);
        let right = parseInt(this.max_value);
        if (this.monetary) {
            left = this.currency_symbol + (left * 0.01).toFixed(2);
            right = this.currency_symbol + (right * 0.01).toFixed(2);
        }
        $(".slider-" + this.metadata + "-value").html(left + " - " + right);
    },

    setup_control: function() {
        let min = this.min;
        let max = this.max;
        let step = 1;
        if (this.monetary) {
            min = Math.floor(this.min * 0.01) * 100;
            max = Math.ceil(this.max * 0.01) * 100;
            step = 10;
        }
        let self = this;
        jQuery(".slider-" + this.metadata).slider({
            range: true,
            min: min,
            max: max,
            step: step,
            values: [this.min_value, this.max_value],
            slide: function(event, ui) {
                self.min_value = ui.values[0];
                self.max_value = ui.values[1];
                self.display_values();
            },
            stop: function(event, ui) {
                self.min_value = ui.values[0];
                self.max_value = ui.values[1];
                if (search && search.do_search) search.do_search();
            }
        });
    },

    // render a range slider
    render: function() {
        let title = this.displayName;
        let dp_class = "slider-" + this.metadata;
        let str = "<div class=\"slider-item-box\">\n" +
            "<div class=\"slider-title-box\">\n" +
            "<div class=\"title\">" + this.esc_html(title) + "</div>\n" +
            "</div>\n\n" +
            "<div class=\"slider-values\">\n" +
            "<div class=\"" + dp_class + "-value\"></div>\n" +
            "</div>\n\n" +
            "<div class=\"slider-body\">\n" +
            "<div class=\"" + dp_class + "\">\n" +
            "</div>\n" +
            "</div>\n" +
            "</div>\n";
        jQuery(".c-" + this.metadata).html(str);
        this.display_values();
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the semantic-display-categories
// display the set of semantic items (usually in the semantic_set array) on the side
//
let display_categories_control = {

    items: [], // the list of semantic-display items in their order
    metadata: "semantic-set-control",

    instantiate() {
        let copy = jQuery.extend({}, display_categories_control);
        jQuery.extend(copy, common_functions);
        copy.items = [];
        return copy;
    },

    // give the controls their value
    set_semantic_set(semantic_set) {
        if (semantic_set) {
            this.items = semantic_set;
        }
        this.render();
    },

    // perform the click replace / insert trick
    toggle_word_in_search(word) {
        let ctrl = jQuery(".search-text");
        let text = ctrl.val();
        if (text) {
            let current_text = " " + text + " ";
            if (current_text.indexOf(" " + word + " ") >= 0) {
                current_text = current_text.replace(" " + word + " ", " ");
            } else {
                current_text = current_text + " " + word;
            }
            ctrl.val(current_text.trim());
        }
    },

    // render a one level category item set
    render() {
        let str = "";
        for (let key in this.items) {
            if (this.items.hasOwnProperty(key)) {
                str += "<div class=\"title-box\">\n" +
                    "<div class=\"title\">" + key + "</div>\n" +
                    "</div>\n";
                let value_list = this.items[key];
                for (let j in value_list) {
                    if (value_list.hasOwnProperty(j)) {
                        let item1 = value_list[j];
                        str += "<div class=\"item-box category-margin\" tabindex=\"0\" onkeyup=\"if (activation(event)) this.onclick(null)\" onclick=\"exec('toggle_word_in_search','" + this.metadata + "','" + this.esc_html(item1.word) + "')\">\n" +
                            "<div>\n" +
                            "<span class=\"category-head\" title=\"further refine your search using '" + this.esc_html(item1.word) + "'\">" + this.esc_html(item1.word) + "</span>\n" +
                            "<span class=\"number-box\" title=\"'" + this.esc_html(item1.word) + "' has a frequency of " + this.esc_html(item1.frequency) + " in these results\">" + this.esc_html(item1.frequency) + "</span>\n" +
                            "</div>\n" +
                            "</div>\n";
                    }
                }
            }
        } // end of for key
        jQuery(".semantic-display-categories").html(str);
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// syn-set selector
//
let syn_set_control = {

    items: [], // the list of synset display items
    metadata: "syn-set-control",

    instantiate() {
        let copy = jQuery.extend({}, syn_set_control);
        jQuery.extend(copy, common_functions);
        copy.items = [];
        return copy;
    },

    // reset this control
    clear() {
        for (let j in this.items) {
            this.items[j].selected = -1;
        }
        this.render();
    },

    // give the controls their value
    set_syn_sets(syn_sets) {
        if (syn_sets && syn_sets.length > 0) {
            this.items = syn_sets;
        }
        this.render();
        if (search && search.do_search) search.do_search();
    },

    // return a lookup word -> selected (if selected)
    get_selected_syn_sets() {
        let syn_set_dictionary = {};
        for (let key in this.items) {
            let item = this.items[key];
            if (item.word && item.selected >= 0) {
                syn_set_dictionary[item.word.toLowerCase()] = item.selected;
            }
        }
        return syn_set_dictionary;
    },

    // return the unique list of words in text_str as a list
    get_unique_words_as_list: function(text_str) {
        let newList = [];
        if (text_str && text_str.length > 0) {
            let parts = text_str.split(" ");
            let duplicates = {};
            for (let i in parts) {
                if (parts.hasOwnProperty(i)) {
                    let _part = parts[i];
                    let part = _part.trim().toLowerCase();
                    if (part.length > 0) {
                        if (!duplicates.hasOwnProperty(part)) {
                            duplicates[part] = 1;
                            newList.push(_part.trim());
                        }
                    }
                }
            }
        }
        return newList;
    },

    // used by UI to markup syn-sets and remove duplicate words
    markup_string_with_syn_sets: function(text) {
        let parts = this.get_unique_words_as_list(text);
        let newList = [];
        let syn_set_dictionary = this.get_selected_syn_sets();
        for (let i in parts) {
            if (parts.hasOwnProperty(i)) {
                let _part = parts[i];
                let part = _part.trim().toLowerCase();
                let synSet = syn_set_dictionary[part];
                if (typeof synSet !== 'undefined' && parseInt(synSet) >= 0) {
                    newList.push(_part.trim() + '/' + synSet);
                } else {
                    newList.push(_part.trim());
                }
            }
        }
        return newList.join(" ");
    },

    // select an item
    select_syn_set(word) {
        if (word && word.length > 0) {
            let selected = parseInt(jQuery(".synset-selector-" + word).val());
            if (selected >= 0 || selected === -1) {
                for (let key in this.items) {
                    let item = this.items[key];
                    if (item.word === word) {
                        item.selected = selected;
                    }
                }
            }
        }
    },

    // render a single item
    render_single_synset: function(synset) {
        let str = "";
        if (synset && synset["word"] && synset["clouds"]) {
            let word = synset["word"];
            let clouds = synset["clouds"]; // this is a csv list of words
            let selected = synset["selected"] ? synset["selected"] : -1;
            if (clouds.length > 1) {
                str += '<div class="title-box">';
                str += '<div class="title" title="select different meanings of \'' + word + '\'">synset: ' + word + '</div>';
                str += "<select class=\"synset-selector-" + word + "\" onchange=\"exec('select_syn_set','" + this.metadata + "','" + word + "');\">";
                str += '<option value="-1">all meanings</option>';
                for (let i in clouds) {
                    if (clouds.hasOwnProperty(i)) {
                        if (selected === i) {
                            str += '<option value="' + i + '" selected>' + clouds[i] + '</option>';
                        } else {
                            str += '<option value="' + i + '">' + clouds[i] + '</option>';
                        }
                    }
                }
                str += '</select>' + triangle_open;
                str += '</div>';
            }
        }
        return str;
    },

    // render a series of syn-set items
    render() {
        let str = "";
        if (this.items && this.items.length > 0) {
            for (let key in this.items) {
                str += this.render_single_synset(this.items[key]);
            }
        }
        jQuery(".syn-sets").html(str);
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// clean text - remove characters we use for special purposes
function cleanup_query_text(text) {
    // remove any : ( ) characters from text first (but not from http: and https:)
    text = text.replace(/\)/g, ' ');
    text = text.replace(/\(/g, ' ');
    text = text.replace(/:/g, ' ');
    text = text.replace(/http \/\//g, 'http://');
    text = text.replace(/https \/\//g, 'https://');
    return text;
}

// helper: turn search-options, text, and custom-rendering data into a super-query string
function super_search_query_str(text, search_options_data, is_custom_render) {
    let query = "(";
    let needsAnd = false;
    if (text.length > 0) {
        query += "body: " + syn_set_control.markup_string_with_syn_sets(text);
        needsAnd = true;
    }
    let af = search_options_data;
    if (af.url && af.url.length > 0 && af.url[0].length > 0) {
        if (needsAnd)
            query += " and (";
        else
            query += " (";
        needsAnd = true;
        for (let i in af.url) {
            if (i > 0) {
                query += " and "
            }
            if (af.url.hasOwnProperty(i)) {
                query += "url: " + af.url[i];
            }
        }
        query += ") "
    }
    if (af.title && af.title.length > 0 && af.title[0].length > 0) {
        if (needsAnd)
            query += " and (";
        else
            query += " (";
        needsAnd = true;
        for (let i in af.title) {
            if (i > 0) {
                query += " and "
            }
            if (af.title.hasOwnProperty(i)) {
                query += "title: " + af.title[i];
            }
        }
        query += ") "
    }
    if (af.author && af.author.length > 0 && af.author[0].length > 0) {
        if (needsAnd)
            query += " and (";
        else
            query += " (";
        needsAnd = true;
        for (let i in af.author) {
            if (i > 0) {
                query += " and "
            }
            if (af.author.hasOwnProperty(i)) {
                query += "author: " + af.author[i];
            }
        }
        query += ") "
    }
    if (af.document_type && af.document_type.length > 0 && af.document_type[0].length > 0) {
        if (needsAnd)
            query += " and (";
        else
            query += " (";
        needsAnd = true;
        for (let i in af.document_type) {
            if (i > 0) {
                query += " or "
            }
            if (af.document_type.hasOwnProperty(i)) {
                query += "type: " + af.document_type[i];
            }
        }
        query += ") "
    }
    // db parameters?
    if (is_custom_render) {
        let db = get_metadata();
        let sort = null;
        for (let metadata in db) {
            if (db.hasOwnProperty(metadata)) {
                let item = db[metadata];
                if (metadata === "sort") {
                    sort = item;
                } else {
                    if (item[0] === "range") {
                        if (needsAnd)
                            query += " and range("
                        else
                            query += " range("
                        needsAnd = true;
                        query += metadata + "," + item[1] + "," + item[2] + ")";

                    } else if (item[0] === "yes") {
                        if (needsAnd)
                            query += " and num("
                        else
                            query += " num("
                        needsAnd = true;
                        query += metadata + ",1)";

                    } else if (item[0] === "rating") {
                        if (needsAnd)
                            query += " and doc("
                        else
                            query += " doc("
                        needsAnd = true;
                        query += metadata + "," + item[1] + ")";

                    } else {

                        let has_brackets = false;
                        if (item.length > 2) {
                            has_brackets = true;
                            if (needsAnd)
                                query += " and ("
                            else
                                query += " ("
                        } else {
                            if (needsAnd)
                                query += " and "
                            else
                                query += " "
                        }
                        needsAnd = true;
                        for (let i in item) {
                            if (i > 0) {
                                if (i > 1) {
                                    query += " or ";
                                }
                                query += "doc(" + metadata + "," + item[i] + ")"
                            }
                        }
                        if (has_brackets)
                            query += ")"
                    }
                } // else if not sort
            } // if has md item
        } // for each md item
        if (sort !== null) {
            if (needsAnd)
                query += " and "
            else
                query += " "
            query += "sort(" + sort[0] + "," + sort[1] + ") ";
        }
    }
    query += ")";
    return query;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


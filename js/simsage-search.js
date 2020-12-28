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
    if (simsage && simsage.do_search) simsage.do_search();
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
    adjust_size: function(str, size) {
        if (size && str.length > size) {
            return str.substr(0,size) + "...";
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
        if (simsage && simsage.kb) {
            return simsage.kb;
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
        let url = this.base_url + endPoint;
        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': this.api_version,
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
        let url = this.base_url + endPoint;
        jQuery.ajax({
            headers: {
                'Content-Type': 'application/json',
                'API-Version': this.api_version,
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
    category_size: this.category_size,

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
            this.category_size = this.category_size;
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
        if (simsage && simsage.do_search) simsage.do_search();
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
    category_size: this.category_size,

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
            this.category_size = this.category_size;
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
        if (simsage && simsage.do_search) simsage.do_search();
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
        if (simsage && simsage.do_search) simsage.do_search();
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
        if (simsage && simsage.do_search) simsage.do_search();
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
        if (simsage && simsage.do_search) simsage.do_search();
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
    currency_symbol: this.currency_symbol,

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
                if (simsage && simsage.do_search) simsage.do_search();
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
        if (simsage && simsage.do_search) simsage.do_search();
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// the search bar at the top
let simsage = {

    // ws-response message types
    mt_Disconnect: "disconnect",
    mt_Error: "error",
    mt_Message: "message",
    mt_Email: "email",
    mt_IsTyping: "typing",
    mt_SignIn: "sign-in",
    mt_SignOut: "sign-out",
    mt_OperatorAvailable: "operator-available",
    mt_OperatorChat: "operator-chat",
    mt_OperatorMessage: "operator-message",

    // the service layer end-point, change "<server>" to ... (no / at end)
    base_url: "http://localhost:8080",
    code_url: "http://localhost:8080",
    // api version of ws_base
    api_version: 1,
    // the organisation's id to search, change "<organisation>" to...
    organisationId: "",

    // do we have an operator?
    operator_enabled: true,
    category_size: 5,   // size of category lists
    page_size: 5,           // number of pages per page in search
    page_size_custom: 10,   // number of pages per page in custom view
    currency_symbol: "$",

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

    kb_list: [],        // list of knowledge-bases
    kb: null,           // the selected knowledge-base
    source_list: [],    // list of sources
    source: null,       // the selected source

    is_busy: false,     // is the system busy?

    connection_retry_count: 1,  // retry-count for any errors and need to connect

    assigned_operator_id: "",   // the id of an assigned operator
    client_typing_last_seen: 0, // timer for typing
    typing_timeout: 1500,       // typing animation timeout in ms
    typing_repeat_timeout: 750, // don't send too many is-typing requests to the server
    operator_count: 0,          // how many operators available
    chat_list: [],              // list of chat messages

    is_custom_render: false,        // is this a custom render display?
    filters_visible: false,         // are the filters visible

    semantic_search_results: [],    // semantic search results
    semantic_search_result_map: {}, // url => semantic_search_result
    semantic_search_result_map_id: {}, // urlId => semantic_search_result

    // single instance
    instantiate() {
        // add other modules
        jQuery.extend(this, common_functions);
        jQuery.extend(this, search_options_control);
        jQuery.extend(this, no_results);
        jQuery.extend(this, search_details);
        jQuery.extend(this, sign_in_control);
        jQuery.extend(this, spelling_control);
        jQuery.extend(this, search_bot);
        jQuery.extend(this, pagination_control);
        jQuery.extend(this, chat_control);
        jQuery.extend(this, search_results_control);
        jQuery.extend(this, domain_control);
        return this;
    },

    // clear the search text and filters
    clear_search: function() {
        jQuery(".search-text").val("");
        this.clear_all(); // clear filters
        this.close_bot();
        if (this.is_custom_render) {
            this.do_search();
        } else {
            this.clear_search_results();
            this.reset_pagination("");
            this.render_pagination();
        }
    },

    // perform a search
    do_search: function() {
        let self = this;
        let text = jQuery(".search-text").val();
        if (this.kb && (this.is_custom_render || text.trim() !== '')) {
            // do we need to reset the pagination?
            this.reset_pagination(text);
            // create the query and clear the errors
            this.error('');
            text = cleanup_query_text(text);
            let search_query_str = super_search_query_str(text, this.get_search_options_data(), this.is_custom_render);
            // console.log(search_query_str);
            if (search_query_str !== '()') {
                simsage.search_query = text;
                this.busy(true);
                let sourceId = "";
                if (this.source && this.source.id) {
                    sourceId = this.source.id;
                }
                let clientQuery = {
                    'organisationId': this.organisationId,
                    'kbList': [this.kb.id],
                    'clientId': this.get_client_id(),
                    'semanticSearch': true,     // always a search
                    'query': search_query_str,  // search query
                    'queryText': text,          // raw text
                    'numResults': 1,              // bot results
                    'scoreThreshold': this.bot_threshold,
                    'page': this.page,
                    'pageSize': this.page_size,
                    'shardSizeList': this.shard_size_list,
                    'fragmentCount': this.fragment_count,
                    'maxWordDistance': this.max_word_distance,
                    'spellingSuggest': this.use_spelling_suggest,
                    'contextLabel': this.context_label,
                    'contextMatchBoost': this.context_match_boost,
                    'sourceId': sourceId,
                };
                this.post_message('/api/ops/query', clientQuery, function(data) {
                    self.receive_search_results(data);
                });

            } else if (!this.is_custom_render) {
                this.error("Please enter a query to start searching.");
            } else {
                console.debug('is_custom_render: empty query');
            }

        } else if (!this.kb) {
            this.error("Server not responding, not connected.");

        } else if (!this.is_custom_render && text.trim() === '') {
            this.render_pagination();
        }
    },

    // process a SimSage search result
    receive_search_results: function(data) {
        let self = this;
        if (data.messageType === this.mt_Message) {
            this.is_typing = false;
            this.semantic_search_results = [];
            this.semantic_search_result_map = {};
            this.semantic_search_result_map_id = {};
            this.spelling_suggestion = data.spellingCorrection; // set spelling suggestion if we have one

            // set the assigned operator
            if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                this.assigned_operator_id = data.assignedOperatorId;
                if (data.operatorName) {
                    this.operator_name = data.operatorName;
                } else {
                    this.operator_name = '';
                }
            }

            // did we get semantic search results?
            if (data.resultList) {
                this.shard_size_list = data.shardSizeList;
                set_display_categories(data.semanticSet);
                set_syn_sets(data.contextStack);
                data.resultList.map(function (sr) {
                    if (!sr.botResult) {
                        // enhance search result for display
                        if (sr.textIndex >= 0 && sr.textIndex < sr.textList.length) {
                            sr['index'] = sr.textIndex;  // inner offset index
                        } else {
                            sr['index'] = 0;  // inner offset index
                        }
                        sr['num_results'] = sr.textList.length;
                        self.semantic_search_results.push(sr);  // add item
                        self.semantic_search_result_map[sr.url] = sr;
                        self.semantic_search_result_map_id[sr.urlId] = sr;
                    }
                });
                this.num_results = data.totalDocumentCount;
                let divided = data.totalDocumentCount / this.page_size;
                this.num_pages = parseInt("" + divided);
                if (parseInt("" + divided) < divided) {
                    this.num_pages += 1;
                }
            }

            // did we get an bot reply?
            let dt = this.unix_time_convert(new Date().getTime());
            if (data.hasResult && data.text && data.text.length > 0) {
                // setup the bot
                this.show_bot(data.text, data.urlList, data.imageList);
            }

            // copy the know email flag from our results
            if (!this.know_email && data.knowEmail) {
                this.know_email = data.knowEmail;
            }

            // no results?
            if (!data.hasResult) {
                // hide
                this.hide_search_results();
                // did we get assigned an operator?
                if (this.assigned_operator_id && this.assigned_operator_id.length > 0) {
                    let text = this.operator_name ? "you are chatting with " + this.operator_name :
                        "you are chatting with an Operator"
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: text
                    });
                    this.update_chat_window();
                    this.show_chat_button(true, this.chat_list.length > 0);
                    this.show_chat();

                } else if (!this.is_custom_render) {
                    // don't show no-search results for a custom render
                    this.show_no_search_results();
                }

            } else if (this.semantic_search_results && this.semantic_search_results.length > 0) {
                // hide if no actual results
                this.render_search_results();
                this.show_search_results();
            }
        } // if message-type is right
    },

    search_typing: function(event) {
        if (event.keyCode === 13) {
            this.do_search();
        }
    },

    busy: function(is_busy) {
        this.is_busy = is_busy;
    },

    on_change_kb: function (kb_id) {
        if (kb_id === undefined) {
            kb_id = jQuery(".dd-knowledge-base").val();
        }
        this.source_list = [];
        this.is_custom_render = false;
        for (let i in this.kb_list) {
            if (this.kb_list.hasOwnProperty(i)) {
                let kb = this.kb_list[i];
                if (kb.id == kb_id) {
                    this.kb = kb;
                    for (let j in kb.sourceList) {
                        if (kb.sourceList.hasOwnProperty(j)) {
                            let source = kb.sourceList[j];
                            this.source_list.push({"name": source.name, "id": source.sourceId, "category_list": source.categoryList});
                        }
                    }
                    // select a default source if there is only one
                    if (this.source_list.length === 1) {
                        this.on_change_source(this.source_list[0].id);
                    }
                }
            }
        }
        // setup the drop down boxes in the UI
        this.setup_dropdowns();
        // deal with domains
        this.setup_domains();
        this.setup_office_365_user();
        // setup any potential domains
        this.change_domain(null);
        if (this.kb_list.length > 1)
            jQuery(".knowledge-base-selector").show();
        else
            jQuery(".knowledge-base-selector").hide();
    },

    // change source by id
    on_change_source: function(source_id) {
        // make sure we have a valid source-id
        if (source_id === undefined) {
            source_id = jQuery(".dd-source").val();
        }
        this.source = null;
        this.is_custom_render = false;
        simsage_sort_list = [];
        simsage_control_list = [];
        for (let i in this.source_list) {
            if (this.source_list.hasOwnProperty(i)) {
                let source = this.source_list[i];
                if (source.id == source_id) {
                    this.source = source;
                    // force display of filters if db system
                    if (source.category_list && source.category_list.length > 0) {
                        this.filters_visible = true;
                        this.is_custom_render = true;
                        this.page_size = this.page_size_custom;
                        setup_controls(source.category_list);  // our special controller
                        this.show_pagination(); // needed for sorting etc.
                    }
                } // if is correct source
            }
        }
        // setup the drop down boxes in the UI
        this.setup_dropdowns();
        // deal with domains
        this.setup_domains();
        this.setup_office_365_user();
        // setup any potential domains
        this.change_domain(null);
        if (!this.is_custom_render) {
            this.hide_search_results(); // hide otherwise
        } else {
            this.do_search();
        }
        this.render_pagination();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// control taking care of the search options on screen (advanced search menu)
//
let search_options_control = {
    menu_visible: false, // is the attached menu showing?
    open: false,  // is the menu open or closed?

    // single instance, setup with a set of knowledge-bases
    setup_search_options() {
        if (!this.show_advanced_filter) {
            jQuery(".search-options-button").hide();
        } else {
            jQuery(".search-options-button").show();
        }
        jQuery(".filter-box-view").hide();
    },

    // perform the initial startup setup
    init: function(control_id, settings) {
        let self = this;
        if (!control_id) {
            console.error("SimSage init() failed, 'control_id' not set")
            return null;
        }
        if (!settings || !settings.organisation_id || !settings.base_url) {
            console.error("SimSage init() failed, settings must be set with an 'organisation_id' and a 'base_url'")
            return null;
        }
        // is there a different code fetch url from the base url?
        if (settings.code_url) {
            this.code_url = settings.code_url;
        } else {
            this.code_url = settings.base_url;
        }
        // get the settings we do have
        this.base_url = settings.base_url;
        this.organisationId = settings.organisation_id;
        // load the render template
        jQuery(control_id).load(settings.code_url + "/simsage-search.html");
        // get possible setting overrides
        // do we have an operator?
        if (typeof settings.operator_enabled === "boolean") this.operator_enabled = settings.operator_enabled;
        // size of category lists
        if (typeof settings.category_size === "number") this.category_size = settings.category_size;
        // number of pages per page in search
        if (typeof settings.page_size === "number") this.page_size = settings.page_size;
        // number of pages per page in custom view
        if (typeof settings.page_size_custom === "number") this.page_size_custom = settings.page_size_custom;
        if (typeof settings.currency_symbol === "string") this.currency_symbol = settings.currency_symbol;
        // search settings
        if (typeof settings.fragment_count === "number") this.fragment_count = settings.fragment_count;
        if (typeof settings.max_word_distance === "number") this.max_word_distance = settings.max_word_distance;
        if (typeof settings.use_spelling_suggest === "boolean") this.use_spelling_suggest = settings.use_spelling_suggest;
        if (typeof settings.context_label === "string") this.context_label = settings.context_label;
        if (typeof settings.context_match_boost === "number") this.context_match_boost = settings.context_match_boost;
        // bot sensitivity - controls the A.I's replies - we suggest you don't change it!
        if (typeof settings.bot_threshold === "number") this.bot_threshold = settings.bot_threshold;
        // show the advanced filters?
        if (typeof settings.show_advanced_filter === "boolean") this.show_advanced_filter = settings.show_advanced_filter;
        // placeholder for search text-control
        if (typeof settings.search_placeholder === "string") this.search_placeholder = settings.search_placeholder;

        console.log("SimSage init, url:" + this.base_url + ", organisation-id:" + this.organisationId,
                    ", operator-enabled:" + this.operator_enabled);
        this.setup_search_options();
        this.setup_dropdowns();
        this.render_pagination();
        // setup a polyfill for IE 11 functions we use
        this.ie11_polyfill();
        // set a placeholder?
        if (this.search_placeholder && this.search_placeholder.length > 0) {
            jQuery(".search-text").attr("placeholder", this.search_placeholder);
        }

        // monitor the ESC key to close dialog boxes
        jQuery(document).on('keydown', function(event) {
            if (event.key === "Escape" || event.key === "Esc") {
                const err_ctrl = jQuery(".error-dialog-box");
                if (err_ctrl.is(":visible")) {
                    err_ctrl.hide();
                } else {
                    simsage.close_chat();
                    simsage.close_search_details();
                    simsage.hide_menu();
                    simsage.close_sign_in();
                    simsage.close_no_search_results();
                    simsage.close_bot();
                }
            }
        });

        let url = '/api/knowledgebase/search/info/' + encodeURIComponent(this.organisationId) + '/' + encodeURIComponent(this.get_client_id());
        this.get_message(url, function(data) {
            self.kb_list = data.kbList;
            self.operator_count = data.operatorCount;
            // get any previously assigned operator on refresh
            self.assigned_operator_id = '';
            if (data.assignedOperatorId) {
                self.assigned_operator_id = data.assignedOperatorId;
            }
            self.operator_name = '';
            if (data.operatorName) {
                self.operator_name = data.operatorName;
            }
            self.show_chat_button(this.operator_enabled && (self.operator_count > 0 || (self.assigned_operator_id && self.assigned_operator_id.length > 0)),
                self.chat_list.length > 0);
            // wordpress override
            if (this.kbId && this.kbId.length > 0) {
                self.kb = {"name": "wordpress knowledge-base", "id": this.kbId, "sourceList": []};
                self.on_change_kb(self.kb.id);
            } else if (self.kb_list.length > 0) {
                self.kb = self.kb_list[0];
                self.on_change_kb(self.kb.id);
            }
            self.error('');
            self.connection_retry_count = 1;
            self.busy(false);
            if (self.operator_enabled) {
                // connect to the socket system
                if(typeof SockJS === "undefined") {
                    $.ajax({
                        url: self.code_url + "/js/sockjs.js",
                        dataType: "script",
                        cache: true,
                        success: function() {
                            console.debug("loaded socks.js");
                            $.ajax({
                                url: self.code_url + "/js/stomp.js",
                                dataType: "script",
                                cache: true,
                                success: function() {
                                    console.debug("loaded stomp.js");
                                    self.connect_ws();
                                }
                            });
                        }
                    });
                } else {
                    self.connect_ws();
                }
                // setup is-typing check
                window.setInterval(function () {
                    self.operator_was_typing(false)
                }, 1000);
            }

        }, function(err) {
            console.log(err);
            if (self.connection_retry_count > 1) {
                self.error('not connected, trying to re-connect, please wait (try ' + self.connection_retry_count + ')');
            } else {
                self.error(err);
            }
            setTimeout(function() { self.init() }, 5000); // try and re-connect as a one-off in 5 seconds
            self.connection_retry_count += 1;
        });
    },

    // return the search metadata based on the selections
    get_search_options_data: function() {
        return {
            "document_type": jQuery('label.document-type-sel select').val().split(','),
            "kb": jQuery('label.knowledge-base-sel select').val(),
            "title": [jQuery('.title-text').val()],
            "url": [jQuery('.url-text').val()],
            "author": [jQuery('.author-text').val()],
        };
    },

    reset_document_type: function() {
        jQuery('label.document-type-sel select').val("");
    },

    clear_all: function() {
        this.reset_document_type();
        jQuery(".title-text").val("");
        jQuery(".url-text").val("");
        jQuery(".author-text").val("");
    },

    toggle_menu: function() {
        this.menu_visible = !this.menu_visible;
        if (this.menu_visible) {
            jQuery(".filter-box-view").show();
        } else {
            jQuery(".filter-box-view").hide();
        }
    },

    // setup the advanced menu drop-down lists
    setup_dropdowns: function() {
        this.setup_kb_list();
        this.set_source_list();
    },

    // render and set a kb list {"name": ..., "id": ....}
    setup_kb_list: function() {
        let str = "";
        if (this.kb_list && this.kb_list.length > 0) {
            for (let i in this.kb_list) {
                if (this.kb_list.hasOwnProperty(i)) {
                    let kb = this.kb_list[i];
                    if (kb && this.kb && kb.id === this.kb.id) {
                        str += "<option value=\"" + this.esc_html(kb.id) + "\" selected>" + this.esc_html(kb.name) + "</option>";
                    } else {
                        str += "<option value=\"" + this.esc_html(kb.id) + "\">" + this.esc_html(kb.name) + "</option>";
                    }
                }
            }
        }
        jQuery(".dd-knowledge-base").html(str);
    },

    // render and set the contents of the source drop-down list {"name": ..., "id": ...}
    set_source_list: function() {
        let str = "<option value=\"\">All Sources</option>";
        if (this.source_list && this.source_list.length > 0) {
            for (let i in this.source_list) {
                if (this.source_list.hasOwnProperty(i)) {
                    let source = this.source_list[i];
                    if (this.source && source && this.source.id === source.id) {
                        str += "<option value=\"" + this.esc_html(source.id) + "\" selected>" + this.esc_html(source.name) + "</option>";
                    } else {
                        str += "<option value=\"" + this.esc_html(source.id) + "\">" + this.esc_html(source.name) + "</option>";
                    }
                }
            }
        }
        jQuery(".dd-source").html(str);
    },

    hide_menu: function(event) {
        if (event) {
            event.stopPropagation();
        }
        this.menu_visible = false;
        jQuery(".filter-box-view").hide();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the no-results handling
//
let no_results = {

    know_email: false,

    // single instance
    instantiate() {
        jQuery.extend(this, common_functions);
        return this;
    },
    email_typing: function(event) {
        if (event.keyCode === 13) {
            this.do_email();
        }
    },
    // user asks for help
    do_email: function() {
        let self = this;
        let email_address = jQuery(".email-text").val();
        if (email_address && this.validate_email(email_address.trim())) {
            this.error('');
            let emailMessage = {
                'messageType': this.mt_Email,
                'organisationId': this.organisationId,
                'kbList': [this.get_kb_id()],
                'clientId': this.get_client_id(),
                'emailAddress': email_address,
            };
            this.post_message('/api/ops/email', emailMessage, function(data) {
                self.receive_ws_data(data);
                self.show_no_search_results(); // update display
            });
        } else {
            this.error("invalid email address");
        }
    },

    show_no_search_results: function() {
        this.close_bot();
        jQuery(".no-search-results").show();
        jQuery(".not-found-words").html(this.adjust_size(jQuery(".search-text").val(), 25));
        jQuery(".search-results").hide();
        if (this.know_email) {
            jQuery(".ask-email-box").hide();
            jQuery(".ask-emailed-box").show();
        } else {
            jQuery(".ask-email-box").show();
            jQuery(".ask-emailed-box").hide();
        }
    },

    close_no_search_results: function() {
        jQuery(".no-search-results").hide();
    },
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// search details display, single instance
//
let search_details = {
    // helper: render a single detail of the details view
    render_single_detail: function(label, text) {
        let str = "<div class=\"row-height align-top\">\n" +
            "<span class=\"label\" title=\"[label]\">[label]</span><span class=\"text\" title=\"[text]\">[text]</span>\n" +
            "</div>\n"
        str = str
            .replace(/\[label]/g, this.esc_html(label))
            .replace(/\[text]/g, this.esc_html(text));
        return str;
    },

    // helper: render a single detail, but with a clickable url
    render_single_detail_url: function(label, url) {
        let str = "<div class=\"row-height align-top\">\n" +
            "<span class=\"label\" title=\"[label]\">[label]</span><span class=\"url\" onclick=\"window.open('[url]', '_blank')\" title=\"[text]\">[text]</span>\n" +
            "</div>\n"
        str = str
            .replace(/\[label]/g, this.esc_html(label))
            .replace(/\[text]/g, this.esc_html(url));
        return str;
    },

    get_preview_url: function() {
        return this.base_url + '/api/document/preview/' + this.organisationId + '/' + this.kb.id + '/' +
            this.get_client_id();
    },

    // render the details of a single result
    render_details_view: function(result) {
        if (result) {
            let str = "<table class=\"details-table\">\n" +
                "<tbody><tr class=\"align-top whole-row\">\n" +
                "<td class=\"align-top row-1\">\n";
            str += this.render_single_detail_url("url", result.url);
            if (result.title) {
                str += this.render_single_detail("title", result.title);
            }
            if (result.urlId > 0) {
                str += this.render_single_detail("document id", result.urlId);
            }
            if (result.author) {
                str += this.render_single_detail("author", result.author);
            }
            if (result.documentType) {
                str += this.render_single_detail("document type", result.documentType);
            }
            if (result.binarySize > 0) {
                str += this.render_single_detail("document byte-size", this.size_to_str(result.binarySize));
            }
            if (result.textSize > 0) {
                str += this.render_single_detail("text byte-size", this.size_to_str(result.textSize));
            }
            if (result.source) {
                str += this.render_single_detail("source/origin", result.source);
            }
            if (result.created > 0) {
                str += this.render_single_detail("document created date/time", this.unix_time_convert(result.created));
            }
            if (result.lastModified > 0) {
                str += this.render_single_detail("document last-modified date/time", this.unix_time_convert(result.lastModified));
            }
            if (result.uploaded > 0) {
                str += this.render_single_detail("pipeline last-crawled date/time", this.unix_time_convert(result.uploaded));
            }
            if (result.converted > 0) {
                str += this.render_single_detail("pipeline last-converted date/time", this.unix_time_convert(result.converted));
            }
            if (result.parsed > 0) {
                str += this.render_single_detail("pipeline last-parsed date/time", this.unix_time_convert(result.parsed));
            }
            if (result.indexed > 0) {
                str += this.render_single_detail("pipeline last-indexed date/time", this.unix_time_convert(result.indexed));
            }
            if (result.previewed > 0) {
                str += this.render_single_detail("pipeline last-preview date/time", this.unix_time_convert(result.previewed));
            }
            if (result.numSentences > 0) {
                str += this.render_single_detail("number of sentences", result.numSentences);
            }
            if (result.numWords > 0) {
                str += this.render_single_detail("number of words", result.numWords);
            }
            if (result.numRelationships > 0) {
                str += this.render_single_detail("number of relationships", result.numRelationships);
            }
            for (let key in result.metadata) {
                // check if the property/key is defined in the object itself, not in parent
                if (key.indexOf('{') === -1 && result.metadata.hasOwnProperty(key)) {
                    let value = result.metadata[key];
                    if (value.indexOf("<") === -1) { // no tags or anything allowed - don't render
                        str += this.render_single_detail(key, value);
                    }
                }
            }
            str += "</td>\n" +
                "<td rowspan=\"20\" class=\"image-row align-top\">\n" +
                "<img src=\"[image]\" class=\"preview-image\" alt=\"page preview\" />\n" +
                "</td>\n" +
                "</tr>\n" +
                "</tbody>\n" +
                "</table>\n";
            str = str
                .replace(/\[url]/g,this. esc_html(result.url))
                .replace(/\[image]/g, this.get_preview_url() + '/' + this.esc_html(result.urlId) + '/0');
            jQuery(".detail-table").html(str);
        } else {
            jQuery(".detail-table").html("");
        }
    },

    show_search_details_by_id: function(result_id) {
        if (this.semantic_search_result_map_id && this.semantic_search_result_map_id.hasOwnProperty(result_id)) {
            this.show_search_details(this.semantic_search_result_map_id[result_id]);
        }
    },

    show_search_details: function(result) {
        this.render_details_view(result);
        jQuery(".search-details-view").show();
    },

    close_search_details: function() {
        jQuery(".search-details-view").hide();
    }

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// control for signing into SimSage
//
let sign_in_control = {

    show_sign_in: function() {
        jQuery(".search-sign-in").show();
    },

    setup_domains: function() {
    },

    setup_office_365_user: function() {
    },

    // setup any potential domains
    change_domain: function(domain) {
    },

    do_sign_in: function() {
        alert("todo: do_sign_in");
    },

    close_sign_in: function() {
        jQuery(".password").val("");
        jQuery(".search-sign-in").hide();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// control taking care of the search options on screen
//
let spelling_control = {

    text: "",

    show_spelling_suggestion: function(text) {
        if (text && text.length > 0) {
            this.text = this.esc_html(text);
            jQuery(".spelling-label-text").html("Did you mean, " + this.text + "?");
            jQuery(".spelling-box-view").show();
        }
    },

    use_spelling_suggestion: function() {
        if (this.text && this.text.length > 0) {
            jQuery(".search-text").val(this.text);
        }
    },

    close_spelling_suggestion: function() {
        jQuery(".spelling-box-view").hide();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the bot display
//
let search_bot = {

    // single instance
    instantiate() {
        jQuery.extend(this, common_functions);
        return this;
    },

    show_bot: function(text, link_list, image_list) {
        jQuery(".bot-reply-text").html(this.esc_html(text));
        let time = this.unix_time_convert(new Date().getTime());
        jQuery(".bot-label-text").html("Bot, " + time);
        jQuery(".bot-box-view").show();
        // add the links
        let str = "";
        if (link_list && link_list.length > 0) {
            if (image_list && image_list.length > 0) {
                str += "<div title='images' class='bot-images-box'>";
                for (let i in image_list) {
                    let link = image_list[i];
                    if (link) {
                        str += "<img src=\"" + link + "\" class='bot-image-link' alt='image'" + link + "</img>\n";
                    }
                }
                str += "</div>\n"
            }
            for (let i in link_list) {
                let link = link_list[i];
                if (link) {
                    str += "<div class='bot-link' title='visit " + link + "'\"><a href=\"" + link + "\" target='_blank'>" + link + "</a></div>\n";
                }
            }
            jQuery(".bot-links").html(str);
        } else {
            jQuery(".bot-links").html("");
        }
    },
    close_bot: function() {
        jQuery(".bot-reply-text").html("");
        jQuery(".bot-box-view").hide();
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the pagination control
//
let pagination_control = {

    // pagination
    num_pages: 0,       // search result information
    num_results: 0,
    page: 0,            // current page
    page_size: this.page_size,      // the size of pages

    selected_view: "text",          // the text or image view for non-custom render displays
    last_query: "",
    shard_size_list: [],            // sharding list

    do_change_page_size: function() {
        this.page_size = parseInt(jQuery(".dd-page-size").val());
        this.do_search();
    },

    do_change_sort: function() {
        let sort_id = jQuery(".dd-sort").val();
        for (let i in simsage_sort_list) {
            simsage_sort_list[i].selected = (i == sort_id);
        }
        this.do_search();
    },

    select_text_view: function() {
        this.selected_view = "text";
        this.do_search();
    },

    select_image_view: function() {
        this.selected_view = "image";
        this.do_search();
    },

    prev_page: function() {
        if (this.page > 0) {
            this.page -= 1;
            this.do_search();
        }
    },

    next_page: function() {
        if ((this.page + 1) < this.num_pages) {
            this.page += 1;
            this.do_search();
        }
    },

    show_pagination: function() {
        jQuery(".pagination-box").show();
    },

    // reset the variables used in determining pagination if the query has changed
    reset_pagination: function(query_text) {
        if (this.last_query !== query_text) {
            this.last_query = query_text;
            this.page = 0;  // reset to page 0
            this.num_pages = 0;
            this.num_results = 0;
            this.shard_size_list = [];
            this.semantic_search_results = [];
            this.semantic_search_result_map = {};
            this.semantic_search_result_map_id = {};
        }
    },

    // render the pagination on-screen
    render_pagination: function() {
        let num_pages = this.num_pages > 0 ? this.num_pages : 1;
        let num_results = this.num_results + " results";
        if (this.num_results === 0) {
            num_results = "no results";
        } else if (this.num_results === 1) {
            num_results = "one result";
        }
        let page_str = "page " + (this.page + 1) + " of " + num_pages;
        let ps = this.page_size;
        let str = "<span class=\"pagination-text\" title=\"" + num_results + "\">" + num_results + "</span>\n" +
            "<span class=\"pagination-text page-size-sel\" title=\"\">\n" +
            "<label>\n" +
            "<select name=\"page-size\" class=\"page-size-select dd-page-size\" tabindex=\"0\" onchange=\"simsage.do_change_page_size()\" title=\"set the number of results per page\">\n" +
            "<option value=\"5\" " + (ps===5 ? "selected" : "") + ">5 results per page</option>\n" +
            "<option value=\"10\" " + (ps===10 ? "selected" : "") + ">10 results per page</option>\n" +
            "<option value=\"15\" " + (ps===15 ? "selected" : "") + ">15 results per page</option>\n" +
            "<option value=\"20\" " + (ps===20 ? "selected" : "") + ">20 results per page</option>\n" +
            "</select><span class=\"dd-chevron-2\" title=\"please click on the text\">&#x2304;</span>\n" +
            "</label>\n" +
            "</span>\n";

        if (this.page > 0) {
            str += "<span class=\"prev-page-box pagination-left\" title=\"go to the previous page\" onclick=\"simsage.prev_page()\">\n" +
                "<span class=\"arrow-enabled\" alt=\"previous page\">&#x2190;</span>\n" +
                "</span>\n";
        } else {
            str += "<span class=\"prev-page-box-disabled pagination-left\" title=\"there is no previous page\">\n" +
                "<span class=\"arrow-disabled\" alt=\"previous page disabled\">&#x2190;</span>\n" +
                "</span>\n";
        }

        str += "<span class=\"pagination-text\" title=\"" + page_str + "\">" + page_str + "</span>\n";
        if (this.page + 1 < this.num_pages) {
            str += "<span class=\"next-page-box\" title=\"go to the next page\" onclick=\"simsage.next_page()\">" +
                "<span class=\"arrow-enabled\" alt=\"next page\">&#x2192;</span>\n" +
                "</span>\n";
        } else {
            str += "<span class=\"next-page-box-disabled\" title=\"there is no next page\">" +
                "<span class=\"arrow-disabled\" alt=\"next page disabled\">&#x2192;</span>\n" +
                "</span>\n";
        }

        str += "<span class=\"view-type-box\">\n";

        // sorting if this is a database
        if (this.is_custom_render && simsage_sort_list.length > 0) {
            str += "<span class=\"sort-text\" title=\"sort by\">\n" +
                "<label>\n" +
                "<select name=\"sort-by\" class=\"sort-select dd-sort\" tabindex=\"0\" onchange=\"simsage.do_change_sort()\" title=\"set the sort order of results\">\n";
            for (let i in simsage_sort_list) {
                if (simsage_sort_list.hasOwnProperty(i)) {
                    let sort = simsage_sort_list[i];
                    str += "<option value=\"" + i + "\" " + (sort.selected ? "selected" : "") + ">" + sort.name + "</option>\n";
                }
            }
            str += "</select><span class=\"dd-chevron\" title=\"please click on the text\">&#x2304;</span>\n" +
                "</label>\n" +
                "</span>\n";
        }

        if (!this.is_custom_render && this.selected_view === "text") {
            str += "<span class=\"pagination-text view-results-as-box\" title=\"view results as\">View results as: </span>\n";
            str +=
                "<span class=\"view-text-outer-box text-view\" tabindex=\"0\" title=\"text view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"simsage.select_text_view()\">\n" +
                "<span class=\"view-text-box\">&nbsp;&#x1f5b9;</span>\n" +
                "<span class=\"view-results-as-text\">Text</span>\n" +
                "</span>\n";

            str +=
                "<span class=\"view-images-box-disabled image-view\" tabindex=\"0\" title=\"image view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"simsage.select_image_view()\">\n" +
                "<span class=\"view-image-box-disabled\">&nbsp;&#x1f5bb;</span>\n" +
                "<span class=\"view-results-as-text-disabled\">Image</span>\n" +
                "</span>\n";
        } else if (!this.is_custom_render) {
            str += "<span class=\"pagination-text view-results-as-box\" title=\"view results as\">View results as: </span>\n";
            str +=
                "<span class=\"view-text-outer-box-disabled text-view\" tabindex=\"0\" title=\"text view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"simsage.select_text_view()\">\n" +
                "<span class=\"view-text-box-disabled\">&nbsp;&#x1f5b9;</span>\n" +
                "<span class=\"view-results-as-text-disabled\">Text</span>\n" +
                "</span>\n";

            str +=
                "<span class=\"view-images-box image-view\" tabindex=\"0\" title=\"image view\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"simsage.select_image_view()\">\n" +
                "<span class=\"view-image-box\">&nbsp;&#x1f5bb;</span>\n" +
                "<span class=\"view-results-as-text\">Image</span>\n" +
                "</span>\n";
        }

        str += "</span>\n";
        jQuery(".pagination-box").html(str);
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// chat control button and text dialog
//

let chat_control = {

    // async chat sockets
    is_ws_connected: false,                        // connected to endpoint?
    stompClient: null,                          // the connection

    close_chat: function() {
        jQuery(".operator-chat-box-view").hide();
    },

    show_chat: function() {
        let ctrl = jQuery(".operator-chat-box-view");
        if (ctrl.is(":visible")) {
            ctrl.hide();
        } else {
            ctrl.show();
        }
    },

    do_chat: function() {
        let ctrl = jQuery(".chat-text");
        let text = ctrl.val();
        let self = this;
        if (this.kb && text.trim().length > 0) {
            let data = {
                organisationId: this.organisationId,
                kbList: [this.kb.id],
                clientId: this.get_client_id(),
                assignedOperatorId: this.assigned_operator_id,
                text: text,
            };
            // add an entry into the chat_list
            this.chat_list.push({
                timeStamp: new Date().getTime(),
                isSimSage: false,
                text: text,
                urlList: [],
            });
            ctrl.val("");
            this.update_chat_window();
            this.post_message('/api/ops/client/chat', data, function(data) {
                self.receive_ws_data(data);
            });
        }
    },

    user_is_typing: function() {
        let now = new Date().getTime();
        if (this.assigned_operator_id && this.assigned_operator_id.length > 0 && this.client_typing_last_seen < now) {
            this.client_typing_last_seen = now + this.typing_repeat_timeout;
            let data = {
                fromId: this.get_client_id(),
                toId: this.assigned_operator_id,
                isTyping: true
            };
            simsage.post_message('/api/ops/typing', data, function(data) {
            });
        }
    },

    chat_typing: function(event) {
        let ctrl = jQuery(".chat-text");
        let button = jQuery(".chat-button-control");
        if (ctrl.val().trim().length === 0) {
            button.removeClass("chat-button");
            button.addClass("chat-button-disabled");
        } else {
            if (event.keyCode === 13) {
                button.removeClass("chat-button");
                button.addClass("chat-button-disabled");
                this.do_chat();
            } else {
                button.removeClass("chat-button-disabled");
                button.addClass("chat-button");
                this.user_is_typing();
            }
        }
    },

    operator_was_typing: function(is_typing) {
        let now = new Date().getTime();
        if (is_typing) {
            this.operator_typing_last_seen = now + this.typing_timeout;
            if (!this.operator_typing && is_typing) {
                this.operator_typing = is_typing;
                this.update_chat_window();
            }
        } else if (this.operator_typing_last_seen < now  && this.operator_typing) {
            this.operator_typing = false;
            this.update_chat_window();
        }
    },

    // render an operator part of the conversation
    render_chat: function(chat) {
        let time_str = chat.timeStamp ? simsage.unix_time_convert(chat.timeStamp) : "";
        if (chat.isSpecialMessage) {
            return "<div class=\"disconnected-box\">\n" +
                "<div class=\"disconnected-line\">\n" +
                "<span class=\"disconnected-label\">" + this.esc_html(chat.text) + "</span>\n" +
                "<span class=\"hyphen\">-</span>\n" +
                "<span class=\"time\">" + time_str + "</span>\n" +
                "</div>\n" +
                "</div>\n";
        } else {
            let text_str = this.esc_html(chat.text ? chat.text : "");
            if (chat.isSimSage) {
                let operator_name = this.operator_name ? this.operator_name : "Operator";
                let url_str = "";
                if (chat.urlList) {
                    for (let j in chat.urlList) {
                        if (chat.urlList.hasOwnProperty(j)) {
                            let url = this.esc_html(chat.urlList[j]);
                            url_str += "<div class=\"url\" title=\"" + url + "\" onclick=\"window.open('" + url + "', '_blank');\">" + url + "</div>\n"
                        }
                    }
                }
                return "<div class=\"operator-box\">\n" +
                    "<div class=\"operator-line\">\n" +
                    "<span class=\"operator-label\">" + operator_name + "</span>\n" +
                    "<span class=\"hyphen\">-</span>\n" +
                    "<span class=\"time\">" + time_str + "</span>\n" +
                    "</div>\n" +
                    "<div class=\"operator-text-box\">\n" +
                    "<div class=\"operator-text\">" + text_str + "</div>\n" +
                    url_str +
                    "</div>\n" +
                    "</div>\n";
            } else {
                return "<div class=\"user-box\">\n" +
                    "<div class=\"user-line\">\n" +
                    "<span class=\"user-label\">You</span>\n" +
                    "<span class=\"hyphen\">-</span>\n" +
                    "<span class=\"time\">" + time_str + "</span>\n" +
                    "</div>\n" +
                    "<div class=\"user-text\">" + text_str + "</div>\n" +
                    "</div>\n";
            }
        }
    },

    render_typing_dots: function() {
        return "<div class=\"left-box-white\">\n" +
            "<span class=\"typing-dots-box\"><span class=\"typing-dots-image\">&#x20db;</span></span>\n" +
            "</div>\n";
    },

    render_chats: function() {
        let str = "";
        for (let i in this.chat_list) {
            if (this.chat_list.hasOwnProperty(i)) {
                str += this.render_chat(this.chat_list[i]);
            }
        }
        if (this.operator_typing) {
            str += this.render_typing_dots();
        }
        return str;
    },

    update_chat_window: function() {
        let ctrl = jQuery(".chat-table");
        ctrl.html(this.render_chats());
        // scroll to bottom of chat window to make the most recent message visible
        ctrl.animate({scrollTop: ctrl.prop("scrollHeight")}, 10);
    },

    // show or hide the chat button with the visible flag
    show_chat_button: function(has_operator, has_chat_messages) {
        this.nop();
        if (has_operator || has_chat_messages) {
            jQuery(".chat-button-at-bottom").show();
            // so we no longer have an operator, but have some history in the chat
            // just disable the button - change its colour
            let cc = jQuery(".chat-container");
            let cwu = jQuery(".chat-with-us-text");
            let ci = jQuery(".chat-with-us-image");
            let cwit = jQuery(".chat-with-us-online");
            if (!has_operator) {
                cc.removeClass("online");
                cc.addClass("offline");
                cwu.removeClass("chat-with-us-text-box-online");
                cwu.addClass("chat-with-us-text-box-online-disabled");
                ci.removeClass("chat-with-us-image-white");
                ci.addClass("chat-with-us-image-grey");
                cwit.attr("title", "all Operators offline");
            } else {
                cc.addClass("online");
                cc.removeClass("offline");
                cwu.addClass("chat-with-us-text-box-online");
                cwu.removeClass("chat-with-us-text-box-online-disabled");
                ci.addClass("chat-with-us-image-white");
                ci.removeClass("chat-with-us-image-grey");
                cwit.attr("title", "Chat with us");
            }
        } else {
            jQuery(".chat-button-at-bottom").hide();
        }
    },

    // connect to SimSage for async-socket chat
    connect_ws: function() {
        if (!this.is_ws_connected) {
            let self = this;
            // this is the socket end-point
            let ws_base = this.base_url + '/ws-api';
            let socket = new SockJS(ws_base);
            this.stompClient = Stomp.over(socket);
            this.stompClient.connect({},
                function () {
                    self.stompClient.subscribe('/chat/' + self.get_client_id(), function (answer) {
                        self.receive_ws_data(JSON.parse(answer.body));
                    });
                    self.set_ws_connected(true);
                },
                function(err) {
                    console.error(err);
                    self.set_ws_connected(false);
                });
        }
    },

    // set the connection status of the chat system - and try and reconnect on fail
    set_ws_connected: function(is_ws_connected) {
        this.is_ws_connected = is_ws_connected;
        let self = this;
        if (!is_ws_connected) {
            if (this.stompClient !== null) {
                this.stompClient.disconnect();
                this.stompClient = null;
            }
            if (this.connection_retry_count > 1) {
                this.error('not connected, trying to re-connect, please wait (try ' + this.connection_retry_count + ')');
            }
            setTimeout(self.connect_ws, 5000); // try and re-connect as a one-off in 5 seconds
            this.connection_retry_count += 1;

        } else {
            this.error('');
            this.connection_retry_count = 1;
            this.stompClient.debug = null;
        }
    },

    // overwrite: generic web socket receiver
    receive_ws_data: function(data) {
        this.busy(false);
        if (data) {
            if (data.messageType === this.mt_Error && data.error.length > 0) {
                this.error(data.error);  // set an error

            } else if (data.messageType === this.mt_Disconnect) {
                this.assigned_operator_id = ''; // disconnect any operator
                this.operator_name = '';
                this.operator_typing = false;
                // add disconnected message if we've been typing
                if (this.chat_list && this.chat_list.length > 0) {
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: "operator disconnected"
                    });
                }
                this.update_chat_window();

            } else if (data.messageType === this.mt_Email) {
                this.know_email = true;

            } else if (data.messageType === this.mt_SignIn) {
                if (data.errorMessage && data.errorMessage.length > 0) {
                    error(data.errorMessage);  // set an error
                    this.signed_in = false;
                } else {
                    // sign-in successful
                    this.signed_in = true;
                    this.sign_in_status(true);
                }
                // todo: show we have signed in

            } else if (data.messageType === this.mt_IsTyping) {
                this.operator_was_typing(true);

            } else if (data.messageType === this.mt_SignOut) {
                if (data.errorMessage && data.errorMessage.length > 0) {
                    this.error(data.errorMessage);  // set an error
                } else {
                    // sign-in successful
                    this.signed_in = false;
                    this.sign_in_status(false);
                }

            } else if (data.messageType === this.mt_OperatorAvailable) {
                // we're notified about a change in availability of the number of operators
                this.operator_count = data.operatorCount;
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                }
                this.show_chat_button(this.operator_count > 0 || (this.assigned_operator_id && this.assigned_operator_id.length > 0),
                    this.chat_list.length > 0);

            } else if (data.messageType === this.mt_OperatorChat) {
                // we're notified about a change in availability of the number of operators
                this.operator_count = data.operatorCount;
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                    if (data.operatorName) {
                        this.operator_name = data.operatorName;
                    } else {
                        this.operator_name = '';
                    }
                } else {
                    // no available operators
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSpecialMessage: true,
                        text: "no operators available"
                    });
                }
                this.update_chat_window();
                this.show_chat_button(this.operator_count > 0 || (this.assigned_operator_id && this.assigned_operator_id.length > 0),
                    this.chat_list.length > 0);

            } else if (data.messageType === this.mt_OperatorMessage) {

                // set the assigned operator
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                }
                // add an entry into the chat_list
                if (data.text && data.text.length > 0) {
                    this.chat_list.push({
                        timeStamp: new Date().getTime(),
                        isSimSage: true,
                        text: data.text,
                        urlList: [],
                    });
                    this.operator_typing = false;
                    this.update_chat_window();
                }

            } else if (data.messageType === this.mt_Message) {
                this.is_typing = false;
                // set the assigned operator
                if (data.assignedOperatorId && data.assignedOperatorId.length > 0) {
                    this.assigned_operator_id = data.assignedOperatorId;
                    if (data.operatorName) {
                        this.operator_name = data.operatorName;
                    } else {
                        this.operator_name = '';
                    }
                }
                // copy the know email flag from our results
                if (!this.know_email && data.knowEmail) {
                    this.know_email = data.knowEmail;
                }
            }
        }
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// render search results
//

let search_results_control = {

    show_search_results: function() {
        jQuery(".search-results").show();
        jQuery(".search-display").show();
        this.close_no_search_results();
    },

    hide_search_results: function() {
        if (!this.is_custom_render) {
            jQuery(".search-display").hide();
        } else {
            // just empty the search results if this is a db display
            jQuery(".search-results-text").html("");
        }
    },

    prev_fragment: function(id) {
        if (this.semantic_search_result_map_id && this.semantic_search_result_map_id.hasOwnProperty(id)) {
            let result = this.semantic_search_result_map_id[id];
            if (result && result.textIndex > 0) {
                result.textIndex -= 1;
                this.render_search_results();
            }
        }
    },

    next_fragment: function(id) {
        if (this.semantic_search_result_map_id && this.semantic_search_result_map_id.hasOwnProperty(id)) {
            let result = this.semantic_search_result_map_id[id];
            if (result && result.textIndex + 1 < result.textList.length) {
                result.textIndex += 1;
                this.render_search_results();
            }
        }
    },

    render_single_text_search_result: function(id, url, title, fragment, fragment_index, num_fragments) {
        let str = "<div class=\"search-result\">\n" +
            "<div title=\"visit [url]\" class=\"search-text-width\">\n" +
            "<a href=\"[url]\" target=\"_blank\"><span class=\"url-text\">[split-url]</span></a>\n" +
            "<div title=\"visit [url]\" onclick=\"visit_url('[url]');\" class=\"more-details\"><span class=\"title-text\">[title]</span></div>\n" +
            "<div><span class=\"result-text\">[fragment]</span></div>\n" +
            "<div class=\"navigate-td\">\n";
        if (fragment_index > 0) {
            str += "<span class=\"navigate-left\" tabindex=\"0\" title=\"view the previous relevant fragment in this document\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"simsage.prev_fragment([id]);\"><span class=\"navigate-image\">&#x2039;</span></span>\n";
        } else {
            str += "<span class=\"no-navigate-left\" tabindex=\"0\" title=\"there is no previous fragment in this document\"><span class=\"navigate-image-disabled\">&#x2039;</span></span>\n";
        }
        if ((fragment_index + 1) < num_fragments) {
            str += "<span class=\"navigate-right\" tabindex=\"0\" title=\"view the next relevant fragment in this document\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"simsage.next_fragment([id]);\"><span class=\"navigate-image\">&#x203a;</span></span>\n";
        } else {
            str += "<span class=\"no-navigate-right\" tabindex=\"0\" title=\"there is no next fragment in this document\"><span class=\"navigate-image-disabled\">&#x203a;</span></span>\n";
        }
        str += "<span class=\"navigate-text\" title=\"Scroll through other relevant search results on this page\">Scroll through other relevant search results on this page</span>\n" +
            "</div>\n" +
            "</div>\n" +
            "<div title=\"view more details\" onkeyup=\"if (activation(event)) this.onclick()\" onclick=\"simsage.show_search_details_by_id([id]);\" tabindex=\"0\" class=\"search-image-width\">\n" +
            "<img src=\"[thumbnail_src]\" alt=\"[title]\" class=\"result-image\"/>\n" +
            "</div>\n" +
            "</div>\n";
        let fragment_str = this.esc_html(fragment)
            .replace(/{hl1:}/g, "<span class='hl1'>")
            .replace(/{:hl1}/g, "</span>")
            .replace(/{hl2:}/g, "<span class='hl2'>")
            .replace(/{:hl2}/g, "</span>");
        str = str
            .replace(/\[url]/g, this.esc_html(url))
            .replace(/\[split-url]/g, this.esc_html(url))
            .replace(/\[id]/g, this.esc_html(id))
            .replace(/\[thumbnail_src]/g, this.get_preview_url() + '/' + this.esc_html(id) + '/-1')
            .replace(/\[title]/g, title && title.length > 0 ? this.esc_html(title) : "(no title)")
            .replace(/\[fragment]/g, fragment_str);
        return str;
    },

    // Render a single search-database result
    render_single_search_db_result: function(id, url, title, html) {
        return html;
    },

    // render a single image result
    render_single_image_search_result: function(id, url, title) {
        let str = "<div class=\"image-result\">" +
            "<div class=\"image-image\" title=\"[title]\" onclick=\"simsage.show_search_details_by_id([id]);\">\n" +
            "<img src=\"[thumbnail_src]\" alt=\"image\" class=\"result-image-image\"/>\n" +
            "</div>\n" +
            "<div class=\"image-text\" title=\"[title]\" onclick=\"simsage.show_search_details_by_id([id]);\">\n" +
            "[title-short]\n" +
            "</div>\n" +
            "</div>\n";
        let title_short = simsage.adjust_size(title, 40);
        str = str
            .replace(/\[url]/g, url)
            .replace(/\[id]/g, id)
            .replace(/\[thumbnail_src]/g, this.get_preview_url() + '/' + id + '/0')
            .replace(/\[title-short]/g, title_short && title_short.length > 0 ? title_short : "(no title)")
            .replace(/\[title]/g, title && title.length > 0 ? title : "(no title)");
        return str;
    },

    get_url_id_from_url: function(url) {
        if (this.semantic_search_result_map.hasOwnProperty(url)) {
            let sr = this.semantic_search_result_map[url];
            if (sr && sr.url === url) {
                return sr.urlId;
            }
        }
        return 0;
    },

    get_image_url_by_doc_url: function(url) {
        // set the image for this item
        let urlId = this.get_url_id_from_url(url);
        return this.base_url + "/api/document/preview/" +
            this.organisationId + "/" + this.kb.id + "/" +
            this.get_client_id() + "/" + urlId + "/-1";
    },

    // update images from ids, ratings, and search result highlighting in records
    update_database_gui: function() {
        let self = this;
        jQuery("div.db-record-rating").each(function() {
            // Get the value
            let val = parseFloat(jQuery(this).html());
            // Make sure that the value is in 0 - 5 range, multiply to get width
            let size = Math.floor(Math.max(0, (Math.min(5, val))));
            let starStr = "";
            for (let i = size; i < 5; i++) {
                starStr += "&#x2606;"
            }
            for (let i = 0; i < size; i++) {
                starStr += "&#x2605;"
            }
            // Replace the numerical value with stars
            jQuery(this).html(starStr);
        });
        jQuery("div.db-record-price").each(function() {
            let val = parseFloat(jQuery(this).html().trim());
            if (val === Math.floor(val)) {
                val = val * 0.01;
            }
            // Replace the numerical value with stars
            $(this).html(this.currency_symbol + val.toFixed(2));
        });
        jQuery("div.db-image").each(function() {
            let val = jQuery(this).html().trim();
            let url = self.get_image_url_by_doc_url(val);
            $(this).html("<img src='" + url + "' class='db-image-size' alt='image'/>");
        });
        // fill in span hl1 and hl2
        jQuery(".search-results-text").each(function() {
            let val = jQuery(this).html().trim();
            val = val.replace(/{hl1:}/g, "<span class='hl1'>");
            val = val.replace(/{:hl1}/g, "</span>");
            val = val.replace(/{hl2:}/g, "<span class='hl2'>");
            val = val.replace(/{:hl2}/g, "</span>");
            jQuery(this).html(val);
        });
    },

    clear_search_results: function() {
        jQuery(".search-results").hide();
        jQuery(".search-results-td").html("");
    },

    // return some hard-wired search results - repeated
    render_search_results: function() {
        if (this.is_custom_render) {
            // render a set of DB records
            let reverse_list = this.semantic_search_results; // JSON.parse(JSON.stringify(simsage.semantic_search_results.reverse()));
            let str = "";
            for (let i in reverse_list) {
                if (reverse_list.hasOwnProperty(i)) {
                    let result = reverse_list[i];
                    if (result.url && result.textList && result.textList.length > 0) {
                        str += this.render_single_search_db_result(result.urlId, result.url, result.title, result.textList[0]);
                    }
                }
            }
            jQuery(".search-results-td").html(str);

        } else if (this.selected_view === "text") {

            let str = "";
            for (let i in this.semantic_search_results) {
                if (this.semantic_search_results.hasOwnProperty(i)) {
                    let result = this.semantic_search_results[i];
                    if (result.url) {
                        str += this.render_single_text_search_result(result.urlId, result.url, result.title,
                            result.textList[result.textIndex], result.textIndex, result.textList.length);
                    }
                }
            }
            jQuery(".search-results-td").html(str);

        } else {
            let str = "";
            for (let i in this.semantic_search_results) {
                if (this.semantic_search_results.hasOwnProperty(i)) {
                    let result = this.semantic_search_results[i];
                    if (result.url) {
                        str += this.render_single_image_search_result(result.urlId, result.url, result.title);
                    }
                }
            }
            str += "<div class=\"end-marker-images\"></div>\n";
            jQuery(".search-results-td").html(str);
        }
        this.update_database_gui();
        this.render_pagination();
    },

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// the no-results handling
//

let domain_control = {

    signed_in: false, // are we signed into a domain or something?

    do_change_domain: function() {
        // // what type of domain is this?
        // let domainType = "";
        // let domain_list = simsage.getDomainListForCurrentKB();
        // for (let domain of domain_list) {
        //     if (domain.sourceId == simsage.sourceId) {
        //         domainType = domain.domainType;
        //         break;
        //     }
        // }
        // let div_email = document.getElementById("divEmail");
        // let div_password = document.getElementById("divPassword");
        // let txt_email = document.getElementById("txtEmail");
        //
        // if (domainType === "aad") { // office365
        //     div_email.style.display = "none";
        //     div_password.style.display = "none";
        // } else {
        //     div_email.style.display = "";
        //     div_password.style.display = "";
        //     if (domainType === "simsage") {
        //         txt_email.placeholder = 'SimSage username';
        //     } else {
        //         txt_email.placeholder = 'Active-Directory username';
        //     }
        //     txt_email.focus();
        // }
    },

    show_sign_in: function() {
        if (this.source) {
            jQuery(".sign-in-title").html("sign-in to \"" +
                this.esc_html(this.source.name) + ", " +
                this.esc_html(this.source.domainType) + "\"");
            jQuery(".search-sign-in").show();
        }
    },

    // get or create a session based client id for SimSage usage
    set_office365_user: function(data) {
        let key = 'simsearch_office_365_user';
        let hasLs = simsage.has_local_storage();
        if (hasLs) {
            let to = simsage.session_timeout_in_mins * 60000;
            data.expiry = new Date().getTime() + to; // 1 hour timeout
            localStorage.setItem(key, JSON.stringify(data));
        }
    },

    // get or create a session based client id for SimSage usage
    remove_office365_user: function() {
        let key = 'simsearch_office_365_user';
        let hasLs = simsage.has_local_storage();
        if (hasLs) {
            localStorage.removeItem(key);
        }
    },

    // do the actual sign-in
    do_sign_in: function() {
        let self = this;
        if (this.source) {
            let user_name = jQuery(".sign-in-user-name").val();
            let password = jQuery(".sign-in-password").val();
            let domain = { sourceId: this.source.id, domain: this.source.name, domain_type: this.source.domainType };
            if (domain.domainType === 'aad') { // azure ad
                let user = this.get_office365_user();
                if (!user) {
                    // do we already have the code to sign-in?
                    let urlParams = new URLSearchParams(window.location.search);
                    let code = urlParams.get('code');
                    if (!code) {
                        window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=' +
                            domain.clientId + '&response_type=code&redirect_uri=' +
                            encodeURIComponent(domain.redirectUrl) + '&scope=User.ReadBasic.All+offline_access+openid+profile' +
                            '&state=' + this.get_client_id();
                    } else {
                        // login this user, using the code
                        this.setup_office_365_user();
                    }
                } else {
                    // we have a user - assume the client wants to sign-out
                    this.remove_office365_user();
                    this.signed_in = false;
                    this.error('');
                }
            } else if (user_name && user_name.length > 0 && password && password.length > 0 && this.kb) {
                this.busy(true);
                this.error('');
                let adSignInData = {
                    'organisationId': this.organisationId,
                    'kbList': [this.kb.id],
                    'clientId': this.get_client_id(),
                    'sourceId': this.source.id,
                    'userName': user_name,
                    'password': password,
                };
                simsage.post_message('/api/ops/ad/sign-in', adSignInData, function (data) {
                    self.receive_ws_data(data, false);
                });
            }
        }
    },

    do_sign_out: function() {
        let self = this;
        this.error('');
        if (this.kb && this.source) {
            this.busy(true);
            this.remove_office365_user();
            let signOutData = {
                'organisationId': this.organisationId,
                'kbList': [this.kb.id],
                'clientId': this.get_client_id(),
                'sourceId': this.source.id,
            };
            this.post_message('/api/ops/ad/sign-out', signOutData, function (data) {
                self.receive_ws_data(data);
            });
        }
    },

}

/*global Ext:false */
/*global $:false */
/*global jQuery:false */
/*global OpenLayers:false */
/*global ol:false */
/*global L:false */
/*global google:false */
/*global GeoExt:false */
/*global mygeocloud_ol:false */
/*global schema:false */
/*global document:false */
/*global window:false */

var geocloud;
geocloud = (function () {
    "use strict";
    var scriptSource = (function (scripts) {
            scripts = document.getElementsByTagName('script');
            var script = scripts[scripts.length - 1];
            if (script.getAttribute.length !== undefined) {
                return script.src;
            }
            return script.getAttribute('src', -1);
        }()),
        map,
        storeClass,
        extend,
        geoJsonStore,
        sqlStore,
        tweetStore,
        elasticStore,
        tileLayer,
        createTileLayer,
        clickEvent,
        transformPoint,
        MAPLIB,
        host,
        OSM = "osm",
        MAPQUESTOSM = "mapQuestOSM",
        MAPBOXNATURALEARTH = "mapBoxNaturalEarth",
        STAMENTONER = "stamenToner",
        GOOGLESTREETS = "googleStreets",
        GOOGLEHYBRID = "googleHybrid",
        GOOGLESATELLITE = "googleSatellite",
        GOOGLETERRAIN = "googleTerrain",
        BINGROAD = "bingRoad",
        BINGAERIAL = "bingAerial",
        BINGAERIALWITHLABELS = "bingAerialWithLabels",
        DTKSKAERMKORT = "dtkSkaermkort",
        DTKSKAERMKORTDAEMPET = "dtkSkaermkortDaempet",
        DIGITALGLOBE = "DigitalGlobe:Imagery",
        attribution = (window.mapAttribution === undefined) ? "Powered by <a href='http://geocloud.mapcentia.com'>MapCentia</a> " : window.mapAttribution;

    // Try to set host from script
    if (typeof window.geocloud_host === "undefined") {
        window.geocloud_host = host = (scriptSource.charAt(0) === "/") ? "" : scriptSource.split("/")[0] + "//" + scriptSource.split("/")[2];
    }
    host = window.geocloud_host;
    if (typeof ol !== "object" && typeof L !== "object" && typeof OpenLayers !== "object") {
        alert("You need to load neither OpenLayers.js, ol3,js or Leaflet.js");
    }
    if (typeof OpenLayers === "object") {
        MAPLIB = "ol2";
    }
    if (typeof ol === "object") {
        MAPLIB = "ol3";
    }
    if (typeof L === "object") {
        MAPLIB = "leaflet";
    }
    if (document.readyState === "loading") {
        if (typeof jQuery === "undefined") {
            document.write("<script src='https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js'><\/script>");
        }
    }
    // Helper for extending classes
    extend = function (ChildClass, ParentClass) {
        ChildClass.prototype = new ParentClass();
    };
    // Base class for stores
    storeClass = function () {
        this.defaults = {
            styleMap: null,
            visibility: true,
            lifetime: 0,
            host: host,
            db: null,
            sql: null,
            q: null,
            name: "Vector",
            id: null,
            rendererOptions: { zIndexing: true },
            projection: (MAPLIB === "leaflet") ? "4326" : "900913",
            //Only leaflet
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng);
            },
            //Only leaflet
            onEachFeature: function () {
            },
            onLoad: function () {
            },
            index: "",
            type: "",
            size: 3,
            clientEncoding: "UTF8"
        };
        this.hide = function () {
            this.layer.setVisibility(false);
        };
        this.show = function () {
            this.layer.setVisibility(true);
        };
        this.map = null;

        // Initiate base class settings
        this.init = function () {
            this.onLoad = this.defaults.onLoad;
            switch (MAPLIB) {
                case 'ol2':
                    this.layer = new OpenLayers.Layer.Vector(this.defaults.name, {
                        styleMap: this.defaults.styleMap,
                        visibility: this.defaults.visibility,
                        renderers: ['Canvas', 'SVG', 'VML'],
                        rendererOptions: this.defaults.rendererOptions
                    });
                    break;
                case 'ol3':
                    this.layer = new ol.layer.Vector({
                        source: new ol.source.GeoJSON(),
                        style: this.defaults.styleMap
                    });
                    this.layer.id = this.defaults.name;
                    break

                case 'leaflet':
                    this.layer = L.geoJson(null, {
                        style: this.defaults.styleMap,
                        pointToLayer: this.defaults.pointToLayer,
                        onEachFeature: this.defaults.onEachFeature
                    });
                    this.layer.id = this.defaults.name;
                    break;
            }
        };
        this.geoJSON = {};
        this.featureStore = null;
        this.reset = function () {
            switch (MAPLIB) {
                case "ol2":
                    this.layer.destroyFeatures();
                    break;
                case "leaflet":
                    this.layer.clearLayers();
                    break;
            }
        };
        this.isEmpty = function () {
            switch (MAPLIB) {
                case "ol2":
                    return (this.layer.features.length === 0) ? true : false;
                    break;
                case "leaflet":
                    return (Object.keys(this.layer._layers).length === 0) ? true : false;
                    break;
            }
        };
        this.getWKT = function () {
            return new OpenLayers.Format.WKT().write(this.layer.features);
        };
    };
    geoJsonStore = sqlStore = function (config) {
        var prop, me = this, map, sql;
        if (config) {
            for (prop in config) {
                this.defaults[prop] = config[prop];
            }
        }
        this.init();
        this.id = this.defaults.id;
        this.sql = this.defaults.sql;
        this.db = this.defaults.db;
        this.load = function (doNotShowAlertOnError) {
            var url = this.defaults.host.replace("cdn.", "");
            try {
                map = me.map;
                sql = this.sql;
                sql = sql.replace("{centerX}", map.getCenter().lat.toString());
                sql = sql.replace("{centerY}", map.getCenter().lon.toString());
                sql = sql.replace("{minX}", map.getExtent().left);
                sql = sql.replace("{maxX}", map.getExtent().right);
                sql = sql.replace("{minY}", map.getExtent().bottom);
                sql = sql.replace("{maxY}", map.getExtent().top);
                sql = sql.replace("{bbox}", map.getExtent().toString());
            } catch (e) {
            }
            $.ajax({
                dataType: 'jsonp',
                data: 'q=' + encodeURIComponent(sql) + '&srs=' + this.defaults.projection + '&lifetime=' + this.defaults.lifetime + "&srs=" + this.defaults.projection + '&client_encoding=' + this.defaults.clientEncoding,
                jsonp: 'jsonp_callback',
                url: url + '/api/v1/sql/' + this.db,
                success: function (response) {
                    if (response.success === false && doNotShowAlertOnError === undefined) {
                        alert(response.message);
                    }
                    if (response.success === true) {
                        if (response.features !== null) {
                            me.geoJSON = response;
                            switch (MAPLIB) {
                                case "ol2":
                                    me.layer.addFeatures(new OpenLayers.Format.GeoJSON().read(response));
                                    break;
                                case "ol3":
                                    me.layer.getSource().addFeatures(new ol.source.GeoJSON(
                                        {
                                            object: response.features[0]
                                        }
                                    ));

                                    break;
                                case "leaflet":
                                    me.layer.addData(response);
                                    break;
                            }
                        }
                    }
                },
                complete: function () {
                    me.onLoad();
                }

            });
            return this.layer;
        };
    };
    tweetStore = function (config) {
        var prop, me = this;
        if (config) {
            for (prop in config) {
                this.defaults[prop] = config[prop];
            }
        }
        this.init();
        this.load = function (doNotShowAlertOnError) {
            var q = this.defaults.q;
            try {
                var map = me.map;
                //q = q.replace("{centerX}", map.getCenter().lat.toString());
                // = q.replace("{centerY}", map.getCenter().lon.toString());
                q = q.replace(/\{minX\}/g, map.getExtent().left);
                q = q.replace(/\{maxX\}/g, map.getExtent().right);
                q = q.replace(/\{minY\}/g, map.getExtent().bottom);
                q = q.replace(/\{maxY\}/g, map.getExtent().top);
                q = q.replace(/{bbox}/g, map.getExtent().toString());
            } catch (e) {
            }
            $.ajax({
                dataType: 'jsonp',
                data: 'search=' + encodeURIComponent(q),
                jsonp: 'jsonp_callback',
                url: this.defaults.host + '/api/v1/twitter/' + this.db,
                success: function (response) {
                    if (response.success === false && doNotShowAlertOnError === undefined) {
                        alert(response.message);
                    }
                    if (response.success === true) {
                        if (response.features !== null) {
                            me.geoJSON = response;
                            switch (MAPLIB) {
                                case "ol2":
                                    me.layer.addFeatures(new OpenLayers.Format.GeoJSON().read(response));
                                    break;
                                case "leaflet":
                                    me.layer.addData(response);
                                    break;
                            }
                        }
                    }
                },
                complete: function () {
                    me.onLoad();
                }
            });
            return this.layer;
        };
    };
    elasticStore = function (config) {
        var prop, me = this;
        if (config) {
            for (prop in config) {
                this.defaults[prop] = config[prop];
            }
        }
        this.init();
        this.q = this.defaults.q;
        this.load = function (doNotShowAlertOnError) {
            var map = me.map, q = this.q;
            try {
                //q = q.replace("{centerX}", map.getCenter().lat.toString());
                //q = q.replace("{centerY}", map.getCenter().lon.toString());
                q = q.replace("{minX}", map.getExtent().left);
                q = q.replace("{maxX}", map.getExtent().right);
                q = q.replace("{minY}", map.getExtent().bottom);
                q = q.replace("{maxY}", map.getExtent().top);
                q = q.replace("{bbox}", map.getExtent().toString());
            } catch (e) {
            }

            $.ajax({
                dataType: 'jsonp',
                data: 'q=' + encodeURIComponent(q) + "&size=" + this.defaults.size,
                jsonp: 'jsonp_callback',
                url: this.defaults.host + '/api/v1/elasticsearch/search/' + this.defaults.db + "/" + this.defaults.index + "/" + this.defaults.type,
                success: function (response) {
                    var features = [];
                    $.each(response.hits.hits, function (i, v) {
                        features.push(v._source);
                    });
                    response.features = features;
                    if (response.features !== null) {
                        me.geoJSON = response;
                        switch (MAPLIB) {
                            case "ol2":
                                me.layer.addFeatures(new OpenLayers.Format.GeoJSON().read(response));
                                break;
                            case "leaflet":
                                me.layer.addData(response);
                                break;
                        }
                    }

                },
                complete: function () {
                    me.onLoad();
                }
            });
            return this.layer;
        };
    };
    // Extend store classes
    extend(sqlStore, storeClass);
    extend(tweetStore, storeClass);
    extend(elasticStore, storeClass);

    //ol2, ol3 and leaflet
    tileLayer = function (config) {
        var prop;
        var defaults = {
            host: host,
            layer: null,
            db: null,
            singleTile: false,
            opacity: 1,
            wrapDateLine: true,
            tileCached: true,
            name: null,
            isBaseLayer: false
        };
        if (config) {
            for (prop in config) {
                defaults[prop] = config[prop];
            }
        }
        return createTileLayer(defaults.layer, defaults);
    };

    //ol2, ol3 and leaflet
    createTileLayer = function (layer, defaults) {
        var parts, l, url, urlArray;
        parts = layer.split(".");
        if (!defaults.tileCached) {
            url = defaults.host + "/wms/" + defaults.db + "/" + parts[0] + "?";
            urlArray = [url];
        } else {
            url = defaults.host + "/wms/" + defaults.db + "/tilecache";
            var url1 = url;
            var url2 = url;
            var url3 = url;
            // For ol2
            urlArray = [url1.replace("cdn.", "cdn1."), url2.replace("cdn.", "cdn2."), url3.replace("cdn.", "cdn3.")];
            // For leaflet
            url = url.replace("cdn.", "{s}.");
        }
        switch (MAPLIB) {
            case "ol2":
                l = new OpenLayers.Layer.WMS(defaults.name, urlArray, {
                    layers: layer,
                    transparent: true
                }, defaults);
                l.id = layer;
                break;
            case "ol3":
                l = new ol.layer.Tile({
                    source: new ol.source.TileWMS({
                        url: url,
                        params: {LAYERS: layer}
                    }),
                    visible: defaults.visibility
                });
                l.id = layer;
                break;
            case "leaflet":
                l = new L.TileLayer.WMS(url, {
                    layers: layer,
                    format: 'image/png',
                    transparent: true,
                    subdomains: ["cdn1", "cdn2", "cdn3"]

                });
                l.id = layer;
                break;
        }
        return l;
    };

    // Set map constructor
    map = function (config) {
        var prop, lControl, queryLayers = [],
            defaults = {
                numZoomLevels: 20,
                projection: "EPSG:900913"
            };
        if (config) {
            for (prop in config) {
                defaults[prop] = config[prop];
            }
        }
        // Load js and css
        if (MAPLIB === "leaflet") {
            // The css
            $('<link/>').attr({ rel: 'stylesheet', type: 'text/css', href: 'http://cdn.eu1.mapcentia.com/js/leaflet/leaflet.css' }).appendTo('head');
            $('<link/>').attr({ rel: 'stylesheet', type: 'text/css', href: 'http://cdn.eu1.mapcentia.com/js/leaflet/plugins/awesome-markers/leaflet.awesome-markers.css' }).appendTo('head');
        }
        $('<link/>').attr({ rel: 'stylesheet', type: 'text/css', href: 'http://eu1.mapcentia.com/api/v3/css/styles.css' }).appendTo('head');

        this.bingApiKey = null;
        this.digitalGlobeKey = null;
        //ol2, ol3
        // extent array
        this.zoomToExtent = function (extent, closest) {
            var p1, p2;
            switch (MAPLIB) {
                case "ol2":
                    if (!extent) {
                        this.map.zoomToExtent(this.map.maxExtent);
                    } else {
                        this.map.zoomToExtent(new OpenLayers.Bounds(extent), closest);
                    }
                    break;
                case "ol3":
                    if (!extent) {
                        this.map.getView().setCenter([0, 0]);
                        this.map.getView().setResolution(39136);
                    } else {
                        this.map.zoomToExtent(new OpenLayers.Bounds(extent), closest);
                    }
                    break;
                case "leaflet":
                    if (!extent) {
                        this.map.fitWorld();
                    }
                    else {
                        p1 = transformPoint(extent[0], extent[1], "EPSG:900913", "EPSG:4326");
                        p2 = transformPoint(extent[2], extent[3], "EPSG:900913", "EPSG:4326");
                        this.map.fitBounds([
                            [p1.y, p1.x],
                            [p2.y, p2.x]
                        ]);
                    }
                    break;
            }
        };
        this.zoomToExtentOfgeoJsonStore = function (store) {
            switch (MAPLIB) {
                case "ol2":
                    this.map.zoomToExtent(store.layer.getDataExtent());
                    break;
                case "leaflet":
                    this.map.fitBounds(store.layer.getBounds());
                    break;
            }
        };
        this.getBaseLayers = function () {
            var layerArr = [];
            switch (MAPLIB) {
                case "leaflet":
                    var layers = this.map._layers;
                    for (var key in layers) {
                        if (layers.hasOwnProperty(key)) {
                            if (layers[key].baseLayer === true) {
                                layerArr.push(layers);
                            }
                        }
                    }
                    break;
            }
            return layerArr;
        };
        //ol2, ol3 and leaflet
        this.getVisibleLayers = function () {
            var layerArr = [], i;
            switch (MAPLIB) {
                case "ol2":
                    for (i = 0; i < this.map.layers.length; i++) {
                        if (this.map.layers[i].isBaseLayer === false && this.map.layers[i].visibility === true && this.map.layers[i].CLASS_NAME === "OpenLayers.Layer.WMS") {
                            layerArr.push(this.map.layers[i].params.LAYERS);
                        }
                    }
                    break;
                case "ol3":
                    for (i = 0; i < this.map.getLayers().getLength(); i++) {

                        if (this.map.getLayers().a[i].e.visible === true && this.map.getLayers().a[i].baseLayer !== true) {
                            layerArr.push(this.map.getLayers().a[i].id);
                        }
                    }
                    break;
                case "leaflet":
                    var layers = this.map._layers;
                    for (var key in layers) {
                        if (layers.hasOwnProperty(key)) {
                            if (layers[key].baseLayer !== true && typeof layers[key]._tiles === "object") {
                                layerArr.push(layers[key].id);
                            }
                        }
                    }
                    break;
            }
            return layerArr.join(";");
        };
        //ol2, ol3 and leaflet
        this.getNamesOfVisibleLayers = function () {
            var layerArr = [], i;
            switch (MAPLIB) {
                case "ol2":
                    for (i = 0; i < this.map.layers.length; i++) {
                        if (this.map.layers[i].isBaseLayer === false && this.map.layers[i].visibility === true && this.map.layers[i].CLASS_NAME === "OpenLayers.Layer.WMS") {
                            layerArr.push(this.map.layers[i].name);
                        }
                    }
                    break;
                case "ol3":
                    for (i = 0; i < this.map.getLayers().getLength(); i++) {
                        if (this.map.getLayers().a[i].t.visible === true && this.map.getLayers().a[i].baseLayer !== true) {
                            layerArr.push(this.map.getLayers().a[i].id);
                        }
                    }
                    break;
                case "leaflet":
                    var layers = this.map._layers;
                    for (var key in layers) {
                        if (layers.hasOwnProperty(key)) {
                            if (layers[key].baseLayer !== true && typeof layers[key]._tiles === "object") {
                                layerArr.push(layers[key].id);
                            }
                        }
                    }
                    break;
            }
            if (layerArr.length > 0) {
                return layerArr.join(",");
            }
            else {
                return layerArr;
            }
        };
        //ol2
        this.getBaseLayer = function () {
            return this.map.baseLayer;
        };
        //ol2, ol3 and leaflet
        this.getBaseLayerName = function () {
            var name, layers;
            switch (MAPLIB) {
                case "ol2":
                    name = this.map.baseLayer.name;
                    break;
                case "ol3":
                    layers = this.map.getLayers();
                    for (var i = 0; i < layers.getLength(); i++) {
                        if (layers.a[i].t.visible === true && layers.a[i].baseLayer === true) {
                            name = this.map.getLayers().a[i].id;
                        }
                    }
                    break;
                case "leaflet":
                    layers = this.map._layers;
                    for (var key in layers) {
                        if (layers.hasOwnProperty(key)) {
                            if (layers[key].baseLayer === true) {
                                name = layers[key].id;
                            }
                        }
                    }
                    break;
            }
            return name;
        };
        //ol2, ol3 leaflet
        this.getZoom = function () {
            var zoom;
            switch (MAPLIB) {
                case "ol2":
                    zoom = this.map.getZoom();
                    break;
                case "ol3":
                    var resolution = this.getResolution();
                    zoom = Math.round(Math.log(2 * Math.PI * 6378137 / (256 * resolution)) / Math.LN2);
                    break;
                case "leaflet":
                    zoom = this.map.getZoom();
                    break;
            }
            return zoom;
        };
        //ol3
        this.getResolution = function () {
            return this.map.getView().getResolution();
        };
        //ol2
        this.getPixelCoord = function (x, y) {
            var p = {};
            p.x = this.map.getPixelFromLonLat(new OpenLayers.LonLat(x, y)).x;
            p.y = this.map.getPixelFromLonLat(new OpenLayers.LonLat(x, y)).y;
            return p;
        };
        //ol2, ol3 and leaflet
        // Input map coordinates (900913)
        this.zoomToPoint = function (x, y, r) {
            switch (MAPLIB) {
                case "ol2":
                    this.map.setCenter(new OpenLayers.LonLat(x, y), r);
                    break;
                case "ol3":
                    this.map.getView().setCenter([x, y]);
                    var resolution;
                    resolution = 2 * Math.PI * 6378137 / (256 * Math.pow(2, r));
                    this.map.getView().setResolution(resolution);
                    break;
                case "leaflet":
                    var p = transformPoint(x, y, "EPSG:900913", "EPSG:4326");
                    this.map.setView([p.y, p.x], r);
                    break;
            }
        };
        // Leaflet only
        this.setView = function (xy, r) {
            this.map.setView(xy, r);
        };
        // map init
        switch (MAPLIB) {
            case "ol2":
                this.map = new OpenLayers.Map(defaults.el, {
                    //theme: null,
                    controls: [
                        new OpenLayers.Control.Zoom(),
                        new OpenLayers.Control.TouchNavigation({
                            dragPanOptions: {
                                enableKinetic: true
                            }
                        })],
                    numZoomLevels: defaults.numZoomLevels,
                    projection: defaults.projection,
                    maxResolution: defaults.maxResolution,
                    minResolution: defaults.minResolution,
                    maxExtent: defaults.maxExtent,
                    eventListeners: defaults.eventListeners
                });
                break;
            case "ol3":
                this.map = new ol.Map({
                    target: defaults.el,
                    view: new ol.View2D({
                    })
                    //renderers: ol.RendererHints.createFromQueryData()
                });
                break;
            case "leaflet":
                this.map = new L.map(defaults.el, {});
                lControl = L.control.layers([], []);
                this.map.addControl(lControl);
                this.map.attributionControl.setPrefix(attribution);
                break;
        }
        var _map = this.map;
        //ol2, ol3 and leaflet
        this.addMapQuestOSM = function () {
            switch (MAPLIB) {
                case "ol2":
                    this.mapQuestOSM = new OpenLayers.Layer.OSM("mapQuestOSM", [
                        "http://otile1.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg",
                        "http://otile2.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg",
                        "http://otile3.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg",
                        "http://otile4.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg"
                    ]);
                    this.mapQuestOSM.wrapDateLine = false;
                    this.map.addLayer(this.mapQuestOSM);
                    this.mapQuestOSM.setVisibility(false);
                    break;
                case "ol3":
                    this.mapQuestOSM = new ol.layer.TileLayer({
                        source: new ol.source.MapQuestOSM(),
                        visible: false
                    });
                    this.map.addLayer(this.mapQuestOSM);
                    break;
                case "leaflet":
                    this.mapQuestOSM = new L.tileLayer('http://otile1.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.jpg');
                    lControl.addBaseLayer(this.mapQuestOSM);
                    break;
            }
            this.mapQuestOSM.baseLayer = true;
            this.mapQuestOSM.id = "mapQuestOSM";
            return (this.mapQuestOSM);
        };
        //ol2, ol3 and leaflet
        this.addMapQuestAerial = function () {
            switch (MAPLIB) {
                case "ol2":
                    this.mapQuestAerial = new OpenLayers.Layer.OSM("mapQuestAerial", ["http://oatile1.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg", "http://oatile2.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg", "http://oatile3.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg", "http://oatile4.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg"]);
                    this.mapQuestAerial.wrapDateLine = false;
                    this.map.addLayer(this.mapQuestAerial);
                    this.mapQuestAerial.setVisibility(false);
                    break;
                case "ol3":
                    this.mapQuestAerial = new ol.layer.TileLayer({
                        source: new ol.source.MapQuestOpenAerial(),
                        visible: false
                    });
                    this.map.addLayer(this.mapQuestAerial);
                    break;
                case "leaflet":
                    this.mapQuestAerial = new L.tileLayer("http://oatile1.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg");
                    lControl.addBaseLayer(this.mapQuestAerial);
                    break;

            }
            this.mapQuestAerial.baseLayer = true;
            this.mapQuestAerial.id = "mapQuestAerial";
            return (this.mapQuestAerial);
        };
        //ol2, ol3 and leaflet
        this.addOSM = function () {
            switch (MAPLIB) {
                case "ol2":
                    this.osm = new OpenLayers.Layer.OSM("osm");
                    this.osm.wrapDateLine = false;
                    this.map.addLayer(this.osm);
                    this.osm.setVisibility(false);
                    break;
                case "ol3":
                    this.osm = new ol.layer.Tile({
                        source: new ol.source.OSM(),
                        visible: false
                    });
                    this.map.addLayer(this.osm);
                    break;
                case "leaflet":
                    this.osm = new L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
                    lControl.addBaseLayer(this.osm);
                    break;
            }
            this.osm.baseLayer = true;
            this.osm.id = "osm";
            return (this.osm);
        };
        //ol2 and leaflet
        this.addStamenToner = function () {
            switch (MAPLIB) {
                case "ol2":
                    this.stamenToner = new OpenLayers.Layer.Stamen("toner");
                    this.stamenToner.name = "stamenToner";
                    this.map.addLayer(this.stamenToner);
                    this.stamenToner.setVisibility(false);
                    break;
                case "ol3":
                    this.stamenToner = new ol.layer.TileLayer({
                        source: new ol.source.Stamen({
                            layer: 'toner'
                        }),
                        visible: false
                    });
                    this.map.addLayer(this.stamenToner);
                    break;
                case "leaflet":
                    try {
                        this.stamenToner = new L.StamenTileLayer("toner");
                        lControl.addBaseLayer(this.stamenToner);
                    }
                    catch (e) {
                    }
                    break;
            }
            this.stamenToner.baseLayer = true;
            this.stamenToner.id = "stamenToner";
            return (this.stamenToner);
        };
        //ol2 and leaflet
        this.addMapBoxNaturalEarth = function () {
            switch (MAPLIB) {
                case "ol2":
                    this.mapBoxNaturalEarth = new OpenLayers.Layer.XYZ("mapBoxNaturalEarth", [
                        "http://a.tiles.mapbox.com/v3/mapbox.natural-earth-hypso-bathy/${z}/${x}/${y}.png",
                        "http://b.tiles.mapbox.com/v3/mapbox.natural-earth-hypso-bathy/${z}/${x}/${y}.png",
                        "http://c.tiles.mapbox.com/v3/mapbox.natural-earth-hypso-bathy/${z}/${x}/${y}.png",
                        "http://d.tiles.mapbox.com/v3/mapbox.natural-earth-hypso-bathy/${z}/${x}/${y}.png"
                    ]);
                    this.mapBoxNaturalEarth.wrapDateLine = false;
                    this.map.addLayer(this.mapBoxNaturalEarth);
                    this.mapBoxNaturalEarth.setVisibility(false);
                    break;
                case "ol3":
                    this.mapBoxNaturalEarth = new ol.layer.TileLayer({
                        source: new ol.source.OSM(),
                        visible: false
                    });
                    this.map.addLayer(this.mapBoxNaturalEarth);
                    break;
                case "leaflet":
                    this.mapBoxNaturalEarth = new L.tileLayer("http://a.tiles.mapbox.com/v3/mapbox.natural-earth-hypso-bathy/{z}/{x}/{y}.png");
                    lControl.addBaseLayer(this.mapBoxNaturalEarth);
                    break;
            }
            this.mapBoxNaturalEarth.baseLayer = true;
            this.mapBoxNaturalEarth.id = "mapBoxNaturalEarth";
            return (this.mapBoxNaturalEarth);
        };
        //ol2 and leaflet
        this.addGoogle = function (type) {
            var l, name, me = this;
            switch (type) {
                case "ROADMAP":
                    name = "googleStreets";
                    break;
                case "HYBRID":
                    name = "googleHybrid";
                    break;
                case "SATELLITE":
                    name = "googleSatellite";
                    break;
                case "TERRAIN":
                    name = "googleTerrain";
                    break;
            }
            // Load Google Maps API and make sure its not loaded more than once
            if (typeof window.GoogleMapsDirty === "undefined" && !(typeof google !== "undefined" && typeof google.maps !== "undefined")) {
                window.GoogleMapsDirty = true;
                jQuery.getScript("https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&callback=gc2SetLGoogle");
                // Google Maps API is loaded
            } else if (typeof window.GoogleMapsDirty === "undefined") {
                window.gc2SetLGoogle();
            }
            (function poll() {
                if (typeof google !== "undefined" && typeof google.maps !== "undefined") {
                    switch (MAPLIB) {
                        case "ol2":
                            l = new OpenLayers.Layer.Google(name, {
                                type: google.maps.MapTypeId[type],
                                wrapDateLine: true,
                                numZoomLevels: 20
                            });
                            me.map.addLayer(l);
                            l.setVisibility(false);
                            l.baseLayer = true;
                            l.id = name;
                            break;
                        case "leaflet":
                            if (typeof L.Google !== "undefined") {
                                l = new L.Google(type);
                                l.baseLayer = true;
                                lControl.addBaseLayer(l);
                                l.id = name;
                                break;
                            } else {
                                setTimeout(poll, 10);
                            }
                    }
                    return (l);
                } else {
                    setTimeout(poll, 10);
                }
            }());
        };
        //ol2 and leaflet
        this.addBing = function (type) {
            var l, name;
            switch (type) {
                case "Road":
                    name = "bingRoad";
                    break;
                case "Aerial":
                    name = "bingAerial";
                    break;
                case "AerialWithLabels":
                    name = "bingAerialWithLabels";
                    break;
            }
            switch (MAPLIB) {
                case "ol2":
                    l = new OpenLayers.Layer.Bing({
                        name: name,
                        wrapDateLine: true,
                        key: this.bingApiKey,
                        type: type
                    });
                    this.map.addLayer(l);
                    l.setVisibility(false);
                    l.baseLayer = true;
                    l.id = name;
                    return (l);
                case "leaflet":
                    l = new L.BingLayer(this.bingApiKey, {"type": type});
                    l.baseLayer = true;
                    lControl.addBaseLayer(l);
                    l.id = name;
                    return (l);
            }
        };
        //ol2 and leaflet
        this.addDigitalGlobe = function (type) {
            var l, name, key = this.digitalGlobeKey;
            switch (type) {
                case "DigitalGlobe:Imagery":
                    name = "DigitalGlobe:ImageryTileService";
                    break;
            }
            switch (MAPLIB) {
                case "ol2":
                    l = new OpenLayers.Layer.XYZ(
                        type,
                        "https://services.digitalglobe.com/earthservice/wmtsaccess?CONNECTID=" + key + "&Service=WMTS&REQUEST=GetTile&Version=1.0.0&Format=image/png&Layer=" + name + "&TileMatrixSet=EPSG:3857&TileMatrix=EPSG:3857:${z}&TileRow=${y}&TileCol=${x}"

                    );
                    this.map.addLayer(l);
                    l.setVisibility(false);
                    break;
                case "leaflet":
                    l = new L.TileLayer("https://services.digitalglobe.com/earthservice/wmtsaccess?CONNECTID=" + key + "&Service=WMTS&REQUEST=GetTile&Version=1.0.0&Format=image/png&Layer=" + name + "&TileMatrixSet=EPSG:3857&TileMatrix=EPSG:3857:{z}&TileRow={y}&TileCol={x}");
                    lControl.addBaseLayer(l);
                    break;
            }
            l.baseLayer = true;
            l.id = type;
            return (l);

        };
        //ol2 and leaflet
        this.addDtkSkaermkort = function (name, layer) {
            var l,
                url = "http://cdn.eu1.mapcentia.com/wms/dk/tilecache";
            switch (MAPLIB) {
                case "ol2":
                    l = new OpenLayers.Layer.WMS(name, url, {
                        layers: layer
                    }, {wrapDateLine: true});
                    this.map.addLayer(l);
                    l.setVisibility(false);
                    break;
                case "leaflet":
                    url = url.replace("cdn.", "{s}.");
                    l = new L.TileLayer.WMS(url, {
                        layers: layer,
                        format: 'image/png',
                        transparent: true,
                        subdomains: ["cdn1", "cdn2", "cdn3"]
                    });
                    lControl.addBaseLayer(l);
                    break;
            }
            l.baseLayer = true;
            l.id = name;
            return (l);
        };
        this.addYandex = function () {/*
         switch (MAPLIB) {
         case "ol2":
         this.osm = new OpenLayers.Layer.OSM("osm");
         this.osm.wrapDateLine = false;
         this.map.addLayer(this.osm);
         this.osm.setVisibility(false);
         break;
         case "ol3":
         this.osm = new ol.layer.TileLayer({
         source: new ol.source.OSM(),
         visible: false
         });
         this.map.addLayer(this.osm);
         break;
         case "leaflet":
         this.yandex = new L.Yandex();
         lControl.addBaseLayer(this.yandex);
         break;
         }
         this.yandex.baseLayer = true;
         this.yandex.id = "yandex";
         return (this.yandex);*/
        };
        //ol2, ol3 and leaflet
        this.setBaseLayer = function (baseLayerName) {
            var me = this;
            var layers;
            (function poll() {
                if ((baseLayerName.search("google") > -1 && (typeof L.Google !== "undefined" && typeof google !== "undefined" && typeof google.maps !== "undefined")) || baseLayerName.search("google") === -1) {
                    switch (MAPLIB) {
                        case "ol2":
                            me.showLayer(baseLayerName);
                            me.map.setBaseLayer(me.getLayersByName(baseLayerName));
                            break;
                        case "ol3":
                            layers = me.map.getLayers();
                            for (var i = 0; i < layers.getLength(); i++) {
                                if (layers.a[i].baseLayer === true) {
                                    layers.a[i].set("visible", false);
                                }
                            }
                            me.getLayersByName(baseLayerName).set("visible", true);
                            break;
                        case "leaflet":
                            layers = lControl._layers;
                            for (var key in layers) {
                                if (layers.hasOwnProperty(key)) {
                                    if (layers[key].layer.baseLayer === true && me.map.hasLayer(layers[key].layer)) {
                                        me.map.removeLayer(layers[key].layer);
                                    }
                                    if (layers[key].layer.baseLayer === true && layers[key].layer.id === baseLayerName) {
                                        // Move all others than Google maps back
                                        if (baseLayerName.search("google") === -1) {
                                            layers[key].layer.setZIndex(1);
                                        }
                                        me.map.addLayer(layers[key].layer, false);
                                    }
                                }
                            }
                            break;
                    }
                } else {
                    setTimeout(poll, 10);
                }
            }());
        };

        this.addBaseLayer = function (l, db) {
            var o;
            switch (l) {
                case "osm":
                    o = this.addOSM();
                    break;
                case "mapQuestOSM":
                    o = this.addMapQuestOSM();
                    break;
                case "mapBoxNaturalEarth":
                    o = this.addMapBoxNaturalEarth();
                    break;
                case "stamenToner":
                    o = this.addStamenToner();
                    break;
                case "googleStreets":
                    o = this.addGoogle("ROADMAP");
                    break;
                case "googleHybrid":
                    o = this.addGoogle("HYBRID");
                    break;
                case "googleSatellite":
                    o = this.addGoogle("SATELLITE");
                    break;
                case "googleTerrain":
                    o = this.addGoogle("TERRAIN");
                    break;
                case "bingRoad":
                    o = this.addBing("Road");
                    break;
                case "bingAerial":
                    o = this.addBing("Aerial");
                    break;
                case "bingAerialWithLabels":
                    o = this.addBing("AerialWithLabels");
                    break;
                case "yandex":
                    o = this.addYandex();
                    break;
                case "dtkSkaermkort":
                    o = this.addDtkSkaermkort("dtkSkaermkort", "dtk_skaermkort");
                    break;
                case "dtkSkaermkortDaempet":
                    o = this.addDtkSkaermkort("dtkSkaermkortDaempet", "dtk_skaermkort_daempet");
                    break;
                case "DigitalGlobe:Imagery":
                    o = this.addDigitalGlobe("DigitalGlobe:Imagery");
                    break;
                default : // Try to add as tile layer
                    this.addTileLayers({
                        layers: [l],
                        db: db,
                        isBaseLayer: true,
                        visibility: false,
                        wrapDateLine: false,
                        displayInLayerSwitcher: true,
                        name: l
                    });
                    break;
            }
            return o;
        };
        //ol2, ol3 and leaflet
        this.addTileLayers = function (config) {
            var defaults = {
                host: host,
                layers: [],
                db: null,
                singleTile: false,
                opacity: 1,
                isBaseLayer: false,
                visibility: true,
                wrapDateLine: true,
                tileCached: true,
                displayInLayerSwitcher: true,
                name: null
            };
            if (config) {
                for (prop in config) {
                    defaults[prop] = config[prop];
                }
            }
            var layers = defaults.layers;
            var layersArr = [];
            for (var i = 0; i < layers.length; i++) {
                var l = createTileLayer(layers[i], defaults);
                l.baseLayer = defaults.isBaseLayer;
                switch (MAPLIB) {
                    case "ol2":
                        this.map.addLayer(l);
                        break;
                    case "ol3":
                        this.map.addLayer(l);
                        break;
                    case "leaflet":
                        if (defaults.isBaseLayer === true) {
                            lControl.addBaseLayer(l);
                        }
                        else {
                            lControl.addOverlay(l);
                        }
                        if (defaults.visibility === true) {
                            this.showLayer(layers[i]);
                        }
                        break;
                }
                layersArr.push(l);
            }
            return layersArr;
        };


        this.removeTileLayerByName = function (name) {
            var arr = this.map.getLayersByName(name);
            this.map.removeLayer(arr[0]);
        };

        // Leaflet
        this.setZIndexOfLayer = function (layer, z) {
            switch (MAPLIB) {
                case "ol2":
                    break;
                case "leaflet":
                    layer.setZIndex(z);
                    break;
            }
        };

        //ol2 and leaflet
        this.addGeoJsonStore = function (store) {
            // set the parent map obj
            store.map = this;
            switch (MAPLIB) {
                case "ol2":
                    this.map.addLayers([store.layer]);
                    break;
                case "ol3":
                    this.map.addLayer(store.layer);
                    break;
                case "leaflet":
                    lControl.addOverlay(store.layer);
                    this.showLayer(store.layer.id);
                    break;
            }
        };
        //ol2 and leaflet
        this.removeGeoJsonStore = function (store) {
            switch (MAPLIB) {
                case "ol2":
                    this.map.removeLayer(store.layer);
                    break;
                case "leaflet":
                    this.map.removeLayer(store.layer);
                    break;
            }

        };
        //ol2, ol3 and leaflet
        this.hideLayer = function (name) {
            switch (MAPLIB) {
                case "ol2":
                    this.getLayersByName(name).setVisibility(false);
                    break;
                case "ol3":
                    this.getLayersByName(name).set("visible", false);
                    break;
                case "leaflet":
                    this.map.removeLayer(this.getLayersByName(name));
                    break;
            }
        };
        //ol2, ol3 and leaflet
        this.showLayer = function (name) {
            switch (MAPLIB) {
                case "ol2":
                    this.getLayersByName(name).setVisibility(true);
                    break;
                case "ol3":
                    this.getLayersByName(name).set("visible", true);
                    break;
                case "leaflet":
                    this.getLayersByName(name).addTo(this.map);
                    break;
            }
        };
        //ol2
        this.getLayerById = function (id) {
            return this.map.getLayer(id);
        }
        //ol2, ol3 and leaflet (rename to getLayerByName)
        this.getLayersByName = function (name) {
            var l;
            switch (MAPLIB) {
                case "ol2":
                    l = this.map.getLayersByName(name)[0];
                    break;
                case "ol3":
                    for (var i = 0; i < this.map.getLayers().getLength(); i++) {
                        if (this.map.getLayers().a[i].id === name) {
                            l = this.map.getLayers().a[i];
                        }
                    }
                    break;
                case "leaflet":
                    var layers = lControl._layers;
                    for (var key in layers) {
                        if (layers.hasOwnProperty(key)) {
                            if (layers[key].layer.id === name) {
                                l = layers[key].layer;
                            }
                        }
                    }
                    break;
            }
            return l;
        };
        //ol2
        this.hideAllTileLayers = function () {
            for (var i = 0; i < this.map.layers.length; i++) {
                if (this.map.layers[i].isBaseLayer === false && this.map.layers[i].CLASS_NAME === "OpenLayers.Layer.WMS") {
                    this.map.layers[i].setVisibility(false);
                }
            }
        };
        //ol2, ol3 and leaflet
        // Output map coordinates (900913)
        this.getCenter = function () {
            var point;
            switch (MAPLIB) {
                case "ol2":
                    point = this.map.center;
                    return {
                        x: point.lon,
                        y: point.lat
                    };
                    break;
                case "ol3":
                    point = this.map.getView().getCenter();
                    return {
                        x: point[0],
                        y: point[1]
                    };
                    break;
                case "leaflet":
                    point = this.map.getCenter();
                    var p = transformPoint(point.lng, point.lat, "EPSG:4326", "EPSG:900913");
                    return {
                        x: p.x,
                        y: p.y,
                        lon: point.lng,
                        lat: point.lat
                    };
                    break;
            }
        };
        //ol2
        this.getExtent = function () {
            var mapBounds, bounds;
            switch (MAPLIB) {
                case "ol2":
                    mapBounds = this.map.getExtent();
                    bounds = mapBounds.toArray();
                    break;
                case "ol3":

                    break;
                case "leaflet":
                    mapBounds = this.map.getBounds().toBBoxString().split(",");
                    bounds = {left: mapBounds[0], right: mapBounds[2], top: mapBounds[3], bottom: mapBounds[1]};
                    break;
            }
            return (bounds);
        };

        //ol2
        this.getBbox = function () {
            return this.map.getExtent().toString();
        };
        // Leaflet
        this.locate = function () {
            this.map.locate({
                setView: true
            });
        }
        //ol2 and leaflet
        this.addLayerFromWkt = function (elements) { // Take 4326
            switch (MAPLIB) {
                case "ol2":
                    this.removeQueryLayers();
                    var features, geometry, transformedFeature, wkt = new OpenLayers.Format.WKT;
                    for (var i = 0; i < elements.length; i++) {
                        features = wkt.read(elements[i]);
                        queryLayers[i] = new OpenLayers.Layer.Vector(null, {
                            displayInLayerSwitcher: false,
                            styleMap: new OpenLayers.StyleMap({'default': new OpenLayers.Style({
                                strokeColor: '#000000',
                                strokeWidth: 3,
                                fillOpacity: 0,
                                strokeOpacity: 0.8
                            })})
                        });
                        geometry = features.geometry.transform(
                            new OpenLayers.Projection('EPSG:4326'),
                            new OpenLayers.Projection('EPSG:900913')
                        );
                        transformedFeature = new OpenLayers.Feature.Vector(geometry, {});
                        queryLayers[i].addFeatures([transformedFeature]);
                        this.map.addLayers([queryLayers[i]]);
                    }
                    break;
                case "ol3":

                    break;
                case "leaflet":
                    this.removeQueryLayers();
                    var wkt = new Wkt.Wkt();
                    for (var i = 0; i < elements.length; i++) {
                        wkt.read(elements[i]);
                        queryLayers[i] = wkt.toObject({
                            color: '#000000',
                            weight: 3,
                            opacity: 0.8,
                            fillOpacity: 0
                        }).addTo(this.map);
                    }
                    break;
            }
        };
        // ol2 and leaflet
        this.removeQueryLayers = function () {
            switch (MAPLIB) {
                case "ol2":
                    try {
                        for (var i = 0; i < queryLayers.length; i++) {
                            //queryLayers[i].destroy();
                            this.map.removeLayer(queryLayers[i])
                        }
                    }
                    catch (e) {
                    }
                    break;
                case "ol3":
                    break;
                case "leaflet":
                    try {
                        for (var i = 0; i < queryLayers.length; i++) {
                            this.map.removeLayer(queryLayers[i]);
                        }
                    }
                    catch (e) {
                    }
                    break;
            }

        };
        // ol2, ol3 and leaflet
        this.on = function (event, callBack) {
            switch (MAPLIB) {
                case "ol2":
                    if (event === "click") {
                        OpenLayers.Control.Click = OpenLayers.Class(OpenLayers.Control, {
                            defaultHandlerOptions: {
                                'single': true,
                                'double': false,
                                'pixelTolerance': 0,
                                'stopSingle': false,
                                'stopDouble': false
                            },
                            initialize: function (options) {
                                this.handlerOptions = OpenLayers.Util.extend({}, this.defaultHandlerOptions);
                                OpenLayers.Control.prototype.initialize.apply(this, arguments);
                                this.handler = new OpenLayers.Handler.Click(this, {
                                    'click': this.trigger
                                }, this.handlerOptions);
                            },
                            trigger: function (e) {
                                callBack(e);
                            }
                        });
                        var click = new OpenLayers.Control.Click()
                        this.map.addControl(click);
                        click.activate();
                    }
                    if (event === "moveend") {
                        this.map.events.register("moveend", null, callBack);
                    }
                    break;
                case "ol3":
                    this.map.on(event, callBack);
                    break;
                case "leaflet":
                    this.map.on(event, callBack);
                    break;
            }
        };
    };
// ol2, ol3 and leaflet
// Input map coordinates (900913)
    clickEvent = function (e, map) {
        this.getCoordinate = function () {
            var point;
            switch (MAPLIB) {
                case "ol2":
                    point = map.map.getLonLatFromPixel(e.xy);
                    return {
                        x: point.lon,
                        y: point.lat
                    };
                    break;
                case "ol3":
                    point = e.coordinate;
                    return {
                        x: point[0],
                        y: point[1]
                    };
                    break;
                case "leaflet":
                    point = e.latlng;
                    var p = transformPoint(point.lng, point.lat, "EPSG:4326", "EPSG:900913");
                    return {
                        x: p.x,
                        y: p.y
                    };
                    break;
            }
        };
    };
    transformPoint = function (lat, lon, s, d) {
        var p = [];
        if (typeof Proj4js === "object") {
            var source = new Proj4js.Proj(s);    //source coordinates will be in Longitude/Latitude
            var dest = new Proj4js.Proj(d);
            p = new Proj4js.Point(lat, lon);
            Proj4js.transform(source, dest, p);
        }
        else {
            p.x = null;
            p.y = null;
        }
        return p;
    };

    return {
        geoJsonStore: geoJsonStore,
        sqlStore: sqlStore,
        tileLayer: tileLayer,
        elasticStore: elasticStore,
        tweetStore: tweetStore,
        map: map,
        MAPLIB: MAPLIB,
        clickEvent: clickEvent,
        transformPoint: transformPoint,
        urlVars: (function getUrlVars() {
            var mapvars = {};
            var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
                mapvars[key] = value;
            });
            return mapvars;
        })(),
        pathName: window.location.pathname.split("/"),
        urlHash: window.location.hash,
        OSM: OSM,
        MAPQUESTOSM: MAPQUESTOSM,
        MAPBOXNATURALEARTH: MAPBOXNATURALEARTH,
        STAMENTONER: STAMENTONER,
        GOOGLESTREETS: GOOGLESTREETS,
        GOOGLEHYBRID: GOOGLEHYBRID,
        GOOGLESATELLITE: GOOGLESATELLITE,
        GOOGLETERRAIN: GOOGLETERRAIN,
        BINGROAD: BINGROAD,
        BINGAERIAL: BINGAERIAL,
        BINGAERIALWITHLABELS: BINGAERIALWITHLABELS,
        DTKSKAERMKORT: DTKSKAERMKORT,
        DTKSKAERMKORTDAEMPET: DTKSKAERMKORTDAEMPET,
        DIGITALGLOBE: DIGITALGLOBE
    };
}());

// Adding extensions for several map providers

// Stamen (Leaflet and OpenLayers)
(function (exports) {
    /*
     * tile.stamen.js v1.2.4
     */

    var SUBDOMAINS = " a. b. c. d.".split(" "),
        MAKE_PROVIDER = function (layer, type, minZoom, maxZoom) {
            return {
                "url": ["http://{S}tile.stamen.com/", layer, "/{Z}/{X}/{Y}.", type].join(""),
                "type": type,
                "subdomains": SUBDOMAINS.slice(),
                "minZoom": minZoom,
                "maxZoom": maxZoom,
                "attribution": [
                    'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
                    'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
                    'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
                    'under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
                ].join("")
            };
        },
        PROVIDERS = {
            "toner": MAKE_PROVIDER("toner", "png", 0, 20),
            "terrain": MAKE_PROVIDER("terrain", "jpg", 4, 18),
            "watercolor": MAKE_PROVIDER("watercolor", "jpg", 1, 18),
            "trees-cabs-crime": {
                "url": "http://{S}.tiles.mapbox.com/v3/stamen.trees-cabs-crime/{Z}/{X}/{Y}.png",
                "type": "png",
                "subdomains": "a b c d".split(" "),
                "minZoom": 11,
                "maxZoom": 18,
                "extent": [
                    {"lat": 37.853, "lon": -122.577},
                    {"lat": 37.684, "lon": -122.313}
                ],
                "attribution": [
                    'Design by Shawn Allen at <a href="http://stamen.com">Stamen</a>.',
                    'Data courtesy of <a href="http://fuf.net">FuF</a>,',
                    '<a href="http://www.yellowcabsf.com">Yellow Cab</a>',
                    '&amp; <a href="http://sf-police.org">SFPD</a>.'
                ].join(" ")
            }
        };

// set up toner and terrain flavors
    setupFlavors("toner", ["hybrid", "labels", "lines", "background", "lite"]);
// toner 2010
    setupFlavors("toner", ["2010"]);
// toner 2011 flavors
    setupFlavors("toner", ["2011", "2011-lines", "2011-labels", "2011-lite"]);
    setupFlavors("terrain", ["background"]);
    setupFlavors("terrain", ["labels", "lines"], "png");

    /*
     * Export stamen.tile to the provided namespace.
     */
    exports.stamen = exports.stamen || {};
    exports.stamen.tile = exports.stamen.tile || {};
    exports.stamen.tile.providers = PROVIDERS;
    exports.stamen.tile.getProvider = getProvider;

    /*
     * A shortcut for specifying "flavors" of a style, which are assumed to have the
     * same type and zoom range.
     */
    function setupFlavors(base, flavors, type) {
        var provider = getProvider(base);
        for (var i = 0; i < flavors.length; i++) {
            var flavor = [base, flavors[i]].join("-");
            PROVIDERS[flavor] = MAKE_PROVIDER(flavor, type || provider.type, provider.minZoom, provider.maxZoom);
        }
    }

    /*
     * Get the named provider, or throw an exception if it doesn't exist.
     */
    function getProvider(name) {
        if (name in PROVIDERS) {
            return PROVIDERS[name];
        } else {
            throw 'No such provider (' + name + ')';
        }
    }

    /*
     * StamenTileLayer for Leaflet
     * <http://leaflet.cloudmade.com/>
     *
     * Tested with version 0.3 and 0.4, but should work on all 0.x releases.
     */
    if (typeof L === "object") {
        L.StamenTileLayer = L.TileLayer.extend({
            initialize: function (name) {
                var provider = getProvider(name),
                    url = provider.url.replace(/({[A-Z]})/g, function (s) {
                        return s.toLowerCase();
                    });
                L.TileLayer.prototype.initialize.call(this, url, {
                    "minZoom": provider.minZoom,
                    "maxZoom": provider.maxZoom,
                    "subdomains": provider.subdomains,
                    "scheme": "xyz",
                    "attribution": provider.attribution
                });
            }
        });
    }

    /*
     * StamenTileLayer for OpenLayers
     * <http://openlayers.org/>
     *
     * Tested with v2.1x.
     */
    if (typeof OpenLayers === "object") {
        // make a tile URL template OpenLayers-compatible
        function openlayerize(url) {
            return url.replace(/({.})/g, function (v) {
                return "$" + v.toLowerCase();
            });
        }

        // based on http://www.bostongis.com/PrinterFriendly.aspx?content_name=using_custom_osm_tiles
        OpenLayers.Layer.Stamen = OpenLayers.Class(OpenLayers.Layer.OSM, {
            initialize: function (name, options) {
                var provider = getProvider(name),
                    url = provider.url,
                    subdomains = provider.subdomains,
                    hosts = [];
                if (url.indexOf("{S}") > -1) {
                    for (var i = 0; i < subdomains.length; i++) {
                        hosts.push(openlayerize(url.replace("{S}", subdomains[i])));
                    }
                } else {
                    hosts.push(openlayerize(url));
                }
                options = OpenLayers.Util.extend({
                    "numZoomLevels": provider.maxZoom,
                    "buffer": 0,
                    "transitionEffect": "resize",
                    // see: <http://dev.openlayers.org/apidocs/files/OpenLayers/Layer/OSM-js.html#OpenLayers.Layer.OSM.tileOptions>
                    // and: <http://dev.openlayers.org/apidocs/files/OpenLayers/Tile/Image-js.html#OpenLayers.Tile.Image.crossOriginKeyword>
                    "tileOptions": {
                        "crossOriginKeyword": null
                    }
                }, options);
                return OpenLayers.Layer.OSM.prototype.initialize.call(this, name, hosts, options);
            }
        });
    }

})(typeof exports === "undefined" ? this : exports);

if (geocloud.MAPLIB === "leaflet") {
// Bing Maps (Leaflet)
    L.BingLayer = L.TileLayer.extend({
        options: {
            subdomains: [0, 1, 2, 3],
            type: 'Aerial',
            attribution: 'Bing',
            culture: ''
        },

        initialize: function (key, options) {
            L.Util.setOptions(this, options);

            this._key = key;
            this._url = null;
            this.meta = {};
            this.loadMetadata();
        },

        tile2quad: function (x, y, z) {
            var quad = '';
            for (var i = z; i > 0; i--) {
                var digit = 0;
                var mask = 1 << (i - 1);
                if ((x & mask) != 0) digit += 1;
                if ((y & mask) != 0) digit += 2;
                quad = quad + digit;
            }
            return quad;
        },

        getTileUrl: function (p, z) {
            var z = this._getZoomForUrl();
            var subdomains = this.options.subdomains,
                s = this.options.subdomains[Math.abs((p.x + p.y) % subdomains.length)];
            return this._url.replace('{subdomain}', s)
                .replace('{quadkey}', this.tile2quad(p.x, p.y, z))
                .replace('{culture}', this.options.culture);
        },

        loadMetadata: function () {
            var _this = this;
            var cbid = '_bing_metadata_' + L.Util.stamp(this);
            window[cbid] = function (meta) {
                _this.meta = meta;
                window[cbid] = undefined;
                var e = document.getElementById(cbid);
                e.parentNode.removeChild(e);
                if (meta.errorDetails) {
                    alert("Got metadata" + meta.errorDetails);
                    return;
                }
                _this.initMetadata();
            };
            var url = "http://dev.virtualearth.net/REST/v1/Imagery/Metadata/" + this.options.type + "?include=ImageryProviders&jsonp=" + cbid + "&key=" + this._key;
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = url;
            script.id = cbid;
            document.getElementsByTagName("head")[0].appendChild(script);
        },

        initMetadata: function () {
            var r = this.meta.resourceSets[0].resources[0];
            this.options.subdomains = r.imageUrlSubdomains;
            this._url = r.imageUrl;
            this._providers = [];
            for (var i = 0; i < r.imageryProviders.length; i++) {
                var p = r.imageryProviders[i];
                for (var j = 0; j < p.coverageAreas.length; j++) {
                    var c = p.coverageAreas[j];
                    var coverage = {zoomMin: c.zoomMin, zoomMax: c.zoomMax, active: false};
                    var bounds = new L.LatLngBounds(
                        new L.LatLng(c.bbox[0] + 0.01, c.bbox[1] + 0.01),
                        new L.LatLng(c.bbox[2] - 0.01, c.bbox[3] - 0.01)
                    );
                    coverage.bounds = bounds;
                    coverage.attrib = p.attribution;
                    this._providers.push(coverage);
                }
            }
            this._update();
        },

        _update: function () {
            if (this._url == null || !this._map) return;
            this._update_attribution();
            L.TileLayer.prototype._update.apply(this, []);
        },

        _update_attribution: function () {
            var bounds = this._map.getBounds();
            var zoom = this._map.getZoom();
            for (var i = 0; i < this._providers.length; i++) {
                var p = this._providers[i];
                if ((zoom <= p.zoomMax && zoom >= p.zoomMin) &&
                    bounds.intersects(p.bounds)) {
                    if (!p.active)
                        this._map.attributionControl.addAttribution(p.attrib);
                    p.active = true;
                } else {
                    if (p.active)
                        this._map.attributionControl.removeAttribution(p.attrib);
                    p.active = false;
                }
            }
        },

        onRemove: function (map) {
            for (var i = 0; i < this._providers.length; i++) {
                var p = this._providers[i];
                if (p.active) {
                    this._map.attributionControl.removeAttribution(p.attrib);
                    p.active = false;
                }
            }
            L.TileLayer.prototype.onRemove.apply(this, [map]);
        }
    });
// Leaflet.AwesomeMarkers (Leaflet)
    (function (e, t, n) {
        L.AwesomeMarkers = {};
        L.AwesomeMarkers.version = "1.0";
        L.AwesomeMarkers.Icon = L.Icon.extend({options: {iconSize: [35, 45], iconAnchor: [17, 42], popupAnchor: [1, -32], shadowAnchor: [10, 12], shadowSize: [36, 16], className: "awesome-marker", icon: "home", color: "blue", iconColor: "white"}, initialize: function (e) {
            e = L.setOptions(this, e)
        }, createIcon: function () {
            var e = t.createElement("div"), n = this.options;
            if (n.icon) {
                e.innerHTML = this._createInner()
            }
            if (n.bgPos) {
                e.style.backgroundPosition = -n.bgPos.x + "px " + -n.bgPos.y + "px"
            }
            this._setIconStyles(e, "icon-" + n.color);
            return e
        }, _createInner: function () {
            var e;
            if (this.options.icon.slice(0, 5) === "icon-") {
                e = this.options.icon
            } else {
                e = "icon-" + this.options.icon
            }
            return"<i class='" + e + (this.options.spin ? " icon-spin" : "") + (this.options.iconColor ? " icon-" + this.options.iconColor : "") + "'></i>"
        }, _setIconStyles: function (e, t) {
            var n = this.options, r = L.point(n[t == "shadow" ? "shadowSize" : "iconSize"]), i;
            if (t === "shadow") {
                i = L.point(n.shadowAnchor || n.iconAnchor)
            } else {
                i = L.point(n.iconAnchor)
            }
            if (!i && r) {
                i = r.divideBy(2, true)
            }
            e.className = "awesome-marker-" + t + " " + n.className;
            if (i) {
                e.style.marginLeft = -i.x + "px";
                e.style.marginTop = -i.y + "px"
            }
            if (r) {
                e.style.width = r.x + "px";
                e.style.height = r.y + "px"
            }
        }, createShadow: function () {
            var e = t.createElement("div"), n = this.options;
            this._setIconStyles(e, "shadow");
            return e
        }});
        L.AwesomeMarkers.icon = function (e) {
            return new L.AwesomeMarkers.Icon(e)
        }
    })(this, document)
}
// Google Maps (Leaflet)
var gc2SetLGoogle = function () {
    if (geocloud.MAPLIB === "leaflet") {
        L.Google = L.Class.extend({
            includes: L.Mixin.Events,
            options: {
                minZoom: 0,
                maxZoom: 18,
                tileSize: 256,
                subdomains: 'abc',
                errorTileUrl: '',
                attribution: '',
                opacity: 1,
                continuousWorld: false,
                noWrap: false,
                mapOptions: {
                    backgroundColor: '#dddddd'
                }
            },

            // Possible types: SATELLITE, ROADMAP, HYBRID, TERRAIN
            initialize: function (type, options) {
                L.Util.setOptions(this, options);

                this._ready = google.maps.Map != undefined;
                if (!this._ready) L.Google.asyncWait.push(this);

                this._type = type || 'SATELLITE';
            },

            onAdd: function (map, insertAtTheBottom) {
                this._map = map;
                this._insertAtTheBottom = insertAtTheBottom;

                // create a container div for tiles
                this._initContainer();
                this._initMapObject();

                // set up events
                map.on('viewreset', this._resetCallback, this);

                this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
                map.on('move', this._update, this);

                map.on('zoomanim', this._handleZoomAnim, this);

                //20px instead of 1em to avoid a slight overlap with google's attribution
                map._controlCorners['bottomright'].style.marginBottom = "20px";

                this._reset();
                this._update();
            },

            onRemove: function (map) {
                this._map._container.removeChild(this._container);
                //this._container = null;

                this._map.off('viewreset', this._resetCallback, this);

                this._map.off('move', this._update, this);

                this._map.off('zoomanim', this._handleZoomAnim, this);

                map._controlCorners['bottomright'].style.marginBottom = "0em";
                //this._map.off('moveend', this._update, this);
            },

            getAttribution: function () {
                return this.options.attribution;
            },

            setOpacity: function (opacity) {
                this.options.opacity = opacity;
                if (opacity < 1) {
                    L.DomUtil.setOpacity(this._container, opacity);
                }
            },

            setElementSize: function (e, size) {
                e.style.width = size.x + "px";
                e.style.height = size.y + "px";
            },

            _initContainer: function () {
                var tilePane = this._map._container,
                    first = tilePane.firstChild;

                if (!this._container) {
                    this._container = L.DomUtil.create('div', 'leaflet-google-layer leaflet-top leaflet-left');
                    this._container.id = "_GMapContainer_" + L.Util.stamp(this);
                    this._container.style.zIndex = "auto";
                }

                tilePane.insertBefore(this._container, first);

                this.setOpacity(this.options.opacity);
                this.setElementSize(this._container, this._map.getSize());
            },

            _initMapObject: function () {
                if (!this._ready) return;
                this._google_center = new google.maps.LatLng(0, 0);
                var map = new google.maps.Map(this._container, {
                    center: this._google_center,
                    zoom: 0,
                    tilt: 0,
                    mapTypeId: google.maps.MapTypeId[this._type],
                    disableDefaultUI: true,
                    keyboardShortcuts: false,
                    draggable: false,
                    disableDoubleClickZoom: true,
                    scrollwheel: false,
                    streetViewControl: false,
                    styles: this.options.mapOptions.styles,
                    backgroundColor: this.options.mapOptions.backgroundColor
                });

                var _this = this;
                this._reposition = google.maps.event.addListenerOnce(map, "center_changed",
                    function () {
                        _this.onReposition();
                    });
                this._google = map;

                google.maps.event.addListenerOnce(map, "idle",
                    function () {
                        _this._checkZoomLevels();
                    });
            },

            _checkZoomLevels: function () {
                //setting the zoom level on the Google map may result in a different zoom level than the one requested
                //(it won't go beyond the level for which they have data).
                // verify and make sure the zoom levels on both Leaflet and Google maps are consistent
                if (this._google.getZoom() !== this._map.getZoom()) {
                    //zoom levels are out of sync. Set the leaflet zoom level to match the google one
                    this._map.setZoom(this._google.getZoom());
                }
            },

            _resetCallback: function (e) {
                this._reset(e.hard);
            },

            _reset: function (clearOldContainer) {
                this._initContainer();
            },

            _update: function (e) {
                if (!this._google) return;
                this._resize();

                var center = e && e.latlng ? e.latlng : this._map.getCenter();
                var _center = new google.maps.LatLng(center.lat, center.lng);

                this._google.setCenter(_center);
                this._google.setZoom(this._map.getZoom());

                this._checkZoomLevels();
                //this._google.fitBounds(google_bounds);
            },

            _resize: function () {
                var size = this._map.getSize();
                if (this._container.style.width == size.x &&
                    this._container.style.height == size.y)
                    return;
                this.setElementSize(this._container, size);
                this.onReposition();
            },


            _handleZoomAnim: function (e) {
                var center = e.center;
                var _center = new google.maps.LatLng(center.lat, center.lng);

                this._google.setCenter(_center);
                this._google.setZoom(e.zoom);
            },


            onReposition: function () {
                if (!this._google) return;
                google.maps.event.trigger(this._google, "resize");
            }
        });
        L.Google.asyncWait = [];
        L.Google.asyncInitialize = function () {
            var i;
            for (i = 0; i < L.Google.asyncWait.length; i++) {
                var o = L.Google.asyncWait[i];
                o._ready = true;
                if (o._container) {
                    o._initMapObject();
                    o._update();
                }
            }
            L.Google.asyncWait = [];
        }
    }
}



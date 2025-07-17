document.addEventListener("DOMContentLoaded", () => {
    function create_map() {
        var mousePositionControl = new ol.control.MousePosition({
            className: 'custom-mouse-position',
            target: document.getElementById('mouse-position'),
            undefinedHTML: '&nbsp;'
        });
        if (mapName === "Abyssal Expedition") {
            var map = new ol.Map({
                controls: ol.control.defaults.defaults().extend([mousePositionControl]),
                target: 'map',

                layers: [
                    new ol.layer.Group({
                        title: 'Overlay',
                        layers: [
                            new ol.layer.Tile({
                                title: 'Overlay',
                                // opacity: 0.7,
                                source: new ol.source.TileImage({
                                    attributions: '',
                                    tileGrid: new ol.tilegrid.TileGrid({
                                        extent: [0,-14400,19200,0],
                                        origin: [0,-14400],
                                        resolutions: [128, 64, 32, 16, 8, 4, 2, 1],
                                        tileSize: [256, 256]
                                    }),
                                    tileUrlFunction: function(tileCoord) {
                                        return ('../static/tiles/abex/{z}/{x}/{y}.png'
                                            .replace('{z}', String(tileCoord[0]))
                                            .replace('{x}', String(tileCoord[1]))
                                            .replace('{y}', String(- 1 - tileCoord[2])));
                                    },
                                })
                            }),
                        ]
                    }),
                ],
                view: new ol.View({
                    center: [8600, -7200],
                    zoom: 0,
                    minZoom: 0,
                    maxZoom: 7,
                    resolutions: [128, 64, 32, 16, 8, 4, 2, 1],
                    extent: [0, -14400, 19200, 0],
                    projection: new ol.proj.Projection({ code: 'EPSG:3857', units: 'm' })
                })
            });
        } else if (mapName === "Hunting Fields") {
            var map = new ol.Map({
                controls: ol.control.defaults.defaults().extend([mousePositionControl]),
                target: 'map',

                layers: [
                    new ol.layer.Group({
                        title: 'Overlay',
                        layers: [
                            new ol.layer.Tile({
                                title: 'Overlay',
                                // opacity: 0.7,
                                source: new ol.source.TileImage({
                                    attributions: '',
                                    tileGrid: new ol.tilegrid.TileGrid({
                                        extent: [0, -4680, 3840, 0],
                                        origin: [0, -4680],
                                        resolutions: [32, 16, 8, 4, 2, 1],
                                        tileSize: [256, 256]
                                    }),
                                    tileUrlFunction: function(tileCoord) {
                                        return ('../static/tiles/hf/{z}/{x}/{y}.png'
                                            .replace('{z}', String(tileCoord[0]))
                                            .replace('{x}', String(tileCoord[1]))
                                            .replace('{y}', String(- 1 - tileCoord[2])));
                                    },
                                })
                            }),
                        ]
                    }),
                ],
                view: new ol.View({
                    resolutions: [32, 16, 8, 4, 2, 1],
                    center: [1920, -2340], // initial center
                    zoom: 0,
                    minZoom: 0,
                    maxZoom: 5,
                    extent: [0, -4680, 3840, 0],
                    projection: new ol.proj.Projection({ code: 'EPSG:3857', units: 'm' })
                })
            });
        }
    }

    create_map();
});

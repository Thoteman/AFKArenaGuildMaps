document.addEventListener("DOMContentLoaded", () => {
    let markerColor = document.getElementById("markerColor")?.value || "#ff0000";
    let markerType = "circle";
    let markedTiles = new Map();
    let tilePositions = [];
    let map;

    const vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({ source: vectorSource });

    function pixelToMapCoords([x, y]) {
        return [x, -y]; // Match raster tile origin (top-left)
    }

    function getCircleSVG(color) {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                <circle cx="8" cy="8" r="6" fill="${color}" stroke="#000" stroke-width="1"/>
            </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    function getHexSVG(color) {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="16" viewBox="0 0 18 16">
                <polygon points="9,0 17,4 17,12 9,16 1,12 1,4" 
                    fill="none" stroke="${color}" stroke-width="2"/>
            </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    function drawMarker(tile) {
        const [x, y] = tile.pixel_coords;
        const coords = [x, -y];
        const hexCoords = tile.hex_coords.join(',');

        const color = markedTiles.get(hexCoords) || markerColor;
        const resolution = map.getView().getResolution();
        if (mapName === "Abyssal Expedition") {
            var scaleFactorCircle = 2 / resolution;
            var scaleFactorHex = 4 / resolution;
        } else if (mapName === "Hunting Fields") {
            var scaleFactorCircle = 1.5 / resolution;
            var scaleFactorHex = 3 / resolution;
        }

        if (markerType === 'hex' || markerType === 'both') {
            const hex = new ol.Feature({ geometry: new ol.geom.Point(coords) });
            hex.setStyle(new ol.style.Style({
                image: new ol.style.Icon({
                    src: getHexSVG(color),
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    scale: scaleFactorHex
                })
            }));
            vectorSource.addFeature(hex);
        }

        if (markerType === 'circle' || markerType === 'both') {
            const markerFeature = new ol.Feature({
                geometry: new ol.geom.Point(coords),
                name: hexCoords,
            });

            const style = new ol.style.Style({
                image: new ol.style.Icon({
                    src: getCircleSVG(color),
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    scale: scaleFactorCircle
                })
            });

            markerFeature.setStyle(style);
            vectorSource.addFeature(markerFeature);
        }
    }

    function updateMarkers() {
        vectorSource.clear();
        tilePositions.forEach(tile => {
            const hexCoords = tile.hex_coords.join(',');
            if (markedTiles.has(hexCoords)) {
                drawMarker(tile);
            }
        });
    }

    function loadMarkers() {
        fetch(`/get_markers/${mapName}`)
            .then(res => res.json())
            .then(data => {
                markedTiles = new Map(Object.entries(data));
                updateMarkers();
            });
    }

    function saveMarkers() {
        const data = {
            map_name: mapName,
            markers: Object.fromEntries(markedTiles),
        };

        fetch('/save_markers/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }

    function resetMap() {
        markedTiles.clear();
        updateMarkers();
        saveMarkers();
    }

    function changeMarker() {
        if (markerType === "circle") markerType = "hex";
        else if (markerType === "hex") markerType = "both";
        else markerType = "circle";
        updateMarkers();
    }

    function setupInteraction(map) {
        map.on('click', function (evt) {
            const [clickX, clickY] = evt.coordinate;

            tilePositions.forEach(tile => {
                const [x, y] = tile.pixel_coords;
                const hexCoords = tile.hex_coords.join(',');
                const distance = Math.hypot(clickX - x, clickY + y); // y flipped in map
                if (distance < 25) {
                    if (markedTiles.has(hexCoords)) {
                        markedTiles.delete(hexCoords);
                    } else {
                        markedTiles.set(hexCoords, markerColor);
                    }
                }
            });

            updateMarkers();
            saveMarkers();
        });

        document.getElementById("markerColor")?.addEventListener("input", (e) => {
            markerColor = e.target.value;
        });

        document.getElementById("resetMapButton")?.addEventListener("click", resetMap);
        document.getElementById("changeMarkerButton")?.addEventListener("click", changeMarker);
    }

    function fetchTilesAndInit() {
        if (mapName === "Abyssal Expedition") {
            tileCenterFile = "ABEX_tiles";
        } else if (mapName === "Hunting Fields") {
            tileCenterFile = "HF_tiles";
        } else {
            console.error("Unknown map name:", mapName);
            return;
        }
        fetch(`/static/tiles/${tileCenterFile}.json`)
            .then(res => res.json())
            .then(data => {
                tilePositions = data;
                updateMarkers();
            });
    }

    function create_map() {
        const mousePositionControl = new ol.control.MousePosition({
            className: 'custom-mouse-position',
            target: document.getElementById('mouse-position'),
            undefinedHTML: '&nbsp;'
        });

        if (mapName === "Abyssal Expedition") {
            map = new ol.Map({
                controls: ol.control.defaults.defaults().extend([mousePositionControl]),
                target: 'map',
                layers: [
                    new ol.layer.Group({
                        title: 'Overlay',
                        layers: [
                            new ol.layer.Tile({
                                title: 'Overlay',
                                source: new ol.source.TileImage({
                                    tileGrid: new ol.tilegrid.TileGrid({
                                        extent: [0, -14400, 19200, 0],
                                        origin: [0, -14400],
                                        resolutions: [128, 64, 32, 16, 8, 4, 2, 1],
                                        tileSize: [256, 256]
                                    }),
                                    tileUrlFunction: tileCoord =>
                                        `../static/tiles/abex/${tileCoord[0]}/${tileCoord[1]}/${-1 - tileCoord[2]}.png`
                                })
                            }),
                            vectorLayer
                        ]
                    })
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
            map = new ol.Map({
                controls: ol.control.defaults.defaults().extend([mousePositionControl]),
                target: 'map',
                layers: [
                    new ol.layer.Group({
                        title: 'Overlay',
                        layers: [
                            new ol.layer.Tile({
                                title: 'Overlay',
                                source: new ol.source.TileImage({
                                    tileGrid: new ol.tilegrid.TileGrid({
                                        extent: [0, -4680, 3840, 0],
                                        origin: [0, -4680],
                                        resolutions: [32, 16, 8, 4, 2, 1],
                                        tileSize: [256, 256]
                                    }),
                                    tileUrlFunction: tileCoord =>
                                        `../static/tiles/hf/${tileCoord[0]}/${tileCoord[1]}/${-1 - tileCoord[2]}.png`
                                })
                            }),
                            vectorLayer
                        ]
                    })
                ],
                view: new ol.View({
                    center: [1920, -2340],
                    zoom: 0,
                    minZoom: 0,
                    maxZoom: 5,
                    resolutions: [32, 16, 8, 4, 2, 1],
                    extent: [0, -4680, 3840, 0],
                    projection: new ol.proj.Projection({ code: 'EPSG:3857', units: 'm' })
                })
            });
        }

        setupInteraction(map);
        fetchTilesAndInit();
        loadMarkers();
    }

    function saveMap() {
        const exportScale = 4;

        const originalSize = map.getSize();
        const originalResolution = map.getView().getResolution();
        const originalCenter = map.getView().getCenter();
        const exportSize = [originalSize[0] * exportScale, originalSize[1] * exportScale];
        const exportResolution = originalResolution / exportScale;

        const mapContainer = map.getTargetElement();

        // Show loading spinner
        const spinner = document.createElement('div');
        spinner.id = 'mapExportSpinner';
        spinner.innerHTML = 'Exporting...';
        Object.assign(spinner.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '1rem 2rem',
            borderRadius: '1rem',
            zIndex: 10000,
            fontSize: '1.2rem'
        });
        mapContainer.appendChild(spinner);
        mapContainer.style.pointerEvents = 'none';

        // Set up new size
        mapContainer.style.width = `${exportSize[0]}px`;
        mapContainer.style.height = `${exportSize[1]}px`;
        map.setSize(exportSize);
        map.getView().setResolution(exportResolution);

        map.once('rendercomplete', function () {
            const canvasElements = mapContainer.querySelectorAll('canvas');

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = exportSize[0];
            finalCanvas.height = exportSize[1];
            const finalContext = finalCanvas.getContext('2d');

            canvasElements.forEach(canvas => {
                if (canvas.style.display !== 'none') {
                    finalContext.drawImage(canvas, 0, 0);
                }
            });

            try {
                const image = finalCanvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = image;
                link.download = `${mapName}_marked_map_highres.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                console.error("Error generating image:", err);
            }

            // Restore everything
            mapContainer.removeChild(spinner);
            mapContainer.style.pointerEvents = '';
            mapContainer.style.width = '';
            mapContainer.style.height = '';
            map.setSize(originalSize);
            map.getView().setResolution(originalResolution);
            map.getView().setCenter(originalCenter);
        });

        map.renderSync();
    }

    create_map();
    map.getView().on('change:resolution', updateMarkers);
    document.getElementById("saveMapButton").addEventListener("click", saveMap);

});

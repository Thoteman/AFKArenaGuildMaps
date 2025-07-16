document.addEventListener("DOMContentLoaded", () => {
    let markerColor = "#ff0000";
    let markerType = "circle";
    let markedTiles = new Map();
    let tilePositions = [];

    // Base map layer (static image as tile)
    const map = new ol.Map({
        target: 'map',
        layers: [],
        view: new ol.View({
            center: [0, 0],
            zoom: 2,
            projection: 'EPSG:3857',
        }),
    });

    // Vector source and layer for markers
    const vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({ source: vectorSource });
    map.addLayer(vectorLayer);

    // Utility: convert pixel coords to Web Mercator (fake projection here)
    function toMercator([x, y]) {
        return ol.proj.fromLonLat([x, -y]); // y-negated for image-based alignment
    }

    function drawMarker(tile) {
        const [x, y] = tile.pixel_coords;
        const coords = toMercator([x, y]);
        const hexCoords = tile.hex_coords.join(',');

        const markerFeature = new ol.Feature({
            geometry: new ol.geom.Point(coords),
            name: hexCoords,
        });

        const style = new ol.style.Style({
            image: markerType !== 'hex' ? new ol.style.Circle({
                radius: 8,
                fill: new ol.style.Fill({ color: markedTiles.get(hexCoords) || markerColor }),
                stroke: new ol.style.Stroke({ color: '#000', width: 1 }),
            }) : undefined,

            // Optional hex drawing
            stroke: markerType !== 'circle' ? new ol.style.Stroke({
                color: markedTiles.get(hexCoords) || markerColor,
                width: 2,
            }) : undefined
        });

        markerFeature.setStyle(style);
        vectorSource.addFeature(markerFeature);
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
            .then(response => response.json())
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
        })
        .then(res => res.json())
        .then(result => console.log("Markers saved:", result))
        .catch(err => console.error("Error saving markers:", err));
    }

    function resetHighResolutionMap() {
        markedTiles.clear();
        updateMarkers();
        saveMarkers();
    }

    function changeMarker() {
        if (markerType === "circle") {
            markerType = "hex";
        } else if (markerType === "hex") {
            markerType = "both";
        } else {
            markerType = "circle";
        }
        updateMarkers();
    }

    function setupInteraction() {
        map.on('click', function (evt) {
            const clickCoord = evt.coordinate;
            const lonLat = ol.proj.toLonLat(clickCoord);
            const [clickX, clickY] = [lonLat[0], -lonLat[1]];

            tilePositions.forEach(tile => {
                const [x, y] = tile.pixel_coords;
                const distance = Math.hypot(clickX - x, clickY - y);
                if (distance < 25) {
                    const hexCoords = tile.hex_coords.join(',');
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

        document.getElementById("markerColor").addEventListener("input", (e) => {
            markerColor = e.target.value;
        });

        document.getElementById("resetMapButton").addEventListener("click", resetHighResolutionMap);
        document.getElementById("saveMapButton").addEventListener("click", () => {
            map.once('rendercomplete', () => {
                map.once('postcompose', function (event) {
                    const canvas = event.context.canvas;
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = `${mapName}_map.png`;
                    link.click();
                });
            });
            map.renderSync();
        });

        document.getElementById("changeMarkerButton").addEventListener("click", changeMarker);
    }

    function fetchMapImage() {
        fetch(`/get_map/${mapName}`)
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    const extent = [0, 0, img.width, img.height];
                    const projection = new ol.proj.Projection({
                        code: 'custom-image',
                        units: 'pixels',
                        extent: extent,
                    });

                    const imageLayer = new ol.layer.Image({
                        source: new ol.source.ImageStatic({
                            url: url,
                            imageExtent: extent,
                            projection: projection,
                        })
                    });

                    map.setLayers([imageLayer, vectorLayer]);

                    map.setView(new ol.View({
                        projection: projection,
                        center: ol.extent.getCenter(extent),
                        zoom: 2,
                        maxZoom: 8,
                    }));
                };
                img.src = url;
            });
    }

    function initialize() {
        fetchMapImage();
        fetchTiles();
        loadMarkers();
        setupInteraction();
    }

    initialize();
});

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas.getContext("2d");
    let scale = 1;
    let offset = { x: 0, y: 0 };
    let dragging = false;
    let lastMousePos = null;
    let markedTiles = new Map();  // Map to store tile colors
    let tilePositions = [];
    let mapImage = new Image();

    // Default marker color and type
    let markerColor = "#ff0000";
    let markerType = "circle";

    // Adjust click radius based on zoom scale
    function getClickRadius() {
        const baseClickRadius = 17;
        return baseClickRadius * scale;
    }

    // Render the map with zoom and pan
    function renderMap() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the map image with current scale and offset
        ctx.drawImage(mapImage, offset.x, offset.y, mapImage.width * scale, mapImage.height * scale);

        // Draw markers
        tilePositions.forEach(tile => {
            const [x, y] = tile.pixel_coords;
            const hexCoords = tile.hex_coords.join(',');

            // Use the color stored for this tile, or the default color if not yet marked
            const color = markedTiles.has(hexCoords) ? markedTiles.get(hexCoords) : "#000000"; // default color for unmarked tiles

            if (markerType != "hex") {
                if (markedTiles.has(hexCoords)) {
                    ctx.beginPath();
                    ctx.arc(x * scale + offset.x, y * scale + offset.y, 10 * scale, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                }
            }if (markerType != "circle") {
                if (markedTiles.has(hexCoords)) {
                    const centerX = x * scale + offset.x;
                    const centerY = y * scale + offset.y;
                    const hexSize = mapName === "Hunting Fields" ? 24 * scale : 32 * scale;
                
                    const stretchFactor = 1.1; // Adjust this to widen the hexagon
                
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i - Math.PI / 6;
                        // Stretch the x-coordinate by the stretchFactor
                        const vertexX = centerX + hexSize * Math.cos(angle) * stretchFactor;
                        const vertexY = centerY + hexSize * Math.sin(angle);
                        if (i === 0) {
                            ctx.moveTo(vertexX, vertexY);
                        } else {
                            ctx.lineTo(vertexX, vertexY);
                        }
                    }
                    ctx.closePath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3 * scale;
                    ctx.stroke();
                }
                
            }
            
        });
    }

    // Fetch the map image
    function fetchMap() {
        fetch(`/get_map/${mapName}`)
            .then(response => response.blob())
            .then(blob => {
                mapImage.src = URL.createObjectURL(blob);
                mapImage.onload = () => {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                    renderMap();
                };
            });
    }

    // Fetch the tiles data
    function fetchTiles() {
        fetch(`/get_tiles/${mapName}`)
            .then(response => response.json())
            .then(data => {
                tilePositions = data;
                renderMap(); // Render after tiles load
            });
    }

    // Save markers to the database
    function saveMarkers() {
        const data = {
            map_name: mapName, // Assume mapName is available globally
            markers: Object.fromEntries(markedTiles) // Convert Map to Object
        };

        fetch('/save_markers/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(result => console.log("Markers saved:", result))
            .catch(error => console.error("Error saving markers:", error));
    }

    // Load markers from the database
    function loadMarkers() {
        fetch(`/get_markers/${mapName}`)
            .then(response => response.json())
            .then(data => {
                markedTiles = new Map(Object.entries(data)); // Convert Object to Map
                renderMap();  // Re-render the map with loaded markers
            })
            .catch(error => console.error("Error loading markers:", error));
    }

    // Initialize everything
    function initialize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        fetchMap();
        fetchTiles();
        loadMarkers();

        // Add event listeners
        setupEventListeners();
    }

    // Mouse events for clicking, dragging, and zooming
    function setupEventListeners() {
        canvas.addEventListener("mousedown", e => {
            const mousePos = { x: e.clientX, y: e.clientY };
            if (e.button === 0) { // Left click
                tilePositions.forEach(tile => {
                    const [x, y] = tile.pixel_coords;
                    const adjustedX = x * scale + offset.x;
                    const adjustedY = y * scale + offset.y;
                    const distance = Math.hypot(mousePos.x - adjustedX, mousePos.y - adjustedY);
                    if (distance < getClickRadius()) {
                        const hexCoords = tile.hex_coords.join(',');
                        if (markedTiles.has(hexCoords)) {
                            // If the tile is already marked, remove it
                            markedTiles.delete(hexCoords);
                        } else {
                            // If the tile is not marked, add it with the current color
                            markedTiles.set(hexCoords, markerColor);
                        }
                    }
                });
                renderMap();
                saveMarkers();  // Save markers after any change
            } else if (e.button === 1) { // Middle click (drag)
                dragging = true;
                lastMousePos = mousePos;
            }
        });

        canvas.addEventListener("mouseup", () => {
            dragging = false;
        });

        canvas.addEventListener("mousemove", e => {
            if (dragging && lastMousePos) {
                const mousePos = { x: e.clientX, y: e.clientY };
                const dx = mousePos.x - lastMousePos.x;
                const dy = mousePos.y - lastMousePos.y;
                offset.x += dx;
                offset.y += dy;
                lastMousePos = mousePos;
                renderMap();
            }
        });

        canvas.addEventListener("wheel", e => {
            const mousePos = { x: e.clientX, y: e.clientY };
            const zoomStep = 1.1;
            const oldScale = scale;
            scale = e.deltaY < 0 ? scale * zoomStep : scale / zoomStep;
            offset.x -= (mousePos.x - offset.x) * (scale / oldScale - 1);
            offset.y -= (mousePos.y - offset.y) * (scale / oldScale - 1);
            renderMap();
            e.preventDefault();
        });

        window.addEventListener("resize", () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            renderMap();
        });

        // Update marker color when the user selects a new color
        document.getElementById("markerColor").addEventListener("input", (e) => {
            markerColor = e.target.value;  // Update the marker color based on user input
        });

        // Add functionality for the reset button
        document.getElementById("resetMapButton").addEventListener("click", resetHighResolutionMap);

        // Add functionality for the save button
        document.getElementById("saveMapButton").addEventListener("click", saveHighResolutionMap);

        document.getElementById("changeMarkerButton").addEventListener("click", changeMarker);
    }

    function resetHighResolutionMap() {
        markedTiles = new Map()
        renderMap();
        saveMarkers();
    }

    function saveHighResolutionMap() {
        const highResCanvas = document.createElement("canvas");
        const highResCtx = highResCanvas.getContext("2d");

        highResCanvas.width = mapImage.width;
        highResCanvas.height = mapImage.height;

        highResCtx.drawImage(mapImage, 0, 0, mapImage.width, mapImage.height);

        // Draw markers
        tilePositions.forEach(tile => {
            const [x, y] = tile.pixel_coords;
            const hexCoords = tile.hex_coords.join(',');

            // Use the color stored for this tile, or the default color if not yet marked
            const color = markedTiles.has(hexCoords) ? markedTiles.get(hexCoords) : "#000000"; // default color for unmarked tiles

            if (markerType != "hex") {
                if (markedTiles.has(hexCoords)) {
                    highResCtx.beginPath();
                    highResCtx.arc(x, y, 10, 0, 2 * Math.PI);
                    highResCtx.fillStyle = color;
                    highResCtx.fill();
                }
            } if (markerType != "circle") {
                if (markedTiles.has(hexCoords)) {
                    const centerX = x;
                    const centerY = y;
                    const hexSize = mapName === "Hunting Fields" ? 24 : 32 ;
                
                    const stretchFactor = 1.1; // Adjust this to widen the hexagon
                
                    highResCtx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i - Math.PI / 6;
                        // Stretch the x-coordinate by the stretchFactor
                        const vertexX = centerX + hexSize * Math.cos(angle) * stretchFactor;
                        const vertexY = centerY + hexSize * Math.sin(angle);
                        if (i === 0) {
                            highResCtx.moveTo(vertexX, vertexY);
                        } else {
                            highResCtx.lineTo(vertexX, vertexY);
                        }
                    }
                    highResCtx.closePath();
                    highResCtx.strokeStyle = color;
                    highResCtx.lineWidth = 3;
                    highResCtx.stroke();
                }
                
            }
            
        });

        const dataUrl = highResCanvas.toDataURL('image/jpeg');
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${mapName}_map.jpeg`;
        link.click();
    }

    function changeMarker() {
        if (markerType == "circle") {
            markerType = "hex";
        } else if (markerType = "hex") {
            markerType = "both";
        } else if (markerType == "both") {
            markerType = "circle"
        }
        renderMap();
    }

    initialize();
});

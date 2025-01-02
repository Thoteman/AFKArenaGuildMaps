const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
let scale = 1;
let offset = { x: 0, y: 0 };
let dragging = false;
let lastMousePos = null;
let markedTiles = new Map();  // Map to store tile colors
let tilePositions = [];
let mapImage = new Image();

// Default marker color
let markerColor = "#ff0000";

// Adjust click radius based on zoom scale
function getClickRadius() {
    const baseClickRadius = 32;
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

        if (markedTiles.has(hexCoords)) {
            ctx.beginPath();
            ctx.arc(x * scale + offset.x, y * scale + offset.y, 10 * scale, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
        }
    });
}

// Mouse events for clicking, dragging, and zooming
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

// Hide the button for the current map
window.onload = function() {
    const currentMapButton = document.getElementById(mapName);
    if (currentMapButton) {
        currentMapButton.style.display = 'none'; // Hide the current map button
    }
    loadMarkers(); // Load markers when the page loads
};

// Fetch the map image
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

// Fetch the tiles data
fetch(`/get_tiles/${mapName}`)
    .then(response => response.json())
    .then(data => {
        tilePositions = data;
    });

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

// Add functionality for the save button
document.getElementById("saveMapButton").addEventListener("click", function() {
    // Create a high-definition canvas
    const highResCanvas = document.createElement("canvas");
    const highResCtx = highResCanvas.getContext("2d");

    // Set the size of the high-definition canvas to the full size of the map
    highResCanvas.width = mapImage.width;
    highResCanvas.height = mapImage.height;

    // Render the map image on the high-definition canvas (without scaling)
    highResCtx.drawImage(mapImage, 0, 0, mapImage.width, mapImage.height);

    // Render the markers on the high-resolution canvas
    tilePositions.forEach(tile => {
        const [x, y] = tile.pixel_coords;
        const hexCoords = tile.hex_coords.join(',');

        // Use the color stored for this tile, or the default color if not yet marked
        const color = markedTiles.has(hexCoords) ? markedTiles.get(hexCoords) : "#000000"; // default color for unmarked tiles

        if (markedTiles.has(hexCoords)) {
            highResCtx.beginPath();
            highResCtx.arc(x, y, 10, 0, 2 * Math.PI);  // Use original size for markers
            highResCtx.fillStyle = color;
            highResCtx.fill();
        }
    });

    // Convert the high-definition canvas to a data URL (this will be the full-resolution map image)
    const dataUrl = highResCanvas.toDataURL('image/png');

    // Create a temporary link element to trigger the download
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${mapName}_high_res_map.png`;  // Set the filename as mapName_high_res_map.png

    // Trigger the download by clicking the link
    link.click();
});

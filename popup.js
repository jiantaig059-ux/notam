function createNotamPopup(notam, coordinate) {

  const popup = document.createElement("div");
  popup.className = "ol-popup notam-popup-window";
  popup.style.position = "absolute";
  popup.style.display = "block";

  popup.innerHTML = `
    <div class="popup-header">
      <span>${notam.id || "NOTAM"}</span>
      <button class="popup-close-btn">×</button>
    </div>
    <div class="popup-body">
      ${detailDataHtml(notam)}
    </div>
    <div class="popup-footer">
      <button class="popup-export-btn" type="button">Export</button>
    </div>
  `;

  document.body.appendChild(popup);

  const overlay = new ol.Overlay({
    element: popup,
    autoPan: true,
    autoPanAnimation: { duration: 250 }
  });
  map.addOverlay(overlay);
  overlay.setPosition(coordinate);

  // PC: 右クリックで閉じる
  popup.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    map.removeOverlay(overlay);
    popup.remove();
  });

  // 閉じるボタン（スマホ・PC共通）
  popup.querySelector(".popup-close-btn").addEventListener("click", () => {
    map.removeOverlay(overlay);
    popup.remove();
  });

  popup.querySelector(".popup-export-btn").addEventListener("click", () => {
    downloadNotamGeoJson(notam);
  });

  // PCのみドラッグ移動を有効化
  const isPC = !("ontouchstart" in window);

  if (isPC) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    popup.querySelector(".popup-header").addEventListener("mousedown", (e) => {
      // ボタンを掴んだときはドラッグしない
      if (e.target.closest(".popup-close-btn")) return;

      isDragging = true;
      const rect = popup.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const pixel = [e.clientX - offsetX, e.clientY - offsetY];
      const coord = map.getCoordinateFromPixel(pixel);
      if (coord) overlay.setPosition(coord);
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }
}

function downloadNotamGeoJson(notam) {
  const polygons = notam._polygons || [];
  const features = polygons.map((polygon) => {
    const coordinates = polygon.map(([lat, lon]) => [lon, lat]);
    let geometry;

    if (coordinates.length >= 3) {
      geometry = { type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] };
    } else if (coordinates.length === 2) {
      geometry = { type: "LineString", coordinates };
    } else if (coordinates.length === 1) {
      geometry = { type: "Point", coordinates: coordinates[0] };
    }

    if (!geometry) return null;

    return {
      type: "Feature",
      properties: {
        notam_id: notam.notam_id || "",
        effective: notam.effective || null,
        expiration: notam.expiration || null,
        raw: notam.raw || ""
      },
      geometry
    };
  }).filter(Boolean);

  const geojson = {
    type: "FeatureCollection",
    features
  };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = String(notam.notam_id || "notam").replace(/[^a-z0-9_-]+/gi, "_");
  link.href = url;
  link.download = `${filename || "notam"}.geojson`;
  link.click();
  URL.revokeObjectURL(url);
}

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

// ===============================
//  NOTAM ポップアップ生成関数
// ===============================
function createNotamPopup(notam, coordinate) {

  // --- DOM 生成 ---
  const popup = document.createElement("div");
  popup.className = "ol-popup notam-popup-window";
  popup.style.position = "absolute";
  popup.style.display = "block";

  popup.innerHTML = `
    <div class="popup-header">
      <span>${notam.id || "NOTAM"}</span>
    </div>
    <div class="popup-body">
      ${detailDataHtml(notam)}
    </div>
  `;

  document.body.appendChild(popup);

  // --- Overlay 作成 ---
  const overlay = new ol.Overlay({
    element: popup,
    autoPan: true,
    autoPanAnimation: { duration: 250 }
  });
  map.addOverlay(overlay);

  overlay.setPosition(coordinate);

  // ===============================
  // 右クリックで閉じる
  // ===============================
  popup.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    map.removeOverlay(overlay);
    popup.remove();
  });
  // ===============================
  // ドラッグ処理（Overlay のまま）
  // ===============================
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  popup.querySelector(".popup-header").addEventListener("mousedown", (e) => {
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


// ===============================
//  NOTAM ポリゴンクリック → 新しいポップアップ生成
// ===============================
map.on("singleclick", function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
  if (!feature) return;

  const notam = feature.get("notam");
  if (!notam) return;

  createNotamPopup(notam, evt.coordinate);
});

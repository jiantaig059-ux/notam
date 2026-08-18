// ===============================
//  レイアウト（FIR / NOTAM / 詳細）ドラッグ調整
// ===============================
const firList = document.getElementById('firList');
const notamList = document.getElementById('notamList');
const detail = document.getElementById('detail');
const divider1 = document.getElementById('divider1');
const divider2 = document.getElementById('divider2');

let dragTarget = null;
let startY = 0;
let startFirHeight = 0;
let startNotamHeight = 0;
let startDetailHeight = 0;

divider1.addEventListener('mousedown', function(e) {
  dragTarget = 'firList';
  startY = e.clientY;
  startFirHeight = firList.offsetHeight;
  startNotamHeight = notamList.offsetHeight;
  document.body.style.userSelect = 'none';
});

divider2.addEventListener('mousedown', function(e) {
  dragTarget = 'notamList';
  startY = e.clientY;
  startNotamHeight = notamList.offsetHeight;
  startDetailHeight = detail.offsetHeight;
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', function(e) {
  if (!dragTarget) return;

  if (dragTarget === 'firList') {
    const dy = e.clientY - startY;
    firList.style.height = Math.max(60, startFirHeight + dy) + 'px';
    notamList.style.height = Math.max(60, startNotamHeight - dy) + 'px';
  } else if (dragTarget === 'notamList') {
    const dy = e.clientY - startY;
    notamList.style.height = Math.max(60, startNotamHeight + dy) + 'px';
    detail.style.height = Math.max(60, startDetailHeight - dy) + 'px';
  }
});

document.addEventListener('mouseup', function() {
  dragTarget = null;
  document.body.style.userSelect = '';
});

// ===============================
//  OpenLayers 初期化
// ===============================
let notamLayers = [];
const API_URL = "https://skylink-api.p.rapidapi.com/notams/";
const API_KEY = "48deec6b4fmsh5df2e39dc9b1a6bp1f31a4jsn18f3ee2f9345";

const coordinateCache = new Map();
function fromLonLatCached(lon, lat) {
  const key = `${lon},${lat}`;
  if (coordinateCache.has(key)) return coordinateCache.get(key);
  const projected = ol.proj.fromLonLat([lon, lat]);
  coordinateCache.set(key, projected);
  return projected;
}

window.map = new ol.Map({
  target: 'map',
  renderer: 'webgl',
  layers: [
    new ol.layer.Tile({ source: new ol.source.OSM() })
  ],
  view: new ol.View({
    center: fromLonLatCached(140, 45),
    zoom: 4
  })
});

const vectorSource = new ol.source.Vector();
const vectorLayer = new ol.layer.Vector({ source: vectorSource });
map.addLayer(vectorLayer);

// ===============================
//  NOTAM 詳細（右側パネル）
// ===============================
const notamListEl = document.getElementById("notamList");
const detailEl = document.getElementById("detail");

// ===============================
//  NOTAM 詳細（地図上の浮動パネル）
// ===============================
let floatingDetailEl = null;
let floatingDrag = false;
let floatingStartX = 0;
let floatingStartY = 0;
let floatingStartLeft = 0;
let floatingStartTop = 0;

function initFloatingDetail() {
  floatingDetailEl = document.createElement("div");
  floatingDetailEl.id = "floatingDetail";
  floatingDetailEl.innerHTML = `

  document.body.appendChild(floatingDetailEl);

  floatingDetailEl.querySelector(".floating-detail-close")
    .addEventListener("click", hideFloatingDetail);

  const header = floatingDetailEl.querySelector(".floating-detail-header");
  header.addEventListener("mousedown", startFloatingDrag);

  document.addEventListener("mousemove", handleFloatingDrag);
  document.addEventListener("mouseup", endFloatingDrag);
}

function startFloatingDrag(e) {
  if (e.button !== 0) return;
  floatingDrag = true;
  floatingStartX = e.clientX;
  floatingStartY = e.clientY;
  const rect = floatingDetailEl.getBoundingClientRect();
  floatingStartLeft = rect.left;
  floatingStartTop = rect.top;
  document.body.style.userSelect = "none";
}

function handleFloatingDrag(e) {
  if (!floatingDrag) return;
  const dx = e.clientX - floatingStartX;
  const dy = e.clientY - floatingStartY;
  setFloatingDetailPosition(floatingStartLeft + dx, floatingStartTop + dy);
}

function endFloatingDrag() {
  floatingDrag = false;
  document.body.style.userSelect = "";
}

function setFloatingDetailPosition(x, y) {
  const maxX = window.innerWidth - floatingDetailEl.offsetWidth - 10;
  const maxY = window.innerHeight - floatingDetailEl.offsetHeight - 10;
  floatingDetailEl.style.left = Math.min(Math.max(10, x), maxX) + "px";
  floatingDetailEl.style.top = Math.min(Math.max(10, y), maxY) + "px";
}

function showFloatingDetail(notam, x, y) {
  const body = floatingDetailEl.querySelector(".floating-detail-body");
  body.innerHTML = detailDataHtml(notam);
  floatingDetailEl.style.display = "block";
  setFloatingDetailPosition(x + 12, y + 12);
}

function hideFloatingDetail() {
  floatingDetailEl.style.display = "none";
}

// ===============================
//  NOTAM 日付処理
// ===============================
function parseNotamDateString(value) {
  if (!value) return null;
  const text = String(value).trim();
  const iso = new Date(text);
  if (!isNaN(iso)) return iso;

  let m = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]));

  m = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], 0));

  m = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2]-1, +m[3], 0, 0, 0));

  return null;
}

function formatJst(dateString) {
  const dt = parseNotamDateString(dateString);
  if (!dt) return "-";
  const jst = new Date(dt.getTime() + 9*3600*1000);
  return `${jst.getUTCMonth()+1}月${jst.getUTCDate()}日${String(jst.getUTCHours()).padStart(2,"0")}${String(jst.getUTCMinutes()).padStart(2,"0")}(JST)`;
}

function formatJstRange(eff, exp) {
  return `${formatJst(eff)}-${formatJst(exp)}`;
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#39;");
}

function detailDataHtml(notam) {
  const raw = notam.raw || "";
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const formatted = lines.map(escapeHtml).join("<br>");

  return `
    <h3>${escapeHtml(notam.notam_id || "")}</h3>
    <p><b>期間:</b> ${formatJstRange(notam.effective, notam.expiration)}</p>
    <hr>
    <pre>${formatted}</pre>
  `;
}

// ===============================
//  NOTAM 取得
// ===============================
let currentNotams = [];
let currentIcao = null;

async function loadNotams(icao) {
  vectorSource.clear();
  notamLayers = [];
  notamListEl.innerHTML = `<p>${icao} の NOTAM を取得中…</p>`;
  detailEl.innerHTML = `<p>NOTAM 詳細がここに表示されます。</p>`;
  currentIcao = icao;

  try {
    const res = await fetch(API_URL + icao, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "skylink-api.p.rapidapi.com"
      }
    });
    const data = await res.json();
    currentNotams = data.notams || [];
    renderNotamList();
  } catch (err) {
    notamListEl.innerHTML = `<p>エラー: ${err.message}</p>`;
  }
}

function deleteNotam(notam) {
  currentNotams = currentNotams.filter(n => n !== notam);

  if (notam._features) {
    notam._features.forEach(f => vectorSource.removeFeature(f));
  }

  renderNotamList();
  hideFloatingDetail();
}

// ===============================
//  NOTAM リスト描画
// ===============================
function renderNotamList() {
  vectorSource.clear();
  notamLayers = [];
  hideFloatingDetail();

  const now = new Date();
  const notams = currentNotams.filter(n => {
    const exp = parseNotamDateString(n.expiration);
    return !exp || exp >= now;
  });

  if (notams.length === 0) {
    notamListEl.innerHTML = `<p>${currentIcao} の有効な NOTAM はありません。</p>`;
    return;
  }

  notamListEl.innerHTML = "";

  notams.forEach((n, idx) => {
    const div = document.createElement("div");
    div.className = "notam-title";
    div.textContent = `${idx+1}. ${n.notam_id || ""} ${n.body?.slice(0,40) || ""}`;

    div.onclick = () => {
      detailEl.innerHTML = detailDataHtml(n);
      hideFloatingDetail();

      if (n._polygons?.length > 0) {
        const extent = ol.extent.boundingExtent(n._polygons[0]);
        map.getView().fit(extent, { maxZoom: 9, padding: [20,20,20,20] });
      }
    };

    div.oncontextmenu = (e) => {
      e.preventDefault();
      deleteNotam(n);
    };

    let pressTimer = null;
    div.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => deleteNotam(n), 600);
    });
    div.addEventListener("touchend", () => clearTimeout(pressTimer));
    div.addEventListener("touchmove", () => clearTimeout(pressTimer));

    notamListEl.appendChild(div);

    drawNotamPolygons(n);
  });
}

// ===============================
//  NOTAM ポリゴン描画
// ===============================
function drawNotamPolygons(notam) {
  const polys = extractPolygons(notam.raw);

  notam._features = [];
  notam._polygons = [];

  polys.forEach(poly => {
    const coords = poly.map(pt => fromLonLatCached(pt[1], pt[0]));
    let geometry;

    const isDanger = /DANGER/i.test(notam.raw || "");

    if (poly.length >= 3) {
      geometry = new ol.geom.Polygon([coords]);
    } else if (poly.length >= 2) {
      geometry = new ol.geom.LineString(coords);
    }

    if (!geometry) return;

    const feature = new ol.Feature({ geometry, notam });

    feature.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: isDanger ? "red" : "blue",
        width: 2,
        lineDash: poly.length === 2 ? [6,6] : undefined
      }),
      fill: poly.length >= 3 ? new ol.style.Fill({
        color: isDanger ? "rgba(255,0,0,0.2)" : "rgba(0,0,255,0.2)"
      }) : undefined
    }));

    vectorSource.addFeature(feature);
    notam._features.push(feature);
    notam._polygons.push(coords);
  });
}

// ===============================
//  ★ ポリゴンクリック → ポップアップ表示
// ===============================
map.on("singleclick", function(evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
  if (!feature) return;

  const notam = feature.get("notam");
  if (!notam) return;

  createNotamPopup(notam, evt.coordinate);
});

// ===============================
//  右クリック → NOTAM削除
// ===============================
map.getViewport().addEventListener("contextmenu", function(evt) {
  evt.preventDefault();
  const pixel = map.getEventPixel(evt);
  map.forEachFeatureAtPixel(pixel, function(feature) {
    const notam = feature.get("notam");
    if (!notam) return;
    deleteNotam(notam);
    return true;
  });
});

// ===============================
//  初期化
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initFloatingDetail();

  document.querySelectorAll(".fir-item").forEach(item => {
    item.addEventListener("click", () => {
      loadNotams(item.dataset.fir);
    });
  });
});

// ===============================
//  座標抽出
// ===============================
function extractPolygons(raw) {
  if (!raw) return [];

  let oneline = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
  oneline = oneline.replace(/BACK TO START\.?/gi, "BACK TO START.|");

  const blocks = oneline.split(/(?=\b\d{1,2}\. )/g);
  const polygons = [];

  blocks.forEach(block => {
    const subBlocks = block.split("|");

    subBlocks.forEach(sub => {
      let coords = [];

      const reRu = /(\d{2})(\d{2})(\d{2})N(\d{3})(\d{2})(\d{2})E/g;
      let m;
      while ((m = reRu.exec(sub)) !== null) {
        coords.push(`${m[1]}${m[2]}N${m[4]}${m[5]}E`);
      }

      const reCn = /N(\d{6})E(\d{7})/g;
      let c;
      while ((c = reCn.exec(sub)) !== null) {
        const lat = c[1];
        const lon = c[2];
        coords.push(`${lat.slice(0,2)}${lat.slice(2,4)}N${lon.slice(0,3)}${lon.slice(3,5)}E`);
      }

      const poly = coords.map(pt => parsePointNoSec(pt)).filter(Boolean);

      if (poly.length >= 2) polygons.push(poly);
    });
  });

  return polygons;
}

function parsePointNoSec(pt) {
  const m = pt.match(/(\d{2})(\d{2})N(\d{3})(\d{2})E/);
  if (!m) return null;
  const lat = +m[1] + +m[2]/60;
  const lon = +m[3] + +m[4]/60;
  return [lat, lon];
}

function parsePoint(pt) {
  const m = pt.match(/(\d{2})(\d{2})(\d{2})([NS])(\d{3})(\d{2})(\d{2})([EW])/);
  if (!m) return null;

  let lat = +m[1] + +m[2]/60 + +m[3]/3600;
  let lon = +m[5] + +m[6]/60 + +m[7]/3600;

  if (m[4] === "S") lat = -lat;
  if (m[8] === "W") lon = -lon;

  return [lat, lon];
}

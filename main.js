// --- 高さ可変ドラッグ用 ---
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
          const newFir = Math.max(60, startFirHeight + dy);
          const newNotam = Math.max(60, startNotamHeight - dy);
          firList.style.height = newFir + 'px';
          notamList.style.height = newNotam + 'px';
        } else if (dragTarget === 'notamList') {
          const dy = e.clientY - startY;
          const newNotam = Math.max(60, startNotamHeight + dy);
          const newDetail = Math.max(60, startDetailHeight - dy);
          notamList.style.height = newNotam + 'px';
          detail.style.height = newDetail + 'px';
        }
      });
      document.addEventListener('mouseup', function() {
        dragTarget = null;
        document.body.style.userSelect = '';
      });
    // NOTAMポリゴンレイヤー格納用
    let notamLayers = [];
  const API_URL = "https://skylink-api.p.rapidapi.com/notams/";
  const API_KEY = "48deec6b4fmsh5df2e39dc9b1a6bp1f31a4jsn18f3ee2f9345"; // ←あなたのキー

const coordinateCache = new Map();
function fromLonLatCached(lon, lat) {
  const key = `${lon},${lat}`;
  if (coordinateCache.has(key)) {
    return coordinateCache.get(key);
  }
  const projected = ol.proj.fromLonLat([lon, lat]);
  coordinateCache.set(key, projected);
  return projected;
}

window.map = new ol.Map({
  target: 'map',
  renderer: 'webgl',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: fromLonLatCached(140, 45),
    zoom: 4
  })
});

const vectorSource = new ol.source.Vector();
const vectorLayer = new ol.layer.Vector({
  source: vectorSource
});
map.addLayer(vectorLayer);

const notamListEl = document.getElementById("notamList");
const detailEl = document.getElementById("detail");
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
    <div class="floating-detail-header">
      <span>NOTAM 詳細</span>
      <button type="button" class="floating-detail-close" aria-label="閉じる">&times;</button>
    </div>
    <div class="floating-detail-body"><p>NOTAM を選択してください。</p></div>
  `;
  document.body.appendChild(floatingDetailEl);

  const closeBtn = floatingDetailEl.querySelector(".floating-detail-close");
  closeBtn.addEventListener("click", hideFloatingDetail);

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
  e.preventDefault();
}

function handleFloatingDrag(e) {
  if (!floatingDrag) return;
  const dx = e.clientX - floatingStartX;
  const dy = e.clientY - floatingStartY;
  setFloatingDetailPosition(floatingStartLeft + dx, floatingStartTop + dy);
}

  function endFloatingDrag() {
    if (!floatingDrag) return;
    floatingDrag = false;
    document.body.style.userSelect = "";
  }

  function setFloatingDetailPosition(x, y) {
    if (!floatingDetailEl) return;
    const maxX = Math.max(10, window.innerWidth - floatingDetailEl.offsetWidth - 10);
    const maxY = Math.max(10, window.innerHeight - floatingDetailEl.offsetHeight - 10);
    floatingDetailEl.style.left = Math.min(Math.max(10, x), maxX) + "px";
    floatingDetailEl.style.top = Math.min(Math.max(10, y), maxY) + "px";
  }

  function showFloatingDetail(notam, x, y) {
    if (!floatingDetailEl) return;
    const body = floatingDetailEl.querySelector(".floating-detail-body");
    body.innerHTML = detailDataHtml(notam);
    floatingDetailEl.classList.add("visible");
    floatingDetailEl.style.display = "block";
    setFloatingDetailPosition(x + 12, y + 12);
  }

  function hideFloatingDetail() {
    if (!floatingDetailEl) return;
    floatingDetailEl.classList.remove("visible");
    floatingDetailEl.style.display = "none";
  }

  function parseNotamDateString(value) {
    if (!value) return null;
    const text = String(value).trim();
    // ISO 文字列や標準的な日付形式を優先
    const isoDate = new Date(text);
    if (!isNaN(isoDate.getTime())) return isoDate;
    // YYYYMMDDhhmmss / YYYYMMDDhhmm / YYYYMMDD
    let m = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    m = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0));
    m = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0));
    return null;
  }

  function formatJst(dateString) {
    if (!dateString) return "-";
    const dt = parseNotamDateString(dateString);
    if (!dt || isNaN(dt.getTime())) return dateString;
    const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    const month = jst.getUTCMonth() + 1;
    const day = jst.getUTCDate();
    const hour = String(jst.getUTCHours()).padStart(2, "0");
    const minute = String(jst.getUTCMinutes()).padStart(2, "0");
    return `${month}月${day}日${hour}${minute}(JST)`;
  }

  function formatJstRange(effective, expiration) {
    return `${formatJst(effective)}-${formatJst(expiration)}`;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

function detailDataHtml(notam) {
  const raw = notam.raw || '';
  const lines = raw.split('\n').map(line => line.trim()).filter(line => line);
  const formatted = lines.map(line => escapeHtml(line)).join('<br>');

  const effectiveJst = formatJst(notam.effective);
  const expirationJst = formatJst(notam.expiration);

  return `
    <h3>${escapeHtml(notam.notam_id || '')}</h3>
    <p><b>期間:</b> ${formatJstRange(notam.effective, notam.expiration)}</p>
    <hr>
    <pre>${formatted}</pre>
  `;
}


  // NOTAM 取得
  let currentNotams = [];
  let currentIcao = null;

  async function loadNotams(icao) {
    // 既存のNOTAMポリゴンを地図から削除
    vectorSource.clear();
    notamLayers = [];
    notamListEl.innerHTML = `<p>${icao} の NOTAM を取得中…</p>`;
    detailEl.innerHTML = `<p>NOTAM 詳細がここに表示されます。</p>`;
    currentIcao = icao;
    try {
      const res = await fetch(API_URL + icao, {
        method: "GET",
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
  // currentNotams から削除
  currentNotams = currentNotams.filter(n => n !== notam);

  // map からレイヤー削除
  if (notam._features) {
    notam._features.forEach(feature => vectorSource.removeFeature(feature));
  }

  // 再描画
  renderNotamList();

  hideFloatingDetail();
}

function renderNotamList() {
  // 既存ポリゴン削除
  vectorSource.clear();
  notamLayers = [];

  hideFloatingDetail();

  const now = new Date();

  // expiration が過去のものを除外
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
    div.textContent = `${idx + 1}. ${n.notam_id || ""} ${n.body?.slice(0, 40) || ""}`;

    // 🔵 リストクリック → detailEl（固定パネル）更新
    div.onclick = () => {
      detailEl.innerHTML = detailDataHtml(n);
      hideFloatingDetail();

      if (n._polygons && n._polygons.length > 0) {
        const extent = ol.extent.boundingExtent(n._polygons[0]);
        map.getView().fit(extent, { maxZoom: 9, padding: [20, 20, 20, 20] });
      }
    };

    // 🔴 リスト右クリック → NOTAM削除
    div.oncontextmenu = (e) => {
      e.preventDefault();
      deleteNotam(n);
    };

    notamListEl.appendChild(div);

    // ポリゴン描画
    drawNotamPolygons(n);
  });
}


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

    const feature = new ol.Feature({
      geometry,
      notam
    });
    feature.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: isDanger ? "red" : "blue",
        width: 2,
        lineDash: poly.length === 2 ? [6, 6] : undefined
      }),
      fill: poly.length >= 3 ? new ol.style.Fill({
        color: isDanger ? "rgba(255,0,0,0.2)" : "rgba(0,0,255,0.2)"
      }) : undefined
    }));

    vectorSource.addFeature(feature);
    notamLayers.push(feature);
    notam._features.push(feature);
    notam._polygons.push(coords);
  });
}

map.on('singleclick', function(evt) {
  map.forEachFeatureAtPixel(evt.pixel, function(feature) {
    const notam = feature.get('notam');
    if (!notam) return;
    const mapRect = map.getTargetElement().getBoundingClientRect();
    const x = mapRect.left + evt.pixel[0];
    const y = mapRect.top + evt.pixel[1];
    showFloatingDetail(notam, x, y);
    detailEl.innerHTML = detailDataHtml(notam);
    return true;
  });
});

map.getViewport().addEventListener('contextmenu', function(evt) {
  evt.preventDefault();
  const pixel = map.getEventPixel(evt);
  map.forEachFeatureAtPixel(pixel, function(feature) {
    const notam = feature.get('notam');
    if (!notam) return;
    deleteNotam(notam);
    return true;
  });
});


document.addEventListener("DOMContentLoaded", () => {

  // FIR クリックイベント
  document.querySelectorAll(".fir-item").forEach(item => {
    item.addEventListener("click", () => {
      const fir = item.dataset.fir;
      loadNotams(fir);
    });// 初期表示（例: UHPP）
  });


});

function extractPolygons(raw) {
  if (!raw) return [];

  // 改行を消して1行に
  let oneline = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");

  // ★ 中国 NOTAM 対応：BACK TO START. で強制分割
  oneline = oneline.replace(/BACK TO START\.?/gi, "BACK TO START.|");

  // 1. 2. 3. ... で分割
  let blocks = oneline.split(/(?=\b\d{1,2}\. )/g);

  const polygons = [];

  blocks.forEach(block => {
    // ★ BACK TO START. でさらに分割
    let subBlocks = block.split("|");

    subBlocks.forEach(sub => {
      let coords = [];

      // ロシア式（秒あり）
      const reRu = /(\d{2})(\d{2})(\d{2})N(\d{3})(\d{2})(\d{2})E/g;
      let m;
      while ((m = reRu.exec(sub)) !== null) {
        const lat = m[1] + m[2] + 'N';
        const lon = m[4] + m[5] + 'E';
        coords.push(lat + lon);
      }

      // 中国式（N360500E1120000）
      const reCn = /N(\d{6})E(\d{7})/g;
      let c;
      while ((c = reCn.exec(sub)) !== null) {
        const lat = c[1]; // 360500
        const lon = c[2]; // 1120000

        const latHH = lat.slice(0, 2);
        const latMM = lat.slice(2, 4);
        const lonHHH = lon.slice(0, 3);
        const lonMM = lon.slice(3, 5);

        const pt = `${latHH}${latMM}N${lonHHH}${lonMM}E`;
        coords.push(pt);
      }

      // 十進法に変換
      const poly = coords.map(pt => parsePointNoSec(pt)).filter(p => p !== null);

      if (poly.length > 0) {
        // ポリゴンを閉じる
        if (poly.length >= 3) poly.push(poly[0]);
        polygons.push(poly);
      }
    });
  });

  return polygons;
}



// hhmmNdddmmE → [lat, lon]
function parsePointNoSec(pt) {// 秒なし形式の座標をパース
  // 例: 4228N13308E
  const m = pt.match(/(\d{2})(\d{2})N(\d{3})(\d{2})E/);
  if (!m) return null;
  // 緯度
  const latH = parseInt(m[1], 10);
  const latM = parseInt(m[2], 10);
  const lat = latH + latM / 60;
  // 経度
  const lonH = parseInt(m[3], 10);
  const lonM = parseInt(m[4], 10);
  const lon = lonH + lonM / 60;
  return [lat, lon];
}

// 例: 422800N1330830E（hhmmssNdddmmssE）
function parsePointSimple(pt) {// 秒あり形式の座標をパース
  // 緯度: 6桁N, 経度: 7桁E
  const m = pt.match(/(\d{2})(\d{2})(\d{2})N(\d{3})(\d{2})(\d{2})E/);
  if (!m) return null;
  // 緯度
  const latH = parseInt(m[1], 10);
  const latM = parseInt(m[2], 10);
  const latS = parseInt(m[3], 10);
  const lat = latH + latM / 60 + latS / 3600;
  // 経度
  const lonH = parseInt(m[4], 10);
  const lonM = parseInt(m[5], 10);
  const lonS = parseInt(m[6], 10);
  const lon = lonH + lonM / 60 + lonS / 3600;
  return [lat, lon];
}
function parsePoint(pt) {// 座標をパース
  // 例: 422400N1321500E
  const m = pt.match(/(\d{2})(\d{2})(\d{2})([NS])(\d{3})(\d{2})(\d{2})([EW])/);
  if (!m) return null;

  let lat = parseInt(m[1]) + parseInt(m[2]) / 60 + parseInt(m[3]) / 3600;
  let lon = parseInt(m[5]) + parseInt(m[6]) / 60 + parseInt(m[7]) / 3600;

  if (m[4] === "S") lat = -lat;
  if (m[8] === "W") lon = -lon;

  return [lat, lon];
}



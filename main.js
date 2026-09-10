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
//  スマホ用ボトムシート制御
// ===============================
const mobileSidebar = document.getElementById('sidebar');
let mobileTouchStartY = 0;
let mobileTouchStartX = 0;
let mobileSwipeOpen = false;

function isMobileLayout() {
  return window.matchMedia('(max-width: 480px)').matches;
}

function setMobileSidebarOpen(open) {
  if (!isMobileLayout()) return;
  mobileSwipeOpen = open;
  mobileSidebar.classList.toggle('mobile-open', open);
}

function setupMobileSidebarSwipe() {
  const beginMobileSwipe = (event) => {
    if (!isMobileLayout()) return;
    const point = event.touches?.[0] || event;
    mobileTouchStartY = point.clientY;
    mobileTouchStartX = point.clientX;
  };
// 画面下からのスワイプだけ許可する
function isSwipeFromBottom(startY) {
  const thresholdPx = 60; // ← ここを調整すれば「もっと下から」にできる
  return startY > window.innerHeight - thresholdPx;
}

const endMobileSwipe = (event) => {
  if (!isMobileLayout()) return;
  const point = event.changedTouches?.[0] || event;
  const dy = point.clientY - mobileTouchStartY;
  const dx = Math.abs(point.clientX - mobileTouchStartX);

  // 横移動が大きい場合は無視
  if (dx > 60) return;

  // ★ 追加：スワイプ開始位置が画面下だけ許可
  const fromBottom = isSwipeFromBottom(mobileTouchStartY);

  // ★ 開いていない時 → 下からのスワイプだけで開く
  if (!mobileSwipeOpen && fromBottom && dy < -36) {
    setMobileSidebarOpen(true);
    return;
  }

  // ★ 開いている時 → 上方向のスワイプで閉じる
  if (mobileSwipeOpen && dy > 36) {
    setMobileSidebarOpen(false);
    return;
  }
};


  document.addEventListener('touchstart', beginMobileSwipe, { passive: true });
  document.addEventListener('touchend', endMobileSwipe, { passive: true });
  document.addEventListener('pointerdown', beginMobileSwipe, { passive: true });
  document.addEventListener('pointerup', endMobileSwipe, { passive: true });

  mobileSidebar.addEventListener('click', (e) => {
    if (!isMobileLayout()) return;
    if (e.target.closest('#firGrid') || e.target.closest('.notam-title')) return;
    setMobileSidebarOpen(!mobileSwipeOpen);
  });
}

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

const militarySource = new ol.source.Vector();
const militaryLayer = new ol.layer.Vector({
  source: militarySource,
  style: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: "#8b4513", width: 2 }),
    fill: new ol.style.Fill({ color: "rgba(139, 69, 19, 0.22)" }),
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({ color: "rgba(139, 69, 19, 0.45)" }),
      stroke: new ol.style.Stroke({ color: "#8b4513", width: 2 })
    })
  })
});
map.addLayer(militaryLayer);

let militaryRequestId = 0;
const militaryBaseUrls = {
  liaoning: "https://www.msa.gov.cn/c8896863b1014c438705536a03eb46ff",
  shandong: "https://www.msa.gov.cn/36ea3354c8f84953aba082d6d989c750",
  zhejiang: "https://www.msa.gov.cn/8e10ea74eb9e4c9690f8f891968add80"
};

function normalizeMilitaryLink(base, href) {
  if (!href) return null;
  return new URL(href, `${base}/`).href;
}

function extractMilitaryMissionText(text) {
  const mission = text.match(/(?:辽航警|军事任务).*?禁止驶入/s);
  return mission ? mission[0].trim() : "";
}

function extractMilitaryGeometry(content) {
  const pattern = /(\d{1,3})-(\d{1,2}(?:\.\d+)?)([NS])\s+(\d{1,3})-(\d{1,2}(?:\.\d+)?)([EW])/gi;
  const coordinates = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const latitude = Number(match[1]) + Number(match[2]) / 60;
    const longitude = Number(match[4]) + Number(match[5]) / 60;
    coordinates.push([
      match[6].toUpperCase() === "W" ? -longitude : longitude,
      match[3].toUpperCase() === "S" ? -latitude : latitude
    ]);
  }
  if (coordinates.length >= 3) {
    return { type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] };
  }
  if (coordinates.length === 2) return { type: "LineString", coordinates };
  if (coordinates.length === 1) return { type: "Point", coordinates: coordinates[0] };
  return null;
}

async function fetchMilitaryList(base, page) {
  const response = await fetch(`${base}/index_${page}.jhtml`);
  if (!response.ok) throw new Error(`一覧取得失敗: HTTP ${response.status}`);
  const document = new DOMParser().parseFromString(await response.text(), "text/html");
  return Array.from(document.querySelectorAll("li a"))
    .filter(link => link.textContent.includes("军事"))
    .map(link => ({
      title: link.textContent.trim(),
      url: normalizeMilitaryLink(base, link.getAttribute("href")),
      date: link.closest("li")?.querySelector(".time")?.textContent.trim() || ""
    }))
    .filter(item => item.url);
}

async function fetchMilitaryDetail(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`詳細取得失敗: HTTP ${response.status}`);
  const document = new DOMParser().parseFromString(await response.text(), "text/html");
  const paragraphs = document.querySelectorAll(
    ".content_wrapper.article-wrap .text p, .article-content p, .TRS_Editor p"
  );
  const text = Array.from(paragraphs).map(p => p.textContent.trim()).filter(Boolean).join("\n");
  return extractMilitaryMissionText(text);
}

async function scrapeMilitaryMissions(provinces) {
  const items = [];
  for (const province of provinces) {
    const base = militaryBaseUrls[province];
    for (let page = 1; page <= 5; page++) {
      items.push(...await fetchMilitaryList(base, page));
    }
  }
  for (const item of items) {
    item.content = await fetchMilitaryDetail(item.url);
  }
  return {
    type: "FeatureCollection",
    features: items.map(item => ({
      type: "Feature",
      properties: { title: item.title, url: item.url, date: item.date, content: item.content },
      geometry: extractMilitaryGeometry(item.content)
    })).filter(feature => feature.geometry)
  };
}

async function loadMilitaryMissions(provinces) {
  const requestId = ++militaryRequestId;
  militarySource.clear();
  if (provinces.length === 0) return;

  try {
    const geojson = await scrapeMilitaryMissions(provinces);
    if (requestId !== militaryRequestId) return;
    const features = new ol.format.GeoJSON().readFeatures(geojson, {
      dataProjection: "EPSG:4326",
      featureProjection: map.getView().getProjection()
    });
    militarySource.addFeatures(features);
  } catch (error) {
    if (requestId === militaryRequestId) {
      console.error("海警局データの取得に失敗しました:", error);
    }
  }
}

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
    <div class="floating-detail-body"></div>
  `;
  document.body.appendChild(floatingDetailEl);

  floatingDetailEl.addEventListener("mousedown", startFloatingDrag);
  floatingDetailEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    hideFloatingDetail();
  });

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

    const statusColor = getNotamColor(n.raw);
    div.style.borderLeft = `4px solid ${statusColor}`;

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

    drawNotamPolygons(n, currentIcao);
  });
}

function getNotamStatus(raw) {
  const text = String(raw || "");
  if (/DANGER/i.test(text)) return "danger";
  if (/AIRSPACE\s+CLSD/i.test(text)) return "airspace-clsd";
  return "normal";
}

const NOTAM_COLOR_STORAGE_KEY = "notam-map-colors";
const notamColors = {
  danger: "#d62828",
  "airspace-clsd": "#f28c28",
  normal: "#1f5eff"
};

function loadNotamColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTAM_COLOR_STORAGE_KEY) || "{}");
    Object.keys(notamColors).forEach(status => {
      if (/^#[0-9a-f]{6}$/i.test(saved[status])) {
        notamColors[status] = saved[status];
      }
    });
  } catch (error) {
    // 保存値が壊れていてもデフォルト色で継続する
  }
}

function saveNotamColors() {
  localStorage.setItem(NOTAM_COLOR_STORAGE_KEY, JSON.stringify(notamColors));
}

function colorWithOpacity(hex, opacity) {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

loadNotamColors();

function getNotamColor(raw, isFill = false) {
  const status = getNotamStatus(raw);
  const opacity = status === "danger" ? 0.22 : status === "airspace-clsd" ? 0.28 : 0.18;
  return isFill ? colorWithOpacity(notamColors[status], opacity) : notamColors[status];
}

// ===============================
//  NOTAM ポリゴン描画
// ===============================
function drawNotamPolygons(notam, firCode = currentIcao) {
  const polys = extractPolygons(notam.raw, firCode);

  notam._features = [];
  notam._polygons = [];

  polys.forEach(poly => {
    const coords = poly.map(pt => fromLonLatCached(pt[1], pt[0]));
    let geometry;

    if (poly.length >= 3) {
      geometry = new ol.geom.Polygon([coords]);
    } else if (poly.length === 2) {
      geometry = new ol.geom.LineString(coords);
    } else if (poly.length === 1) {
      geometry = new ol.geom.Point(coords[0]);
    }

    if (!geometry) return;

    const strokeColor = getNotamColor(notam.raw);
    const fillColor = getNotamColor(notam.raw, true);
    const feature = new ol.Feature({ geometry, notam });

    feature.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: strokeColor,
        width: 2,
        lineDash: poly.length === 2 ? [6,6] : undefined
      }),
      fill: poly.length >= 3 ? new ol.style.Fill({ color: fillColor }) : undefined,
      image: poly.length === 1 ? new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: fillColor }),
        stroke: new ol.style.Stroke({ color: strokeColor, width: 2 })
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
  setupMobileSidebarSwipe();
  setMobileSidebarOpen(false);

  const settingsButton = document.getElementById("settingsButton");
  const settingsModal = document.getElementById("settingsModal");
  const colorInputs = settingsModal.querySelectorAll("[data-notam-color]");
  const provinceInputs = settingsModal.querySelectorAll("[name=coastGuardProvince]");
  const provinceStorageKey = "notam-coast-guard-provinces";
  const savedProvinces = JSON.parse(localStorage.getItem(provinceStorageKey) || "[]");
  provinceInputs.forEach(input => {
    input.checked = savedProvinces.includes(input.value);
  });

  async function scrapeSelectedProvinces() {
    const provinces = Array.from(provinceInputs)
      .filter(input => input.checked)
      .map(input => input.value);
    localStorage.setItem(provinceStorageKey, JSON.stringify(provinces));
    await loadMilitaryMissions(provinces);
  }

  const closeSettings = () => {
    settingsModal.hidden = true;
    settingsButton.focus();
  };

  colorInputs.forEach(input => {
    const status = input.dataset.notamColor;
    input.value = notamColors[status];
    input.addEventListener("input", () => {
      notamColors[status] = input.value;
      saveNotamColors();
      if (currentNotams.length > 0) renderNotamList();
    });
  });

  settingsButton.addEventListener("click", () => {
    settingsModal.hidden = false;
    settingsModal.querySelector(".settings-close").focus();
  });
  document.getElementById("startButton").addEventListener("click", async () => {
    const startButton = document.getElementById("startButton");
    startButton.disabled = true;
    startButton.textContent = "読み込み中…";
    closeSettings();
    try {
      await scrapeSelectedProvinces();
    } finally {
      startButton.disabled = false;
      startButton.textContent = "読み込み開始";
    }
  });
  settingsModal.querySelectorAll("[data-settings-close]").forEach((element) => {
    element.addEventListener("click", closeSettings);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settingsModal.hidden) closeSettings();
  });

  document.querySelectorAll(".fir-item").forEach(item => {
    item.addEventListener("click", () => {
      setMobileSidebarOpen(true);
      loadNotams(item.dataset.fir);
    });
  });
});

// ===============================
//  座標抽出
// ===============================
function extractPolygons(raw, firCode = "") {
  if (!raw) return [];

  const oneline = raw
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/BACK TO START\.?/gi, "BACK TO START.|")
    .trim();

  const blocks = oneline.split(/(?=\b\d{1,2}\. )/g);
  const polygons = [];

  blocks.forEach(block => {
    const subBlocks = block.split("|");

    subBlocks.forEach(sub => {
      const points = extractFirCoordinates(sub, firCode);
      if (points.length >= 1) polygons.push(points);
    });
  });

  return polygons;
}

function extractFirCoordinates(sub, firCode = "") {
  const fir = String(firCode || "").toUpperCase();
  const patterns = [];

  if (["UHMM", "UHHH"].includes(fir)) {
    patterns.push(/(\d{5,6})([NS])(\d{6,7})([EW])/g);
    patterns.push(/([NS])(\d{5,6})([EW])(\d{6,7})/g);
  } else if (["ZSHA", "ZBPE"].includes(fir)) {
    patterns.push(/([NS])(\d{5,6})([EW])(\d{6,7})/g);
    patterns.push(/(\d{5,6})([NS])(\d{6,7})([EW])/g);
  } else {// デフォルトパターン
    patterns.push(/(\d{5,6})([NS])\s*(\d{6,7})([EW])/g);
    patterns.push(/([NS])(\d{5,6})([EW])(\d{6,7})/g);
  }

  const points = [];

  patterns.forEach(pattern => {
    let m;
    while ((m = pattern.exec(sub)) !== null) {
      let latValue;
      let latHem;
      let lonValue;
      let lonHem;

      if (m[2] && /[NS]/i.test(m[2])) {
        latValue = m[1];
        latHem = m[2];
        lonValue = m[3];
        lonHem = m[4];
      } else {
        latValue = m[2];
        latHem = m[1];
        lonValue = m[4];
        lonHem = m[3];
      }

      const point = parseDmsCoordinate(latValue, latHem, lonValue, lonHem);
      if (point) points.push(point);
    }
  });

  const unique = [];
  points.forEach(point => {
    const key = `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
    if (!unique.some(existing => `${existing[0].toFixed(6)},${existing[1].toFixed(6)}` === key)) {
      unique.push(point);
    }
  });

  return unique;
}

function parseDmsCoordinate(latValue, latHem, lonValue, lonHem) {
  const lat = parseDms(latValue, latHem);
  const lon = parseDms(lonValue, lonHem);
  if (lat == null || lon == null) return null;
  return [lat, lon];
}

function parseDms(value, hemisphere) {
  if (value == null || hemisphere == null) return null;

  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;

  const isLat = /[NS]/i.test(hemisphere);
  const degreeLen = isLat ? 2 : 3;

  let degrees = 0;
  let minutes = 0;
  let seconds = 0;

  if (digits.length >= degreeLen + 4) {
    degrees = Number(digits.slice(0, degreeLen));
    minutes = Number(digits.slice(degreeLen, degreeLen + 2));
    seconds = Number(digits.slice(degreeLen + 2, degreeLen + 4));
  } else if (digits.length >= degreeLen + 2) {
    degrees = Number(digits.slice(0, degreeLen));
    minutes = Number(digits.slice(degreeLen, degreeLen + 2));
  } else if (digits.length >= degreeLen) {
    degrees = Number(digits.slice(0, degreeLen));
  } else {
    return null;
  }

  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (hemisphere === "S" || hemisphere === "W") decimal *= -1;
  return decimal;
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


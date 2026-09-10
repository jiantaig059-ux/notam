import * as cheerio from "cheerio";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const BASE_URLS = {
    liaoning: "https://www.msa.gov.cn/c8896863b1014c438705536a03eb46ff",
    shandong: "https://www.msa.gov.cn/36ea3354c8f84953aba082d6d989c750",
    zhejiang: "https://www.msa.gov.cn/8e10ea74eb9e4c9690f8f891968add80"
};

// ★ リンク正規化（絶対パス・相対パス両対応）
function normalizeLink(base, href) {
    if (!href) return null;

    if (href.startsWith("http://") || href.startsWith("https://")) {
        return href;
    }
    if (href.startsWith("/")) {
        return "https://www.msa.gov.cn" + href;
    }
    return base + "/" + href;
}

function extractMissionText(fullText) {
    // 軍事任務の文は「辽航警」「渤海」「军事任务」「禁止驶入」などを含む
    const pattern = /(辽航警.*?禁止驶入)/s;

    const match = fullText.match(pattern);
    if (match) {
        return match[1].trim();
    }

    // フォールバック：军事任务〜禁止驶入
    const fallback = /(军事任务.*?禁止驶入)/s;
    const m2 = fullText.match(fallback);
    if (m2) {
        return m2[1].trim();
    }

    return "";
}

function extractGeometry(content) {
    // スペースあり・なし両対応
    const coordinatePattern =
        /(\d{1,3})-(\d{1,2}(?:\.\d+)?)([NS])\s+(\d{1,3})-(\d{1,2}(?:\.\d+)?)([EW])/gi;

    const coordinates = [];
    let match;

    while ((match = coordinatePattern.exec(content)) !== null) {
        const latDeg = Number(match[1]);
        const latMin = Number(match[2]);
        const lonDeg = Number(match[4]);
        const lonMin = Number(match[5]);

        const lat = latDeg + latMin / 60;
        const lon = lonDeg + lonMin / 60;

        coordinates.push([
            match[6].toUpperCase() === "W" ? -lon : lon,
            match[3].toUpperCase() === "S" ? -lat : lat
        ]);
    }

    if (coordinates.length >= 3) {
        return { type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] };
    }
    if (coordinates.length === 2) {
        return { type: "LineString", coordinates };
    }
    if (coordinates.length === 1) {
        return { type: "Point", coordinates: coordinates[0] };
    }
    return null;
}



async function fetchList(base, page) {
    const url = `${base}/index_${page}.jhtml`;

    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!res.ok) {
        console.log(`✖ 取得失敗: ${url}`);
        return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const items = [];

    $("li").each((i, li) => {
        const a = $(li).find("a");
        if (!a.length) return;

        const title = a.text().trim();

        // 軍事系だけフィルタ
        if (!title.includes("军事")) return;

        const rawLink = a.attr("href");
        const link = normalizeLink(base, rawLink);

        const date = $(li).find("span.time").text().trim();

        items.push({
            title,
            url: link,
            date
        });
    });

    return items;
}

async function fetchDetail(url) {
    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!res.ok) {
        console.log(`✖ 詳細ページ取得失敗: ${url}`);
        return { content: "" };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // ★ 最優先：健太が貼ったページの本文構造
    let paragraphs = $(".content_wrapper.article-wrap .text p");

    // ★ フォールバック：他の軍事演练ページの構造
    if (paragraphs.length === 0) {
        paragraphs = $(".article-content p");
    }
    if (paragraphs.length === 0) {
        paragraphs = $(".TRS_Editor p");
    }

    const texts = [];
    paragraphs.each((i, p) => {
        const text = $(p).text().trim();
        if (text.length > 0) {
            texts.push(text);
        }
    });

    const fullText = texts.join("\n");

    // ★ 軍事任務文だけ抽出
    const mission = extractMissionText(fullText);

    return {
        content: mission
    };
}

function toGeoJSON(items) {
    return {
        type: "FeatureCollection",
        features: items.map((item) => ({
            type: "Feature",
            properties: {
                title: item.title,
                url: item.url,
                date: item.date,
                content: item.content
            },
            geometry: extractGeometry(item.content)
        }))
    };
}

export async function scrapeSelected(provinces) {
    const selected = [...new Set(provinces)].filter((province) => BASE_URLS[province]);
    let all = [];

    for (const province of selected) {
        const base = BASE_URLS[province];
        console.log(`=== カテゴリ: ${base} ===`);

        for (let p = 1; p <= 5; p++) {
            const list = await fetchList(base, p);
            console.log(`  index_${p}: ${list.length} 件`);
            all = all.concat(list);
        }
    }

    for (const item of all) {
        const detail = await fetchDetail(item.url);
        item.content = detail.content;
    }

    return toGeoJSON(all);
}


async function main() {
    const geojson = await scrapeSelected(Object.keys(BASE_URLS));
    await writeFile("military-missions.geojson", JSON.stringify(geojson, null, 2), "utf8");

    console.log("=== 軍事演练 GeoJSON 抽出結果（本文付き） ===");
    console.log(JSON.stringify(geojson, null, 2));
    console.log(`保存完了: military-missions.geojson (${geojson.features.length} features)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main();
}

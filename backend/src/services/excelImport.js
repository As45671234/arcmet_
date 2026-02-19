
const XLSX = require("xlsx");

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


async function extractImagesFromZip(buffer, imagesDir) {
  // Fallback: extract all xl/media/* images in order.
  // Returns array of saved URL paths.
  const out = [];
  let JSZip;
  try { JSZip = require("jszip"); } catch (e) { return out; }

  if (!imagesDir) return out;
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch (e) { return out; }

  const media = Object.keys(zip.files)
    .filter((p) => /^xl\/media\//i.test(p) && /\.(png|jpe?g|webp|gif|bmp)$/i.test(p))
    .sort();

  for (const p of media) {
    try {
      const ext = (p.split(".").pop() || "png").toLowerCase();
      const safeExt = ["png","jpg","jpeg","webp","gif","bmp"].includes(ext) ? ext : "png";
      const buf = await zip.file(p).async("nodebuffer");
      const name = crypto.randomBytes(16).toString("hex") + "." + safeExt;
      fs.writeFileSync(path.join(imagesDir, name), buf);
      out.push("/uploads/products/" + name);
    } catch (e) {
      // ignore
    }
  }

  return out;
}

function pickText(xml, tag) {
  const reTag = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = String(xml || "").match(reTag);
  return m ? m[1] : "";
}

function getAttr(s, attr) {
  const reAttr = new RegExp(`${attr}="([^"]+)"`, "i");
  const m = String(s || "").match(reAttr);
  return m ? m[1] : "";
}

function parseIntSafe(v) {
  const n = parseInt(String(v || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

async function extractImagesXlsx(buffer) {
  // Returns map:
  //  - `${sheetName}|${row}` -> { buf, ext }
  //  - `${sheetName}|${row}|${col}` -> { buf, ext }
  const map = new Map();
  let JSZip;
  try { JSZip = require("jszip"); } catch (e) { return map; }

  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch (e) { return map; }

  // workbook: map sheet rid -> { name, sheetPath }
  const workbookXml = zip.file("xl/workbook.xml") ? await zip.file("xl/workbook.xml").async("string") : "";
  const wbRelsXml = zip.file("xl/_rels/workbook.xml.rels") ? await zip.file("xl/_rels/workbook.xml.rels").async("string") : "";

  const wbRelMap = {};
  const relRe = /<Relationship\b[^>]*>/gi;
  let rm;
  while ((rm = relRe.exec(wbRelsXml))) {
    const tag = rm[0];
    const id = getAttr(tag, "Id");
    const target = getAttr(tag, "Target");
    if (id && target) wbRelMap[id] = target.replace(/^\/+/, "");
  }

  const sheetRe = /<sheet\b[^>]*>/gi;
  let sm;
  const sheets = [];
  while ((sm = sheetRe.exec(workbookXml))) {
    const tag = sm[0];
    const name = getAttr(tag, "name") || "Sheet";
    const rid = getAttr(tag, "r:id") || getAttr(tag, "id");
    if (!rid) continue;
    const target = wbRelMap[rid];
    if (!target) continue;
    const sheetPath = target.startsWith("xl/") ? target : "xl/" + target;
    sheets.push({ name: String(name).trim() || "Sheet", sheetPath });
  }

  // drawing rels cache
  const drawingRelsCache = new Map();

  async function getDrawingRelMap(drawingPath) {
    if (drawingRelsCache.has(drawingPath)) return drawingRelsCache.get(drawingPath);

    // xl/drawings/drawing1.xml -> xl/drawings/_rels/drawing1.xml.rels
    const base = drawingPath.split("/").pop() || "";
    const relsPath = "xl/drawings/_rels/" + base + ".rels";
    const xml = zip.file(relsPath) ? await zip.file(relsPath).async("string") : "";
    const map2 = {};
    let m2;
    relRe.lastIndex = 0;
    while ((m2 = relRe.exec(xml))) {
      const tag = m2[0];
      const id = getAttr(tag, "Id");
      const target = getAttr(tag, "Target");
      if (id && target) map2[id] = target;
    }
    drawingRelsCache.set(drawingPath, map2);
    return map2;
  }

  async function getSheetDrawingPath(sheetPath) {
    const sheetXml = zip.file(sheetPath) ? await zip.file(sheetPath).async("string") : "";
    if (!sheetXml) return null;

    // Find <drawing r:id="rIdX"/>
    const dTag = sheetXml.match(/<drawing\b[^>]*\/>/i) || sheetXml.match(/<drawing\b[^>]*>[\s\S]*?<\/drawing>/i);
    if (!dTag) return null;
    const rid = getAttr(dTag[0], "r:id");
    if (!rid) return null;

    // sheet rels: xl/worksheets/sheet1.xml -> xl/worksheets/_rels/sheet1.xml.rels
    const base = sheetPath.split("/").pop() || "";
    const relsPath = "xl/worksheets/_rels/" + base + ".rels";
    const relXml = zip.file(relsPath) ? await zip.file(relsPath).async("string") : "";
    if (!relXml) return null;

    let m3;
    relRe.lastIndex = 0;
    while ((m3 = relRe.exec(relXml))) {
      const tag = m3[0];
      const id = getAttr(tag, "Id");
      const target = getAttr(tag, "Target");
      if (id === rid && target) {
        // targets like "../drawings/drawing1.xml"
        const clean = target.replace(/^\/+/, "");
        const full = clean.startsWith("xl/") ? clean : "xl/worksheets/" + clean;
        // normalize ../
        const parts = full.split("/");
        const norm = [];
        for (const p of parts) {
          if (p === "..") norm.pop();
          else if (p === ".") continue;
          else norm.push(p);
        }
        return norm.join("/");
      }
    }
    return null;
  }

  async function parseDrawing(sheetName, drawingPath) {
    const drawingXml = zip.file(drawingPath) ? await zip.file(drawingPath).async("string") : "";
    if (!drawingXml) return;

    const dRelMap = await getDrawingRelMap(drawingPath);

    const anchorRe = /<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/gi;
    let am;
    while ((am = anchorRe.exec(drawingXml))) {
      const block = am[0];

      const fromXml = pickText(block, "xdr:from");
      const toXml = pickText(block, "xdr:to");
      const fromRow = parseIntSafe(pickText(fromXml, "xdr:row"));
      const fromCol = parseIntSafe(pickText(fromXml, "xdr:col"));
      const toRow = parseIntSafe(pickText(toXml, "xdr:row"));

      if (fromRow === null) continue;

      const rowZero = (toRow !== null) ? Math.round((fromRow + toRow) / 2) : fromRow;
      const row1 = rowZero + 1;
      const col1 = (fromCol !== null) ? (fromCol + 1) : null;

      // a:blip r:embed="rIdX"
      const blip = block.match(/<a:blip\b[^>]*>/i);
      const embed = blip ? (getAttr(blip[0], "r:embed") || getAttr(blip[0], "embed")) : "";
      if (!embed) continue;

      const target = dRelMap[embed];
      if (!target) continue;

      // Target is like "../media/image1.png"
      let mediaPath = target.replace(/^\/+/, "");
      if (!mediaPath.startsWith("xl/")) {
        // drawing is in xl/drawings, so ../media => xl/media
        const parts = ("xl/drawings/" + mediaPath).split("/");
        const norm = [];
        for (const p of parts) {
          if (p === "..") norm.pop();
          else if (p === ".") continue;
          else norm.push(p);
        }
        mediaPath = norm.join("/");
      }

      const f = zip.file(mediaPath);
      if (!f) continue;

      const ext = (mediaPath.split(".").pop() || "png").toLowerCase();
      const safeExt = ["png","jpg","jpeg","webp","gif","bmp"].includes(ext) ? ext : "png";
      const buf = await f.async("nodebuffer");
      if (!buf || !buf.length) continue;

      const obj = { buf, ext: safeExt };

      const rowKey = `${sheetName}|${row1}`;
      if (!map.has(rowKey)) map.set(rowKey, obj);

      if (col1 !== null) {
        const cellKey = `${sheetName}|${row1}|${col1}`;
        if (!map.has(cellKey)) map.set(cellKey, obj);
      }
    }
  }

  for (const sh of sheets) {
    const drawingPath = await getSheetDrawingPath(sh.sheetPath);
    if (!drawingPath) continue;
    await parseDrawing(sh.name, drawingPath);
  }

  return map;
}
const { slugify, parseNumber, isRowEmpty, rowNonEmptyCount } = require("../utils");

const KNOWN_CATEGORIES = [
  "Утеплитель",
  "Protan",
  "Plastfoil",
  "Пеноплэкс",
  "ВОРОНКИ",
  "Аэраторы",
  "Комплектующие",
  "Металл",
  "Трапы",
  "Садовый"
].map((x) => x.toLowerCase());

const PENOPLEX_GROUP_WORDS = [
  "основа",
  "фасад",
  "гео",
  "гео с",
  "кровля",
  "тип 45",
  "тип45"
];

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderMap(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = normalizeHeader(headerRow[i]);
    if (!h) continue;

    if (h.includes("артикул")) map.sku = i;
    if (h === "наименование" || h.includes("наименование материала") || h.includes("наименование")) map.name = i;
    if (h.includes("описание")) map.description = i;

    if (h.includes("толщина")) map.thickness = i;
    if (h.includes("размер")) map.size = i;

    if (h.includes("площадь") && h.includes("пачке")) map.pack_area = i;
    if (h.includes("объем") && h.includes("пачке")) map.pack_volume = i;
    if (h.includes("площадь") && h.includes("рулоне")) map.roll_area = i;

    // some sheets use short units columns for penoplex
    if (h === "м2" || h === "m2") map.pack_area = map.pack_area !== undefined ? map.pack_area : i;
    if (h === "м3" || h === "m3") map.pack_volume = map.pack_volume !== undefined ? map.pack_volume : i;

    // "Количество в упаковке"
    if (h.includes("количество") && h.includes("упаков")) map.pack_qty = i;

    if (h.includes("кратность")) map.pack_qty = i;
    if (h.includes("маркировка")) map.marking = i;
    if (h.includes("изображение")) map.image = i;

    // prices
    if (h === "цена" || h.includes("цена ")) map.price_any = map.price_any || i;
    if (h.includes("закупоч")) map.purchase = i;
    if (h.includes("рекоменд")) map.recommended = i;
    if (h.includes("цена розниц")) map.retail = i;
    if (h.includes("цена для клиент")) map.client = i;
    if (h.includes("интернет-магаз")) map.online = i;
    if (h.includes("от 5")) map.wholesale_5m = i;
    if (h.includes("от 1")) map.wholesale_1m = i;
  }
  return map;
}

function looksLikeHeaderRow(row) {
  const joined = row.map((c) => normalizeHeader(c)).join(" | ");
  return (
    joined.includes("наименование") ||
    joined.includes("артикул") ||
    joined.includes("цена") ||
    (joined.includes("толщина") && joined.includes("упаков"))
  );
}

function looksLikeCategoryTitle(title, currentCategoryTitle) {
  const t = String(title || "").trim();
  if (!t) return false;
  const low = t.toLowerCase();

  // If we are already inside a known top-level category (sheet tabs),
  // do NOT replace it with long descriptive titles. Treat those as groups instead.
  const cur = String(currentCategoryTitle || "").trim();
  if (cur && KNOWN_CATEGORIES.includes(cur.toLowerCase())) {
    const picked = pickCategoryFromTitle(t);
    if (!picked) return false;
  }

  // Don't treat penoplex sub-groups as categories
  if (String(currentCategoryTitle || "").toLowerCase().includes("пеноп")) {
    const isPenoplexGroup = PENOPLEX_GROUP_WORDS.some((w) => low === w || low.startsWith(w + " "));
    if (isPenoplexGroup) return false;
  }

  if (pickCategoryFromTitle(t)) return true;

  // big titles in caps are usually category blocks
  const letters = t.replace(/[^\p{L}]+/gu, "");
  if (letters.length >= 4 && t === t.toUpperCase() && t.includes(" ")) return true;

  // known block keywords
  if (/(воронк|аэратор|дефлектор|крепеж|саморез|опор|инвентар)/i.test(t)) return true;

  return false;
}

function pickCategoryFromTitle(title) {
  const t = String(title || "").trim();
  const low = t.toLowerCase();
  const isKnown = KNOWN_CATEGORIES.some((c) => low === c);
  if (isKnown) return t;

  // If starts with known category
  const found = KNOWN_CATEGORIES.find((c) => low.includes(c));
  return found ? t : null;
}

async function workbookToProducts({ buffer, filename, imagesDir }) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const products = [];

  const isXlsx = filename && String(filename).toLowerCase().endsWith(".xlsx");
  let imagesByRow = new Map();
  let imagesQueue = [];
  let queueIdx = 0;

  if (isXlsx) {
    try {
      imagesByRow = await extractImagesXlsx(buffer);
    } catch (e) {
      imagesByRow = new Map();
    }

    // If we couldn't map images to rows (or exceljs was heavy), fall back to extracting all media files.
    if (!imagesByRow || imagesByRow.size === 0) {
      try {
        imagesQueue = await extractImagesFromZip(buffer, imagesDir);
      } catch (e) {
        imagesQueue = [];
      }
    }
  }


  const normalizeImageValue = (val) => {
    const s = String(val || "").trim();
    if (!s) return "";
    const low = s.toLowerCase();
    const isUrl = /^https?:\/\//i.test(s);
    const hasExt = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(low);
    if (isUrl || hasExt) return s;
    return "";
  };


  for (const sheetName of wb.SheetNames) {
    const sn = String(sheetName || "").trim();
    if (!sn) continue;
    if (/^диаграм/i.test(sn) || /^chart/i.test(sn) || /^diagram/i.test(sn)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    let currentCategoryTitle = String(sheetName || "Каталог").trim();
    let currentGroup = "";
    let headerMap = null;
    let rowMode = "normal";

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (isRowEmpty(row)) continue;

      const nonEmpty = rowNonEmptyCount(row);

      // category/group title row (single cell)
      if (nonEmpty === 1) {
        const title = String(row.find((c) => String(c || "").trim()) || "").trim();
        if (looksLikeCategoryTitle(title, currentCategoryTitle)) {
          currentCategoryTitle = title;
          currentGroup = "";
          headerMap = null;
          rowMode = "normal";
          continue;
        }

        currentGroup = title;
        // If group row explicitly mentions a catalog brand/group, reset mode
        rowMode = "normal";
        continue;
      }

      if (looksLikeHeaderRow(row)) {
        headerMap = buildHeaderMap(row);

        // Special case: Penoplex sheets often don't have a "name" column.
        // They have thickness and other numeric columns.
        const isPenoplex = String(currentCategoryTitle || "").toLowerCase().includes("пеноп");
        if (!headerMap.name && isPenoplex && headerMap.thickness !== undefined) {
          headerMap.name = headerMap.thickness;
          rowMode = "penoplex";
        } else {
          rowMode = "normal";
        }
        continue;
      }

      if (!headerMap || headerMap.name === undefined) continue;

      let name = String(row[headerMap.name] || "").trim();
      if (!name) continue;

      if (rowMode === "penoplex") {
        const thicknessText = name;
        const t = /мм/i.test(thicknessText) ? thicknessText : `${thicknessText} мм`;
        name = `${currentGroup ? currentGroup + " " : ""}${t}`.trim();
      }

      const sku = headerMap.sku !== undefined ? String(row[headerMap.sku] || "").trim() : "";
      const description = headerMap.description !== undefined ? String(row[headerMap.description] || "").trim() : "";

      let image = headerMap.image !== undefined ? normalizeImageValue(row[headerMap.image]) : "";

      // Embedded images in .xlsx: map them by sheet + row (and optionally column),
      // then save to uploads with a stable file name based on the product name (and sku).
      if (!image) {
        const excelRow = r + 1;
        const rowKey = `${sheetName}|${excelRow}`;
        let imgObj = null;

        // In real files, images may be slightly shifted vertically (or anchored to a nearby row).
        // We try the exact row first, then search the nearest rows within a small tolerance.
        const rowCandidates = [excelRow, excelRow + 1, excelRow - 1, excelRow + 2, excelRow - 2].filter((x) => x > 0);

        if (headerMap.image !== undefined) {
          const col1 = headerMap.image + 1;
          for (const rr of rowCandidates) {
            const cellKey = `${sheetName}|${rr}|${col1}`;
            if (imagesByRow.has(cellKey)) { imgObj = imagesByRow.get(cellKey); break; }
          }
        }

        if (!imgObj) {
          for (const rr of rowCandidates) {
            const rk = `${sheetName}|${rr}`;
            if (imagesByRow.has(rk)) { imgObj = imagesByRow.get(rk); break; }
          }
        }

        if (imgObj && imgObj.buf) {
          if (!imagesDir) {
            image = "";
          } else {
            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

            const base = sku ? `${sku}-${name}` : name;
            const baseSlug = slugify(base || "image") || "image";
            const ext = String(imgObj.ext || "png").toLowerCase();
            const safeExt = ["png","jpg","jpeg","webp","gif","bmp"].includes(ext) ? ext : "png";

            let fileName = baseSlug + "." + safeExt;
            let outPath = path.join(imagesDir, fileName);
            let idx = 2;
            while (fs.existsSync(outPath)) {
              fileName = `${baseSlug}-${idx}.${safeExt}`;
              outPath = path.join(imagesDir, fileName);
              idx++;
            }

            fs.writeFileSync(outPath, imgObj.buf);
            image = "/uploads/products/" + fileName;
          }
        }

        // Very last fallback (only if we couldn't map by row): assign next extracted media image in order.
        if (!image && imagesQueue.length && queueIdx < imagesQueue.length) {
          image = imagesQueue[queueIdx];
          queueIdx++;
        }
      }

      const thickness = headerMap.thickness !== undefined ? String(row[headerMap.thickness] || "").trim() : "";
      const size = headerMap.size !== undefined ? String(row[headerMap.size] || "").trim() : "";

      const attrs = {};
      if (thickness) attrs.thickness_mm = thickness;
      if (size) attrs.roll_size_mm = size;

      if (headerMap.pack_area !== undefined) {
        const v = String(row[headerMap.pack_area] || "").trim();
        if (v) attrs.pack_area_m2 = v;
      }
      if (headerMap.pack_volume !== undefined) {
        const n = parseNumber(row[headerMap.pack_volume]);
        if (n !== undefined) attrs.pack_volume_m3 = n;
      }
      if (headerMap.roll_area !== undefined) {
        const v = String(row[headerMap.roll_area] || "").trim();
        if (v) attrs.roll_area_m2 = v;
      }
      if (headerMap.pack_qty !== undefined) {
        const v = String(row[headerMap.pack_qty] || "").trim();
        if (v) attrs.pack_qty = v;
      }
      if (headerMap.marking !== undefined) {
        const v = String(row[headerMap.marking] || "").trim();
        if (v) attrs.marking = v;
      }

      const prices = {};
      const retail = headerMap.retail !== undefined ? parseNumber(row[headerMap.retail]) : undefined;
      const recommended = headerMap.recommended !== undefined ? parseNumber(row[headerMap.recommended]) : undefined;
      const purchase = headerMap.purchase !== undefined ? parseNumber(row[headerMap.purchase]) : undefined;
      const client = headerMap.client !== undefined ? parseNumber(row[headerMap.client]) : undefined;
      const online = headerMap.online !== undefined ? parseNumber(row[headerMap.online]) : undefined;
      const w5 = headerMap.wholesale_5m !== undefined ? parseNumber(row[headerMap.wholesale_5m]) : undefined;
      const w1 = headerMap.wholesale_1m !== undefined ? parseNumber(row[headerMap.wholesale_1m]) : undefined;

      if (retail !== undefined) prices.retail = retail;
      else if (recommended !== undefined) prices.retail = recommended;
      else if (purchase !== undefined && rowMode === "penoplex") prices.retail = purchase;
      else if (headerMap.price_any !== undefined) {
        const any = parseNumber(row[headerMap.price_any]);
        if (any !== undefined) prices.retail = any;
      }

      if (purchase !== undefined) prices.purchase = purchase;
      if (recommended !== undefined) prices.recommended = recommended;
      if (client !== undefined) prices.client = client;
      if (online !== undefined) prices.online = online;
      if (w5 !== undefined) prices.wholesale_5m = w5;
      if (w1 !== undefined) prices.wholesale_1m = w1;

      // note / "по запросу"
      const rowText = row.map((c) => String(c || "")).join(" ").toLowerCase();
      if (rowText.includes("по запросу")) prices.note = "Цена по запросу";

      const category_id = slugify(currentCategoryTitle || sheetName);
      const brandOrGroup = currentGroup || "";

      const keyBase = sku ? `sku:${sku}` : `${category_id}|${slugify(brandOrGroup)}|${slugify(name)}|${slugify(thickness)}|${slugify(size)}`;
      const key = slugify(keyBase);

      products.push({
        key,
        category_id,
        category_title: currentCategoryTitle,
        name,
        brandOrGroup,
        unit: "шт",
        sku,
        image,
        description,
        prices,
        attrs,
        inStock: true,
        active: true
      });
    }
  }

  return products;
}

module.exports = { workbookToProducts };
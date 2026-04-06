
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

function cellRefToRowCol(cellRef) {
  const m = String(cellRef || "").toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1];
  const row = parseIntSafe(m[2]);
  if (row === null) return null;

  let col = 0;
  for (const ch of letters) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }

  return { row, col };
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

      // Use top-left anchor row (fromRow) — more reliable than midpoint for cell-anchored images
      const row1 = fromRow + 1;
      // Also register at midpoint row for floating images that span multiple rows
      const rowMid = (toRow !== null) ? Math.round((fromRow + toRow) / 2) + 1 : row1;
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

      // Register at top-anchor row (primary) and midpoint row (secondary)
      for (const rr of Array.from(new Set([row1, rowMid]))) {
        const rowKey = `${sheetName}|${rr}`;
        if (!map.has(rowKey)) map.set(rowKey, obj);
        if (col1 !== null) {
          const cellKey = `${sheetName}|${rr}|${col1}`;
          if (!map.has(cellKey)) map.set(cellKey, obj);
        }
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

async function extractRichValueImagesXlsx(buffer) {
  const map = new Map();
  let JSZip;
  try { JSZip = require("jszip"); } catch (e) { return map; }

  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch (e) { return map; }

  const richValueRelXml = zip.file("xl/richData/richValueRel.xml")
    ? await zip.file("xl/richData/richValueRel.xml").async("string")
    : "";
  const richValueRelRelsXml = zip.file("xl/richData/_rels/richValueRel.xml.rels")
    ? await zip.file("xl/richData/_rels/richValueRel.xml.rels").async("string")
    : "";
  const richValueXml = zip.file("xl/richData/rdrichvalue.xml")
    ? await zip.file("xl/richData/rdrichvalue.xml").async("string")
    : "";
  const metadataXml = zip.file("xl/metadata.xml")
    ? await zip.file("xl/metadata.xml").async("string")
    : "";
  const workbookXml = zip.file("xl/workbook.xml")
    ? await zip.file("xl/workbook.xml").async("string")
    : "";
  const wbRelsXml = zip.file("xl/_rels/workbook.xml.rels")
    ? await zip.file("xl/_rels/workbook.xml.rels").async("string")
    : "";

  if (!richValueRelXml || !richValueRelRelsXml || !richValueXml || !metadataXml || !workbookXml || !wbRelsXml) {
    return map;
  }

  const richRelOrder = [];
  const richRelTagRe = /<rel\b[^>]*r:id="([^"]+)"[^>]*\/>/gi;
  let relOrderMatch;
  while ((relOrderMatch = richRelTagRe.exec(richValueRelXml))) {
    richRelOrder.push(relOrderMatch[1]);
  }

  const relTargetMap = {};
  const relTagRe = /<Relationship\b[^>]*>/gi;
  let relMatch;
  while ((relMatch = relTagRe.exec(richValueRelRelsXml))) {
    const tag = relMatch[0];
    const id = getAttr(tag, "Id");
    const target = getAttr(tag, "Target");
    if (id && target) relTargetMap[id] = target;
  }

  const localImageObjects = [];
  const rvRe = /<rv\b[^>]*>[\s\S]*?<\/rv>/gi;
  let rvMatch;
  while ((rvMatch = rvRe.exec(richValueXml))) {
    const block = rvMatch[0];
    const values = Array.from(block.matchAll(/<v>([\s\S]*?)<\/v>/gi)).map((m) => String(m[1] || "").trim());
    const relIndex = parseIntSafe(values[0]);
    if (relIndex === null) {
      localImageObjects.push(null);
      continue;
    }

    const rid = richRelOrder[relIndex];
    const target = rid ? relTargetMap[rid] : "";
    if (!target) {
      localImageObjects.push(null);
      continue;
    }

    const parts = (`xl/richData/${target}`).split("/");
    const norm = [];
    for (const p of parts) {
      if (p === "..") norm.pop();
      else if (p === "." || !p) continue;
      else norm.push(p);
    }
    const mediaPath = norm.join("/");
    const file = zip.file(mediaPath);
    if (!file) {
      localImageObjects.push(null);
      continue;
    }

    const buf = await file.async("nodebuffer");
    const ext = String((mediaPath.split(".").pop() || "png")).toLowerCase();
    const safeExt = ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext) ? ext : "png";
    localImageObjects.push(buf && buf.length ? { buf, ext: safeExt } : null);
  }

  const vmToRichIndex = {};
  const valueMetadataMatch = metadataXml.match(/<valueMetadata\b[^>]*>([\s\S]*?)<\/valueMetadata>/i);
  if (valueMetadataMatch) {
    const bkBlocks = valueMetadataMatch[1].match(/<bk>[\s\S]*?<\/bk>/gi) || [];
    bkBlocks.forEach((bk, idx) => {
      const rc = bk.match(/<rc\b[^>]*v="(\d+)"[^>]*\/>/i);
      if (rc) vmToRichIndex[idx + 1] = parseIntSafe(rc[1]);
    });
  }

  const wbRelMap = {};
  let wbRelMatch;
  while ((wbRelMatch = relTagRe.exec(wbRelsXml))) {
    const tag = wbRelMatch[0];
    const id = getAttr(tag, "Id");
    const target = getAttr(tag, "Target");
    if (id && target) wbRelMap[id] = target.replace(/^\/+/, "");
  }

  const sheetRe = /<sheet\b[^>]*>/gi;
  let sheetMatch;
  const sheets = [];
  while ((sheetMatch = sheetRe.exec(workbookXml))) {
    const tag = sheetMatch[0];
    const name = getAttr(tag, "name") || "Sheet";
    const rid = getAttr(tag, "r:id") || getAttr(tag, "id");
    const target = rid ? wbRelMap[rid] : "";
    if (!target) continue;
    const sheetPath = target.startsWith("xl/") ? target : `xl/${target}`;
    sheets.push({ name: String(name).trim() || "Sheet", sheetPath });
  }

  for (const sh of sheets) {
    const sheetXml = zip.file(sh.sheetPath) ? await zip.file(sh.sheetPath).async("string") : "";
    if (!sheetXml) continue;

    const cellTags = sheetXml.match(/<c\b[^>]*>/gi) || [];
    for (const tag of cellTags) {
      const vm = parseIntSafe(getAttr(tag, "vm"));
      const cellRef = getAttr(tag, "r");
      if (vm === null || !cellRef) continue;

      const richIndex = vmToRichIndex[vm];
      if (richIndex === undefined || richIndex === null) continue;
      const imageObj = localImageObjects[richIndex];
      if (!imageObj) continue;

      const pos = cellRefToRowCol(cellRef);
      if (!pos) continue;

      const rowKey = `${sh.name}|${pos.row}`;
      const cellKey = `${sh.name}|${pos.row}|${pos.col}`;
      map.set(cellKey, imageObj);
      if (!map.has(rowKey)) map.set(rowKey, imageObj);
    }
  }

  return map;
}

async function extractImagesExcelJs(buffer) {
  const map = new Map();
  let ExcelJS;
  try { ExcelJS = require("exceljs"); } catch (e) { return map; }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (e) {
    return map;
  }

  const mediaList = Array.isArray(workbook.model?.media) ? workbook.model.media : [];
  const mediaById = new Map();
  for (const media of mediaList) {
    if (media?.index !== undefined) mediaById.set(Number(media.index), media);
    if (media?.id !== undefined) mediaById.set(Number(media.id), media);
  }

  for (const worksheet of workbook.worksheets || []) {
    const sheetName = String(worksheet?.name || "").trim();
    if (!sheetName || typeof worksheet.getImages !== "function") continue;

    const images = worksheet.getImages();
    for (const imageRef of images) {
      const range = imageRef?.range || {};
      const tl = range.tl || {};
      const br = range.br || {};

      const fromRow = Number.isFinite(tl.nativeRow) ? tl.nativeRow : null;
      const fromCol = Number.isFinite(tl.nativeCol) ? tl.nativeCol : null;
      const toRow = Number.isFinite(br.nativeRow) ? br.nativeRow : fromRow;
      const toCol = Number.isFinite(br.nativeCol) ? br.nativeCol : fromCol;
      if (fromRow === null || fromCol === null) continue;

      // Use top-left anchor for primary key; also register midpoint for floating images
      const row1 = fromRow + 1;
      const col1 = fromCol + 1;
      const rowMid = Number.isFinite(toRow) ? Math.round((fromRow + toRow) / 2) + 1 : row1;
      const colMid = Number.isFinite(toCol) ? Math.round((fromCol + toCol) / 2) + 1 : col1;

      const media = mediaById.get(Number(imageRef.imageId));
      if (!media) continue;

      let buf = null;
      if (Buffer.isBuffer(media.buffer)) buf = media.buffer;
      else if (typeof media.base64 === "string" && media.base64) buf = Buffer.from(media.base64, "base64");
      if (!buf || !buf.length) continue;

      const ext = String(media.extension || media.type || "png").replace(/^\./, "").toLowerCase();
      const safeExt = ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext) ? ext : "png";
      const obj = { buf, ext: safeExt };

      // Register both top-anchor and midpoint positions
      for (const [rr, cc] of [[row1, col1], [rowMid, colMid]]) {
        const rowKey = `${sheetName}|${rr}`;
        const cellKey = `${sheetName}|${rr}|${cc}`;
        if (!map.has(cellKey)) map.set(cellKey, obj);
        if (!map.has(rowKey)) map.set(rowKey, obj);
      }
    }
  }

  return map;
}
const { slugify, parseNumber, isRowEmpty, rowNonEmptyCount, getImportSupplier, buildProductKey } = require("../utils");

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
    .replace(/[._]+/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderMap(headerRow) {
  const knownIndices = new Set();
  const map = { imageColumns: [], attrColumns: [] };

  const mark = (idx) => { knownIndices.add(idx); return idx; };

  for (let i = 0; i < headerRow.length; i++) {
    const rawHeader = String(headerRow[i] || "").trim();
    const h = normalizeHeader(rawHeader);
    if (!h) continue;

    if (h.includes("артикул")) { map.sku = mark(i); continue; }
    if (
      h === "наименование" ||
      h.includes("наименование материала") ||
      h.includes("наименование") ||
      h.includes("номенклатур")
    ) { map.name = mark(i); continue; }
    if (h.includes("описание")) { map.description = mark(i); continue; }
    if (/(^ед\s*изм$)|(^ед\s*изм\s*$)|(^единица\s*измерения$)|(^ед\s*изм\b)/i.test(h)) { map.unit = mark(i); continue; }
    if (h.includes("количеств") || h === "остаток") { map.quantity = mark(i); continue; }

    // Subcategory column (новый: "Подкатегория", "Sub", "Группа товара")
    if (h.includes("подкатегори") || h.includes("sub categ") || h === "subcat" || h === "sub" || h === "группа товара") {
      map.subcategory = mark(i); continue;
    }

    // Characteristics column - format "Ключ: Значение; Ключ2: Значение2"
    if (h.includes("характеристик") || h === "specs" || h === "attributes") {
      map.characteristics = mark(i); continue;
    }

    if (h.includes("толщина")) { map.thickness = mark(i); continue; }
    if (h.includes("размер")) { map.size = mark(i); continue; }

    if (h.includes("площадь") && h.includes("пачке")) { map.pack_area = mark(i); continue; }
    if (h.includes("объем") && h.includes("пачке")) { map.pack_volume = mark(i); continue; }
    if (h.includes("площадь") && h.includes("рулоне")) { map.roll_area = mark(i); continue; }

    if (h === "м2" || h === "m2") { map.pack_area = map.pack_area !== undefined ? map.pack_area : mark(i); continue; }
    if (h === "м3" || h === "m3") { map.pack_volume = map.pack_volume !== undefined ? map.pack_volume : mark(i); continue; }

    if (h.includes("количество") && h.includes("упаков")) { map.pack_qty = mark(i); continue; }
    if (h.includes("кратность")) { map.pack_qty = mark(i); continue; }
    if (h.includes("маркировка")) { map.marking = mark(i); continue; }
    if (h.includes("изображение") || h.includes("картинк") || h.includes("фото")) {
      const numMatch = h.match(/(\d+)/);
      if (numMatch) map.imageColumns.push(mark(i));
      else { map.image = mark(i); }
      continue;
    }

    // prices
    if (h === "цена" || h.includes("цена ")) { map.price_any = map.price_any || mark(i); continue; }
    if (h.includes("закупоч")) { map.purchase = mark(i); continue; }
    if (h.includes("рекоменд")) { map.recommended = mark(i); continue; }
    if (h.includes("цена розниц")) { map.retail = mark(i); continue; }
    if (h.includes("цена для клиент")) { map.client = mark(i); continue; }
    if (h.includes("интернет-магаз")) { map.online = mark(i); continue; }
    if (h.includes("от 5")) { map.wholesale_5m = mark(i); continue; }
    if (h.includes("от 1")) { map.wholesale_1m = mark(i); continue; }
  }

  // Second pass: any non-empty header column not already claimed → generic attribute column
  for (let i = 0; i < headerRow.length; i++) {
    const rawHeader = String(headerRow[i] || "").trim();
    if (!rawHeader || knownIndices.has(i)) continue;
    const h = normalizeHeader(rawHeader);
    if (!h) continue;
    map.attrColumns.push({ index: i, label: rawHeader });
  }

  return map;
}

function looksLikeHeaderRow(row) {
  const joined = row.map((c) => normalizeHeader(c)).join(" | ");

  const hasName  = joined.includes("наименование") || joined.includes("номенклатур");
  const hasSku   = joined.includes("артикул");
  const hasPrice = joined.includes("цена");
  const hasMeas  = joined.includes("ед изм");
  const hasQty   = joined.includes("количеств");
  const hasThickAndPack = joined.includes("толщина") && joined.includes("упаков");

  const score = [hasName, hasSku, hasPrice, hasMeas, hasQty, hasThickAndPack].filter(Boolean).length;

  // Require at least 2 matching keywords to avoid false positives on data rows
  // that happen to contain "цена" or "артикул" in their description/name
  return score >= 2;
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

function uniqueNonEmpty(list) {
  return Array.from(new Set((list || []).map((item) => String(item || "").trim()).filter(Boolean)));
}

function saveEmbeddedImage({ imageObj, imagesDir, baseName }) {
  if (!imageObj || !imageObj.buf || !imagesDir) return "";
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  const baseSlug = slugify(baseName || "image") || "image";
  const ext = String(imageObj.ext || "png").toLowerCase();
  const safeExt = ["png","jpg","jpeg","webp","gif","bmp"].includes(ext) ? ext : "png";

  let fileName = `${baseSlug}.${safeExt}`;
  let outPath = path.join(imagesDir, fileName);
  let idx = 2;
  while (fs.existsSync(outPath)) {
    fileName = `${baseSlug}-${idx}.${safeExt}`;
    outPath = path.join(imagesDir, fileName);
    idx++;
  }

  fs.writeFileSync(outPath, imageObj.buf);
  return `/uploads/products/${fileName}`;
}

function resolveEmbeddedImage({ imagesByRow, sheetName, excelRow, columnIndex, strictColumn, usedKeys, sameRowOnly }) {
  const rowCandidates = sameRowOnly
    ? [excelRow]
    : [excelRow, excelRow + 1, excelRow - 1, excelRow + 2, excelRow - 2].filter((x) => x > 0);

  if (columnIndex !== undefined && columnIndex !== null) {
    const col1 = columnIndex + 1;
    const colCandidates = [col1, col1 - 1, col1 + 1, col1 - 2, col1 + 2].filter((x) => x > 0);

    for (const rr of rowCandidates) {
      for (const cc of colCandidates) {
        const cellKey = `${sheetName}|${rr}|${cc}`;
        if (!imagesByRow.has(cellKey)) continue;
        if (usedKeys && usedKeys.has(cellKey)) continue;
        if (usedKeys) usedKeys.add(cellKey);
        return imagesByRow.get(cellKey);
      }
    }

    if (strictColumn) return null;
  }

  for (const rr of rowCandidates) {
    const rowKey = `${sheetName}|${rr}`;
    if (!imagesByRow.has(rowKey)) continue;
    if (usedKeys && usedKeys.has(rowKey)) continue;
    if (usedKeys) usedKeys.add(rowKey);
    return imagesByRow.get(rowKey);
  }

  return null;
}

async function workbookToProducts({ buffer, filename, imagesDir, supplier }) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const products = [];
  const supplierMeta = supplier ? getImportSupplier(supplier) : null;

  const isXlsx = filename && String(filename).toLowerCase().endsWith(".xlsx");
  let imagesByRow = new Map();

  const mergeImageMaps = (targetMap, sourceMap) => {
    if (!sourceMap || typeof sourceMap.forEach !== "function") return;
    sourceMap.forEach((value, key) => {
      if (!targetMap.has(key)) targetMap.set(key, value);
    });
  };

  if (isXlsx) {
    let richMap = new Map();
    let excelJsMap = new Map();
    let zipDrawingMap = new Map();

    try {
      richMap = await extractRichValueImagesXlsx(buffer);
    } catch (e) {
      richMap = new Map();
    }

    try {
      excelJsMap = await extractImagesExcelJs(buffer);
    } catch (e) {
      excelJsMap = new Map();
    }

    try {
      zipDrawingMap = await extractImagesXlsx(buffer);
    } catch (e) {
      zipDrawingMap = new Map();
    }

    // Some files are only partially handled by one parser. Merge all extracted keys.
    mergeImageMaps(imagesByRow, richMap);
    mergeImageMaps(imagesByRow, excelJsMap);
    mergeImageMaps(imagesByRow, zipDrawingMap);
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

  const extractUrlFromImageFormula = (formula) => {
    const f = String(formula || "").trim();
    if (!f) return "";

    // Excel IMAGE("https://...", ...) and localized separators.
    const m = f.match(/IMAGE\s*\(\s*"([^"]+)"/i) || f.match(/IMAGE\s*\(\s*'([^']+)'/i);
    return m ? String(m[1] || "").trim() : "";
  };

  const extractImageUrlFromCell = (wsLocal, excelRow, columnIndex) => {
    if (columnIndex === undefined || columnIndex === null) return "";
    if (!wsLocal) return "";

    const cellRef = XLSX.utils.encode_cell({ r: Math.max(0, excelRow - 1), c: Math.max(0, columnIndex) });
    const cell = wsLocal[cellRef];
    if (!cell) return "";

    // 1) Formula IMAGE("url")
    const fromFormula = extractUrlFromImageFormula(cell.f);
    if (fromFormula) return normalizeImageValue(fromFormula);

    // 2) Hyperlink target
    const fromLink = String(cell?.l?.Target || "").trim();
    if (fromLink) return normalizeImageValue(fromLink);

    // 3) Direct cell value string
    return normalizeImageValue(cell.v);
  };


  for (const sheetName of wb.SheetNames) {
    const sn = String(sheetName || "").trim();
    if (!sn) continue;
    if (/^диаграм/i.test(sn) || /^chart/i.test(sn) || /^diagram/i.test(sn)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    let currentCategoryTitle = supplierMeta ? supplierMeta.title : String(sheetName || "Каталог").trim();
    let currentGroup = "";
    let headerMap = null;
    let rowMode = "normal";
    const defaultGroup = supplierMeta && wb.SheetNames.length > 1 ? sn : "";

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (isRowEmpty(row)) continue;

      const nonEmpty = rowNonEmptyCount(row);

      // category/group title row (single cell)
      // Only treat as group title BEFORE a header is found, or if it truly looks like a category.
      // Once headerMap is established, a single-cell row could be a product with sparse data — fall through.
      if (nonEmpty === 1 && !headerMap) {
        const title = String(row.find((c) => String(c || "").trim()) || "").trim();
        if (!supplierMeta && looksLikeCategoryTitle(title, currentCategoryTitle)) {
          currentCategoryTitle = title;
          currentGroup = "";
          headerMap = null;
          rowMode = "normal";
          continue;
        }

        currentGroup = title;
        rowMode = "normal";
        continue;
      }

      // After headerMap is found, single-cell rows are still checked as potential group labels
      // only if they don't look like a product name (i.e. no digits, no Latin chars, very short).
      if (nonEmpty === 1 && headerMap) {
        const title = String(row.find((c) => String(c || "").trim()) || "").trim();
        const looksLikeLabel = title.length < 60 && !/\d/.test(title) && !/[a-zA-Z]{3}/.test(title);
        if (looksLikeLabel && looksLikeCategoryTitle(title, currentCategoryTitle)) {
          currentGroup = title;
          continue;
        }
        // Otherwise fall through and try to parse as product (name-only row)
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
      const unit = headerMap.unit !== undefined ? String(row[headerMap.unit] || "").trim() : "";
      const stockQty = headerMap.quantity !== undefined ? parseNumber(row[headerMap.quantity]) : undefined;
      // Subcategory: explicit column beats single-cell group row
      const subcategoryFromCol = headerMap.subcategory !== undefined ? String(row[headerMap.subcategory] || "").trim() : "";
      const excelRow = r + 1;

      const imageColumns = headerMap.imageColumns && headerMap.imageColumns.length
        ? headerMap.imageColumns
        : (headerMap.image !== undefined ? [headerMap.image] : []);
      const usedImageKeys = new Set();

      let images = uniqueNonEmpty(imageColumns.map((columnIndex) => normalizeImageValue(row[columnIndex])));

      // Extra fallback: image URLs in formula/hyperlink cells (e.g. IMAGE("https://..."))
      if (imageColumns.length) {
        for (const columnIndex of imageColumns) {
          const fromCell = extractImageUrlFromCell(ws, excelRow, columnIndex);
          if (fromCell) images.push(fromCell);
        }
      }

      for (const columnIndex of imageColumns) {
        const embedded = resolveEmbeddedImage({
          imagesByRow,
          sheetName,
          excelRow,
          columnIndex,
          strictColumn: true,
          sameRowOnly: true,
          usedKeys: usedImageKeys
        });
        const saved = saveEmbeddedImage({
          imageObj: embedded,
          imagesDir,
          baseName: `${sku || name}-${columnIndex + 1}`
        });
        if (saved) images.push(saved);
      }

      // Fallback: if no images found with strict matching, retry with row/col tolerance (±2)
      if (images.length === 0) {
        const fallbackCols = imageColumns.length > 0
          ? imageColumns
          : (headerMap.image !== undefined ? [headerMap.image] : [undefined]);
        for (let fi = 0; fi < fallbackCols.length; fi++) {
          const fbCol = fallbackCols[fi];
          const embedded = resolveEmbeddedImage({
            imagesByRow,
            sheetName,
            excelRow,
            columnIndex: fbCol,
            strictColumn: false,
            sameRowOnly: false,
            usedKeys: usedImageKeys
          });
          const saved = saveEmbeddedImage({
            imageObj: embedded,
            imagesDir,
            baseName: `${sku || name}-${fi + 1}`
          });
          if (saved) images.push(saved);
        }
      }

      images = uniqueNonEmpty(images);
      const image = images[0] || "";

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

      // Parse "Характеристики" column: "Ключ: Значение; Ключ2: Значение2"
      if (headerMap.characteristics !== undefined) {
        const charStr = String(row[headerMap.characteristics] || "").trim();
        if (charStr) {
          // Support both ";" and newline separators
          const pairs = charStr.split(/[;\n]+/);
          for (const pair of pairs) {
            const colonIdx = pair.indexOf(":");
            if (colonIdx < 1) continue;
            const key = pair.slice(0, colonIdx).trim();
            const val = pair.slice(colonIdx + 1).trim();
            if (key && val) attrs[key] = val;
          }
        }
      }

      // Generic attribute columns: any unclaimed column
      if (Array.isArray(headerMap.attrColumns)) {
        for (const { index, label } of headerMap.attrColumns) {
          const v = String(row[index] || "").trim();
          if (v && label) attrs[label] = v;
        }
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

      const category_id = supplierMeta ? supplierMeta.id : slugify(currentCategoryTitle || sheetName);
      const category_title = supplierMeta ? supplierMeta.title : currentCategoryTitle;
      const supplier_id = supplierMeta ? supplierMeta.id : category_id;
      const supplier_title = supplierMeta ? supplierMeta.title : category_title;
      // Subcategory column overrides single-cell group rows
      const brandOrGroup = subcategoryFromCol || currentGroup || defaultGroup || "";
      const key = buildProductKey({
        categoryId: category_id,
        supplierId: supplier_id,
        sku,
        brandOrGroup,
        name,
        thickness,
        size
      });

      products.push({
        key,
        category_id,
        category_title,
        supplier_id,
        supplier_title,
        name,
        brandOrGroup,
        unit: unit || "шт",
        sku,
        image,
        images,
        description,
        stockQty,
        prices,
        attrs,
        inStock: stockQty !== undefined ? stockQty > 0 : true,
        active: true
      });
    }
  }

  return products;
}

module.exports = { workbookToProducts };
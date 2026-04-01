
const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");


const Product = require("../models/Product");
const CategoryMeta = require("../models/CategoryMeta");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const SiteSettings = require("../models/SiteSettings");
const { requireAdmin } = require("../middleware/auth");
const { workbookToProducts } = require("../services/excelImport");
const { slugify, getImportSupplier, buildProductKey, normalizeImageUrl, normalizeSiteSettings } = require("../utils");

const router = express.Router();


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }
});
const productImagesDir = path.join(__dirname, "..", "..", "uploads", "products");
fs.mkdirSync(productImagesDir, { recursive: true });
const importChunksDir = path.join(__dirname, "..", "..", "uploads", "import-chunks");
fs.mkdirSync(importChunksDir, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, productImagesDir),
    filename: (_, file, cb) => {
      const ext = path.extname(String(file.originalname || "")).toLowerCase();
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext) ? ext : ".jpg";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function uploadSingle(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();

      // Multer errors are very common for big files; return a readable message.
      if (err && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "file too large" });
      }

      return res.status(400).json({ error: "upload failed", details: String(err && err.message ? err.message : err) });
    });
  };
}

function makeUploadId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getChunkDir(uploadIdRaw) {
  const uploadId = String(uploadIdRaw || "").trim();
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(uploadId)) return "";
  return path.join(importChunksDir, uploadId);
}

function cleanupDirSafe(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup failures
  }
}

async function upsertImportedProducts(items, supplierMeta) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const validItems = items.filter((it) => {
    const ok = !!(it && it.name && it.category_id && it.key);
    if (!ok) skipped++;
    return ok;
  });

  const keys = Array.from(new Set(validItems.map((it) => String(it.key)).filter(Boolean)));
  const skus = Array.from(new Set(validItems.map((it) => String(it.sku || "").trim()).filter(Boolean)));
  const names = Array.from(new Set(validItems.filter((it) => !String(it.sku || "").trim()).map((it) => String(it.name || "").trim()).filter(Boolean)));

  const orQueries = [];
  if (keys.length) orQueries.push({ key: { $in: keys } });
  if (skus.length) orQueries.push({ category_id: supplierMeta.id, sku: { $in: skus } });
  if (names.length) orQueries.push({ category_id: supplierMeta.id, name: { $in: names } });

  const existingDocs = orQueries.length
    ? await Product.find({ $or: orQueries }).lean()
    : [];

  const byKey = new Map();
  const bySku = new Map();
  const byNameGroup = new Map();

  for (const doc of existingDocs) {
    if (doc && doc.key) byKey.set(String(doc.key), doc);
    if (doc && doc.category_id && doc.sku) bySku.set(`${doc.category_id}|${String(doc.sku).trim()}`, doc);
    if (doc && doc.category_id && doc.name) {
      const ng = `${doc.category_id}|${String(doc.name).trim()}|${String(doc.brandOrGroup || "").trim()}`;
      byNameGroup.set(ng, doc);
    }
  }

  const operations = [];

  for (const it of validItems) {
    const skuKey = it.sku ? `${it.category_id}|${String(it.sku).trim()}` : "";
    const nameGroupKey = `${it.category_id}|${String(it.name).trim()}|${String(it.brandOrGroup || "").trim()}`;

    const existing =
      byKey.get(String(it.key)) ||
      (skuKey ? bySku.get(skuKey) : null) ||
      byNameGroup.get(nameGroupKey) ||
      null;

    if (!existing || !existing._id) {
      operations.push({ insertOne: { document: it } });
      inserted++;
      continue;
    }

    const mergedPrices = { ...(existing.prices || {}), ...(it.prices || {}) };
    const mergedAttrs = it.attrs || existing.attrs || {};

    const setPayload = {
      category_id: it.category_id,
      category_title: it.category_title,
      supplier_id: it.supplier_id || existing.supplier_id || "",
      supplier_title: it.supplier_title || existing.supplier_title || "",
      key: it.key || existing.key,
      name: it.name,
      brandOrGroup: it.brandOrGroup,
      unit: it.unit || existing.unit || "шт",
      sku: it.sku || existing.sku || "",
      description: it.description || existing.description || "",
      attrs: mergedAttrs,
      prices: mergedPrices
    };

    if (it.image) setPayload.image = it.image;
    if (Array.isArray(it.images) && it.images.length) setPayload.images = it.images;
    if (it.stockQty !== undefined) {
      setPayload.stockQty = it.stockQty;
      setPayload.inStock = it.stockQty > 0;
    }

    operations.push({
      updateOne: {
        filter: { _id: existing._id },
        update: { $set: setPayload }
      }
    });
    updated++;
  }

  if (operations.length) {
    await Product.bulkWrite(operations, { ordered: false });
  }

  return { inserted, updated, skipped };
}


router.post("/login", (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });

  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || password !== expected) return res.status(401).json({ error: "invalid password" });

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );

  res.json({ token });
});

router.post("/purge-all", requireAdmin, async (req, res) => {
  const confirmText = String(req.body?.confirmText || "").trim();
  const purgePassword = String(req.body?.purgePassword || "").trim();

  if (confirmText !== "DELETE_ALL") {
    return res.status(400).json({ error: "invalid confirmation text" });
  }

  const expected = process.env.ADMIN_PURGE_PASSWORD || "ArcmetPurge!2026#FullReset";
  if (!purgePassword || purgePassword !== expected) {
    return res.status(403).json({ error: "invalid purge password" });
  }

  const [products, categories, orders, leads] = await Promise.all([
    Product.deleteMany({}),
    CategoryMeta.deleteMany({}),
    Order.deleteMany({}),
    Lead.deleteMany({})
  ]);

  return res.json({
    ok: true,
    deleted: {
      products: Number(products?.deletedCount || 0),
      categories: Number(categories?.deletedCount || 0),
      orders: Number(orders?.deletedCount || 0),
      leads: Number(leads?.deletedCount || 0)
    }
  });
});

router.get("/catalog", requireAdmin, async (req, res) => {
  const products = await Product.find({ active: true }).sort({ category_title: 1, name: 1 }).lean();
  const categoriesMap = new Map();

  for (const p of products) {
    const catId = p.category_id;
    if (!categoriesMap.has(catId)) {
      categoriesMap.set(catId, { id: catId, title: p.category_title, fields: [], items: [], image: "" });
    }
    categoriesMap.get(catId).items.push({
      id: String(p._id),
      name: p.name,
      supplier_id: p.supplier_id || "",
      supplier_title: p.supplier_title || "",
      brandOrGroup: p.brandOrGroup || "",
      unit: p.unit || "шт",
      sku: p.sku || "",
      image: normalizeImageUrl(p.image),
      images: (Array.isArray(p.images) ? p.images : []).map((x) => normalizeImageUrl(x)).filter(Boolean),
      description: p.description || "",
      stockQty: p.stockQty,
      prices: p.prices || {},
      attrs: p.attrs || {},
      category_id: p.category_id,
      inStock: !!p.inStock
    });
  }

  const catIds = Array.from(categoriesMap.keys());
  if (catIds.length > 0) {
    const metas = await CategoryMeta.find({ category_id: { $in: catIds } }).lean();
    const metaMap = new Map(metas.map((m) => [m.category_id, m]));
    for (const [id, cat] of categoriesMap.entries()) {
      const meta = metaMap.get(id);
      if (meta && meta.image) cat.image = normalizeImageUrl(meta.image);
    }
  }

  res.json({ categories: Array.from(categoriesMap.values()) });
});

router.get("/categories", requireAdmin, async (req, res) => {
  const products = await Product.find({ active: true }).select("category_id category_title").lean();
  const categoriesMap = new Map();

  for (const p of products) {
    const catId = p.category_id;
    if (!categoriesMap.has(catId)) {
      categoriesMap.set(catId, { id: catId, title: p.category_title, image: "" });
    }
  }

  const catIds = Array.from(categoriesMap.keys());
  if (catIds.length > 0) {
    const metas = await CategoryMeta.find({ category_id: { $in: catIds } }).lean();
    const metaMap = new Map(metas.map((m) => [m.category_id, m]));
    for (const [id, cat] of categoriesMap.entries()) {
      const meta = metaMap.get(id);
      if (meta && meta.image) cat.image = normalizeImageUrl(meta.image);
      if (meta && meta.title && !cat.title) cat.title = meta.title;
    }
  }

  const items = Array.from(categoriesMap.values()).sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "ru")
  );

  res.json({ categories: items });
});

router.patch("/categories/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "category id required" });

  const image = req.body?.image;
  const title = req.body?.title;

  const update = { category_id: id };
  if (image !== undefined) update.image = String(image || "");
  if (title !== undefined) update.title = String(title || "");

  const saved = await CategoryMeta.findOneAndUpdate(
    { category_id: id },
    { $set: update },
    { upsert: true, new: true }
  ).lean();

  res.json({
    ok: true,
    category: {
      id: saved.category_id,
      title: saved.title || "",
      image: normalizeImageUrl(saved.image)
    }
  });
});

router.post("/import/excel", requireAdmin, uploadSingle("file"), async (req, res) => {
  try {
    const t0 = Date.now();
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file is required" });
    const supplier = String(req.body?.supplier || "").trim();
    const supplierMeta = getImportSupplier(supplier);
    if (!supplierMeta) {
      return res.status(400).json({ error: "supplier is required" });
    }

    const items = await workbookToProducts({
      buffer: file.buffer,
      filename: file.originalname || "",
      imagesDir: require("path").join(__dirname, "..", "..", "uploads", "products"),
      supplier: supplierMeta.id
    });

    if (!items.length) {
      return res.status(400).json({
        error: "excel template was not recognized",
        details: "Не удалось распознать строки товаров. Проверьте заголовки Excel и перезапустите backend после обновления кода."
      });
    }

    const { inserted, updated, skipped } = await upsertImportedProducts(items, supplierMeta);

    res.json({
      ok: true,
      inserted,
      updated,
      skipped,
      totalParsed: items.length,
      supplier: supplierMeta,
      durationMs: Date.now() - t0
    });
  } catch (e) {
    res.status(500).json({ error: "import failed", details: String(e && e.message ? e.message : e) });
  }
});

router.post("/import/excel/chunk/init", requireAdmin, async (req, res) => {
  const uploadId = makeUploadId();
  const dir = getChunkDir(uploadId);
  if (!dir) return res.status(400).json({ error: "invalid upload id" });

  fs.mkdirSync(dir, { recursive: true });
  res.json({ ok: true, uploadId });
});

router.post("/import/excel/chunk/:uploadId", requireAdmin, uploadSingle("chunk"), async (req, res) => {
  const dir = getChunkDir(req.params.uploadId);
  if (!dir) return res.status(400).json({ error: "invalid upload id" });
  if (!fs.existsSync(dir)) return res.status(404).json({ error: "upload session not found" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "chunk is required" });

  const idxRaw = String(req.body?.index || "").trim();
  const idx = Number(idxRaw);
  if (!Number.isInteger(idx) || idx < 0 || idx > 10000) {
    return res.status(400).json({ error: "invalid chunk index" });
  }

  const partPath = path.join(dir, `${idx}.part`);
  fs.writeFileSync(partPath, file.buffer);
  res.json({ ok: true, index: idx, size: file.size || file.buffer?.length || 0 });
});

router.post("/import/excel/chunk/:uploadId/complete", requireAdmin, async (req, res) => {
  const t0 = Date.now();
  const dir = getChunkDir(req.params.uploadId);
  if (!dir) return res.status(400).json({ error: "invalid upload id" });
  if (!fs.existsSync(dir)) return res.status(404).json({ error: "upload session not found" });

  try {
    const supplier = String(req.body?.supplier || "").trim();
    const supplierMeta = getImportSupplier(supplier);
    if (!supplierMeta) {
      return res.status(400).json({ error: "supplier is required" });
    }

    const filename = String(req.body?.filename || "import.xlsx");
    const parts = fs.readdirSync(dir)
      .filter((name) => /^\d+\.part$/.test(name))
      .map((name) => ({ name, idx: Number(name.replace(/\.part$/, "")) }))
      .sort((a, b) => a.idx - b.idx);

    if (!parts.length) {
      return res.status(400).json({ error: "no chunks uploaded" });
    }

    const buffers = parts.map((p) => fs.readFileSync(path.join(dir, p.name)));
    const merged = Buffer.concat(buffers);

    const items = await workbookToProducts({
      buffer: merged,
      filename,
      imagesDir: require("path").join(__dirname, "..", "..", "uploads", "products"),
      supplier: supplierMeta.id
    });

    if (!items.length) {
      return res.status(400).json({
        error: "excel template was not recognized",
        details: "Не удалось распознать строки товаров. Проверьте заголовки Excel и перезапустите backend после обновления кода."
      });
    }

    const { inserted, updated, skipped } = await upsertImportedProducts(items, supplierMeta);

    res.json({
      ok: true,
      inserted,
      updated,
      skipped,
      totalParsed: items.length,
      supplier: supplierMeta,
      durationMs: Date.now() - t0,
      chunked: true
    });
  } catch (e) {
    res.status(500).json({ error: "import failed", details: String(e && e.message ? e.message : e) });
  } finally {
    cleanupDirSafe(dir);
  }
});

router.post("/upload/product-image", requireAdmin, (req, res) => {
  imageUpload.single("file")(req, res, (err) => {
    if (err && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "file too large" });
    }
    if (err) {
      return res.status(400).json({ error: "upload failed", details: String(err.message || err) });
    }

    if (!req.file) return res.status(400).json({ error: "file is required" });
    const imageUrl = `/uploads/products/${req.file.filename}`;
    return res.json({ ok: true, imageUrl });
  });
});

router.post("/products", requireAdmin, async (req, res) => {
  const body = req.body || {};
  const category_title = String(body.category_title || "").trim();
  const name = String(body.name || "").trim();

  if (!category_title || !name) return res.status(400).json({ error: "category_title and name are required" });

  const category_id = slugify(category_title);
  const sku = String(body.sku || "").trim();
  const supplier_id = String(body.supplier_id || category_id).trim() || category_id;
  const supplier_title = String(body.supplier_title || category_title).trim() || category_title;
  const key = buildProductKey({
    categoryId: category_id,
    supplierId: supplier_id,
    sku,
    brandOrGroup: body.brandOrGroup || "",
    name,
    thickness: body.attrs?.thickness_mm || "",
    size: body.attrs?.roll_size_mm || ""
  });

  const payload = {
    key,
    category_id,
    category_title,
    supplier_id,
    supplier_title,
    name,
    brandOrGroup: String(body.brandOrGroup || ""),
    unit: String(body.unit || "шт"),
    sku,
    image: String(body.image || ""),
    images: Array.isArray(body.images) ? body.images.map((x) => String(x || "").trim()).filter(Boolean) : [],
    description: String(body.description || ""),
    stockQty: body.stockQty !== undefined ? Number(body.stockQty) : undefined,
    prices: body.prices || {},
    attrs: body.attrs || {},
    inStock: body.inStock !== undefined ? !!body.inStock : true,
    active: true
  };

  if (sku) {
    const existing = await Product.findOne({
      sku,
      $or: [
        { supplier_id },
        { category_id }
      ]
    });

    if (existing) {
      existing.key = key;
      existing.category_id = payload.category_id;
      existing.category_title = payload.category_title;
      existing.supplier_id = payload.supplier_id;
      existing.supplier_title = payload.supplier_title;
      existing.name = payload.name;
      existing.brandOrGroup = payload.brandOrGroup;
      existing.unit = payload.unit;
      existing.sku = payload.sku;
      existing.image = payload.image;
      existing.images = payload.images;
      existing.description = payload.description;
      existing.stockQty = payload.stockQty;
      existing.prices = payload.prices;
      existing.attrs = payload.attrs;
      existing.inStock = payload.inStock;
      existing.active = true;

      await existing.save();
      return res.json({ product: existing.toJSON(), updated: true });
    }
  }

  const created = await Product.create(payload);

  res.json({ product: created.toJSON() });
});

router.patch("/products/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const patch = req.body || {};

  const p = await Product.findById(id);
  if (!p) return res.status(404).json({ error: "not found" });

  if (patch.inStock !== undefined) p.inStock = !!patch.inStock;
  if (patch.active !== undefined) p.active = !!patch.active;

  if (patch.name !== undefined) p.name = String(patch.name);
  if (patch.brandOrGroup !== undefined) p.brandOrGroup = String(patch.brandOrGroup);
  if (patch.unit !== undefined) p.unit = String(patch.unit);
  if (patch.sku !== undefined) p.sku = String(patch.sku);
  if (patch.image !== undefined) p.image = String(patch.image);
  if (patch.images !== undefined && Array.isArray(patch.images)) p.images = patch.images.map((x) => String(x || "").trim()).filter(Boolean);
  if (patch.description !== undefined) p.description = String(patch.description);
  if (patch.stockQty !== undefined) p.stockQty = Number(patch.stockQty);
  if (patch.supplier_id !== undefined) p.supplier_id = String(patch.supplier_id);
  if (patch.supplier_title !== undefined) p.supplier_title = String(patch.supplier_title);

  if (patch.stockQty !== undefined && patch.inStock === undefined) {
    p.inStock = Number(patch.stockQty) > 0;
  }

  if (patch.prices && typeof patch.prices === "object") {
    p.prices = { ...(p.prices || {}), ...patch.prices };
  }
  if (patch.attrs && typeof patch.attrs === "object") {
    p.attrs = { ...(p.attrs || {}), ...patch.attrs };
  }

  await p.save();
  res.json({ product: p.toJSON() });
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const p = await Product.findById(id);
  if (!p) return res.status(404).json({ error: "not found" });
  await p.deleteOne();
  res.json({ ok: true });
});

// --------------------
// Orders (Admin)
// --------------------
router.get("/orders", requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const skip = (page - 1) * limit;

  const status = String(req.query.status || "").trim();
  const sortBy = String(req.query.sortBy || "date").trim(); // date | status
  const sortDir = String(req.query.sortDir || "desc").trim(); // asc | desc

  const q = {};
  if (status) q.status = status;

  const sort = {};
  if (sortBy === "status") sort.status = sortDir === "asc" ? 1 : -1;
  sort.createdAt = sortDir === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    Order.find(q).sort(sort).skip(skip).limit(limit).lean(),
    Order.countDocuments(q)
  ]);

  res.json({
    page,
    limit,
    total,
    items: items.map((o) => ({
      id: String(o._id),
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerEmail: o.customerEmail || "",
      address: o.address || "",
      comment: o.comment || "",
      deliveryMethod: o.deliveryMethod || "courier_astana",
      paymentMethod: o.paymentMethod || "kaspi",
      status: o.status,
      total: o.total || 0,
      createdAt: o.createdAt
    }))
  });
});

router.get("/orders/:id", requireAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ error: "order not found" });

  res.json({
    order: {
      id: String(order._id),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail || "",
      address: order.address || "",
      comment: order.comment || "",
      deliveryMethod: order.deliveryMethod || "courier_astana",
      paymentMethod: order.paymentMethod || "kaspi",
      status: order.status,
      total: order.total || 0,
      items: order.items || [],
      createdAt: order.createdAt
    }
  });
});

router.patch("/orders/:id", requireAdmin, async (req, res) => {
  const status = String(req.body?.status || "").trim();
  if (!["new", "processing", "completed", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true }
  ).lean();

  if (!order) return res.status(404).json({ error: "order not found" });

  res.json({ ok: true, status: order.status });
});

router.delete("/orders/:id", requireAdmin, async (req, res) => {
  const order = await Order.findByIdAndDelete(req.params.id).lean();
  if (!order) return res.status(404).json({ error: "order not found" });
  res.json({ ok: true });
});

router.get("/orders/:id/export", requireAdmin, async (req, res) => {
  const ExcelJS = require("exceljs");
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ error: "order not found" });

  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet("Order");
  ws1.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Value", key: "value", width: 60 },
  ];

  const rows1 = [
    ["Order ID", String(order._id)],
    ["Status", String(order.status || "")],
    ["Created At", order.createdAt ? new Date(order.createdAt).toISOString() : ""],
    ["Customer Name", String(order.customerName || "")],
    ["Customer Phone", String(order.customerPhone || "")],
    ["Customer Email", String(order.customerEmail || "")],
    ["Address", String(order.address || "")],
    ["Comment", String(order.comment || "")],
    ["Delivery Method", String(order.deliveryMethod || "courier_astana")],
    ["Payment Method", String(order.paymentMethod || "kaspi")],
    ["Total", Number(order.total || 0)],
  ].map(([field, value]) => ({ field, value }));

  ws1.addRows(rows1);
  ws1.getRow(1).font = { bold: true };

  const ws2 = wb.addWorksheet("Items");
  ws2.columns = [
    { header: "Name", key: "name", width: 40 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Price", key: "price", width: 12 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Line Total", key: "lineTotal", width: 14 },
    { header: "Image", key: "image", width: 40 },
  ];
  ws2.getRow(1).font = { bold: true };

  const items = Array.isArray(order.items) ? order.items : [];
  ws2.addRows(items.map((it) => ({
    name: String(it.name || ""),
    sku: String(it.sku || ""),
    unit: String(it.unit || ""),
    price: Number(it.price || 0),
    quantity: Number(it.quantity || 0),
    lineTotal: Number(it.lineTotal || 0),
    image: String(it.image || ""),
  })));

  const buf = await wb.xlsx.writeBuffer();

  const fname = `order_${String(order._id)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(Buffer.from(buf));
});

// --------------------
// Leads (Admin)
// --------------------
router.get("/leads", requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const skip = (page - 1) * limit;

  const status = String(req.query.status || "").trim();
  const sortDir = String(req.query.sortDir || "desc").trim(); // asc | desc

  const q = {};
  if (status) q.status = status;

  const sort = { createdAt: sortDir === "asc" ? 1 : -1 };

  const [items, total] = await Promise.all([
    Lead.find(q).sort(sort).skip(skip).limit(limit).lean(),
    Lead.countDocuments(q)
  ]);

  res.json({
    page,
    limit,
    total,
    items: items.map((l) => ({
      id: String(l._id),
      name: l.name,
      phone: l.phone,
      email: l.email || "",
      message: l.message || "",
      status: l.status,
      createdAt: l.createdAt
    }))
  });
});

router.get("/leads/:id", requireAdmin, async (req, res) => {
  const lead = await Lead.findById(req.params.id).lean();
  if (!lead) return res.status(404).json({ error: "lead not found" });
  res.json({
    lead: {
      id: String(lead._id),
      name: lead.name,
      phone: lead.phone,
      email: lead.email || "",
      message: lead.message || "",
      status: lead.status,
      createdAt: lead.createdAt
    }
  });
});

router.patch("/leads/:id", requireAdmin, async (req, res) => {
  const status = String(req.body?.status || "").trim();
  if (!["new", "processing", "done"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true }
  ).lean();

  if (!lead) return res.status(404).json({ error: "lead not found" });
  res.json({ ok: true, status: lead.status });
});

router.delete("/leads/:id", requireAdmin, async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id).lean();
  if (!lead) return res.status(404).json({ error: "lead not found" });
  res.json({ ok: true });
});

// ── Site Settings (Homepage Constructor) ──────────────────────────────────
router.get("/site-settings", requireAdmin, async (req, res) => {
  const settings = await SiteSettings.findOne().lean();
  res.json({ ok: true, settings: normalizeSiteSettings(settings || {}) });
});

router.put("/site-settings", requireAdmin, async (req, res) => {
  const patch = req.body || {};
  const allowed = [
    "phone", "email", "address",
    "kaspiEnabled", "kaspiUrl",
    "halykEnabled", "halykUrl",
    "heroSlides", "aboutSlides",
    "homepageImages",
  ];
  const update = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) update[key] = patch[key];
  }
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: update },
    { new: true, upsert: true }
  ).lean();
  res.json({ ok: true, settings: normalizeSiteSettings(settings) });
});

module.exports = router;

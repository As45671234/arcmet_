
const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");


const Product = require("../models/Product");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const { requireAdmin } = require("../middleware/auth");
const { workbookToProducts } = require("../services/excelImport");
const { slugify } = require("../utils");

const router = express.Router();


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }
});
const productImagesDir = path.join(__dirname, "..", "..", "uploads", "products");
fs.mkdirSync(productImagesDir, { recursive: true });

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

router.get("/catalog", requireAdmin, async (req, res) => {
  const products = await Product.find({ active: true }).sort({ category_title: 1, name: 1 }).lean();
  const categoriesMap = new Map();

  for (const p of products) {
    const catId = p.category_id;
    if (!categoriesMap.has(catId)) {
      categoriesMap.set(catId, { id: catId, title: p.category_title, fields: [], items: [] });
    }
    categoriesMap.get(catId).items.push({
      id: String(p._id),
      name: p.name,
      brandOrGroup: p.brandOrGroup || "",
      unit: p.unit || "шт",
      sku: p.sku || "",
      image: p.image || "",
      description: p.description || "",
      prices: p.prices || {},
      attrs: p.attrs || {},
      category_id: p.category_id,
      inStock: !!p.inStock
    });
  }

  res.json({ categories: Array.from(categoriesMap.values()) });
});

router.post("/import/excel", requireAdmin, uploadSingle("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file is required" });

    const items = await workbookToProducts({
      buffer: file.buffer,
      filename: file.originalname || "",
      imagesDir: require("path").join(__dirname, "..", "..", "uploads", "products")
    });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const it of items) {
    if (!it.name || !it.category_id) { skipped++; continue; }

    const existing = await Product.findOne({ key: it.key });
    if (!existing) {
      await Product.create(it);
      inserted++;
    } else {
      // Update prices/attrs/description but keep manual edits if present? We'll overwrite basic fields.
      existing.category_id = it.category_id;
      existing.category_title = it.category_title;
      existing.name = it.name;
      existing.brandOrGroup = it.brandOrGroup;
      existing.sku = it.sku || existing.sku;
      if (it.image) existing.image = it.image;
      existing.description = it.description || existing.description;
      existing.attrs = it.attrs || existing.attrs;

      existing.prices = { ...(existing.prices || {}), ...(it.prices || {}) };
      await existing.save();
      updated++;
    }
  }

    res.json({ ok: true, inserted, updated, skipped, totalParsed: items.length });
  } catch (e) {
    res.status(500).json({ error: "import failed", details: String(e && e.message ? e.message : e) });
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
  const keyBase = sku ? `sku:${sku}` : `${category_id}|${slugify(body.brandOrGroup || "")}|${slugify(name)}|${slugify(body.attrs?.thickness_mm || "")}|${slugify(body.attrs?.roll_size_mm || "")}`;
  const key = slugify(keyBase);

  const created = await Product.create({
    key,
    category_id,
    category_title,
    name,
    brandOrGroup: String(body.brandOrGroup || ""),
    unit: String(body.unit || "шт"),
    sku,
    image: String(body.image || ""),
    description: String(body.description || ""),
    prices: body.prices || {},
    attrs: body.attrs || {},
    inStock: body.inStock !== undefined ? !!body.inStock : true,
    active: true
  });

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
  if (patch.description !== undefined) p.description = String(patch.description);

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

module.exports = router;

const express = require("express");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const CategoryMeta = require("../models/CategoryMeta");
const SiteSettings = require("../models/SiteSettings");
const { normalizeImageUrl, normalizeSiteSettings } = require("../utils");

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((it) => {
      const quantity = Number(it.quantity || 0);
      const price = Number(it.prices?.retail ?? it.price);
      const lineTotal = (Number.isFinite(price) ? price : 0) * (Number.isFinite(quantity) ? quantity : 0);

      return {
        productId: it.id ? String(it.id) : (it.productId ? String(it.productId) : ""),
        name: String(it.name || "").trim(),
        sku: String(it.sku || "").trim(),
        unit: String(it.unit || "шт"),
        image: String(it.image || ""),
        price: Number.isFinite(price) ? price : undefined,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        lineTotal: Number.isFinite(lineTotal) ? lineTotal : 0
      };
    })
    .filter((x) => x.name && x.quantity > 0);
}

async function createOrderFromPayload(payload) {
  const { customerName, customerPhone, customerEmail, address, comment, items, total } = payload || {};
  if (!customerPhone || !customerEmail || !Array.isArray(items) || items.length === 0) return null;

  const cleanItems = normalizeOrderItems(items);
  if (cleanItems.length === 0) return null;

  const computedTotal = cleanItems.reduce((s, x) => s + Number(x.lineTotal || 0), 0);
  const finalTotal = Number.isFinite(Number(total)) ? Number(total) : computedTotal;

  return Order.create({
    customerName: String(customerName || "").trim(),
    customerPhone: String(customerPhone).trim(),
    customerEmail: String(customerEmail).trim(),
    address: String(address || "").trim(),
    comment: String(comment || "").trim(),
    items: cleanItems,
    total: finalTotal
  });
}

function publicRoutes(emailLimiter) {
  const router = express.Router();

  // Catalog for website (only active + inStock)
  router.get("/catalog", async (req, res) => {
    const products = await Product.find({ active: true, inStock: true }).sort({ category_title: 1, name: 1 }).lean();
    const categoriesMap = new Map();

    for (const p of products) {
      const catId = p.category_id;
      if (!categoriesMap.has(catId)) {
        categoriesMap.set(catId, {
          id: catId,
          title: p.category_title,
          fields: [],
          items: [],
          image: ""
        });
      }
      const cat = categoriesMap.get(catId);
      cat.items.push({
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

  // Lead form: save to DB only (no email delivery)
  router.post("/leads/email", emailLimiter, async (req, res) => {
    const { name, phone, email, message } = req.body || {};
    if (!phone || !email) return res.status(400).json({ error: "phone and email are required" });

    const lead = await Lead.create({
      name: String(name || "").trim(),
      phone: String(phone).trim(),
      email: String(email).trim(),
      message: String(message || "").trim()
    });

    res.json({ ok: true, id: String(lead._id) });
  });

  // Main order endpoint: save to DB only (no email delivery)
  router.post("/orders", emailLimiter, async (req, res) => {
    const order = await createOrderFromPayload(req.body || {});
    if (!order) return res.status(400).json({ error: "invalid order" });
    res.json({ ok: true, id: String(order._id) });
  });

  // Backward-compatible endpoint
  router.post("/orders/email", emailLimiter, async (req, res) => {
    const order = await createOrderFromPayload(req.body || {});
    if (!order) return res.status(400).json({ error: "invalid order" });
    res.json({ ok: true, id: String(order._id) });
  });

  // Public site settings (phone, email, address, kaspi/halyk links, hero/about slides)
  router.get("/site-settings", async (req, res) => {
    const settings = await SiteSettings.findOne().lean();
    res.json({ ok: true, settings: normalizeSiteSettings(settings || {}) });
  });

  return router;
}

module.exports = publicRoutes;

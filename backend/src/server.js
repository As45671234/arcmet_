
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { connectDb, isDbReady } = require("./config/db");

const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const CategoryMeta = require("./models/CategoryMeta");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads"));

app.set("trust proxy", 1);

app.use(helmet());
app.use(morgan("dev"));
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: false
}));
app.use(express.json({ limit: "2mb" }));

// Serve uploaded product images
app.use("/uploads", express.static(uploadsRoot));
app.use("/api/uploads", express.static(uploadsRoot));

// Backward-compatible alias (older builds used /prodImage)
app.use("/prodImage", express.static(path.join(uploadsRoot, "products")));
app.use("/api/prodImage", express.static(path.join(uploadsRoot, "products")));


const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// Пока база не поднялась, запросы к данным должны получать внятный отказ,
// а не зависать и не падать с пятисоткой. Статика выше по стеку, её это
// не касается — картинки продолжают отдаваться.
app.use("/api", (req, res, next) => {
  if (isDbReady()) return next();
  res.status(503).json({
    error: "database_unavailable",
    message: "База данных временно недоступна. Повторите запрос через минуту."
  });
});

app.use("/api", publicRoutes(emailLimiter));
app.use("/api/admin", adminRoutes);

app.get("/health", (req, res) => {
  const dbReady = isDbReady();
  res.status(dbReady ? 200 : 503).json({ ok: dbReady, db: dbReady ? "up" : "down" });
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(
    "User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: https://arcmet.kz/sitemap.xml"
  );
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const metas = await CategoryMeta.find({}).lean();
    const baseUrl = "https://arcmet.kz";
    const today = new Date().toISOString().slice(0, 10);

    const urls = [
      { loc: `${baseUrl}/`, changefreq: "weekly", priority: "1.0" },
      { loc: `${baseUrl}/catalog`, changefreq: "daily", priority: "0.9" },
      ...metas.map((m) => ({
        loc: `${baseUrl}/catalog?cat=${encodeURIComponent(m.category_id)}`,
        changefreq: "weekly",
        priority: "0.8"
      }))
    ];

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      ),
      "</urlset>"
    ].join("\n");

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (e) {
    res.status(500).send("<?xml version=\"1.0\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"/>");
  }
});

app.use((err, req, res, next) => {
  if (!err) return next();

  const code = err.code || "";
  if (code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "file too large" });
  }

  const msg = err.message ? String(err.message) : "server error";
  return res.status(500).json({ error: msg });
});


// Слушаем порт сразу, не дожидаясь базы. Раньше было наоборот, и пока Mongo
// лежала, nginx отдавал 502 — по нему невозможно отличить «сервис упал» от
// «сервис поднимается». Теперь приходит 503 с объяснением, а картинки и
// статика работают всё это время.
app.listen(PORT, () => {
  console.log(`Backend started on http://localhost:${PORT}`);
});

connectDb(process.env.MONGODB_URI).catch((err) => {
  console.error("MongoDB: не удалось подключиться:", err && err.message ? err.message : err);
});

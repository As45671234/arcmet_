
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const { connectDb } = require("./config/db");

const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.set("trust proxy", 1);

app.use(helmet());
app.use(morgan("dev"));
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: false
}));
app.use(express.json({ limit: "2mb" }));

// Serve uploaded product images
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Backward-compatible alias (older builds used /prodImage)
app.use("/prodImage", express.static(path.join(__dirname, "..", "uploads", "products")));
app.use("/api/prodImage", express.static(path.join(__dirname, "..", "uploads", "products")));


const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api", publicRoutes(emailLimiter));
app.use("/api/admin", adminRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  if (!err) return next();

  const code = err.code || "";
  if (code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "file too large" });
  }

  const msg = err.message ? String(err.message) : "server error";
  return res.status(500).json({ error: msg });
});


connectDb(process.env.MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend started on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    process.exit(1);
  });

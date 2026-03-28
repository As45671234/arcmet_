
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const IMPORT_SUPPLIERS = [
  { id: "plastfoil", title: "PLASTFOIL", aliases: ["plastfoil", "plastoil"] },
  { id: "panelsan", title: "PANELSAN", aliases: ["panelsan"] },
  { id: "fachmann", title: "FACHMANN", aliases: ["fachmann"] },
  { id: "rheinzink", title: "RHEINZINK", aliases: ["rheinzink"] },
  { id: "penoplex", title: "ПЕНОПЛЭКС", aliases: ["пеноплэкс", "пеноплекс", "penoplex"] },
  { id: "akfa", title: "AKFA BUILD", aliases: ["akfa", "akfa build", "akfabuild"] }
];

function normalizeSupplierChoice(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function getImportSupplier(value) {
  const normalized = normalizeSupplierChoice(value);
  if (!normalized) return null;

  return IMPORT_SUPPLIERS.find((item) =>
    [item.id, item.title, ...(item.aliases || [])]
      .map((candidate) => normalizeSupplierChoice(candidate))
      .includes(normalized)
  ) || null;
}

function buildProductKey({ categoryId, supplierId, sku, brandOrGroup, name, thickness, size }) {
  const prefix = slugify(supplierId || categoryId || "catalog");
  if (sku) return slugify(`${prefix}|sku|${sku}`);

  return slugify([
    prefix,
    slugify(brandOrGroup || ""),
    slugify(name || ""),
    slugify(thickness || ""),
    slugify(size || "")
  ].join("|"));
}

function parseNumber(v) {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const lowered = s.toLowerCase();
  if (lowered.includes("по запросу")) return undefined;

  // remove spaces, nbsp, currency symbols
  const cleaned = s
    .replace(/\u00A0/g, " ")
    .replace(/[₸$€]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "."); // comma decimal

  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  return undefined;
}

function isRowEmpty(row) {
  return !row || row.every((c) => String(c || "").trim() === "");
}

function rowNonEmptyCount(row) {
  if (!row) return 0;
  return row.reduce((acc, c) => acc + (String(c || "").trim() ? 1 : 0), 0);
}

function normalizeImageUrl(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v) || v.startsWith("data:") || v.startsWith("blob:")) return v;
  if (v.startsWith("/api/uploads/") || v.startsWith("/api/prodImage/")) return v;
  if (v.startsWith("/uploads/") || v.startsWith("/prodImage/")) return `/api${v}`;
  return v.startsWith("/") ? v : `/${v}`;
}

function normalizeSiteSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const homepageImages = src.homepageImages && typeof src.homepageImages === "object"
    ? src.homepageImages
    : {};

  return {
    ...src,
    heroSlides: Array.isArray(src.heroSlides)
      ? src.heroSlides.map((slide) => ({
          ...slide,
          img: normalizeImageUrl(slide && slide.img)
        }))
      : [],
    aboutSlides: Array.isArray(src.aboutSlides)
      ? src.aboutSlides.map((slide) => ({
          ...slide,
          imageUrl: normalizeImageUrl(slide && slide.imageUrl),
          bullets: Array.isArray(slide && slide.bullets)
            ? slide.bullets.map((item) => String(item || "").trim()).filter(Boolean)
            : []
        }))
      : [],
    homepageImages: {
      ...homepageImages,
      headerLogo: normalizeImageUrl(homepageImages.headerLogo),
      footerLogo: normalizeImageUrl(homepageImages.footerLogo),
      partnersBackground: normalizeImageUrl(homepageImages.partnersBackground),
      productSlides: Array.isArray(homepageImages.productSlides)
        ? homepageImages.productSlides
            .map((item) => ({
              id: String(item && item.id ? item.id : "").trim(),
              image: normalizeImageUrl(item && item.image)
            }))
            .filter((item) => item.id)
        : [],
      partnerLogos: Array.isArray(homepageImages.partnerLogos)
        ? homepageImages.partnerLogos.map((item) => normalizeImageUrl(item)).filter(Boolean)
        : []
    }
  };
}

module.exports = {
  slugify,
  parseNumber,
  isRowEmpty,
  rowNonEmptyCount,
  IMPORT_SUPPLIERS,
  getImportSupplier,
  normalizeSupplierChoice,
  buildProductKey,
  normalizeImageUrl,
  normalizeSiteSettings
};

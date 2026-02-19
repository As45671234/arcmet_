
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
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

module.exports = { slugify, parseNumber, isRowEmpty, rowNonEmptyCount };

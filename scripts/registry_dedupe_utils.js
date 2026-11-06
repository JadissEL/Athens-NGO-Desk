/**
 * Shared normalisation for registry duplicate checks and national imports.
 */
function normName(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9α-ωάέήίόύώ\s&'.-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string | null | undefined} u
 * @returns {string | null}
 */
function normHost(u) {
  if (!u || typeof u !== "string") return null;
  const t = u.trim();
  if (!t) return null;
  try {
    const url = /^https?:\/\//i.test(t) ? new URL(t) : new URL("https://" + t.replace(/^\/\//, ""));
    return url.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

module.exports = { normName, normHost };

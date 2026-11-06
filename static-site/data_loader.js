/**
 * Optional: fetch NGO_DATA from Phase B API before app.js runs.
 * Set window.NGO_DATA_API_BASE to API origin (no trailing slash), e.g. https://api.example.com
 */
(function () {
  const base = typeof window.NGO_DATA_API_BASE === "string" ? window.NGO_DATA_API_BASE.trim() : "";
  if (!base) {
    window.NGO_DATA_LOADED = Promise.resolve(null);
    return;
  }
  const url = base.replace(/\/$/, "") + "/api/ngo-data";
  window.NGO_DATA_LOADED = fetch(url, { credentials: "omit" })
    .then(function (r) {
      if (!r.ok) throw new Error("GET " + url + " → " + r.status);
      return r.json();
    })
    .catch(function (e) {
      console.warn("[NGO_DATA] API fetch failed, using data.js if present:", e && e.message ? e.message : e);
      return null;
    });
})();

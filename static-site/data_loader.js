/**
 * Optional: fetch NGO_DATA from Phase B API before app.js runs.
 * Set window.NGO_DATA_API_BASE to API origin (no trailing slash), e.g. https://api.example.com
 */
(function () {
  const base = typeof window.NGO_DATA_API_BASE === "string" ? window.NGO_DATA_API_BASE.trim() : "";
  const hBase =
    typeof window.HOSPITALITY_API_BASE === "string" && window.HOSPITALITY_API_BASE.trim()
      ? window.HOSPITALITY_API_BASE.trim()
      : base;

  if (!base) {
    window.NGO_DATA_LOADED = Promise.resolve(null);
  } else {
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
  }

  if (!hBase) {
    window.HOSPITALITY_JOBS_LOADED = Promise.resolve([]);
  } else {
  const hUrl = hBase.replace(/\/$/, "") + "/api/hospitality/jobs";
  window.HOSPITALITY_JOBS_LOADED = fetch(hUrl, { credentials: "omit" })
    .then(function (r) {
      if (!r.ok) throw new Error("GET " + hUrl + " → " + r.status);
      return r.json();
    })
    .then(function (data) {
      return data && Array.isArray(data.items) ? data.items : [];
    })
    .catch(function (e) {
      console.warn("[Hospitality] API fetch failed:", e && e.message ? e.message : e);
      return [];
    });
  }

  const eventsBase = base || hBase;
  if (!eventsBase) {
    window.CIVIC_EVENTS_LOADED = Promise.resolve([]);
  } else {
    const eUrl = eventsBase.replace(/\/$/, "") + "/api/events";
    window.CIVIC_EVENTS_LOADED = fetch(eUrl, { credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("GET " + eUrl + " → " + r.status);
        return r.json();
      })
      .then(function (data) {
        return data && Array.isArray(data.items) ? data.items : [];
      })
      .catch(function (e) {
        console.warn("[Events] API fetch failed:", e && e.message ? e.message : e);
        return [];
      });
  }
})();

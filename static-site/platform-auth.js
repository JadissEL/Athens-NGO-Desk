/**
 * Unified desk sign-in (Clerk). Dashboard type is a stored preference — not RBAC.
 * window.PlatformAuth — load once, shared by employer + events + account hub.
 */
(function () {
  const CLERK_CDN = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";

  const DASHBOARD_ROUTES = {
    jobseeker: { hash: "jobs" },
    employer: { hash: "employer" },
    ngo_member: { hash: "events" },
    funder: { hash: "funding" },
    donor: { hash: "audiences" },
    steward: { steward: true },
  };

  let clerk = null;
  let publishableKey = "";
  let initPromise = null;

  function apiBase() {
    const n = typeof window.NGO_DATA_API_BASE === "string" ? window.NGO_DATA_API_BASE.trim() : "";
    return n.replace(/\/$/, "");
  }

  async function loadScript() {
    if (window.Clerk) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = CLERK_CDN;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Clerk JS failed to load"));
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const base = apiBase();
      if (!base) return false;
      const cfg = await fetch(base + "/api/steward-config").then((r) => r.json());
      publishableKey = cfg.clerkPublishableKey || "";
      if (!publishableKey || !cfg.clerkServerConfigured) return false;
      await loadScript();
      clerk = window.Clerk;
      await clerk.load({ publishableKey });
      clerk.addListener(() => {
        refreshAccountUi().catch(() => {});
        refreshHeaderButton();
      });
      refreshHeaderButton();
      return true;
    })();
    return initPromise;
  }

  function getClerk() {
    return clerk;
  }

  function openSignIn() {
    clerk?.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
  }

  async function signOut() {
    await clerk?.signOut();
    refreshHeaderButton();
  }

  async function authHeaders(extra = {}) {
    const h = { ...extra };
    if (clerk?.session) {
      const t = await clerk.session.getToken();
      if (t) h.Authorization = "Bearer " + t;
    }
    return h;
  }

  async function api(path, opts = {}) {
    const base = apiBase();
    if (!base) throw new Error("API base not configured");
    const headers = await authHeaders(opts.headers || {});
    if (opts.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(base + path, { ...opts, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      throw new Error((data && data.error) || res.statusText || "Request failed");
    }
    return data;
  }

  function refreshHeaderButton() {
    const el = document.getElementById("desk-auth-btn");
    if (!el) return;
    if (!clerk) {
      el.textContent = "Sign in";
      el.dataset.authMode = "signin";
      return;
    }
    if (clerk.user) {
      const label = clerk.user.firstName || clerk.user.primaryEmailAddress?.emailAddress || "Account";
      el.textContent = label.length > 18 ? label.slice(0, 16) + "…" : label;
      el.dataset.authMode = "account";
    } else {
      el.textContent = "Sign in";
      el.dataset.authMode = "signin";
    }
  }

  async function goToDashboard(type) {
    const base = apiBase();
    const route = DASHBOARD_ROUTES[type];
    if (!route) return;
    if (route.steward && base) {
      window.open(base + "/steward/", "_blank", "noopener,noreferrer");
      return;
    }
    if (route.hash) {
      window.location.hash = route.hash;
      if (typeof window.showPage === "function") window.showPage(route.hash);
    }
  }

  async function refreshAccountUi() {
    const signedOut = document.getElementById("account-signed-out");
    const signedIn = document.getElementById("account-signed-in");
    const pick = document.getElementById("account-dashboard-pick");
    const status = document.getElementById("account-status");
    if (!signedOut || !signedIn) return;
    const ready = await init();
    if (!ready) {
      if (status) status.textContent = "Sign-in is not configured on the API (Clerk keys missing).";
      return;
    }
    if (!clerk?.user) {
      signedOut.hidden = false;
      signedIn.hidden = true;
      return;
    }
    signedOut.hidden = true;
    signedIn.hidden = false;
    let me;
    try {
      me = await api("/api/platform/me");
    } catch (e) {
      if (status) status.textContent = e.message || "Could not load profile";
      return;
    }
    const current = document.getElementById("account-current-type");
    if (current) {
      current.textContent = me.dashboardType
        ? me.dashboardType.replace(/_/g, " ")
        : "Not chosen yet";
    }
  }

  function bindAccountHub() {
    const hub = document.getElementById("page-account");
    if (!hub || hub.dataset.bound) return;
    hub.dataset.bound = "1";

    document.getElementById("account-signin")?.addEventListener("click", () => openSignIn());
    document.getElementById("account-signout")?.addEventListener("click", () => signOut());
    document.getElementById("desk-auth-btn")?.addEventListener("click", () => {
      if (!clerk?.user) openSignIn();
      else {
        window.location.hash = "account";
        if (typeof window.showPage === "function") window.showPage("account");
      }
    });

    document.getElementById("account-save-dashboard")?.addEventListener("click", async () => {
      const sel = document.getElementById("account-dashboard-type");
      const status = document.getElementById("account-status");
      if (!sel?.value) return;
      try {
        await api("/api/platform/me/dashboard", {
          method: "PUT",
          body: JSON.stringify({ dashboardType: sel.value }),
        });
        if (status) status.textContent = "Dashboard preference saved.";
        await refreshAccountUi();
      } catch (e) {
        if (status) status.textContent = e.message || "Save failed";
      }
    });

    document.getElementById("account-open-dashboard")?.addEventListener("click", async () => {
      const sel = document.getElementById("account-dashboard-type");
      const status = document.getElementById("account-status");
      const type = sel?.value;
      if (!type) {
        if (status) status.textContent = "Pick a dashboard type first.";
        return;
      }
      try {
        if (clerk?.user) {
          await api("/api/platform/me/dashboard", {
            method: "PUT",
            body: JSON.stringify({ dashboardType: type }),
          });
        }
        await goToDashboard(type);
      } catch (e) {
        if (status) status.textContent = e.message || "Could not open dashboard";
      }
    });
  }

  async function loadDashboardTypes() {
    const sel = document.getElementById("account-dashboard-type");
    if (!sel || sel.options.length > 1) return;
    const base = apiBase();
    if (!base) return;
    try {
      const cfg = await fetch(base + "/api/platform/config").then((r) => r.json());
      sel.innerHTML = (cfg.dashboardTypes || [])
        .map((t) => `<option value="${t.id}">${t.label}</option>`)
        .join("");
    } catch {
      sel.innerHTML = Object.keys(DASHBOARD_ROUTES)
        .map((id) => `<option value="${id}">${id.replace(/_/g, " ")}</option>`)
        .join("");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindAccountHub();
    init()
      .then(() => loadDashboardTypes())
      .then(() => refreshAccountUi())
      .catch(() => {});
    window.addEventListener("hashchange", () => {
      if ((location.hash || "").replace(/^#/, "") === "account") {
        refreshAccountUi();
        loadDashboardTypes();
      }
    });
  });

  window.PlatformAuth = {
    init,
    getClerk,
    openSignIn,
    signOut,
    api,
    apiFetch: api,
    goToDashboard,
    refreshAccountUi,
  };
})();

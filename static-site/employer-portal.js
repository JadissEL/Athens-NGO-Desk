/**
 * Hospitality employer workbench (Clerk + Phase B API).
 * Requires window.NGO_DATA_API_BASE or window.HOSPITALITY_API_BASE.
 */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  function apiBase() {
    const h =
      typeof window.HOSPITALITY_API_BASE === "string" ? window.HOSPITALITY_API_BASE.trim() : "";
    const n = typeof window.NGO_DATA_API_BASE === "string" ? window.NGO_DATA_API_BASE.trim() : "";
    return (h || n).replace(/\/$/, "");
  }

  let clerk = null;
  let clerkPublishableKey = "";

  async function api(path, opts = {}) {
    const base = apiBase();
    if (!base) throw new Error("API base not configured");
    const headers = { ...(opts.headers || {}) };
    if (clerk && clerk.session) {
      try {
        const token = await clerk.session.getToken();
        if (token) headers.Authorization = "Bearer " + token;
      } catch (e) {
        console.warn("Clerk token", e);
      }
    }
    const res = await fetch(base + path, {
      ...opts,
      headers: opts.body && !headers["Content-Type"] ? { "Content-Type": "application/json", ...headers } : headers,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText || "Request failed";
      throw new Error(msg);
    }
    return data;
  }

  function setEmployerStep(step) {
    $$("[data-employer-step]").forEach((btn) => {
      const on = btn.dataset.employerStep === step;
      btn.classList.toggle("is-active", on);
    });
    $$("[data-employer-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.employerPanel === step);
    });
    $$("[data-employer-summary]").forEach((card) => {
      card.classList.toggle("is-active", card.dataset.employerSummary === step);
    });
  }

  function showEmployerStatus(msg, ok) {
    const el = $("#employer-status");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("is-ok", !!ok);
    el.classList.toggle("is-err", !ok);
  }

  async function refreshEmployerState() {
    const signBox = $("#employer-signin");
    const signed = $("#employer-signed-in");
    const regForm = $("#employer-register-form");
    const pending = $("#employer-pending");
    const verified = $("#employer-verified-tools");
    if (!clerk || !clerk.user) {
      if (signBox) signBox.hidden = false;
      if (signed) signed.hidden = true;
      return;
    }
    if (signBox) signBox.hidden = true;
    if (signed) signed.hidden = false;
    const me = await api("/api/hospitality/employer/me");
    if (!me.registered) {
      if (regForm) regForm.hidden = false;
      if (pending) pending.hidden = true;
      if (verified) verified.hidden = true;
      setEmployerStep("register");
      return;
    }
    if (regForm) regForm.hidden = true;
    const st = me.employer.verificationStatus;
    if (st === "verified") {
      if (pending) pending.hidden = true;
      if (verified) verified.hidden = false;
      setEmployerStep("post");
      await loadEmployerJobs();
      await loadInbox();
    } else {
      if (pending) pending.hidden = false;
      if (verified) verified.hidden = true;
      $("#employer-pending-status").textContent = st;
      setEmployerStep("register");
    }
  }

  async function loadEmployerJobs() {
    const list = $("#employer-jobs-list");
    if (!list) return;
    const data = await api("/api/hospitality/employer/jobs");
    const items = data.items || [];
    list.innerHTML =
      items.length === 0
        ? "<p class=\"muted\">No jobs yet. Publish one below.</p>"
        : `<ul class="muted">${items
            .map(
              (j) =>
                `<li><strong>${escapeHtml(j.title)}</strong> · ${escapeHtml(j.status)} · ${escapeHtml(j.location || "")}</li>`
            )
            .join("")}</ul>`;
  }

  async function loadInbox() {
    const wrap = $("#employer-inbox");
    if (!wrap) return;
    const data = await api("/api/hospitality/employer/applications");
    const items = data.items || [];
    if (!items.length) {
      wrap.innerHTML = "<p class=\"muted\">No applications yet.</p>";
      return;
    }
    wrap.innerHTML = `<table class="employer-inbox-table"><thead><tr><th>Applicant</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${items
      .map(
        (a) => `<tr>
          <td>${escapeHtml(a.seekerName)}<br/><span class="small muted">${escapeHtml(a.seekerEmail)}</span></td>
          <td>${escapeHtml(a.jobTitle)}</td>
          <td><select data-app-id="${escapeHtml(a.id)}" class="employer-app-status">
            ${["submitted", "viewed", "shortlisted", "rejected"]
              .map((s) => `<option value="${s}"${s === a.status ? " selected" : ""}>${s}</option>`)
              .join("")}
          </select></td>
          <td>${a.hasCv ? `<button type="button" class="btn btn-small" data-cv-id="${escapeHtml(a.id)}">CV</button>` : "—"}</td>
        </tr>`
      )
      .join("")}</tbody></table>`;
    $$(".employer-app-status", wrap).forEach((sel) => {
      sel.addEventListener("change", async () => {
        try {
          await api(`/api/hospitality/employer/applications/${sel.dataset.appId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: sel.value }),
          });
          showEmployerStatus("Status updated.", true);
        } catch (e) {
          showEmployerStatus(e.message || "Update failed", false);
        }
      });
    });
    $$("[data-cv-id]", wrap).forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const base = apiBase();
          const token = await clerk.session.getToken();
          const res = await fetch(`${base}/api/hospitality/employer/applications/${btn.dataset.cvId}/cv`, {
            headers: { Authorization: "Bearer " + token },
          });
          if (!res.ok) throw new Error("CV download failed");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "cv-" + btn.dataset.cvId;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          showEmployerStatus(e.message || "CV failed", false);
        }
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  async function loadClerk() {
    const cfg = await fetch(apiBase() + "/api/steward-config").then((r) => r.json());
    clerkPublishableKey = cfg.clerkPublishableKey || "";
    if (!clerkPublishableKey) {
      showEmployerStatus("Clerk is not configured on the API host.", false);
      return;
    }
    if (window.Clerk) {
      clerk = window.Clerk;
      return;
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
      s.async = true;
      s.dataset.clerkPublishableKey = clerkPublishableKey;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Clerk JS load failed"));
      document.head.appendChild(s);
    });
    clerk = window.Clerk;
    await clerk.load({ publishableKey: clerkPublishableKey });
  }

  function bindEmployerUi() {
    $$("[data-employer-step]").forEach((btn) => {
      btn.addEventListener("click", () => setEmployerStep(btn.dataset.employerStep));
    });
    $("#employer-clerk-signin")?.addEventListener("click", () => clerk?.openSignIn());
    $("#employer-clerk-signout")?.addEventListener("click", () => clerk?.signOut());

    $("#employer-register-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = {
        legalName: f.legalName.value.trim(),
        tradeName: f.tradeName.value.trim(),
        employerType: f.employerType.value,
        region: f.region.value.trim(),
        contactEmail: f.contactEmail.value.trim(),
        website: f.website.value.trim(),
        afm: f.afm.value.trim(),
      };
      try {
        await api("/api/hospitality/employer/register", { method: "POST", body: JSON.stringify(body) });
        showEmployerStatus("Profile saved. A steward will verify your account.", true);
        await refreshEmployerState();
      } catch (err) {
        showEmployerStatus(err.message || "Save failed", false);
      }
    });

    $("#employer-job-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const langs = f.languagesRequired.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        title: f.title.value.trim(),
        location: f.location.value.trim(),
        description: f.description.value.trim(),
        contractType: f.contractType.value.trim(),
        languagesRequired: langs,
        seasonality: f.seasonality.value.trim(),
        payBandText: f.payBandText.value.trim(),
        fairHireFlags: {
          trainingProvided: f.trainingProvided.checked,
          noExperienceRequired: f.noExperienceRequired.checked,
        },
        status: "published",
      };
      try {
        await api("/api/hospitality/employer/jobs", { method: "POST", body: JSON.stringify(body) });
        showEmployerStatus("Job published.", true);
        f.reset();
        await loadEmployerJobs();
        setEmployerStep("inbox");
      } catch (err) {
        showEmployerStatus(err.message || "Publish failed", false);
      }
    });

    window.addEventListener("hashchange", () => {
      if ((location.hash || "").replace(/^#/, "") === "employer") {
        refreshEmployerState().catch((e) => showEmployerStatus(e.message, false));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!$("#page-employer")) return;
    bindEmployerUi();
    if (!apiBase()) {
      showEmployerStatus("Set window.NGO_DATA_API_BASE for employer tools.", false);
      return;
    }
    try {
      await loadClerk();
      clerk?.addListener?.(({ user }) => {
        if (user) refreshEmployerState();
      });
      if ((location.hash || "").replace(/^#/, "") === "employer") {
        await refreshEmployerState();
      }
    } catch (e) {
      showEmployerStatus(e.message || "Init failed", false);
    }
  });
})();

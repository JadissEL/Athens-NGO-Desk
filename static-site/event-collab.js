(function () {
  const $ = (sel, el = document) => el.querySelector(sel);

  function apiBase() {
    const n = typeof window.NGO_DATA_API_BASE === "string" ? window.NGO_DATA_API_BASE.trim() : "";
    return n.replace(/\/$/, "");
  }

  let clerk = null;

  async function ensureClerk() {
    if (clerk) return clerk;
    if (!window.PlatformAuth) return null;
    const ok = await window.PlatformAuth.init();
    if (!ok) return null;
    clerk = window.PlatformAuth.getClerk();
    return clerk;
  }

  async function authHeaders() {
    const c = clerk || window.PlatformAuth?.getClerk?.();
    const h = { "Content-Type": "application/json" };
    if (c?.session) {
      const t = await c.session.getToken();
      if (t) h.Authorization = "Bearer " + t;
    }
    return h;
  }

  window.mountEventCollab = async function (container, eventId) {
    if (!container || !eventId) return;
    const base = apiBase();
    container.innerHTML = "<p class=\"small muted\">Loading collaboration…</p>";
    if (!base) {
      container.innerHTML = "<p class=\"small muted\">API not configured.</p>";
      return;
    }
    try {
      await ensureClerk();
      if (!clerk?.user) {
        container.innerHTML =
          '<p class="small muted">Org members: <button type="button" class="btn btn-small" id="ev-collab-signin">Sign in</button> to start a collaboration thread.</p>';
        $("#ev-collab-signin", container)?.addEventListener("click", () =>
          window.PlatformAuth?.openSignIn() ?? clerk?.openSignIn()
        );
        return;
      }
      const me = await fetch(base + "/api/org-members/me", { headers: await authHeaders() }).then((r) => r.json());
      if (!me.items?.length) {
        container.innerHTML =
          "<p class=\"small muted\">No organisation assigned yet. Ask a desk steward to link your Clerk user to your NGO.</p>";
        return;
      }
      const orgOptions = me.items
        .map((m) => `<option value="${m.registryOrgId}">${m.orgName || m.registryOrgId}</option>`)
        .join("");
      container.innerHTML = `
        <h3>Collaborate with other NGOs</h3>
        <form id="ev-thread-form">
          <label class="small">Speaking as
            <select name="registryOrgId">${orgOptions}</select>
          </label>
          <label class="small">Subject
            <input name="subject" required placeholder="Co-host request, volunteer swap…" />
          </label>
          <button type="submit" class="btn btn-primary">Start thread</button>
        </form>
        <div id="ev-thread-view" hidden></div>`;
      $("#ev-thread-form", container)?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target;
        const body = {
          subject: f.subject.value.trim(),
          registryOrgId: f.registryOrgId.value,
        };
        const r = await fetch(`${base}/api/events/${encodeURIComponent(eventId)}/threads`, {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        await openThread($("#ev-thread-view", container), j.thread.id, f.registryOrgId.value);
        $("#ev-thread-view", container).hidden = false;
      });
    } catch (e) {
      container.innerHTML = `<p class="small err">${e.message || "Error"}</p>`;
    }
  };

  async function openThread(wrap, threadId, registryOrgId) {
    if (!wrap) return;
    const base = apiBase();
    const data = await fetch(`${base}/api/threads/${encodeURIComponent(threadId)}`, {
      headers: await authHeaders(),
    }).then((r) => r.json());
    const msgs = data.thread?.messages || [];
    wrap.innerHTML = `
      <h4>${data.thread?.subject || "Thread"}</h4>
      <div class="thread-msg-list">${msgs
        .map((m) => `<div class="thread-msg"><strong>${m.authorOrgId}</strong><p>${escapeHtml(m.body)}</p></div>`)
        .join("")}</div>
      <form id="ev-msg-form">
        <textarea name="body" rows="3" required></textarea>
        <input type="hidden" name="registryOrgId" value="${registryOrgId}" />
        <button type="submit" class="btn">Send</button>
      </form>`;
    $("#ev-msg-form", wrap)?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      await fetch(`${base}/api/threads/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ body: f.body.value.trim(), registryOrgId: f.registryOrgId.value }),
      });
      await openThread(wrap, threadId, registryOrgId);
    });
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }
})();

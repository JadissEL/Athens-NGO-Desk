(async () => {
  let DATA = window.NGO_DATA;
  if (window.NGO_DATA_LOADED) {
    try {
      const remote = await window.NGO_DATA_LOADED;
      if (remote && remote.registry) DATA = remote;
    } catch (e) {
      console.warn("NGO_DATA load error", e);
    }
  }
  if (!DATA || !DATA.registry) {
    document.body.innerHTML =
      "<p style='padding:2rem;font-family:sans-serif'>Missing data — bundle data.js (npm run build:data) or set window.NGO_DATA_API_BASE and ensure GET /api/ngo-data works.</p>";
    return;
  }

  const orgs = DATA.registry.organizations || [];
  const possibility = DATA.possibility?.organizations || [];
  const possibilityById = Object.fromEntries((possibility || []).map((p) => [p.id, p]));
  const emails = DATA.emails?.contacts || [];
  const mediaMeta = DATA.media?.meta || {};
  const articles = DATA.media?.articles || [];

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  /* ---------- helpers ---------- */
  function bandClass(band) {
    if (!band) return "pending";
    const b = band.toLowerCase();
    if (b.includes("very high")) return "vh";
    if (b.startsWith("high")) return "h";
    if (b.startsWith("medium")) return "m";
    return "l";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ddHtml(v) {
    if (v == null || v === "") return "—";
    const s = typeof v === "string" ? v : String(v);
    if (s.includes("<")) return s;
    return esc(s);
  }

  const OSINT_REF_TYPE_ORDER = ["website", "careers", "social", "news", "registry", "funding", "legal", "other"];

  const OSINT_REF_TYPE_LABELS = {
    website: "Official & web",
    careers: "Careers & vacancies",
    social: "Social / boards",
    news: "News & digest",
    registry: "Registry / desk",
    funding: "Funding",
    legal: "Legal / statutory",
    other: "Other sources",
  };

  /**
   * Group OSINT references by type for the profile sidebar.
   * @param {Array<{ label?: string, url?: string, type?: string }>} refs
   */
  function renderReferencesGrouped(refs) {
    if (!refs || !refs.length) return "";
    /** @type {Record<string, Array<{ label?: string, url?: string, type?: string }>>} */
    const by = {};
    for (const r of refs) {
      const t = r && typeof r.type === "string" ? r.type : "other";
      if (!by[t]) by[t] = [];
      by[t].push(r);
    }
    const parts = [];
    for (const t of OSINT_REF_TYPE_ORDER) {
      const list = by[t];
      if (!list || !list.length) continue;
      parts.push(
        `<div class="refs-type-block"><h3 class="refs-type-heading">${esc(OSINT_REF_TYPE_LABELS[t] || t)}</h3><ul class="link-stack">${list
          .map((r) => {
            const label = r.label || r.url;
            const u = r.url || "";
            return u
              ? `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a></li>`
              : `<li>${esc(label)}</li>`;
          })
          .join("")}</ul></div>`
      );
    }
    for (const t of Object.keys(by)) {
      if (OSINT_REF_TYPE_ORDER.includes(t)) continue;
      const list = by[t];
      if (!list || !list.length) continue;
      parts.push(
        `<div class="refs-type-block"><h3 class="refs-type-heading">${esc(t)}</h3><ul class="link-stack">${list
          .map((r) => {
            const label = r.label || r.url;
            const u = r.url || "";
            return u
              ? `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a></li>`
              : `<li>${esc(label)}</li>`;
          })
          .join("")}</ul></div>`
      );
    }
    return parts.join("");
  }

  /** Collapse verbose scope strings into 2–3 region buckets (desktop UX). */
  function regionBucketFromScope(scope) {
    const s = String(scope || "").toLowerCase();
    if (!s) return "greece";
    if (s.includes("greece-wide")) return "national";
    if (s.includes("athens") || s.includes("attica")) return "athens";
    return "greece";
  }

  function regionLabelShort(scope) {
    const b = regionBucketFromScope(scope);
    if (b === "national") return "Greece-wide";
    if (b === "athens") return "Athens area";
    return "Greece";
  }

  const PAGES = [
    "overview",
    "media",
    "life",
    "registry",
    "jobs",
    "apply",
    "possibility",
    "create",
    "funding",
    "org-profile",
  ];

  const STAGE_BG = {
    overview: "hero.jpg",
    media: "img/athens-agora.jpg",
    life: "img/community.jpg",
    jobs: "img/desk-work.jpg",
    apply: "img/community.jpg",
    registry: "img/athens-agora.jpg",
    possibility: "img/planning.jpg",
    create: "img/documents.jpg",
    funding: "img/funding-collab.jpg",
    "org-profile": "img/athens-agora.jpg",
  };

  /* ---------- routing ---------- */
  function parseHash() {
    const raw = (location.hash || "#overview").replace(/^#/, "");
    if (!raw || raw === "overview") {
      return { kind: "page", page: "overview" };
    }
    const orgMatch = /^org\/(.+)$/.exec(raw);
    if (orgMatch) {
      return { kind: "org", orgId: decodeURIComponent(orgMatch[1]) };
    }
    const page = PAGES.includes(raw) && raw !== "org-profile" ? raw : "overview";
    return { kind: "page", page };
  }

  function showPageInternal(pageId) {
    const id =
      pageId === "org-profile"
        ? "org-profile"
        : PAGES.includes(pageId) && pageId !== "org-profile"
          ? pageId
          : "overview";
    if (id === "org-profile") {
      $$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-org-profile"));
      $$("#nav button").forEach((b) => b.classList.remove("active"));
    } else {
      $$(".page").forEach((p) => p.classList.toggle("active", p.id === `page-${id}`));
      $$("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
    }
    document.body.classList.toggle("is-landing", id === "overview");
    const activeNav = document.querySelector("#nav button.active");
    if (activeNav) revealNavButton(activeNav);
    const stage = $(".stage");
    const bgKey = id === "org-profile" ? "org-profile" : id;
    if (stage && STAGE_BG[bgKey]) {
      stage.style.backgroundImage = `linear-gradient(120deg, rgba(15, 20, 25, 0.55), rgba(15, 20, 25, 0.28)), url("${STAGE_BG[bgKey]}")`;
    }
  }

  /* Keep the active item inside the phone nav scroller without moving the page. */
  function revealNavButton(btn) {
    const nav = document.getElementById("nav");
    const shell = nav && nav.closest(".nav-scroll");
    if (!nav || !shell || !btn) return;
    const buttons = [...nav.querySelectorAll("button")];
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const padLeft = shell.classList.contains("is-scrolled") ? 40 : 2;
    const padRight = shell.classList.contains("is-at-end") ? 2 : 44;
    const hiddenLeft = btnRect.left < navRect.left + padLeft;
    const hiddenRight = btnRect.right > navRect.right - padRight;
    if (!hiddenLeft && !hiddenRight) return;
    if (btn === buttons[0]) nav.scrollLeft = 0;
    else if (btn === buttons[buttons.length - 1]) nav.scrollLeft = nav.scrollWidth;
    else if (hiddenLeft) nav.scrollLeft -= navRect.left + padLeft - btnRect.left;
    else nav.scrollLeft += btnRect.right - (navRect.right - padRight);
    syncNavEdges();
  }

  function syncNavEdges() {
    const nav = document.getElementById("nav");
    const shell = nav && nav.closest(".nav-scroll");
    if (!nav || !shell) return;
    const max = nav.scrollWidth - nav.clientWidth;
    const overflowing = max > 1;
    const scrolled = overflowing && nav.scrollLeft > 4;
    const atEnd = overflowing && nav.scrollLeft >= max - 2;
    for (const el of [nav, shell]) {
      el.classList.toggle("is-overflowing", overflowing);
      el.classList.toggle("is-scrolled", scrolled);
      el.classList.toggle("is-at-end", atEnd);
    }
  }

  function bindNavOverflow() {
    const nav = document.getElementById("nav");
    if (!nav || nav.dataset.overflowBound) return;
    nav.dataset.overflowBound = "1";
    nav.addEventListener("scroll", syncNavEdges, { passive: true });
    const shell = nav.closest(".nav-scroll");
    const nudge = (direction) => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      nav.scrollBy({
        left: direction * Math.max(120, nav.clientWidth * 0.65),
        behavior: reduce ? "auto" : "smooth",
      });
    };
    shell?.querySelector(".nav-edge-end")?.addEventListener("click", () => nudge(1));
    shell?.querySelector(".nav-edge-start")?.addEventListener("click", () => nudge(-1));
    nav.addEventListener("focusin", (event) => {
      const btn = event.target.closest("button");
      if (btn && nav.contains(btn)) revealNavButton(btn);
    });
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => syncNavEdges());
      ro.observe(nav);
    } else {
      window.addEventListener("resize", syncNavEdges);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        syncNavEdges();
        const active = nav.querySelector("button.active");
        if (active) revealNavButton(active);
      });
    }
    syncNavEdges();
  }

  /* ---------- navigation ---------- */
  function showPage(pageId) {
    if (!PAGES.includes(pageId) || pageId === "org-profile") return;
    location.hash = pageId;
  }

  function openOrgProfile(orgId) {
    if (!orgId) return;
    location.hash = `org/${encodeURIComponent(orgId)}`;
  }

  function renderOrgProfile(orgId) {
    const org = orgs.find((x) => x.id === orgId);
    const wrap = $("#org-profile-logo-wrap");
    const img = $("#org-profile-logo");
    const conf = $("#org-profile-conflict");
    if (!org) {
      $("#org-profile-name").textContent = "Organisation not found";
      $("#org-profile-sub").textContent = "";
      if (wrap) wrap.hidden = true;
      if (conf) conf.textContent = "";
      $("#org-profile-narrative").textContent =
        "No organisation matches this link. Return to the registry and pick a row.";
      ["#org-profile-mission", "#org-profile-employment", "#org-profile-method", "#org-profile-links", "#org-profile-desk"].forEach(
        (sel) => {
          const el = $(sel);
          if (el) el.innerHTML = "";
        }
      );
      const corpusPanel = $("#org-profile-desk-corpus-panel");
      if (corpusPanel) corpusPanel.hidden = true;
      const possNote = $("#org-profile-possibility-note");
      if (possNote) possNote.textContent = "";
      const mediaMatches = $("#org-profile-media-matches");
      if (mediaMatches) mediaMatches.innerHTML = "";
      const refsPanel = $("#org-profile-refs-panel");
      if (refsPanel) refsPanel.hidden = true;
      const refsUl = $("#org-profile-refs");
      if (refsUl) refsUl.innerHTML = "";
      const progPanel = $("#org-profile-programmes-panel");
      if (progPanel) progPanel.hidden = true;
      const progWrap = $("#org-profile-programmes");
      if (progWrap) progWrap.innerHTML = "";
      return;
    }

    const os = org.osintProfile;
    const poss = possibilityById[org.id];
    $("#org-profile-name").textContent = os?.identity?.primaryName || org.name;
    $("#org-profile-sub").innerHTML = [
      org.nameEl ? esc(org.nameEl) : "",
      org.sector ? esc(org.sector) : "",
      org.scope ? `<span class="small muted">${esc(org.scope)}</span>` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    if (conf) {
      const jp = org.jobPossibility || {};
      const lines = [];
      if (poss && jp.staffEstimate != null && poss.staff?.estimate != null && poss.staff.estimate !== jp.staffEstimate) {
        lines.push(
          `Staff scale: registry estimate (${jp.staffEstimate}) differs from possibility dataset (${poss.staff.estimate}) — compare sources.`
        );
      }
      if (poss && jp.why && poss.why && String(jp.why).trim() !== String(poss.why).trim()) {
        lines.push("Narrative / why lines differ between registry jobPossibility and job_possibility.json — read both on this page.");
      }
      conf.textContent = lines.join(" ");
    }

    if (os?.logo?.url && img && wrap) {
      wrap.hidden = false;
      img.alt = os.logo.alt || `${org.name} logo`;
      img.src = os.logo.url;
      img.onerror = () => {
        wrap.hidden = true;
      };
    } else if (wrap) {
      wrap.hidden = true;
    }

    $("#org-profile-narrative").textContent = os?.narrative || org.notes || "No extended OSINT narrative yet.";

    const deskCorpus = os?.deskCorpus;
    const corpusPanel = $("#org-profile-desk-corpus-panel");
    const possNoteEl = $("#org-profile-possibility-note");
    const mediaWrap = $("#org-profile-media-matches");
    const matches = deskCorpus?.mediaDigestMatches;
    if (corpusPanel && possNoteEl && mediaWrap) {
      const hasNote = deskCorpus?.possibilitySourcesNote && String(deskCorpus.possibilitySourcesNote).trim();
      const hasMatches = Array.isArray(matches) && matches.length > 0;
      if (hasNote || hasMatches) {
        corpusPanel.hidden = false;
        possNoteEl.textContent = hasNote ? String(deskCorpus.possibilitySourcesNote) : "";
        possNoteEl.hidden = !hasNote;
        mediaWrap.innerHTML = hasMatches
          ? `<ul class="media-match-list">${matches
              .map((m) => {
                const when = m.date ? ` · ${m.date}` : "";
                const src = m.sourceLabel ? ` · ${m.sourceLabel}` : "";
                const wk = m.digestWeekLabel ? ` <span class="small muted">(${esc(m.digestWeekLabel)})</span>` : "";
                return `<li><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">${esc(m.title)}</a>${wk}<br /><span class="small muted">${esc(
                  m.dek || ""
                )}${when}${src}</span></li>`;
              })
              .join("")}</ul>`
          : "";
      } else {
        corpusPanel.hidden = true;
        possNoteEl.textContent = "";
        mediaWrap.innerHTML = "";
      }
    }

    const aliasList = os?.identity?.aliases;
    $("#org-profile-mission").innerHTML = [
      ["Also known as (desk)", Array.isArray(aliasList) && aliasList.length ? aliasList.join(" · ") : "—"],
      ["Thematic area", (os?.mission?.thematicAreas || []).join(", ") || "—"],
      ["Geography", os?.mission?.geographyLabel || org.scope || "—"],
      ["Mission (summary)", os?.mission?.summary || org.focus || "—"],
    ]
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${ddHtml(v)}</dd>`)
      .join("");

    const jo = org.jobOpenings || {};
    const jp = org.jobPossibility || {};
    const jobsLine =
      jo.totalFound != null
        ? `${jo.totalFound}${jo.status && jo.status !== "pending" ? ` (${jo.status})` : ""}`
        : "—";
    $("#org-profile-employment").innerHTML = [
      ["Research status", os?.employmentSignals?.researchStatus || jo.status || "—"],
      ["Indexed public postings", String(os?.employmentSignals?.indexedPostingsCount ?? jo.totalFound ?? "—")],
      ["Desk jobs line", jobsLine],
      ["Careers page", jo.careersUrl ? `<a href="${esc(jo.careersUrl)}" target="_blank" rel="noopener">Open</a>` : "—"],
      [
        "Discovery sources",
        (os?.employmentSignals?.discoverySources || jo.sources || []).length
          ? `<ul class="mini-list">${(os?.employmentSignals?.discoverySources || jo.sources || [])
              .map((s) => `<li>${esc(s)}</li>`)
              .join("")}</ul>`
          : "—",
      ],
      [
        "Discovery URLs (parsed)",
        (os?.employmentSignals?.discoverySourceUrls || []).length
          ? `<ul class="mini-list">${(os?.employmentSignals?.discoverySourceUrls || [])
              .map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`)
              .join("")}</ul>`
          : "—",
      ],
      [
        "Indicative roles",
        (os?.employmentSignals?.indicativeRoles || jp.bestFitRoles || []).length
          ? `<ul class="mini-list">${(os?.employmentSignals?.indicativeRoles || jp.bestFitRoles || [])
              .map((r) => `<li>${esc(r)}</li>`)
              .join("")}</ul>`
          : "—",
      ],
    ]
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${ddHtml(v)}</dd>`)
      .join("");

    $("#org-profile-method").innerHTML = [
      ["OSINT methodology", os?.methodology || "—"],
      ["Sources used (tiers)", (os?.sourcesTiers || []).map((t) => esc(t)).join(" · ") || "—"],
      ["Collected / synthesized at", os?.collectedAt || "—"],
      ["Confidence", os?.verification?.confidence || "—"],
      ["Verification notes", os?.verification?.notes || "—"],
    ]
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${ddHtml(v)}</dd>`)
      .join("");

    const progPanel = $("#org-profile-programmes-panel");
    const progWrap = $("#org-profile-programmes");
    const progs = os?.programmes;
    if (progs && progs.length && progPanel && progWrap) {
      progPanel.hidden = false;
      progWrap.innerHTML = progs
        .map((pr) => {
          const ev = pr.evidence || [];
          const evHtml = ev.length
            ? `<ul class="mini-list">${ev
                .map((e) => {
                  const label = e.label || e.url;
                  return `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(label)}</a></li>`;
                })
                .join("")}</ul>`
            : "";
          return `<div class="programme-block"><h3>${esc(pr.name)}</h3><p>${esc(pr.summary)}</p>${evHtml}</div>`;
        })
        .join("");
    } else if (progPanel) {
      progPanel.hidden = true;
      if (progWrap) progWrap.innerHTML = "";
    }

    const contactsForOrg = emails.filter((c) => c.orgId === org.id);
    const contactHintLinks = (os?.onlinePresence?.contactHints || [])
      .map((h) => {
        const lines = [];
        if (h.email) {
          lines.push(
            `<a class="email-link" href="mailto:${esc(h.email)}?subject=${encodeURIComponent("Enquiry — Greece NGO Desk")}">${esc(h.email)}</a>`
          );
        }
        if (h.applyUrl) {
          lines.push(`<a href="${esc(h.applyUrl)}" target="_blank" rel="noopener">${esc("Apply / ATS")}</a>`);
        }
        if (!lines.length) return "";
        const sub = lines.join(' <span class="small muted">·</span> ');
        return `<li><span class="contact-hint-label">${esc(h.label || "Contact")}</span><br /><span class="small">${sub}</span></li>`;
      })
      .filter(Boolean);
    const legacyEmail =
      contactsForOrg.length && !contactHintLinks.length ? contactsForOrg.find((c) => c.email) : null;

    $("#org-profile-links").innerHTML = [
      org.website ? `<li><a href="${esc(org.website)}" target="_blank" rel="noopener">Official website</a></li>` : "",
      jo.careersUrl ? `<li><a href="${esc(jo.careersUrl)}" target="_blank" rel="noopener">Careers / vacancies</a></li>` : "",
      ...contactHintLinks,
      legacyEmail
        ? `<li><a class="email-link" href="mailto:${esc(legacyEmail.email)}?subject=${encodeURIComponent(
            "Enquiry — Greece NGO Desk"
          )}">Contact (spontaneous)</a></li>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const refs = os?.references;
    const refsPanel = $("#org-profile-refs-panel");
    const refsUl = $("#org-profile-refs");
    if (refs && refs.length && refsPanel && refsUl) {
      refsPanel.hidden = false;
      refsUl.innerHTML = renderReferencesGrouped(refs);
    } else if (refsPanel) {
      refsPanel.hidden = true;
      if (refsUl) refsUl.innerHTML = "";
    }

    const scoreLabel =
      jp.score != null ? `${jp.score}${jp.band ? ` · ${jp.band}` : ""}` : jp.status === "scored" ? "Scored" : "—";
    const staffLine =
      os?.scaleSignals?.staffEstimate != null
        ? String(os.scaleSignals.staffEstimate)
        : jp.staffEstimate != null
          ? String(jp.staffEstimate)
          : poss?.staff?.estimate != null
            ? `${poss.staff.estimate} (possibility dataset)`
            : "—";
    const peopleLine =
      os?.scaleSignals?.beneficiariesLabel != null
        ? String(os.scaleSignals.beneficiariesLabel)
        : jp.beneficiariesLabel != null
          ? String(jp.beneficiariesLabel)
          : poss?.beneficiariesDependents?.estimateLabel || "—";
    $("#org-profile-desk").innerHTML = [
      ["Job possibility (desk)", scoreLabel],
      poss && poss.score != null && poss.score !== jp.score
        ? [
            "Possibility score (alternate)",
            `${poss.score} · ${poss.possibility || ""} (job_possibility.json — check registry for canonical)`,
          ]
        : null,
      ["Staff estimate", staffLine],
      ["People served (label)", peopleLine],
      os?.scaleSignals?.sourcesNote
        ? ["Scale signals (note)", String(os.scaleSignals.sourcesNote)]
        : null,
    ]
      .filter(Boolean)
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${ddHtml(v)}</dd>`)
      .join("");

    window.scrollTo(0, 0);
  }

  function applyRoute() {
    const r = parseHash();
    if (r.kind === "org") {
      showPageInternal("org-profile");
      renderOrgProfile(r.orgId);
      return;
    }
    showPageInternal(r.page);
    window.scrollTo(0, 0);
  }

  $$("[data-page]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.dataset.page;
      if (!id) return;
      e.preventDefault();
      showPage(id);
    });
  });

  window.addEventListener("hashchange", () => applyRoute());

  /* ---------- registry ---------- */
  const sectors = [...new Set(orgs.map((o) => o.sector).filter(Boolean))].sort();
  const scopes = [...new Set(orgs.map((o) => o.scope).filter(Boolean))].sort();
  sectors.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    $("#f-sector").appendChild(opt);
  });
  const jobsSectorSelect = $("#f-jobs-sector");
  if (jobsSectorSelect) {
    sectors.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      jobsSectorSelect.appendChild(opt);
    });
  }
  scopes.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    $("#f-scope").appendChild(opt);
  });

  /** "all" | "hiring" | "custom" — quick chip state */
  let registryPresetMode = "all";

  function clearRegistryPresetButtons() {
    $$("[data-reg-preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  }

  function syncRegistryPresetChips() {
    clearRegistryPresetButtons();
    if (registryPresetMode === "hiring") {
      const btn = document.querySelector('[data-reg-preset="hiring"]');
      if (btn) btn.setAttribute("aria-pressed", "true");
    } else if (registryPresetMode === "all") {
      const btn = document.querySelector('[data-reg-preset="all"]');
      if (btn) btn.setAttribute("aria-pressed", "true");
    }
  }

  function markRegistryFiltersCustom() {
    registryPresetMode = "custom";
    syncRegistryPresetChips();
  }

  function filteredOrgs() {
    const q = ($("#q-reg").value || "").trim().toLowerCase();
    const sector = $("#f-sector").value;
    const scope = $("#f-scope").value;
    const scoreF = $("#f-score").value;
    const region = $("#f-region")?.value || "";

    return orgs.filter((o) => {
      if (registryPresetMode === "hiring" && !orgHasVacancyResearch(o)) return false;
      if (sector && o.sector !== sector) return false;
      if (scope && o.scope !== scope) return false;
      if (region === "athens") {
        if (regionBucketFromScope(o.scope) !== "athens") return false;
      } else if (region === "national") {
        if (regionBucketFromScope(o.scope) !== "national") return false;
      }
      if (scoreF === "scored" && o.jobPossibility?.status !== "scored") return false;
      if (scoreF === "high") {
        const sc = o.jobPossibility?.score;
        if (sc == null || sc < 65) return false;
      }
      if (!q) return true;
      const blob = [o.name, o.nameEl, o.sector, o.scope, o.focus, o.notes].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  function orgHasVacancyResearch(o) {
    const jo = o.jobOpenings || {};
    return jo.status === "researched" || jo.status === "partial" || (jo.totalFound != null && jo.totalFound > 0);
  }

  function registrySummaryLine(list) {
    const parts = [];
    const q = ($("#q-reg").value || "").trim();
    if (q) parts.push(`matching “${q}”`);

    const region = $("#f-region")?.value || "";
    if (region === "athens") parts.push("Athens / Attica area");
    else if (region === "national") parts.push("Greece-wide (HQ Athens)");

    const sector = $("#f-sector").value;
    if (sector) parts.push(sector);

    const scope = $("#f-scope").value;
    if (scope) parts.push(`exact scope: ${scope}`);

    const scoreF = $("#f-score").value;
    if (scoreF === "scored") parts.push("scored only");
    else if (scoreF === "high") parts.push("high score (65+)");

    if (registryPresetMode === "hiring") parts.push("with public vacancy research");

    const suffix = parts.length ? ` — ${parts.join(" · ")}` : "";
    return `<strong>${list.length}</strong> organisation${list.length === 1 ? "" : "s"}${suffix}`;
  }

  function renderRegistry() {
    const list = filteredOrgs().sort((a, b) => a.name.localeCompare(b.name));
    const countEl = $("#reg-count");
    if (countEl) countEl.innerHTML = registrySummaryLine(list);
    $("#reg-body").innerHTML = list
      .map((o) => {
        const jp = o.jobPossibility || {};
        const jo = o.jobOpenings || {};
        const band = jp.band || (jp.status === "scored" ? "Scored" : "Unscored");
        const score = jp.score != null ? jp.score : "—";
        const jobs =
          jo.totalFound != null
            ? `${jo.totalFound}${jo.status && jo.status !== "pending" ? ` · ${jo.status}` : ""}`
            : "pending";
        const regShort = regionLabelShort(o.scope);
        return `<tr data-id="${esc(o.id)}">
          <td>
            <strong><a href="#org/${esc(o.id)}" class="table-profile-link">${esc(o.name)}</a></strong>
            ${o.nameEl ? `<div class="small muted">${esc(o.nameEl)}</div>` : ""}
            ${o.website ? `<div class="small"><a href="${esc(o.website)}" target="_blank" rel="noopener">website</a></div>` : ""}
          </td>
          <td><span class="table-sector">${esc(o.sector)}</span></td>
          <td class="small"><abbr title="${esc(o.scope)}">${esc(regShort)}</abbr></td>
          <td class="small">${esc(jobs)}</td>
          <td>
            <span class="pill ${bandClass(jp.band)}">${esc(typeof score === "number" ? `${score} · ${band}` : band)}</span>
          </td>
          <td>
            <button type="button" class="pill" data-detail="${esc(o.id)}">Detail</button>
            <div class="small registry-inline-link"><a href="#org/${esc(o.id)}">Profile →</a></div>
          </td>
        </tr>`;
      })
      .join("");

    $$("#reg-body [data-detail]").forEach((btn) => {
      btn.addEventListener("click", () => openOrgSheet(btn.dataset.detail));
    });
    $$("#reg-body .table-profile-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
    syncRegistryPresetChips();
  }

  function applyRegistryPreset(preset) {
    const q = $("#q-reg");
    const region = $("#f-region");
    const sector = $("#f-sector");
    const scope = $("#f-scope");
    const score = $("#f-score");
    if (preset === "all") {
      registryPresetMode = "all";
      if (q) q.value = "";
      if (region) region.value = "";
      if (sector) sector.value = "";
      if (scope) scope.value = "";
      if (score) score.value = "";
    } else if (preset === "hiring") {
      registryPresetMode = "hiring";
      if (q) q.value = "";
      if (region) region.value = "";
      if (sector) sector.value = "";
      if (scope) scope.value = "";
      if (score) score.value = "";
    } else if (preset === "high") {
      registryPresetMode = "custom";
      if (q) q.value = "";
      if (region) region.value = "";
      if (sector) sector.value = "";
      if (scope) scope.value = "";
      if (score) score.value = "high";
    } else if (preset === "athens") {
      registryPresetMode = "custom";
      if (q) q.value = "";
      if (region) region.value = "athens";
      if (sector) sector.value = "";
      if (scope) scope.value = "";
      if (score) score.value = "";
    } else if (preset === "national") {
      registryPresetMode = "custom";
      if (q) q.value = "";
      if (region) region.value = "national";
      if (sector) sector.value = "";
      if (scope) scope.value = "";
      if (score) score.value = "";
    }
    syncRegistryPresetChips();
    renderRegistry();
  }

  $$("[data-reg-preset]").forEach((btn) => {
    btn.addEventListener("click", () => applyRegistryPreset(btn.dataset.regPreset));
  });

  $("#reg-reset-filters")?.addEventListener("click", () => {
    applyRegistryPreset("all");
  });

  function openOrgSheet(id) {
    const org = orgs.find((x) => x.id === id);
    if (!org) return;
    const jp = org.jobPossibility || {};
    const jo = org.jobOpenings || {};
    const sheet = $("#reg-detail-body");
    $("#reg-detail").classList.add("open");
    sheet.hidden = false;
    $("#reg-detail-title").textContent = org.name;
    $("#reg-detail-sub").textContent = [org.nameEl, org.sector, org.scope].filter(Boolean).join(" · ");

    const email = emails.find((c) => c.orgId === org.id && c.email);
    const scoreLabel =
      jp.score != null ? `${jp.score} · ${jp.band || "Scored"}` : jp.status === "scored" ? "Scored" : "Not scored yet";

    $("#reg-detail-grid").innerHTML = [
      ["Focus", org.focus || "—"],
      ["Jobs indexed", jo.totalFound != null ? `${jo.totalFound} (${jo.status || "—"})` : "Pending research"],
      ["Possibility", scoreLabel],
      ["Staff (est.)", jp.staffEstimate != null ? String(jp.staffEstimate) : "—"],
      ["People served", jp.beneficiariesLabel || "—"],
      [
        "Website",
        org.website
          ? `<a href="${esc(org.website)}" target="_blank" rel="noopener">${esc(org.website.replace(/^https?:\/\//, ""))}</a>`
          : "—",
      ],
      [
        "Careers",
        jo.careersUrl
          ? `<a href="${esc(jo.careersUrl)}" target="_blank" rel="noopener">Open board</a>`
          : "—",
      ],
      [
        "Spontaneous CV",
        email
          ? `<a class="email-link" href="mailto:${esc(email.email)}?subject=${encodeURIComponent(
              "Spontaneous application — Greece NGO Desk"
            )}">${esc(email.email)}</a>`
          : "—",
      ],
      [
        "Full OSINT profile",
        `<a href="#org/${esc(org.id)}">Open organisation page</a>`,
      ],
    ]
      .map(
        ([k, v]) =>
          `<div class="org-fact"><span class="org-fact-k">${esc(k)}</span><span class="org-fact-v">${v}</span></div>`
      )
      .join("");

    const roles = jp.bestFitRoles || [];
    $("#reg-detail-roles").innerHTML = roles.length
      ? roles.map((r) => `<li>${esc(r)}</li>`).join("")
      : "<li class='muted'>No scored role hints yet</li>";

    const posts = (jo.postings || []).slice(0, 6);
    $("#reg-detail-posts").innerHTML = posts.length
      ? posts
          .map((p) => {
            const when = [p.postedDate, p.deadline ? `deadline ${p.deadline}` : null]
              .filter(Boolean)
              .join(" · ");
            const link = p.url
              ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>`
              : esc(p.title);
            return `<li>${link}${when ? `<span class="small muted"> — ${esc(when)}</span>` : ""}${
              p.location ? `<span class="small muted"> · ${esc(p.location)}</span>` : ""
            }</li>`;
          })
          .join("")
      : "<li class='muted'>No public postings indexed</li>";

    $("#reg-detail-why").textContent = jp.why || org.notes || "";
    $("#reg-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  $("#reg-detail-close")?.addEventListener("click", () => {
    $("#reg-detail").classList.remove("open");
    const sheet = $("#reg-detail-body");
    if (sheet) sheet.hidden = true;
  });

  ["q-reg", "f-sector", "f-scope", "f-score", "f-region"].forEach((id) => {
    const el = $(`#${id}`);
    if (!el) return;
    const handler = () => {
      markRegistryFiltersCustom();
      renderRegistry();
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });

  /* ---------- jobs ---------- */
  const orgSectorById = Object.fromEntries(orgs.map((o) => [o.id, o.sector]));

  function allPostings() {
    const rows = [];
    for (const o of orgs) {
      const posts = o.jobOpenings?.postings || [];
      for (const p of posts) {
        rows.push({
          org: o.name,
          orgId: o.id,
          title: p.title,
          postedDate: p.postedDate || "",
          deadline: p.deadline || "",
          location: p.location || "",
          url: p.url || "",
          kind: p.kind || "",
        });
      }
    }
    return rows.sort((a, b) => String(b.postedDate).localeCompare(String(a.postedDate)));
  }

  function isAthensLoc(loc) {
    const s = String(loc || "").toLowerCase();
    if (!s) return false;
    return (
      s.includes("athens") ||
      s.includes("attica") ||
      s.includes("αθήνα") ||
      s.includes("αττικ") ||
      s.includes("zografos") ||
      s.includes("kapandriti") ||
      s.includes("attiki")
    );
  }

  function parseDeadline(d) {
    if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
    const t = Date.parse(d);
    return Number.isFinite(t) ? t : null;
  }

  function renderJobs() {
    const q = ($("#q-jobs").value || "").trim().toLowerCase();
    const region = $("#f-jobs-region")?.value || "all";
    const sector = $("#f-jobs-sector")?.value || "";
    let rows = allPostings();
    if (region === "athens") {
      rows = rows.filter((r) => isAthensLoc(r.location));
    } else if (region === "other") {
      rows = rows.filter((r) => r.location && !isAthensLoc(r.location));
    }
    if (sector) {
      rows = rows.filter((r) => orgSectorById[r.orgId] === sector);
    }
    if (q) {
      rows = rows.filter((r) =>
        [r.org, r.title, r.location, r.kind, orgSectorById[r.orgId]].join(" ").toLowerCase().includes(q)
      );
    }

    const now = Date.now();
    const soon = rows
      .map((r) => ({ ...r, dl: parseDeadline(r.deadline) }))
      .filter((r) => r.dl && r.dl >= now - 86400000)
      .sort((a, b) => a.dl - b.dl)
      .slice(0, 4);

    const parts = [];
    if (region === "athens") parts.push("Athens / Attica area");
    else if (region === "other") parts.push("outside Athens / Attica");
    if (sector) parts.push(sector);

    $("#jobs-stats").innerHTML = [
      ["Showing", `${rows.length}${parts.length ? ` (${parts.join(" · ")})` : ""}`],
      ["With deadline", soon.length ? `${soon.length} upcoming` : "—"],
    ]
      .map(
        ([label, value]) =>
          `<div class="stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`
      )
      .join("");

    const rail = $("#jobs-deadlines");
    if (rail) {
      if (soon.length) {
        rail.hidden = false;
        rail.innerHTML =
          `<div class="deadline-label">Soon</div>` +
          soon
            .map(
              (r) => `<a class="deadline-chip" href="${esc(r.url || "#")}" ${
                r.url ? 'target="_blank" rel="noopener"' : ""
              }><strong>${esc(r.org)}</strong><span>${esc(r.title)}</span><em>${esc(
                r.deadline
              )}</em></a>`
            )
            .join("");
      } else {
        rail.hidden = true;
        rail.innerHTML = "";
      }
    }

    $("#jobs-body").innerHTML = rows
      .map(
        (r) => `<tr>
        <td><a href="#org/${esc(r.orgId)}" class="table-profile-link">${esc(r.org)}</a></td>
        <td>${esc(r.title)}${r.kind ? ` <span class="pill">${esc(r.kind)}</span>` : ""}</td>
        <td>${esc(r.postedDate || "—")}</td>
        <td>${esc(r.deadline || "—")}</td>
        <td class="small">${esc(r.location || "—")}</td>
        <td>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">Open</a>` : "—"}</td>
      </tr>`
      )
      .join("");
    $$("#jobs-body .table-profile-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
  }

  $("#q-jobs").addEventListener("input", renderJobs);
  $("#f-jobs-region")?.addEventListener("change", renderJobs);
  $("#f-jobs-sector")?.addEventListener("change", renderJobs);

  /* ---------- apply / spontaneous emails ---------- */
  function renderApply() {
    const tip = DATA.emails?.meta?.tip;
    if (tip && $("#apply-tip")) {
      $("#apply-tip").textContent = tip;
    }
    const ranked = [...emails].sort((a, b) => {
      const ae = a.email ? 0 : 1;
      const be = b.email ? 0 : 1;
      if (ae !== be) return ae - be;
      const ap = a.orgId ? 0 : 1;
      const bp = b.orgId ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return String(a.name).localeCompare(String(b.name));
    });
    $("#apply-emails").innerHTML = ranked
      .map((c) => {
        const mail = c.email
          ? `<a class="email-link" href="mailto:${esc(c.email)}?subject=${encodeURIComponent(
              "Spontaneous application — Greece NGO Desk"
            )}">${esc(c.email)}</a>`
          : c.applyUrl
            ? `<a href="${esc(c.applyUrl)}" target="_blank" rel="noopener">Apply via ATS</a>`
            : "—";
        return `<article class="email-card${c.email ? "" : " email-card--ats"}">
          <h3>${esc(c.name)}</h3>
          <div class="email-kind">${esc(c.kind || "")}</div>
          <div class="email-addr">${mail}</div>
          ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
        </article>`;
      })
      .join("");
  }

  /* ---------- possibility ---------- */
  function renderPossibility() {
    const ranked = [...possibility].sort((a, b) => b.score - a.score);
    $("#poss-chart").innerHTML = ranked
      .map(
        (o) => `
      <div class="chart-row">
        <div>${esc(o.name)}</div>
        <div class="bar"><i style="width:${o.score}%"></i></div>
        <div class="n">${o.score}</div>
      </div>`
      )
      .join("");

    $("#poss-cards").innerHTML = ranked
      .map((o) => {
        const staff =
          o.staff?.estimate != null
            ? `${o.staff.estimate}${o.staff.year ? ` (${o.staff.year})` : ""}`
            : o.staff?.range || "—";
        const deps =
          o.beneficiariesDependents?.estimateLabel ||
          (o.beneficiariesDependents?.estimate != null
            ? String(o.beneficiariesDependents.estimate)
            : "—");
        const roles = (o.bestFitRoles || []).map((r) => `<li>${esc(r)}</li>`).join("");
        return `<article class="card">
          <h3>${esc(o.name)} <span class="pill ${bandClass(o.possibility)}">${esc(o.score)} · ${esc(o.possibility)}</span></h3>
          <div class="meta">Staff: ${esc(staff)} · Dependents / people served: ${esc(deps)}</div>
          <div class="score-bar" title="Score ${o.score}"><span style="width:${o.score}%"></span></div>
          <p class="small muted" style="margin:0.75rem 0">${esc(o.why)}</p>
          <ul>${roles}</ul>
          <p class="small muted">Public posts indexed: ${esc(o.hiringSignal?.publicPostingsIndexed ?? "—")} · Last: ${esc(o.hiringSignal?.lastPublicPost || "—")}</p>
        </article>`;
      })
      .join("");
  }

  $$("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.scroll);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ---------- media / hot rail ---------- */
  function formatMediaDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function hotArticles() {
    const marked = articles.filter((a) => a.hot);
    if (marked.length >= 3) return marked.slice(0, 3);
    return [...articles]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 3);
  }

  function renderHotRail() {
    const rail = $("#hot-rail");
    if (!rail) return;
    const week = mediaMeta.weekLabel ? ` · ${mediaMeta.weekLabel}` : "";
    const headSpan = $(".hot-rail-head span");
    if (headSpan) headSpan.textContent = `Hot this week${week}`;

    rail.innerHTML = hotArticles()
      .map(
        (a, i) => `
      <button type="button" class="hot-card" data-media-id="${esc(a.id)}" style="animation-delay:${i * 0.08}s">
        <span class="hot-card-date">${esc(formatMediaDate(a.date))}</span>
        <span class="hot-card-title">${esc(a.title)}</span>
        <span class="hot-card-dek">${esc(a.dek || "")}</span>
      </button>`
      )
      .join("");

    $$("#hot-rail [data-media-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        showPage("media");
        requestAnimationFrame(() => {
          const el = document.getElementById(`article-${btn.dataset.mediaId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    });
  }

  function renderMedia() {
    const weekEl = $("#media-week-label");
    if (weekEl && mediaMeta.weekLabel) {
      weekEl.textContent = `NGO digest · Monday–Sunday ${mediaMeta.weekLabel} · Greece civil society`;
    }
    const intro = $("#media-intro");
    if (intro) {
      intro.textContent = `${articles.length} separated stories for Mon–Sun ${mediaMeta.weekLabel || "last week"} (plus short context pieces) — hiring, funding, protection and civic space.`;
    }
    const disc = $("#media-disclaimer");
    if (disc) disc.textContent = mediaMeta.disclaimer || "";

    const q = ($("#q-media")?.value || "").trim().toLowerCase();
    let list = [...articles].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (q) {
      list = list.filter((a) =>
        [a.title, a.dek, a.source, ...(a.tags || []), ...(a.body || [])].join(" ").toLowerCase().includes(q)
      );
    }

    const feed = $("#media-feed");
    if (!feed) return;
    feed.innerHTML = list
      .map((a) => {
        const tags = (a.tags || []).map((t) => `<span class="media-tag">${esc(t)}</span>`).join("");
        const paras = (a.body || []).map((p) => `<p>${esc(p)}</p>`).join("");
        return `
        <article class="media-article" id="article-${esc(a.id)}">
          <div class="media-article-media">
            <img src="${esc(a.image || "img/athens-agora.jpg")}" alt="${esc(a.imageAlt || a.title)}" loading="lazy" width="900" height="600" />
          </div>
          <div class="media-article-body">
            <div class="media-article-meta">
              <time datetime="${esc(a.date)}">${esc(formatMediaDate(a.date))}</time>
              ${a.hot ? `<span class="media-hot">Hot</span>` : ""}
              <span class="media-source">${esc(a.source || "")}</span>
            </div>
            <h2>${esc(a.title)}</h2>
            <p class="media-dek">${esc(a.dek || "")}</p>
            <div class="media-copy">${paras}</div>
            <div class="media-tags">${tags}</div>
            ${
              a.sourceUrl
                ? `<a class="btn" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">Read source ↗</a>`
                : ""
            }
          </div>
        </article>`;
      })
      .join("");
  }

  $("#q-media")?.addEventListener("input", renderMedia);

  renderHotRail();
  renderMedia();
  renderRegistry();
  renderJobs();
  renderApply();
  renderPossibility();
  bindNavOverflow();
  applyRoute();
})();


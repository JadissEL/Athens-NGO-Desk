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
    "audiences",
    "legal",
    "org-profile",
  ];

  const CMD_ACTIONS = [
    { id: "overview", label: "Home", hint: "Landing" },
    { id: "jobs", label: "Openings", hint: "Vacancies table" },
    { id: "apply", label: "Apply by email", hint: "Spontaneous CVs" },
    { id: "registry", label: "Registry", hint: "Organisations" },
    { id: "media", label: "Media digest", hint: "Weekly stories" },
    { id: "life", label: "Life on the desk", hint: "Worker rhythm" },
    { id: "possibility", label: "Job possibility scores", hint: "Desk scoring" },
    { id: "create", label: "Found an NGO", hint: "Formation guide" },
    { id: "funding", label: "Fund an NGO", hint: "Grants & donors" },
    { id: "audiences", label: "Who this is for", hint: "Audiences" },
    { id: "legal", label: "Legal notice", hint: "Disclaimer" },
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
    $$("#mobile-dock [data-page]").forEach((b) =>
      b.classList.toggle("active", b.dataset.page === id && id !== "org-profile")
    );
    $$("#desk-rail-nav [data-page], .desk-rail-mark[data-page]").forEach((b) =>
      b.classList.toggle("active", b.dataset.page === id && id !== "org-profile")
    );
    const bgKey = id === "org-profile" ? "org-profile" : id;
    const stage = $(".stage");
    if (stage && stage.classList.contains("stage--bento")) {
      stage.style.backgroundImage = "none";
    } else if (stage && STAGE_BG[bgKey]) {
      stage.style.backgroundImage = `linear-gradient(120deg, rgba(15, 20, 25, 0.55), rgba(15, 20, 25, 0.28)), url("${STAGE_BG[bgKey]}")`;
    }
    const activeNav = document.querySelector("#nav button.active");
    if (activeNav) revealNavButton(activeNav);
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
      const crumb = $("#org-breadcrumb-name");
    if (crumb) crumb.textContent = "Not found";
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
    const displayName = os?.identity?.primaryName || org.name;
    const crumb = $("#org-breadcrumb-name");
    if (crumb) crumb.textContent = displayName;
    $("#org-profile-name").textContent = displayName;
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
        corpusPanel.open = true;
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
      progPanel.open = true;
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
    const refsUl = $("#org-profile-refs");
    if (refs && refs.length && refsUl) {
      refsUl.innerHTML = renderReferencesGrouped(refs);
    } else if (refsUl) {
      refsUl.innerHTML = "";
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

    const idName = $("#org-identity-name");
    const idSub = $("#org-identity-sub");
    const idQuick = $("#org-identity-quick");
    const idWrap = $("#org-identity-logo-wrap");
    const idImg = $("#org-identity-logo");
    if (idName) idName.textContent = displayName;
    if (idSub) idSub.innerHTML = $("#org-profile-sub").innerHTML;
    if (idQuick) {
      const links = $("#org-profile-links").innerHTML;
      idQuick.innerHTML = links ? `<ul class="link-stack">${links}</ul>` : "";
    }
    if (idImg && idWrap && img && img.src && !wrap.hidden) {
      idWrap.hidden = false;
      idImg.src = img.src;
      idImg.alt = img.alt;
    } else if (idWrap) {
      idWrap.hidden = true;
    }
    const foldRefs = $("#fold-refs");
    if (foldRefs) foldRefs.hidden = !(refs && refs.length);
    setOrgTab("overview");

    window.scrollTo(0, 0);
  }

  function setOrgTab(tab) {
    $$("#org-tabs [data-org-tab]").forEach((btn) => {
      const on = btn.dataset.orgTab === tab;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".profile-fold[data-org-panel]").forEach((el) => {
      el.hidden = el.dataset.orgPanel !== tab;
    });
  }

  if (!$("#org-tabs")?.dataset.bound) {
    $("#org-tabs").dataset.bound = "1";
    $$("#org-tabs [data-org-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setOrgTab(btn.dataset.orgTab));
    });
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

  function bindCommandPalette(cmdIndex) {
    const dialog = $("#cmd-palette");
    const input = $("#cmd-input");
    const list = $("#cmd-results");
    const openBtn = $("#cmd-open");
    if (!dialog || !input || !list) return;

    let highlight = 0;
    let visible = CMD_ACTIONS.map((a) => ({ type: "page", ...a }));

    function rankCmdItem(item, needle) {
      const label = item.label.toLowerCase();
      if (label === needle) return 0;
      if (label.startsWith(needle)) return 1;
      if (label.includes(needle)) return 2;
      if ((item.hint || "").toLowerCase().includes(needle)) return 3;
      return 9;
    }

    function runCmdItem(item) {
      if (!item) return;
      dialog.close();
      if (item.type === "page") {
        showPage(item.id);
        return;
      }
      if (item.type === "org") {
        showPage("registry");
        requestAnimationFrame(() => openOrgSheet(item.orgId));
        return;
      }
      if (item.type === "job") {
        showPage("jobs");
        requestAnimationFrame(() => {
          if ($("#q-jobs")) $("#q-jobs").value = item.label;
          pendingJobSearchFocus = item.label;
          renderJobs();
        });
      }
    }

    function paintResults() {
      list.innerHTML = visible
        .map((a, i) => {
          const kind =
            a.type === "org" ? `<span class="cmd-kind">NGO</span>` : a.type === "job" ? `<span class="cmd-kind">Job</span>` : "";
          return `<li><button type="button" role="option" data-cmd-idx="${i}" aria-selected="${i === highlight ? "true" : "false"}"><strong>${esc(a.label)}</strong> ${kind}<span class="small muted">${esc(a.hint || "")}</span></button></li>`;
        })
        .join("");
      list.querySelectorAll("button[data-cmd-idx]").forEach((btn) => {
        btn.addEventListener("click", () => runCmdItem(visible[Number(btn.dataset.cmdIdx)]));
      });
    }

    function openPalette() {
      visible = CMD_ACTIONS.map((a) => ({ type: "page", ...a }));
      highlight = 0;
      input.value = "";
      paintResults();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      requestAnimationFrame(() => input.focus());
    }

    function filterResults(q) {
      const needle = q.trim().toLowerCase();
      if (!needle) {
        visible = CMD_ACTIONS.map((a) => ({ type: "page", ...a }));
      } else {
        visible = cmdIndex
          .filter((item) => `${item.label} ${item.hint || ""}`.toLowerCase().includes(needle))
          .sort((a, b) => rankCmdItem(a, needle) - rankCmdItem(b, needle))
          .slice(0, 14);
      }
      highlight = 0;
      paintResults();
    }

    openBtn?.addEventListener("click", openPalette);
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
      }
    });

    input.addEventListener("input", () => filterResults(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        highlight = Math.min(highlight + 1, Math.max(visible.length - 1, 0));
        paintResults();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlight = Math.max(highlight - 1, 0);
        paintResults();
      } else if (e.key === "Enter" && visible[highlight]) {
        e.preventDefault();
        runCmdItem(visible[highlight]);
      }
    });
  }

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

  const CARD_TONES = ["mint", "sand", "sky", "coral", "lavender"];

  function orgInitials(name) {
    const parts = String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    return parts.map((p) => p[0]).join("").toUpperCase() || "NG";
  }

  function toneForId(id) {
    let h = 0;
    const s = String(id || "");
    for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * 17) % CARD_TONES.length;
    return CARD_TONES[h];
  }

  let registryView = "cards";
  let selectedRegId = null;
  let registryPresetFocus = false;
  let pendingRegSearchFocus = null;
  let pendingJobSearchFocus = null;

  function pickBestOrgIndex(list, q) {
    if (!list.length) return 0;
    const ql = String(q || "")
      .trim()
      .toLowerCase();
    if (!ql) return 0;
    const exact = list.findIndex(
      (o) => o.name.toLowerCase() === ql || (o.nameEl && String(o.nameEl).toLowerCase() === ql)
    );
    if (exact >= 0) return exact;
    const starts = list.findIndex((o) => o.name.toLowerCase().startsWith(ql));
    if (starts >= 0) return starts;
    const inc = list.findIndex((o) =>
      [o.name, o.nameEl, o.sector, o.focus, o.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(ql)
    );
    return inc >= 0 ? inc : 0;
  }

  function preferDeskPane() {
    return window.matchMedia("(min-width: 1024px)").matches;
  }

  function setRegistryView(mode) {
    registryView = mode === "table" ? "table" : "cards";
    const cards = $("#reg-card-grid");
    const table = document.querySelector(".reg-table-view");
    const split = $("#registry-split");
    const btnCards = $("#reg-view-cards");
    const btnTable = $("#reg-view-table");
    if (split) split.hidden = false;
    if (cards) cards.hidden = registryView !== "cards";
    if (table) table.hidden = registryView !== "table";
    if (split) split.classList.toggle("registry-split--table", registryView === "table");
    if (btnCards) {
      btnCards.classList.toggle("active", registryView === "cards");
      btnCards.setAttribute("aria-pressed", registryView === "cards" ? "true" : "false");
    }
    if (btnTable) {
      btnTable.classList.toggle("active", registryView === "table");
      btnTable.setAttribute("aria-pressed", registryView === "table" ? "true" : "false");
    }
  }

  function renderRegistryCards(list) {
    const grid = $("#reg-card-grid");
    if (!grid) return;
    grid.innerHTML = list
      .map((o) => {
        const jp = o.jobPossibility || {};
        const jo = o.jobOpenings || {};
        const band = jp.band || (jp.status === "scored" ? "Scored" : "Unscored");
        const score = jp.score != null ? jp.score : "—";
        const jobs =
          jo.totalFound != null
            ? `${jo.totalFound} role${jo.totalFound === 1 ? "" : "s"}`
            : "Vacancies pending";
        const tone = toneForId(o.id);
        const regShort = regionLabelShort(o.scope);
        const scorePill =
          typeof score === "number"
            ? `<span class="ngo-card-score-pill">${esc(score)}</span>`
            : `<span class="ngo-card-cap-badge">${esc(band)}</span>`;
        return `<article class="ngo-card ngo-card--${tone}" data-id="${esc(o.id)}">
          <div class="ngo-card-cap">${scorePill}</div>
          <div class="ngo-card-body">
            <span class="ngo-card-initials">${esc(orgInitials(o.name))}</span>
            <h3><a href="#org/${esc(o.id)}" class="table-profile-link">${esc(o.name)}</a></h3>
            <p class="ngo-card-meta">${esc(o.sector || "Sector n/a")} · ${esc(regShort)}</p>
            <div class="ngo-card-pills">
              <span class="pill ${bandClass(jp.band)}">${esc(typeof score === "number" ? `${score}` : band)}</span>
              <span class="pill">${esc(jobs)}</span>
            </div>
            <div class="ngo-card-actions">
              <a class="btn" href="#org/${esc(o.id)}">Profile</a>
              <button type="button" class="btn btn-primary" data-detail="${esc(o.id)}">Detail</button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    grid.querySelectorAll("[data-detail]").forEach((btn) => {
      btn.addEventListener("click", () => openOrgSheet(btn.dataset.detail));
    });
    grid.querySelectorAll(".table-profile-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
  }

  function renderRegistry() {
    const list = filteredOrgs().sort((a, b) => a.name.localeCompare(b.name));
    const countEl = $("#reg-count");
    if (countEl) countEl.innerHTML = registrySummaryLine(list);
    renderRegistryCards(list);
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
        const regSel = selectedRegId === o.id ? " is-selected" : "";
        return `<tr class="reg-row${regSel}" data-id="${esc(o.id)}" tabindex="0">
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
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openOrgSheet(btn.dataset.detail);
      });
    });
    $$("#reg-body tr.reg-row").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        openOrgSheet(tr.dataset.id);
      });
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openOrgSheet(tr.dataset.id);
        }
      });
    });
    $$("#reg-body .table-profile-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
    if (selectedRegId && !list.some((o) => o.id === selectedRegId)) {
      $("#reg-detail-close")?.click();
    } else if (preferDeskPane() && list.length) {
      if (registryPresetFocus) {
        registryPresetFocus = false;
        openOrgSheet(list[0].id);
      } else if (pendingRegSearchFocus !== null) {
        const qq = pendingRegSearchFocus;
        pendingRegSearchFocus = null;
        if (String(qq).trim()) openOrgSheet(list[pickBestOrgIndex(list, qq)].id);
      }
    }
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
    registryPresetFocus = true;
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
    selectedRegId = id;
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
    $$("#reg-card-grid .ngo-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.id === id);
    });
    $$("#reg-body tr.reg-row").forEach((tr) => {
      tr.classList.toggle("is-selected", tr.dataset.id === id);
    });
    const empty = $("#reg-pane-empty");
    if (empty) empty.hidden = true;
    if (!preferDeskPane()) {
      $("#reg-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  $("#reg-detail-close")?.addEventListener("click", () => {
    $("#reg-detail").classList.remove("open");
    const sheet = $("#reg-detail-body");
    if (sheet) sheet.hidden = true;
    const empty = $("#reg-pane-empty");
    if (empty) empty.hidden = false;
    selectedRegId = null;
    $$("#reg-card-grid .ngo-card").forEach((c) => c.classList.remove("is-selected"));
    $$("#reg-body tr.reg-row").forEach((tr) => tr.classList.remove("is-selected"));
  });

  let registrySearchDebounce = null;

  ["q-reg", "f-sector", "f-scope", "f-score", "f-region"].forEach((id) => {
    const el = $(`#${id}`);
    if (!el) return;
    const handler = () => {
      markRegistryFiltersCustom();
      renderRegistry();
      if (id === "q-reg") {
        clearTimeout(registrySearchDebounce);
        const q = (el.value || "").trim();
        if (q.length < 2) return;
        registrySearchDebounce = setTimeout(() => {
          if (!preferDeskPane()) return;
          const list = filteredOrgs().sort((a, b) => a.name.localeCompare(b.name));
          if (list.length) openOrgSheet(list[pickBestOrgIndex(list, q)].id);
        }, 450);
      }
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

  function renderHomeStats() {
    const el = $("#home-stats");
    if (!el) return;
    const postings = allPostings();
    const hiringOrgs = orgs.filter((o) => orgHasVacancyResearch(o)).length;
    el.innerHTML = [
      ["Organisations", String(orgs.length)],
      ["Indexed openings", String(postings.length)],
      ["With vacancy research", String(hiringOrgs)],
      ["Media stories", String(articles.length)],
    ]
      .map(
        ([label, value]) =>
          `<div class="stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`
      )
      .join("");
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

  let lastJobRows = [];
  let jobsView = "cards";
  let selectedJobIdx = null;

  function pickBestJobIndex(rows, q) {
    if (!rows.length) return 0;
    const ql = String(q || "")
      .trim()
      .toLowerCase();
    if (!ql) return 0;
    const exactTitle = rows.findIndex((r) => r.title.toLowerCase() === ql);
    if (exactTitle >= 0) return exactTitle;
    const exactOrg = rows.findIndex((r) => r.org.toLowerCase() === ql);
    if (exactOrg >= 0) return exactOrg;
    const starts = rows.findIndex(
      (r) => r.title.toLowerCase().startsWith(ql) || r.org.toLowerCase().startsWith(ql)
    );
    if (starts >= 0) return starts;
    const inc = rows.findIndex((r) =>
      [r.org, r.title, r.location, r.kind, orgSectorById[r.orgId]].join(" ").toLowerCase().includes(ql)
    );
    return inc >= 0 ? inc : 0;
  }

  function setJobsView(mode) {
    jobsView = mode === "table" ? "table" : "cards";
    const split = $("#jobs-split");
    const cards = $("#jobs-card-grid");
    const table = document.querySelector(".jobs-table-view");
    const btnCards = $("#jobs-view-cards");
    const btnTable = $("#jobs-view-table");
    if (split) {
      split.hidden = false;
      split.classList.toggle("jobs-split--table", jobsView === "table");
    }
    if (cards) cards.hidden = jobsView !== "cards";
    if (table) table.hidden = jobsView !== "table";
    if (btnCards) {
      btnCards.classList.toggle("active", jobsView === "cards");
      btnCards.setAttribute("aria-pressed", jobsView === "cards" ? "true" : "false");
    }
    if (btnTable) {
      btnTable.classList.toggle("active", jobsView === "table");
      btnTable.setAttribute("aria-pressed", jobsView === "table" ? "true" : "false");
    }
    if (preferDeskPane() && lastJobRows.length) {
      const idx = selectedJobIdx != null && lastJobRows[selectedJobIdx] ? selectedJobIdx : 0;
      showJobPane(idx);
    }
  }

  function fillJobDetail(r, prefix) {
    $(`#${prefix}-title`).textContent = r.title || "Opening";
    $(`#${prefix}-org`).innerHTML = `<a href="#org/${esc(r.orgId)}">${esc(r.org)}</a> · ${esc(
      orgSectorById[r.orgId] || ""
    )}`;
    $(`#${prefix}-facts`).innerHTML = [
      ["Posted", r.postedDate || "—"],
      ["Deadline", r.deadline || "—"],
      ["Location", r.location || "—"],
      ["Type", r.kind || "—"],
    ]
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join("");
    $(`#${prefix}-dek`).textContent = r.location
      ? `Based in ${r.location}. Confirm details on the employer site before applying.`
      : "";
    $(`#${prefix}-actions`).innerHTML = [
      r.url
        ? `<a class="btn btn-primary" href="${esc(r.url)}" target="_blank" rel="noopener">Apply on site</a>`
        : "",
      `<button type="button" class="btn" data-page="apply">Spontaneous CV</button>`,
      `<a class="btn" href="#org/${esc(r.orgId)}">Org profile</a>`,
    ]
      .filter(Boolean)
      .join("");
    $$(`#${prefix}-actions [data-page]`).forEach((b) =>
      b.addEventListener("click", () => {
        const dialog = $("#job-drawer");
        if (dialog?.open) dialog.close();
        showPage(b.dataset.page);
      })
    );
    $$(`#${prefix}-org a[href^="#org/"]`).forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
    $$(`#${prefix}-actions a[href^="#org/"]`).forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
  }

  function highlightJobSelection(index) {
    $$("#jobs-card-grid .job-card").forEach((el, i) => {
      el.classList.toggle("is-selected", i === index);
    });
    $$("#jobs-body tr.job-row").forEach((tr) => {
      tr.classList.toggle("is-selected", Number(tr.dataset.jobIdx) === index);
    });
  }

  function showJobPane(index) {
    const r = lastJobRows[index];
    if (!r) return;
    selectedJobIdx = index;
    highlightJobSelection(index);
    const pane = $("#job-detail-pane");
    const empty = $("#job-pane-empty");
    const body = $("#job-pane-body");
    if (!pane || !body) return;
    pane.hidden = false;
    if (empty) empty.hidden = true;
    body.hidden = false;
    fillJobDetail(r, "job-pane");
    requestAnimationFrame(() => {
      const target =
        jobsView === "table"
          ? $(`#jobs-body tr[data-job-idx="${index}"]`)
          : $(`#jobs-card-grid [data-job-card="${index}"]`);
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  function openJobDrawer(index) {
    const r = lastJobRows[index];
    if (!r) return;
    if (preferDeskPane() && (jobsView === "cards" || jobsView === "table")) {
      showJobPane(index);
      return;
    }
    const dialog = $("#job-drawer");
    if (!dialog) return;
    fillJobDetail(r, "job-drawer");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderJobCards(rows) {
    const grid = $("#jobs-card-grid");
    if (!grid) return;
    const now = Date.now();
    grid.innerHTML = rows
      .map((r, i) => {
        const tone = toneForId(r.orgId);
        const dl = parseDeadline(r.deadline);
        const urgent = dl && dl >= now && dl - now < 14 * 86400000;
        const sel = selectedJobIdx === i ? " is-selected" : "";
        return `<article class="ngo-card job-card ngo-card--${tone}${sel}" data-job-card="${i}">
          <div class="ngo-card-cap"><span class="ngo-card-cap-badge">${r.kind ? esc(r.kind) : "Opening"}</span></div>
          <div class="ngo-card-body">
            <span class="ngo-card-initials">${esc(orgInitials(r.org))}</span>
            <h3>${esc(r.title)}</h3>
            <p class="ngo-card-meta"><a href="#org/${esc(r.orgId)}" class="table-profile-link">${esc(r.org)}</a> · ${esc(r.location || "Greece")}</p>
            <div class="ngo-card-pills">
              ${r.kind ? `<span class="pill">${esc(r.kind)}</span>` : ""}
              ${r.postedDate ? `<span class="pill">Posted ${esc(r.postedDate)}</span>` : ""}
              ${urgent ? `<span class="pill pill-urgent">Deadline ${esc(r.deadline)}</span>` : r.deadline ? `<span class="pill">${esc(r.deadline)}</span>` : ""}
            </div>
            <div class="ngo-card-actions">
              <button type="button" class="btn" data-job-idx="${i}">Details</button>
              ${
                r.url
                  ? `<a class="btn btn-primary" href="${esc(r.url)}" target="_blank" rel="noopener">Apply</a>`
                  : `<button type="button" class="btn btn-primary" data-job-idx="${i}">Details</button>`
              }
            </div>
          </div>
        </article>`;
      })
      .join("");
    grid.querySelectorAll("[data-job-idx]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openJobDrawer(Number(btn.dataset.jobIdx));
      });
    });
    grid.querySelectorAll("[data-job-card]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        openJobDrawer(Number(card.dataset.jobCard));
      });
    });
    grid.querySelectorAll(".table-profile-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
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
    const prevKey =
      selectedJobIdx != null && lastJobRows[selectedJobIdx]
        ? `${lastJobRows[selectedJobIdx].orgId}::${lastJobRows[selectedJobIdx].title}`
        : null;
    lastJobRows = rows;
    const countEl = $("#jobs-result-count");
    if (countEl) {
      countEl.innerHTML = `<strong>${rows.length}</strong> opening${rows.length === 1 ? "" : "s"}`;
    }
    if (prevKey) {
      const found = rows.findIndex((r) => `${r.orgId}::${r.title}` === prevKey);
      selectedJobIdx = found >= 0 ? found : null;
    }
    renderJobCards(rows);
    if (preferDeskPane() && rows.length && (jobsView === "cards" || jobsView === "table")) {
      let idx = selectedJobIdx != null ? selectedJobIdx : 0;
      if (pendingJobSearchFocus !== null) {
        idx = pickBestJobIndex(rows, pendingJobSearchFocus);
        pendingJobSearchFocus = null;
        selectedJobIdx = idx;
      }
      showJobPane(idx);
    } else if (pendingJobSearchFocus !== null && rows.length) {
      const idx = pickBestJobIndex(rows, pendingJobSearchFocus);
      pendingJobSearchFocus = null;
      selectedJobIdx = idx;
      openJobDrawer(idx);
    } else if (!rows.length) {
      selectedJobIdx = null;
      const pane = $("#job-detail-pane");
      const empty = $("#job-pane-empty");
      const body = $("#job-pane-body");
      if (pane) pane.hidden = !preferDeskPane();
      if (empty) empty.hidden = false;
      if (body) body.hidden = true;
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
            .map((r) => {
              const idx = rows.findIndex(
                (x) => x.orgId === r.orgId && x.title === r.title && x.deadline === r.deadline
              );
              const apply = r.url
                ? `<span class="deadline-chip-apply"><a class="deadline-chip-external" href="${esc(r.url)}" target="_blank" rel="noopener">Apply ↗</a></span>`
                : "";
              return `<button type="button" class="deadline-chip" data-job-idx="${idx >= 0 ? idx : 0}" title="Show in detail pane">
                <strong>${esc(r.org)}</strong><span>${esc(r.title)}</span><em>${esc(r.deadline)}</em>${apply}
              </button>`;
            })
            .join("");
        $$("#jobs-deadlines .deadline-chip[data-job-idx]").forEach((btn) => {
          btn.addEventListener("click", () => openJobDrawer(Number(btn.dataset.jobIdx)));
        });
        $$("#jobs-deadlines .deadline-chip-external").forEach((a) => {
          a.addEventListener("click", (e) => e.stopPropagation());
        });
      } else {
        rail.hidden = true;
        rail.innerHTML = "";
      }
    }

    $("#jobs-body").innerHTML = rows
      .map((r, i) => {
        const sel = selectedJobIdx === i ? " is-selected" : "";
        return `<tr class="job-row${sel}" data-job-idx="${i}" tabindex="0">
        <td><a href="#org/${esc(r.orgId)}" class="table-profile-link">${esc(r.org)}</a></td>
        <td>${esc(r.title)}${r.kind ? ` <span class="pill">${esc(r.kind)}</span>` : ""}</td>
        <td>${esc(r.postedDate || "—")}</td>
        <td>${esc(r.deadline || "—")}</td>
        <td class="small">${esc(r.location || "—")}</td>
        <td>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">Open</a>` : `<button type="button" class="pill" data-job-idx="${i}">Detail</button>`}</td>
      </tr>`;
      })
      .join("");
    $$("#jobs-body tr.job-row").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        openJobDrawer(Number(tr.dataset.jobIdx));
      });
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openJobDrawer(Number(tr.dataset.jobIdx));
        }
      });
    });
    $$("#jobs-body button[data-job-idx]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openJobDrawer(Number(btn.dataset.jobIdx));
      });
    });
    $$("#jobs-body .table-profile-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
    if (selectedJobIdx != null && preferDeskPane()) {
      highlightJobSelection(selectedJobIdx);
    }
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
      .map((c, i) => {
        const tone = toneForId(c.orgId || String(i));
        const mail = c.email
          ? `<a class="email-link" href="mailto:${esc(c.email)}?subject=${encodeURIComponent(
              "Spontaneous application — Greece NGO Desk"
            )}">${esc(c.email)}</a>`
          : c.applyUrl
            ? `<a href="${esc(c.applyUrl)}" target="_blank" rel="noopener">Apply via ATS</a>`
            : "—";
        const profile =
          c.orgId ? `<a class="btn" href="#org/${esc(c.orgId)}">Profile</a>` : "";
        return `<article class="ngo-card ngo-card--${tone}">
          <div class="ngo-card-cap"></div>
          <div class="ngo-card-body">
            <span class="ngo-card-initials">${esc(orgInitials(c.name))}</span>
            <h3>${esc(c.name)}</h3>
            <p class="ngo-card-meta">${esc(c.kind || "Contact")}</p>
            <div class="ngo-card-pills">${c.email ? `<span class="pill">Email</span>` : `<span class="pill">ATS</span>`}</div>
            <div class="email-addr">${mail}</div>
            ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
            <div class="ngo-card-actions">
              ${profile}
              ${c.email ? `<a class="btn btn-primary email-link" href="mailto:${esc(c.email)}?subject=${encodeURIComponent("Spontaneous application — Greece NGO Desk")}">Send CV</a>` : ""}
            </div>
          </div>
        </article>`;
      })
      .join("");
    $$("#apply-emails a[href^='#org/']").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
  }

  /* ---------- possibility ---------- */
  function renderPossibility() {
    const ranked = [...possibility].sort((a, b) => b.score - a.score);
    const chartEl = $("#poss-chart");
    if (chartEl) {
      chartEl.innerHTML = ranked
        .slice(0, 4)
        .map(
          (o) =>
            `<div class="stat"><div class="label">${esc(o.name)}</div><div class="value">${esc(o.score)}</div></div>`
        )
        .join("");
    }

    const orgByPossId = Object.fromEntries(orgs.map((o) => [o.id, o]));
    $("#poss-cards").innerHTML = ranked
      .map((o, i) => {
        const org = orgByPossId[o.id];
        const tone = toneForId(o.id || String(i));
        const staff =
          o.staff?.estimate != null
            ? `${o.staff.estimate}${o.staff.year ? ` (${o.staff.year})` : ""}`
            : o.staff?.range || "—";
        const deps =
          o.beneficiariesDependents?.estimateLabel ||
          (o.beneficiariesDependents?.estimate != null
            ? String(o.beneficiariesDependents.estimate)
            : "—");
        const name = org?.name || o.name;
        return `<article class="ngo-card ngo-card--${tone}">
          <div class="ngo-card-cap"></div>
          <div class="ngo-card-body">
            <span class="ngo-card-initials">${esc(orgInitials(name))}</span>
            <h3>${org ? `<a href="#org/${esc(o.id)}" class="table-profile-link">${esc(name)}</a>` : esc(name)}</h3>
            <div class="ngo-card-pills">
              <span class="pill ${bandClass(o.possibility)}">${esc(o.score)} · ${esc(o.possibility)}</span>
            </div>
            <p class="ngo-card-meta">Staff: ${esc(staff)} · People: ${esc(deps)}</p>
            <div class="score-bar" title="Score ${o.score}"><span style="width:${o.score}%"></span></div>
            <p class="small muted">${esc(o.why)}</p>
            <div class="ngo-card-actions">
              ${org ? `<a class="btn btn-primary" href="#org/${esc(o.id)}">Profile</a>` : ""}
              <button type="button" class="btn" data-page="jobs">Openings</button>
            </div>
          </div>
        </article>`;
      })
      .join("");
    $$("#poss-cards .table-profile-link, #poss-cards a[href^='#org/']").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
    $$("#poss-cards [data-page]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        showPage(btn.dataset.page);
      });
    });
    $$("#poss-cards .ngo-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        const link = card.querySelector("a[href^='#org/']");
        const id = link?.getAttribute("href")?.replace("#org/", "");
        if (id) openOrgProfile(id);
      });
    });
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
    const headH2 = document.querySelector(".bento-section-head h2");
    if (headH2) headH2.textContent = `Hot this week${week}`;

    const tones = CARD_TONES;
    rail.innerHTML = hotArticles()
      .map(
        (a, i) => `
      <button type="button" class="story-card story-card--${tones[i % tones.length]}" data-media-id="${esc(a.id)}">
        <div class="story-card-cap"><span class="story-card-date">${esc(formatMediaDate(a.date))}</span></div>
        <div class="story-card-body">
          <span class="story-card-title">${esc(a.title)}</span>
          <span class="story-card-dek">${esc(a.dek || "")}</span>
        </div>
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
      .map((a, i) => {
        const tags = (a.tags || []).map((t) => `<span class="media-tag">${esc(t)}</span>`).join("");
        const paras = (a.body || []).slice(0, 3).map((p) => `<p>${esc(p)}</p>`).join("");
        const tone = CARD_TONES[i % CARD_TONES.length];
        return `
        <article class="ngo-card media-feed-card ngo-card--${tone}" id="article-${esc(a.id)}">
          <div class="media-feed-card-img">
            <img src="${esc(a.image || "img/athens-agora.jpg")}" alt="${esc(a.imageAlt || a.title)}" loading="lazy" />
          </div>
          <div class="ngo-card-body">
            <div class="media-article-meta">
              <time datetime="${esc(a.date)}">${esc(formatMediaDate(a.date))}</time>
              ${a.hot ? `<span class="media-hot">Hot</span>` : ""}
              <span class="media-source">${esc(a.source || "")}</span>
            </div>
            <h2>${esc(a.title)}</h2>
            <p class="media-dek">${esc(a.dek || "")}</p>
            <div class="media-copy">${paras}</div>
            <div class="media-tags">${tags}</div>
            <div class="ngo-card-actions">
              ${
                a.sourceUrl
                  ? `<a class="btn btn-primary" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">Read source ↗</a>`
                  : ""
              }
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  $("#q-media")?.addEventListener("input", renderMedia);

  document.body.classList.add("desk-bento");
  setRegistryView("cards");
  setJobsView("cards");
  $("#reg-view-cards")?.addEventListener("click", () => setRegistryView("cards"));
  $("#reg-view-table")?.addEventListener("click", () => setRegistryView("table"));
  $("#jobs-view-cards")?.addEventListener("click", () => setJobsView("cards"));
  $("#jobs-view-table")?.addEventListener("click", () => setJobsView("table"));
  $("#desk-rail-more")?.addEventListener("click", () => showPage("possibility"));
  $("#hero-search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const intent = $("#hero-intent")?.value || "registry";
    const q = ($("#hero-q")?.value || "").trim();
    const region = $("#hero-region")?.value || "";
    showPage(intent);
    requestAnimationFrame(() => {
      if (intent === "registry") {
        if ($("#q-reg")) $("#q-reg").value = q;
        if (region && $("#f-region")) $("#f-region").value = region;
        markRegistryFiltersCustom();
        pendingRegSearchFocus = q.trim() ? q : null;
        renderRegistry();
      } else if (intent === "jobs") {
        if ($("#q-jobs")) $("#q-jobs").value = q;
        if (region === "athens" && $("#f-jobs-region")) $("#f-jobs-region").value = "athens";
        else if (region && $("#f-jobs-region")) $("#f-jobs-region").value = "all";
        pendingJobSearchFocus = q.trim() ? q : null;
        renderJobs();
      } else if (intent === "media" && $("#q-media")) {
        $("#q-media").value = q;
        renderMedia();
      }
    });
  });

  renderHotRail();
  renderHomeStats();
  renderMedia();
  renderRegistry();
  renderJobs();
  renderApply();
  renderPossibility();

  function buildCommandIndex() {
    return [
      ...CMD_ACTIONS.map((a) => ({ type: "page", id: a.id, label: a.label, hint: a.hint })),
      ...orgs.map((o) => ({
        type: "org",
        orgId: o.id,
        label: o.name,
        hint: [o.sector, regionLabelShort(o.scope)].filter(Boolean).join(" · ") || "Organisation",
      })),
      ...allPostings().map((r) => ({
        type: "job",
        jobKey: `${r.orgId}::${r.title}`,
        label: r.title,
        hint: `${r.org}${r.location ? ` · ${r.location}` : ""}`,
      })),
    ];
  }

  bindNavOverflow();
  bindCommandPalette(buildCommandIndex());
  applyRoute();
})();


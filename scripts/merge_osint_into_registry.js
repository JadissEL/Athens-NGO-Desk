/**
 * Merge auto-generated OSINT profile stubs + optional overrides into registry.organizations.
 * Used by build_data.js, server seed, and publish (Fastify).
 */
const fs = require("fs");
const path = require("path");

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/**
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 */
function deepMerge(target, source) {
  if (!isPlainObject(source)) return target;
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(/** @type {Record<string, unknown>} */ (out[k]), v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
function websiteHost(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} org
 * @returns {string[]}
 */
function linkedInHintsFromJobs(org) {
  const sources = org.jobOpenings && org.jobOpenings.sources;
  if (!Array.isArray(sources)) return [];
  return sources.filter((s) => typeof s === "string" && s.toLowerCase().includes("linkedin"));
}

/**
 * Normalise for fuzzy name / tag matching (Greek-insensitive; strip accents lightly).
 * @param {string} s
 */
function normaliseMatchKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0370-\u03FF]+/gi, " ")
    .trim();
}

/**
 * Tokens from org name for matching media tags and titles.
 * @param {string} name
 */
function orgNameTokens(name) {
  const n = normaliseMatchKey(name);
  const parts = n.split(/\s+/).filter((p) => p.length > 2);
  /** @type {Set<string>} */
  const out = new Set();
  for (const p of parts) {
    out.add(p);
  }
  const short = normaliseMatchKey(name).replace(/\s+/g, "");
  if (short.length >= 4) out.add(short);
  return [...out];
}

/** Tokens too generic for digest substring matching (false positives). */
const MEDIA_STOPWORD_TOKENS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "hellas",
  "hellenic",
  "greek",
  "greece",
  "athens",
  "ngo",
  "network",
  "international",
  "national",
  "project",
  "association",
  "foundation",
  "initiative",
  "services",
  "center",
  "centre",
  "support",
]);

/** Common newsroom / digest abbreviations (expand over time). */
const ORG_ALIAS_TOKENS = {
  "ngo-036-m-decins-sans-fronti-res-greek-section": [
    "msf",
    "medecins sans frontieres",
    "frontieres",
    "doctors without borders",
    "doctorswithoutborders",
  ],
  "ngo-013-international-rescue-committee-hellas": ["irc", "international rescue committee", "rescue committee"],
  "ngo-057-actionaid-hellas": ["actionaid", "action aid"],
  "ngo-001-metadrasi": ["metadrasi", "meta drasi"],
  "ngo-009-arsis": ["arsis"],
  "ngo-002-greek-council-for-refugees-gcr": ["gcr", "greek council for refugees", "elliniko symvoulio"],
  "ngo-008-the-home-project": ["home project", "the home project"],
  "ngo-065-amnesty-international-greece": ["amnesty", "amnesty international", "amnesty gr"],
  "ngo-098-synyparxis": ["synyparxi", "synyparxis", "συνυπαρξη"],
  "ngo-090-unhcr-greece": ["unhcr", "un high commissioner", "refugee agency"],
  "ngo-004-praksis": ["praksis", "πραξη"],
  "ngo-003-solidaritynow": ["solidaritynow", "solidarity now"],
  "ngo-033-terre-des-hommes-hellas": ["terre des hommes", "tdh"],
  "ngo-035-doctors-of-the-world-greek-delegation": ["mdm", "doctors of the world", "mdmgreece", "medecins du monde"],
};

/**
 * @param {string} s
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Slug fragments from id e.g. ngo-057-actionaid-hellas → actionaid, hellas
 * @param {string} orgId
 */
function slugTokensFromOrgId(orgId) {
  if (!orgId || typeof orgId !== "string") return [];
  const slug = orgId.replace(/^ngo-\d+-/i, "");
  return slug
    .split(/-+/)
    .map((p) => normaliseMatchKey(p))
    .filter((t) => t.length > 2 && !MEDIA_STOPWORD_TOKENS.has(t));
}

/**
 * First label of website host (metadrasi.org → metadrasi) when distinct from name tokens.
 * @param {string | null | undefined} website
 */
function domainLabelTokenFromWebsite(website) {
  const host = websiteHost(website);
  if (!host) return null;
  const first = host.split(".")[0];
  const t = normaliseMatchKey(first);
  if (t.length < 4) return null;
  if (["www", "mail", "jobs", "careers", "apply"].includes(t)) return null;
  return t;
}

/**
 * True if token appears as a word in normalised hay (reduces "hellas" in "hellasthe" style false positives).
 * @param {string} hayNorm
 * @param {string} token
 */
function tokenMatchesInHay(hayNorm, token) {
  if (!hayNorm || !token) return false;
  const t = token.trim();
  if (t.length < 2) return false;
  if (MEDIA_STOPWORD_TOKENS.has(t) && t.length < 6) return false;
  if (t.length >= 6) {
    const re = new RegExp(`(^|[^a-z0-9\u0370-\u03FF])${escapeRegExp(t)}([^a-z0-9\u0370-\u03FF]|$)`);
    return re.test(hayNorm);
  }
  const strict = new RegExp(`(^|\\s)${escapeRegExp(t)}(\\s|$)`);
  return strict.test(hayNorm);
}

/**
 * Parenthetical acronyms e.g. "Greek Council for Refugees (GCR)" → gcr
 * @param {string} name
 */
function acronymTokensFromName(name) {
  const out = [];
  if (!name || typeof name !== "string") return out;
  const re = /\(([A-Za-zΑ-Ωα-ω0-9&.\-\s]+)\)/g;
  let m;
  while ((m = re.exec(name)) !== null) {
    const inner = m[1].trim();
    const parts = inner.split(/[\s/]+/).filter(Boolean);
    for (const p of parts) {
      const t = normaliseMatchKey(p.replace(/[^a-z0-9\u0370-\u03FF]/gi, ""));
      if (t.length >= 2 && t.length <= 12) out.push(t);
    }
  }
  return out;
}

/**
 * @param {string} orgId
 * @param {string} primaryName
 * @param {string} nameEl
 * @param {string | null | undefined} website
 */
function mediaMatchTokensForOrg(orgId, primaryName, nameEl, website) {
  const base = [...orgNameTokens(primaryName), ...orgNameTokens(nameEl), ...acronymTokensFromName(primaryName), ...acronymTokensFromName(nameEl)];
  const extra = ORG_ALIAS_TOKENS[orgId];
  if (Array.isArray(extra)) {
    for (const e of extra) {
      const t = normaliseMatchKey(e);
      if (t.length >= 2) base.push(t);
    }
  }
  for (const st of slugTokensFromOrgId(orgId)) base.push(st);
  const dom = domainLabelTokenFromWebsite(website);
  if (dom) base.push(dom);
  return [...new Set(base.filter(Boolean))];
}

/**
 * @param {Record<string, unknown>} article
 * @param {string[]} tokens
 * @param {string} orgNorm
 */
function articleMentionsOrg(article, tokens, orgNorm) {
  const hay = normaliseMatchKey(
    [article.title, article.dek, ...(Array.isArray(article.tags) ? article.tags : []), ...(Array.isArray(article.body) ? article.body : [])].join(" ")
  );
  if (orgNorm.length >= 8 && orgNorm.includes(" ")) {
    const words = orgNorm.split(/\s+/).filter((w) => w.length > 2);
    const significant = words.filter((w) => !(MEDIA_STOPWORD_TOKENS.has(w) && w.length < 6));
    if (significant.length >= 2 && significant.every((w) => tokenMatchesInHay(hay, w))) return true;
  }
  if (orgNorm.length >= 10 && !orgNorm.includes(" ")) {
    const re = new RegExp(`(^|[^a-z0-9\u0370-\u03FF])${escapeRegExp(orgNorm)}([^a-z0-9\u0370-\u03FF]|$)`);
    if (re.test(hay)) return true;
  }

  let hits = 0;
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (MEDIA_STOPWORD_TOKENS.has(t) && t.length < 6) continue;
    if (!tokenMatchesInHay(hay, t)) continue;
    if (t.length >= 6) return true;
    if (t.length >= 4) hits++;
  }
  return hits >= 2;
}

/**
 * @param {unknown} poss
 * @param {string} orgId
 * @returns {Record<string, unknown> | null}
 */
function possibilityRowByOrgId(poss, orgId) {
  if (!poss || typeof poss !== "object") return null;
  const orgs = /** @type {Record<string, unknown>} */ (poss).organizations;
  if (!Array.isArray(orgs)) return null;
  const row = orgs.find((o) => o && typeof o === "object" && (/** @type {Record<string, unknown>} */ (o)).id === orgId);
  return row && typeof row === "object" ? /** @type {Record<string, unknown>} */ (row) : null;
}

/**
 * @param {unknown} mediaBundle
 * @param {{ primaryName: string, nameEl?: string | null, website?: string | null }} identity
 * @returns {{ display: Record<string, unknown>[], rawMatched: Record<string, unknown>[] }}
 */
function mediaMentionsForOrg(mediaBundle, identity, orgId) {
  const empty = { display: [], rawMatched: [] };
  const meta = mediaBundle && typeof mediaBundle === "object" ? /** @type {Record<string, unknown>} */ (mediaBundle).meta : null;
  const weekLabel = meta && typeof meta.weekLabel === "string" ? meta.weekLabel : "";
  const articles = mediaBundle && typeof mediaBundle === "object" ? /** @type {Record<string, unknown>} */ (mediaBundle).articles : null;
  if (!Array.isArray(articles)) return empty;

  const primary = String(identity.primaryName || "");
  const nameEl = identity.nameEl != null ? String(identity.nameEl) : "";
  const website = identity.website != null && typeof identity.website === "string" ? identity.website : null;
  const tokens = mediaMatchTokensForOrg(String(orgId || ""), primary, nameEl, website).filter(Boolean);
  const orgNorm = normaliseMatchKey(primary);

  /** @type {Record<string, unknown>[]} */
  const rawMatched = [];
  for (const a of articles) {
    if (!a || typeof a !== "object") continue;
    if (articleMentionsOrg(/** @type {Record<string, unknown>} */ (a), tokens, orgNorm)) {
      rawMatched.push(/** @type {Record<string, unknown>} */ (a));
    }
  }
  const display = rawMatched
    .map((a) => {
      const ar = a;
      return {
        articleId: typeof ar.id === "string" ? ar.id : "",
        title: typeof ar.title === "string" ? ar.title : "",
        dek: typeof ar.dek === "string" ? ar.dek : null,
        date: typeof ar.date === "string" ? ar.date : null,
        sourceLabel: typeof ar.source === "string" ? ar.source : null,
        sourceUrl: typeof ar.sourceUrl === "string" ? ar.sourceUrl : "",
        digestWeekLabel: weekLabel || null,
      };
    })
    .filter((m) => m.title && m.sourceUrl);
  return { display, rawMatched };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractUrls(text) {
  if (!text || typeof text !== "string") return [];
  const re = /https?:\/\/[^\s)\]"'<>]+/gi;
  const found = text.match(re) || [];
  const seen = new Set();
  const out = [];
  for (let u of found) {
    u = u.replace(/[.,;:!?)]+$/, "");
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * Normalise URL for deduplication (strip query, trailing slash, lowercase host).
 * @param {string} url
 */
function normalizeUrlForDedupe(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.search = "";
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  } catch {
    return url.trim();
  }
}

/**
 * Normalise a discovery "source" string (domain or host/path) to an https URL when safe.
 * @param {string} raw
 * @returns {string | null}
 */
function sourceHintToUrl(raw) {
  const s = String(raw || "").trim();
  if (!s || /\s/.test(s)) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^www\./i.test(s)) return `https://${s}`;
  // host.tld or host.tld/path (no spaces)
  if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  return null;
}

/**
 * Unique non-null URLs preserving first-seen order.
 * @param {string[]} urls
 */
function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    if (!u || typeof u !== "string") continue;
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} possRow
 */
function referencesFromPossibility(possRow) {
  /** @type {Record<string, unknown>[]} */
  const refs = [];
  const push = (label, url, type) => {
    if (!url || typeof url !== "string") return;
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    refs.push({ label: label || u, url: u, type });
  };

  const staff = possRow.staff && typeof possRow.staff === "object" ? /** @type {Record<string, unknown>} */ (possRow.staff) : null;
  const staffSrc = staff && typeof staff.source === "string" ? staff.source : "";
  for (const u of extractUrls(staffSrc)) {
    push("Staff / scale (cited in job_possibility.json)", u, "other");
  }

  const ben = possRow.beneficiariesDependents && typeof possRow.beneficiariesDependents === "object" ? /** @type {Record<string, unknown>} */ (possRow.beneficiariesDependents) : null;
  const benSrc = ben && typeof ben.source === "string" ? ben.source : "";
  for (const u of extractUrls(benSrc)) {
    push("Beneficiaries / reach (cited in job_possibility.json)", u, "other");
  }

  const hiring = possRow.hiringSignal && typeof possRow.hiringSignal === "object" ? /** @type {Record<string, unknown>} */ (possRow.hiringSignal) : null;
  const hireBlob = [hiring?.extra, hiring?.span]
    .filter((x) => typeof x === "string")
    .join(" ");
  for (const u of extractUrls(hireBlob)) {
    push("Hiring signal (cited in job_possibility.json)", u, "careers");
  }

  if (possRow.why && typeof possRow.why === "string") {
    for (const u of extractUrls(possRow.why)) {
      push("Possibility narrative (URL in job_possibility.json)", u, "other");
    }
  }

  return refs;
}

/**
 * @param {Record<string, unknown>[]} refs
 */
function dedupeRefs(refs) {
  const seen = new Set();
  const out = [];
  for (const r of refs) {
    if (!r || typeof r.url !== "string") continue;
    const k = normalizeUrlForDedupe(r.url);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Rich notes from job_possibility row (text OSINT, URLs extracted separately).
 * @param {Record<string, unknown>} possRow
 */
function possibilityTextBundle(possRow) {
  const staff = possRow.staff && typeof possRow.staff === "object" ? /** @type {Record<string, unknown>} */ (possRow.staff) : null;
  const ben = possRow.beneficiariesDependents && typeof possRow.beneficiariesDependents === "object" ? /** @type {Record<string, unknown>} */ (possRow.beneficiariesDependents) : null;
  const hiring = possRow.hiringSignal && typeof possRow.hiringSignal === "object" ? /** @type {Record<string, unknown>} */ (possRow.hiringSignal) : null;

  const staffBits = [];
  if (staff?.source && typeof staff.source === "string" && !/^https?:\/\//i.test(staff.source)) {
    staffBits.push(`Staff source note: ${staff.source}`);
  }
  if (staff?.note && typeof staff.note === "string") staffBits.push(`Staff note: ${staff.note}`);

  const benBits = [];
  if (ben?.source && typeof ben.source === "string" && !/^https?:\/\//i.test(ben.source)) {
    benBits.push(`Beneficiaries source note: ${ben.source}`);
  }
  const ex = ben?.examples;
  if (Array.isArray(ex) && ex.length) {
    benBits.push(`Examples cited: ${ex.filter((x) => typeof x === "string").join(" · ")}`);
  }

  const hireBits = [];
  if (hiring?.extra && typeof hiring.extra === "string") hireBits.push(hiring.extra);
  if (hiring?.span && typeof hiring.span === "string") hireBits.push(`Posting span (index): ${hiring.span}`);

  return { staffBits, benBits, hireBits };
}

/**
 * @param {Record<string, unknown>[]} mentions
 */
function referencesFromMedia(mentions) {
  return mentions.map((m) => ({
    label: m.digestWeekLabel ? `${m.title} (${m.digestWeekLabel})` : m.title,
    url: m.sourceUrl,
    type: "news",
    retrievedAt: m.date || null,
  }));
}

/**
 * Extra URLs found only in digest body paragraphs when the piece matches this org (primary sources cited in copy).
 * @param {unknown} mediaBundle
 * @param {Record<string, unknown>[]} matchedArticlesRaw
 * @param {string | null | undefined} orgWebsite
 */
function referencesFromMediaBodyUrls(mediaBundle, matchedArticlesRaw, orgWebsite) {
  /** @type {Record<string, unknown>[]} */
  const refs = [];
  const push = (label, url, type) => {
    if (!url || typeof url !== "string") return;
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    refs.push({ label: label || u, url: u, type });
  };
  if (!mediaBundle || typeof mediaBundle !== "object") return refs;
  const articles = /** @type {Record<string, unknown>} */ (mediaBundle).articles;
  if (!Array.isArray(articles) || !Array.isArray(matchedArticlesRaw)) return refs;
  const ids = new Set(
    matchedArticlesRaw
      .map((a) => (a && typeof a === "object" && typeof (/** @type {Record<string, unknown>} */ (a)).id === "string" ? (/** @type {Record<string, unknown>} */ (a)).id : ""))
      .filter(Boolean)
  );
  const orgHost = websiteHost(orgWebsite);
  const meta = /** @type {Record<string, unknown>} */ (mediaBundle).meta;
  const weekLabel = meta && typeof meta.weekLabel === "string" ? meta.weekLabel : "";
  for (const a of articles) {
    if (!a || typeof a !== "object") continue;
    const ar = /** @type {Record<string, unknown>} */ (a);
    const aid = typeof ar.id === "string" ? ar.id : "";
    if (!aid || !ids.has(aid)) continue;
    const title = typeof ar.title === "string" ? ar.title : "Digest article";
    const body = Array.isArray(ar.body) ? ar.body.filter((x) => typeof x === "string").join("\n") : "";
    const dek = typeof ar.dek === "string" ? ar.dek : "";
    const blob = `${dek}\n${body}`;
    const primary = typeof ar.sourceUrl === "string" ? ar.sourceUrl : "";
    for (const u of extractUrls(blob)) {
      if (primary && normalizeUrlForDedupe(u) === normalizeUrlForDedupe(primary)) continue;
      try {
        const h = new URL(u).hostname.replace(/^www\./i, "");
        if (orgHost && h === orgHost) continue;
      } catch {
        /* keep */
      }
      const wk = weekLabel ? ` (${weekLabel})` : "";
      push(`Digest — further link${wk}: ${title}`, u, "news");
    }
  }
  return refs;
}

/**
 * ATS / apply links from spontaneous_emails.json (same orgId).
 * @param {Record<string, unknown>} org
 * @param {unknown} emailsBundle
 */
function referencesFromSpontaneousContacts(org, emailsBundle) {
  /** @type {Record<string, unknown>[]} */
  const refs = [];
  const push = (label, url, type) => {
    if (!url || typeof url !== "string") return;
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    refs.push({ label: label || u, url: u, type });
  };
  const orgId = typeof org.id === "string" ? org.id : "";
  if (!orgId || !emailsBundle || typeof emailsBundle !== "object") return refs;
  const contacts = /** @type {Record<string, unknown>} */ (emailsBundle).contacts;
  if (!Array.isArray(contacts)) return refs;
  for (const c of contacts) {
    if (!c || typeof c !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (c);
    if (row.orgId !== orgId) continue;
    const kind = typeof row.kind === "string" ? row.kind : "contact";
    if (row.applyUrl && typeof row.applyUrl === "string") {
      push(`Spontaneous / careers (${kind}): apply URL`, row.applyUrl, "careers");
    }
    if (row.note && typeof row.note === "string") {
      for (const u of extractUrls(row.note)) {
        push(`Spontaneous contact note (URL)`, u, "careers");
      }
    }
  }
  return refs;
}

/**
 * Structured rows for UI: every spontaneous_emails.json contact for this orgId (email and/or apply URL).
 * @param {Record<string, unknown>} org
 * @param {unknown} emailsBundle
 * @returns {Record<string, unknown>[]}
 */
function contactHintsFromSpontaneousEmails(org, emailsBundle) {
  /** @type {Record<string, unknown>[]} */
  const out = [];
  const orgId = typeof org.id === "string" ? org.id : "";
  if (!orgId || !emailsBundle || typeof emailsBundle !== "object") return out;
  const contacts = /** @type {Record<string, unknown>} */ (emailsBundle).contacts;
  if (!Array.isArray(contacts)) return out;
  for (const c of contacts) {
    if (!c || typeof c !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (c);
    if (row.orgId !== orgId) continue;
    const kind = typeof row.kind === "string" ? row.kind : "contact";
    const name = typeof row.name === "string" ? row.name : "Desk contact";
    const email = row.email != null && typeof row.email === "string" ? row.email : null;
    const applyUrl = row.applyUrl != null && typeof row.applyUrl === "string" ? row.applyUrl : null;
    if (!email && !applyUrl) continue;
    const label = `${name} (${kind})`;
    out.push({
      kind,
      label,
      email,
      applyUrl,
    });
  }
  return out;
}

/**
 * URLs from registry website, careers page, discovery sources, indexed postings + notes.
 * @param {Record<string, unknown>} org
 */
function referencesFromRegistryJobs(org) {
  /** @type {Record<string, unknown>[]} */
  const refs = [];
  const push = (label, url, type) => {
    if (!url || typeof url !== "string") return;
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    refs.push({ label: label || u, url: u, type });
  };

  const jo = org.jobOpenings && typeof org.jobOpenings === "object" ? /** @type {Record<string, unknown>} */ (org.jobOpenings) : null;
  if (org.website && typeof org.website === "string") {
    const w = org.website.trim();
    if (/^https?:\/\//i.test(w)) push("Official website (registry)", w, "website");
  }
  if (jo?.careersUrl && typeof jo.careersUrl === "string") {
    const c = jo.careersUrl.trim();
    if (/^https?:\/\//i.test(c)) push("Careers / vacancies page (registry)", c, "careers");
  }
  const sources = jo && Array.isArray(jo.sources) ? jo.sources : [];
  for (const s of sources) {
    if (typeof s !== "string") continue;
    const u = sourceHintToUrl(s);
    if (u) push(`Vacancy discovery source: ${s}`, u, s.toLowerCase().includes("linkedin") ? "social" : "careers");
  }

  const posts = jo && Array.isArray(jo.postings) ? jo.postings : [];
  for (const p of posts) {
    if (!p || typeof p !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (p);
    const url = typeof row.url === "string" ? row.url : "";
    const title = typeof row.title === "string" ? row.title : "Indexed vacancy";
    if (url) push(`Public vacancy (indexed): ${title}`, url, "careers");
    if (row.notes && typeof row.notes === "string") {
      for (const u of extractUrls(row.notes)) {
        push(`Vacancy note: ${title}`, u, "careers");
      }
    }
  }
  if (jo?.notes && typeof jo.notes === "string") {
    for (const u of extractUrls(jo.notes)) {
      push("Vacancy research note (URL in registry)", u, "careers");
    }
  }
  const jp = org.jobPossibility && typeof org.jobPossibility === "object" ? /** @type {Record<string, unknown>} */ (org.jobPossibility) : null;
  if (jp?.why && typeof jp.why === "string") {
    for (const u of extractUrls(jp.why)) {
      push("Desk job-possibility note (URL in registry)", u, "other");
    }
  }
  if (org.notes && typeof org.notes === "string") {
    for (const u of extractUrls(org.notes)) {
      push("Registry notes (URL)", u, "other");
    }
  }
  return refs;
}

/**
 * Careers URL from compact summary (when present for this org).
 * @param {string} orgId
 * @param {unknown} summaryBundle
 */
function referencesFromJobSummary(orgId, summaryBundle) {
  /** @type {Record<string, unknown>[]} */
  const refs = [];
  const push = (label, url, type) => {
    if (!url || typeof url !== "string") return;
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    refs.push({ label: label || u, url: u, type });
  };
  if (!summaryBundle || typeof summaryBundle !== "object") return refs;
  const researched = /** @type {Record<string, unknown>} */ (summaryBundle).researched;
  if (!Array.isArray(researched)) return refs;
  const row = researched.find((r) => r && typeof r === "object" && (/** @type {Record<string, unknown>} */ (r)).id === orgId);
  if (!row || typeof row !== "object") return refs;
  const careersUrl = /** @type {Record<string, unknown>} */ (row).careersUrl;
  if (typeof careersUrl === "string") push("Careers page (job_openings_summary.json)", careersUrl, "careers");
  return refs;
}

/**
 * Clickable URLs aligned with jobOpenings.sources (same order; skips non-URL hints).
 * @param {Record<string, unknown>} org
 * @returns {string[]}
 */
function discoverySourceUrlsFromOrg(org) {
  const jo = org.jobOpenings && typeof org.jobOpenings === "object" ? /** @type {Record<string, unknown>} */ (org.jobOpenings) : null;
  const sources = jo && Array.isArray(jo.sources) ? jo.sources : [];
  return uniqueUrls(
    sources
      .filter((s) => typeof s === "string")
      .map((s) => sourceHintToUrl(/** @type {string} */ (s)))
      .filter((u) => u != null)
  );
}

/**
 * Auto stub from existing registry fields + job research (OSINT-lite; not a substitute for full verification).
 * @param {Record<string, unknown>} org
 * @param {{ buildTimeIso?: string, possibility?: unknown, media?: unknown, emails?: unknown, summary?: unknown }} [opts]
 */
function generateAutoOsintProfile(org, opts = {}) {
  const host = websiteHost(org.website);
  const collectedAt = opts.buildTimeIso || new Date().toISOString();
  const jo = org.jobOpenings && typeof org.jobOpenings === "object" ? org.jobOpenings : {};
  const jp = org.jobPossibility && typeof org.jobPossibility === "object" ? org.jobPossibility : {};
  const possRow = typeof org.id === "string" ? possibilityRowByOrgId(opts.possibility, org.id) : null;
  const careersUrl = jo.careersUrl ?? null;
  const postingSources = Array.isArray(jo.sources) ? jo.sources : [];
  const tiers = [
    "Desk registry row (canonical JSON)",
    "Public job research indices (careers pages, boards, PDFs) where status is researched",
  ];
  if (org.website) tiers.unshift("Organisation public website (domain for logo heuristic)");
  tiers.push("Desk job-possibility dataset (public source citations embedded as text or URLs)");
  tiers.push("Weekly media digest on this site (tag/title match — verify on source URL)");
  tiers.push("Spontaneous contacts file (apply URLs and link-bearing notes per orgId)");
  tiers.push("Job openings summary (compact careers URL echo per researched org)");

  /** @type {Record<string, unknown> | null} */
  let logo = null;
  if (host) {
    logo = {
      url: `https://logo.clearbit.com/${host}`,
      alt: `${org.name} logo (derived from public website domain via Clearbit)`,
      sourceLabel: "Clearbit Logo API — domain inferred from organisation website URL in registry",
    };
  }

  /** @type {unknown[]} */
  const highlights = [];
  if (org.focus) highlights.push(`Programme focus (registry): ${org.focus}`);
  if (org.scope) highlights.push(`Geographic scope (registry): ${org.scope}`);
  if (jo.status === "researched" && jo.totalFound != null) {
    highlights.push(`Public vacancies indexed in last research pass: ${jo.totalFound}`);
  }
  if (jp.score != null && jp.band) {
    highlights.push(`Relative job-opportunity index (desk methodology): ${jp.score} · ${jp.band}`);
  }
  if (jp.why && typeof jp.why === "string") {
    highlights.push(`Desk note on hiring context: ${jp.why}`);
  }

  /** @type {unknown[]} */
  const roles = Array.isArray(jp.bestFitRoles) ? [...jp.bestFitRoles] : [];

  const mediaBundle =
    typeof org.id === "string"
      ? mediaMentionsForOrg(
          opts.media,
          {
            primaryName: String(org.name || ""),
            nameEl: org.nameEl != null ? String(org.nameEl) : null,
            website: org.website != null && typeof org.website === "string" ? org.website : null,
          },
          org.id
        )
      : { display: [], rawMatched: [] };
  const mediaMentions = mediaBundle.display;
  const mediaRawMatched = mediaBundle.rawMatched;

  const possText = possRow ? possibilityTextBundle(possRow) : { staffBits: [], benBits: [], hireBits: [] };
  for (const line of possText.staffBits) highlights.push(line);
  for (const line of possText.benBits) highlights.push(line);
  for (const line of possText.hireBits) highlights.push(line);

  if (possRow && typeof possRow.why === "string" && possRow.why.trim()) {
    highlights.push(`Possibility dataset narrative: ${possRow.why}`);
  }

  /** @type {Record<string, unknown>[]} */
  let references = [];

  references = references.concat(referencesFromRegistryJobs(org));
  references = references.concat(referencesFromSpontaneousContacts(org, opts.emails));
  if (possRow) {
    references = references.concat(referencesFromPossibility(possRow));
  }
  if (typeof org.id === "string") {
    references = references.concat(referencesFromJobSummary(org.id, opts.summary));
  }
  references = references.concat(/** @type {Record<string, unknown>[]} */ (referencesFromMedia(mediaMentions)));
  references = references.concat(
    referencesFromMediaBodyUrls(opts.media, mediaRawMatched, org.website != null && typeof org.website === "string" ? org.website : null)
  );

  references = dedupeRefs(references);

  let confidence = "low";
  if (references.length >= 3) confidence = "high";
  else if (
    references.length >= 1 ||
    mediaMentions.length >= 1 ||
    postingSources.length >= 2 ||
    jo.status === "researched"
  ) {
    confidence = "medium";
  }

  /** @type {Record<string, unknown>} */
  const verification = {
    confidence,
    lastSynthesizedAt: collectedAt,
    notes:
      "Automated synthesis from Greece NGO Desk registry, indexed vacancies (incl. posting URLs), job-possibility dataset, and digest matches. " +
      "Does not include privileged records, leaks, or non-public HR data. For authoritative facts, use primary sources linked below.",
  };

  /** @type {Record<string, unknown>} */
  const profile = {
    methodology:
      "Open-source intelligence (OSINT): only public or desk-published material — official sites, " +
      "indexed careers listings, and registry metadata from this dataset. No covert channels.",
    collectedAt,
    sourcesTiers: tiers,
    identity: {
      primaryName: org.name,
      nameEl: org.nameEl ?? null,
      aliases: (() => {
        const primary = String(org.name || "");
        const el = org.nameEl != null ? String(org.nameEl) : "";
        const id = typeof org.id === "string" ? org.id : "";
        const fromParen = [...acronymTokensFromName(primary), ...acronymTokensFromName(el)].map((t) => t.toUpperCase());
        const fromMap = ORG_ALIAS_TOKENS[id] || [];
        return [...new Set([...fromParen, ...fromMap])].filter(Boolean).slice(0, 12);
      })(),
    },
    mission: {
      summary: org.focus || "—",
      thematicAreas: [org.sector].filter(Boolean),
      geographyLabel: org.scope || "—",
    },
    scaleSignals: {
      staffEstimate:
        jp.staffEstimate != null
          ? jp.staffEstimate
          : possRow?.staff && typeof possRow.staff === "object" && (/** @type {Record<string, unknown>} */ (possRow.staff)).estimate != null
            ? Number((/** @type {Record<string, unknown>} */ (possRow.staff)).estimate)
            : null,
      beneficiariesLabel:
        jp.beneficiariesLabel != null
          ? String(jp.beneficiariesLabel)
          : possRow?.beneficiariesDependents &&
              typeof possRow.beneficiariesDependents === "object" &&
              (/** @type {Record<string, unknown>} */ (possRow.beneficiariesDependents)).estimateLabel != null
            ? String((/** @type {Record<string, unknown>} */ (possRow.beneficiariesDependents)).estimateLabel)
            : null,
      sourcesNote:
        possRow && possText.staffBits.length + possText.benBits.length > 0
          ? "Registry jobPossibility may be sparse: staff/beneficiary lines below prefer job_possibility.json when present. Treat as indicative."
          : "Estimates where present come from desk scoring inputs; treat as indicative.",
    },
    employmentSignals: {
      researchStatus: jo.status || "unknown",
      indexedPostingsCount: jo.totalFound != null ? jo.totalFound : null,
      careersUrl,
      discoverySources: postingSources,
      discoverySourceUrls: discoverySourceUrlsFromOrg(org),
      linkedInHints: linkedInHintsFromJobs(org),
      indicativeRoles: roles,
    },
    onlinePresence: {
      website: org.website ?? null,
      careersPage: careersUrl,
      socialHints: linkedInHintsFromJobs(org),
      contactHints: contactHintsFromSpontaneousEmails(org, opts.emails),
    },
    programmes: [],
    deskCorpus: {
      mediaDigestMatches: mediaMentions,
      possibilitySourcesNote:
        possRow && possText.staffBits.length + possText.benBits.length + possText.hireBits.length > 0
          ? "Structured signals from job_possibility.json (staff / beneficiaries / hiring index). Prefer URLs listed under References when present."
          : null,
    },
    narrative:
      highlights.length > 0
        ? highlights.join(" ")
        : "Stub profile — extend via data/ngos/osint_profiles.json after primary-source review.",
    verification,
    logo,
    references,
  };

  return profile;
}

/**
 * Load optional overrides from data/ngos/osint_profiles.json
 * @param {string} repoRoot
 * @returns {Record<string, Record<string, unknown>>}
 */
function loadOsintOverrides(repoRoot) {
  const fp = path.join(repoRoot, "data", "ngos", "osint_profiles.json");
  if (!fs.existsSync(fp)) return {};
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return {};
  }
  const list = raw.organizations;
  if (!Array.isArray(list)) return {};
  /** @type {Record<string, Record<string, unknown>>} */
  const map = {};
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const id = row.id;
    const os = row.osintProfile;
    if (typeof id !== "string" || !os || typeof os !== "object") continue;
    map[id] = /** @type {Record<string, unknown>} */ (os);
  }
  return map;
}

/**
 * @param {Record<string, unknown>} registry
 * @param {string} repoRoot
 * @param {{ buildTimeIso?: string, possibility?: unknown, media?: unknown, emails?: unknown, summary?: unknown }} [opts]
 */
function mergeOsintIntoRegistry(registry, repoRoot, opts = {}) {
  if (!registry || typeof registry !== "object") return registry;
  const orgs = registry.organizations;
  if (!Array.isArray(orgs)) return registry;
  const overrides = loadOsintOverrides(repoRoot);
  const buildTimeIso = opts.buildTimeIso || new Date().toISOString();

  let possibility = opts.possibility;
  let media = opts.media;
  let emails = opts.emails;
  let summary = opts.summary;
  if (possibility === undefined || media === undefined || emails === undefined || summary === undefined) {
    try {
      if (possibility === undefined) {
        const fp = path.join(repoRoot, "data", "ngos", "job_possibility.json");
        if (fs.existsSync(fp)) possibility = JSON.parse(fs.readFileSync(fp, "utf8"));
      }
      if (media === undefined) {
        const fm = path.join(repoRoot, "data", "ngos", "media_week.json");
        if (fs.existsSync(fm)) media = JSON.parse(fs.readFileSync(fm, "utf8"));
      }
      if (emails === undefined) {
        const fe = path.join(repoRoot, "data", "ngos", "spontaneous_emails.json");
        if (fs.existsSync(fe)) emails = JSON.parse(fs.readFileSync(fe, "utf8"));
      }
      if (summary === undefined) {
        const fsu = path.join(repoRoot, "data", "ngos", "job_openings_summary.json");
        if (fs.existsSync(fsu)) summary = JSON.parse(fs.readFileSync(fsu, "utf8"));
      }
    } catch {
      /* ignore */
    }
  }

  return {
    ...registry,
    organizations: orgs.map((org) => {
      if (!org || typeof org !== "object") return org;
      const o = /** @type {Record<string, unknown>} */ (org);
      const id = o.id;
      const auto = generateAutoOsintProfile(o, { buildTimeIso, possibility, media, emails, summary });
      const override = id && typeof id === "string" ? overrides[id] : undefined;
      const merged = override ? deepMerge(auto, override) : auto;
      return { ...o, osintProfile: merged };
    }),
  };
}

/**
 * Remove merged OSINT profiles (for writing canonical athens_greece.json from API export).
 * @param {Record<string, unknown>} registry
 */
function stripOsintFromRegistry(registry) {
  if (!registry || typeof registry !== "object") return registry;
  const orgs = registry.organizations;
  if (!Array.isArray(orgs)) return registry;
  return {
    ...registry,
    organizations: orgs.map((org) => {
      if (!org || typeof org !== "object") return org;
      const { osintProfile: _removed, ...rest } = org;
      return rest;
    }),
  };
}

module.exports = {
  mergeOsintIntoRegistry,
  loadOsintOverrides,
  generateAutoOsintProfile,
  deepMerge,
  stripOsintFromRegistry,
};

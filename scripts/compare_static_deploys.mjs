#!/usr/bin/env node
const urls = [
  { name: "vercel", url: "https://greece-ngo-desk.vercel.app/" },
  { name: "github-pages", url: "https://jadissel.github.io/Athens-NGO-Desk/" },
];
const local = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../static-site/index.html", import.meta.url), "utf8")
);

for (const u of urls) {
  const html = await fetch(u.url).then((r) => r.text());
  const markers = {
    platform_login: html.includes("platform-auth.js"),
    account_hub: html.includes("id=\"page-account\""),
    events: html.includes("id=\"page-events\""),
    stitch34: html.includes("aegean-stitch34"),
    api_base: /NGO_DATA_API_BASE\s*=\s*"([^"]+)"/.exec(html)?.[1],
  };
  let orgCount = null;
  try {
    const dataJs = await fetch(new URL("data.js", u.url)).then((r) => r.text());
    orgCount = (dataJs.match(/"id":"ngo-/g) || []).length;
  } catch {
    /* ignore */
  }
  console.log(u.name, { ...markers, orgCount });
}

const localMarkers = {
  platform_login: local.includes("platform-auth.js"),
  account_hub: local.includes("id=\"page-account\""),
  stitch34: local.includes("aegean-stitch34"),
};
const dataLocal = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../static-site/data.js", import.meta.url), "utf8")
);
console.log("local", { ...localMarkers, orgCount: (dataLocal.match(/"id":"ngo-/g) || []).length });
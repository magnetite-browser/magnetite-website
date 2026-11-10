// Checks the built site in dist/:
// - every internal link and #fragment points at something that exists,
// - nothing loads from another origin (scripts, styles, images, fonts, frames)
//   except the visitor statistics script, and no script is inline,
// - every page carries the Content-Security-Policy meta tag,
// - links to files in our GitHub repositories name files that exist in their
//   checkouts, when those are checked out next to this one (folders
//   `magnetite` and `magnetite-sync`).
// `--external` also requests every external link once (needs network).
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const beside = new URL("../../", import.meta.url).pathname;
const site = "https://magnetitebrowser.org";
// The one file a page may load from another origin: STATS.script in src/site.ts.
const statistics = "https://umami.stack-forge.cloud/umami";
// Repository file links: https://github.com/<owner>/<repo>/blob/<branch>/<path>
const repoFile = /^https:\/\/github\.com\/[^/]+\/([^/]+)\/blob\/[^/]+\/([^#?]+)/;
const checkouts = { magnetite: join(beside, "magnetite"), "magnetite-sync": join(beside, "magnetite-sync") };
const external = process.argv.includes("--external");

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) out.push(path);
  }
  return out;
}

const exists = (path) => stat(path).then(() => true, () => false);

/** File in dist/ that serves a site path, or null. */
async function resolve(pathname) {
  const clean = decodeURIComponent(pathname);
  for (const candidate of [join(dist, clean), join(dist, clean, "index.html")]) {
    if ((await exists(candidate)) && (await stat(candidate)).isFile()) return candidate;
  }
  return null;
}

const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const attrs = (html, name) => [...html.matchAll(new RegExp(`<([a-z]+)\\b[^>]*\\s${name}="([^"]*)"`, "g"))].map((m) => ({ tag: m[1], value: m[2] }));

const errors = [];
const externalLinks = new Set();
const pages = await htmlFiles(dist);
const idCache = new Map();

for (const file of pages) {
  const html = await readFile(file, "utf8");
  const page = "/" + relative(dist, file).replace(/index\.html$/, "");
  if (!html.includes('http-equiv="Content-Security-Policy"')) errors.push(`${page}: no CSP meta tag`);

  // Anything the browser fetches by itself must come from this origin.
  for (const { tag, value } of attrs(html, "src")) {
    if (/^(https?:)?\/\//.test(value) && !(tag === "script" && value === statistics))
      errors.push(`${page}: <${tag} src> loads from another origin: ${value}`);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/g)) {
    const href = m[0].match(/\shref="([^"]*)"/)?.[1] ?? "";
    const rel = m[0].match(/\srel="([^"]*)"/)?.[1] ?? "";
    if (rel !== "canonical" && /^(https?:)?\/\//.test(href)) errors.push(`${page}: <link rel=${rel}> loads from another origin: ${href}`);
  }
  if (/<(iframe|embed|object)\b/.test(html)) errors.push(`${page}: contains <iframe>, <embed> or <object>`);
  // Scripts only as files from this site (the CSP has no 'unsafe-inline').
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    const src = m[1].match(/\ssrc="([^"]*)"/)?.[1];
    if (!src) errors.push(`${page}: inline <script> (blocked by the CSP)`);
  }
  if (/\sstyle="/.test(html)) errors.push(`${page}: inline style attribute (blocked by the CSP)`);

  for (const { value: raw } of attrs(html, "href")) {
    // Absolute links to this site (canonical) are checked like internal ones.
    const href = raw.startsWith(site) ? raw.slice(site.length) || "/" : raw;
    const [, repoName, file] = href.match(repoFile) ?? [];
    const checkout = checkouts[repoName];
    if (file && checkout && (await exists(checkout)) && !(await exists(join(checkout, decodeURIComponent(file)))))
      errors.push(`${page}: repository file not found: ${repoName}/${file}`);
    if (/^(mailto:|tel:)/.test(href)) continue;
    if (/^https?:\/\//.test(href)) {
      if (!href.startsWith("https://")) errors.push(`${page}: insecure link ${href}`);
      externalLinks.add(href);
      continue;
    }
    const url = new URL(href, `https://site${page}`);
    if (url.host !== "site") continue;
    const target = await resolve(url.pathname);
    if (!target) {
      errors.push(`${page}: broken link ${href}`);
      continue;
    }
    if (url.hash && target.endsWith(".html")) {
      if (!idCache.has(target)) idCache.set(target, ids(await readFile(target, "utf8")));
      if (!idCache.get(target).has(url.hash.slice(1))) errors.push(`${page}: missing anchor ${href}`);
    }
  }
}

if (external) {
  for (const href of externalLinks) {
    try {
      const res = await fetch(href, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (!res.ok) errors.push(`external ${href}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`external ${href}: ${e.cause?.code ?? e.message}`);
    }
  }
}

console.log(`check-links: ${pages.length} pages, ${externalLinks.size} external links${external ? " requested" : " (not requested; use --external)"}`);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("check-links: ok");

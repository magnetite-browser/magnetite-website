// Checks the built site: starts its server (server.mjs) on a free local port,
// reads every page reachable from the home page, the live demo and the 404
// page, and fails if
// - an internal link or #fragment points at something that does not exist,
// - a page loads anything from another origin (scripts, styles, images,
//   fonts, frames) except the visitor statistics script, or has an inline script,
// - a page lacks the Content-Security-Policy meta tag,
// - a link to a file in our GitHub repositories names a file that does not
//   exist in its checkout, when those are checked out next to this one
//   (folders `magnetite` and `magnetite-sync`).
// `--external` also requests every external link once (needs network).
import { once } from "node:events";
import { stat } from "node:fs/promises";
import { join } from "node:path";

const beside = new URL("../../", import.meta.url).pathname;
const site = "https://magnetitebrowser.org";
// The one file a page may load from another origin: STATS.script in src/site.ts.
const statistics = "https://umami.stack-forge.cloud/umami";
// Repository file links: https://github.com/<owner>/<repo>/blob/<branch>/<path>
const repoFile = /^https:\/\/github\.com\/[^/]+\/([^/]+)\/blob\/[^/]+\/([^#?]+)/;
const checkouts = { magnetite: join(beside, "magnetite"), "magnetite-sync": join(beside, "magnetite-sync") };
const external = process.argv.includes("--external");
// Not linked from any page: the home page's script adds the demo's frame, and no link leads to the 404 page.
const demo = "/demo/";
const unknown = "/no-such-page/";

process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
const { server } = await import("../server.mjs");
if (!server.listening) await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;

const exists = (path) => stat(path).then(() => true, () => false);

/** What the server answers for a site path: its status, and the HTML if it is a page. Asked once per path. */
const answers = new Map();
function ask(pathname) {
  if (!answers.has(pathname))
    answers.set(
      pathname,
      fetch(base + pathname).then(async (res) => ({
        status: res.status,
        html: res.headers.get("content-type")?.startsWith("text/html") ? await res.text() : (await res.body?.cancel(), null),
      })),
    );
  return answers.get(pathname);
}

const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const attrs = (html, name) => [...html.matchAll(new RegExp(`<([a-z]+)\\b[^>]*\\s${name}="([^"]*)"`, "g"))].map((m) => ({ tag: m[1], value: m[2] }));

const errors = [];
const externalLinks = new Set();
// Grows while pages are read: every internal link to a page adds it.
const pages = ["/", demo, unknown];

for (const page of pages) {
  const { status, html } = await ask(page);
  if (status !== (page === unknown ? 404 : 200) || html === null) {
    errors.push(`${page}: answered ${status}`);
    continue;
  }
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
    const target = await ask(url.pathname);
    // A link within the page itself is fine on the 404 page too.
    if (target.status !== 200 && url.pathname !== page) {
      errors.push(`${page}: broken link ${href}`);
      continue;
    }
    if (target.html === null) continue;
    if (!pages.includes(url.pathname)) pages.push(url.pathname);
    if (url.hash && !ids(target.html).has(url.hash.slice(1))) errors.push(`${page}: missing anchor ${href}`);
  }
}
server.close();
server.closeAllConnections();

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

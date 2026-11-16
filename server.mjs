// The site's web server: the built pages and files (dist/, see astro.config.mjs)
// over plain HTTP, for a reverse proxy that holds the certificate. It adds what
// Astro's own server leaves out: the security headers on every response and
// compression. It writes no access log and no files.
//
//   pnpm build && node server.mjs      PORT (default 8080), HOST (default 0.0.0.0)
import http from "node:http";
import compression from "compression";

// The built entry would otherwise start a server of its own on import.
process.env.ASTRO_NODE_AUTOSTART = "disabled";
// Serves files from dist/client (those under /_astro/ as immutable) and renders the pages.
const { handler } = await import("./dist/server/entry.mjs");

// On every response. The pages' Content-Security-Policy is theirs to send: src/middleware.ts.
const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000",
};

const compress = compression();

/** Exported for scripts/check-links.mjs, which asks it for the pages. */
export const server = http.createServer((req, res) => {
  for (const [name, value] of Object.entries(HEADERS)) res.setHeader(name, value);
  compress(req, res, () => handler(req, res));
});

server.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? "0.0.0.0");

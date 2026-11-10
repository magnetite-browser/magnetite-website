// Draws the sample icons the live demo's sidebar shows: site icons to
// public/favicons/<host>.png and extension icons to public/ext-icons/<id>,
// the paths the app's sidebar asks for (its favicon cache and the engine's
// extension icons), which on this site are just folders. macOS only (sips);
// the results are committed, so the site build does not need this.
// Run: node scripts/make-demo-icons.mjs
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// host → [background, glyph drawn in white on a 64 px tile]
const stroke = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
const ICONS = {
  "mail.example.org": ["#3b82c4", stroke("M14 22h36v22H14z M14 23l18 13 18-13")],
  "calendar.example.org": ["#d9534f", stroke("M15 20h34v28H15z M15 29h34 M24 14v9 M40 14v9")],
  "chat.example.org": ["#7a5fd0", stroke("M14 18h36v22H30l-10 9v-9h-6z")],
  "radio.example.org": ["#e08a2e", stroke("M22 40V24 M32 46V18 M42 38V26")],
  "maps.example.org": ["#3c9d6b", stroke("M32 50s13-12 13-22a13 13 0 0 0-26 0c0 10 13 22 13 22z M32 28h.1")],
  "photos.example.org": ["#c95b9a", stroke("M14 20h36v26H14z M14 40l10-9 8 7 7-6 11 9")],
  "wiki.example.org": ["#5b6470", stroke("M16 20l8 24 8-18 8 18 8-24")],
  "roadmap.example.org": ["#c9973f", stroke("M16 22h20 M16 32h32 M28 42h20")],
  "notes.example.org": ["#4a8fd6", stroke("M20 14h18l8 8v28H20z M27 30h12 M27 38h12")],
  "git.example.org": ["#e2622b", stroke("M22 16v32 M42 30v18 M22 30c0 8 20 2 20 10") + `<circle cx="22" cy="16" r="4.5" fill="#fff"/><circle cx="42" cy="26" r="4.5" fill="#fff"/><circle cx="22" cy="48" r="4.5" fill="#fff"/>`],
  "blog.example.org": ["#2f8f8a", stroke("M18 46c2-12 10-24 26-28-2 14-10 22-22 24 M18 46l10-10")],
  "docs.example.org": ["#6b7fd7", stroke("M32 18c-6-4-12-4-18-2v28c6-2 12-2 18 2 6-4 12-4 18-2V16c-6-2-12-2-18 2z M32 18v28")],
  "trails.example.org": ["#4f8a57", stroke("M10 46l14-24 8 12 6-8 16 20z")],
  "kitchen.example.org": ["#d77a3d", stroke("M14 30h36c0 10-8 18-18 18s-18-8-18-18z M26 16c-3 4 3 4 0 8 M36 16c-3 4 3 4 0 8")],
  "rail.example.org": ["#566b8c", stroke("M20 14h24v26H20z M20 28h24 M24 40l-6 10 M40 40l6 10") + `<circle cx="27" cy="34" r="2" fill="#fff"/><circle cx="37" cy="34" r="2" fill="#fff"/>`],
  "video.example.org": ["#c0392b", `<path d="M25 19l22 13-22 13z" fill="#fff"/>`],
  "cycling.example.org": ["#b8553f", stroke("M26 42l6-16h10 M32 26l8 16") + `<circle cx="20" cy="42" r="8" fill="none" stroke="#fff" stroke-width="5"/><circle cx="44" cy="42" r="8" fill="none" stroke="#fff" stroke-width="5"/>`],
};

// Sample extensions, shown in the sidebar when pinned: file name → the same.
const EXTENSIONS = {
  "keyring.png": ["#2f6fdd", `<circle cx="25" cy="32" r="9" fill="none" stroke="#fff" stroke-width="5"/>` + stroke("M34 32h18 M46 32v8")],
  "reader.png": ["#3a3a40", stroke("M18 20h28 M18 30h28 M18 40h18")],
  "shield.png": ["#2e9d6a", stroke("M32 13l16 6v12c0 10-7 17-16 20-9-3-16-10-16-20V19z M25 32l5 5 9-10")],
};

const out = fileURLToPath(new URL("../public/favicons/", import.meta.url));
const extensions = fileURLToPath(new URL("../public/ext-icons/", import.meta.url));
const tmp = await mkdtemp(join(tmpdir(), "demo-icons-"));
const png = (svg, to) => execFileSync("sips", ["-s", "format", "png", "-z", "64", "64", svg, "--out", to], { stdio: "ignore" });
const draw = async (name, [background, glyph], to) => {
  const svg = join(tmp, `${name}.svg`);
  await writeFile(svg, `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${background}"/>${glyph}</svg>`);
  png(svg, to);
};
await mkdir(out, { recursive: true });
await mkdir(extensions, { recursive: true });
for (const [host, icon] of Object.entries(ICONS)) await draw(host, icon, join(out, `${host}.png`));
for (const [file, icon] of Object.entries(EXTENSIONS)) await draw(file, icon, join(extensions, file));
// Magnetite's own site is a favorite in the demo.
png(fileURLToPath(new URL("../public/favicon.svg", import.meta.url)), join(out, "magnetitebrowser.org.png"));
await rm(tmp, { recursive: true });
console.log(`${Object.keys(ICONS).length + 1} icons written to public/favicons/, ${Object.keys(EXTENSIONS).length} to public/ext-icons/`);

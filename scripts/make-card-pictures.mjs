// Takes the pictures on the home page's feature cards from the live demo:
// for each card, the window at `data-still` of its scene, cut to the piece
// its `data-shot` selects, as public/cards/<scene>.webp at twice the size.
// The cards are read from the home page itself, so the two cannot disagree.
// Run through scripts/make-images.sh (macOS; needs the site running and cwebp).
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const site = process.argv[2] ?? "http://localhost:4321";
const here = fileURLToPath(new URL(".", import.meta.url));
const out = join(here, "../public/cards");
const tmp = await mkdtemp(join(tmpdir(), "cards-"));
await mkdir(out, { recursive: true });

/**
 * The piece `shot` (a CSS selector; its first `first` matches if given) of
 * the window with `scene` played to `still`, with `pad` pixels around it
 * and at most `max` wide.
 * The demo says where the piece is; the picture is cut there.
 */
function picture(scene, still, { shot, ...options }, name) {
  const png = join(tmp, `${name}.png`);
  const given = Object.entries(options).filter(([, value]) => value !== undefined);
  const query = new URLSearchParams({ scene, t: still, shot, ...Object.fromEntries(given) });
  const rect = execFileSync("swift", [join(here, "render.swift"), `${site}/demo/?film&${query}`, "1280", "800", png, "2"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
  if (!rect) throw new Error(`${name}: nothing matches ${shot}`);
  execFileSync("cwebp", ["-quiet", "-q", "82", "-crop", ...rect.split(" ").map((n) => String(Number(n) * 2)), png, "-o", join(out, `${name}.webp`)]);
  console.log(`public/cards/${name}.webp  (${rect})`);
}

const home = await (await fetch(site)).text();
const attribute = (tag, name) => tag.match(new RegExp(`\\sdata-${name}="([^"]*)"`))?.[1]?.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&amp;", "&");
for (const [tag] of home.matchAll(/<li\b[^>]*\sdata-card="[^"]*"[^>]*>/g)) {
  const [scene, still, shot, first, pad, max] = ["card", "still", "shot", "shot-first", "shot-pad", "shot-max"].map((name) => attribute(tag, name));
  picture(scene, still, { shot, first, pad, max }, scene);
}
// What the capture tool's result shows in the sidebar: the element the
// capture scene picks, the third card of the sample roadmap's first column.
picture("capture", "0", { shot: ".pg-columns section:nth-child(1) .pg-card:nth-of-type(3)", pad: "1" }, "capture-thumb");
await rm(tmp, { recursive: true });

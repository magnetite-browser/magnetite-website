// The live demo at /demo/: Magnetite's own sidebar and command bar on a
// sample state (see Demo.tsx). On its own the page is something to click
// around in; with `?film` it is the picture of the home page's tour, which
// drives it from outside (film.ts) and keeps it from taking the keyboard.
import { createRoot } from "react-dom/client";
import "./demo.css";
import type { DemoApi, DemoReady, SceneId } from "./api";
import { Demo } from "./Demo";
import { film } from "./film";

const root = document.getElementById("root");
const params = new URLSearchParams(location.search);
const embedded = params.has("film");

// The sidebar remembers which folders are open in localStorage. A visit to a
// website should leave nothing behind, so here that lasts as long as the page.
const memory = new Map<string, string>();
Storage.prototype.getItem = (key) => memory.get(key) ?? null;
Storage.prototype.setItem = (key, value) => void memory.set(key, String(value));
Storage.prototype.removeItem = (key) => void memory.delete(key);

if (embedded) {
  // Parts of the app focus a field or scroll a row into view when they
  // appear. In a frame, either would move the page around it.
  HTMLElement.prototype.focus = () => {};
  Element.prototype.scrollIntoView = () => {};
  // They also close what is open when their window loses the keyboard. The
  // frame never has it, and a scene must not end because the visitor looked away.
  addEventListener("blur", (e) => e.stopImmediatePropagation(), true);
}

/**
 * For the pictures of the site (scripts/make-images.sh): `?film&scene=…&t=…`
 * plays that scene up to `t` by itself, quickly. `data-rendering` on <html>
 * is gone once the picture can be taken. With `&shot=<selector>` (and
 * `&first=<n>` for only its first matches, `&pad=<px>` around them,
 * `&max=<px>` for no more than that width), where those elements are is
 * left in `data-rect` on <html> as "x y w h": engines break lines
 * differently, so only the page itself knows.
 */
async function still(api: DemoApi, scene: SceneId, upTo: number) {
  // A page that is not on screen gets its timers slowed down: step with messages instead.
  const step = () =>
    new Promise<void>((next) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => next();
      channel.port2.postMessage(null);
    });
  for (let t = 0; t <= upTo; t += 0.02) {
    api.show(scene, Math.min(t, upTo));
    await step();
  }
  // What answers late (an import, the capture tool) is there by now.
  await new Promise((next) => setTimeout(next, 2500));
  api.show(scene, upTo);
  await step();
  const shot = params.get("shot");
  if (shot) {
    const boxes = [...document.querySelectorAll(shot)].slice(0, Number(params.get("first")) || undefined).map((el) => el.getBoundingClientRect());
    const pad = Number(params.get("pad") ?? 8);
    if (!boxes.length) return void delete document.documentElement.dataset.rendering;
    const [left, top] = [Math.max(0, Math.min(...boxes.map((b) => b.left)) - pad), Math.max(0, Math.min(...boxes.map((b) => b.top)) - pad)];
    const [right, bottom] = [Math.min(innerWidth, Math.max(...boxes.map((b) => b.right)) + pad), Math.min(innerHeight, Math.max(...boxes.map((b) => b.bottom)) + pad)];
    const width = Math.min(right - left, Number(params.get("max")) || Infinity);
    document.documentElement.dataset.rect = [left, top, width, bottom - top].map(Math.round).join(" ");
  }
  delete document.documentElement.dataset.rendering;
}

if (root) {
  root.dataset.mode = embedded ? "film" : "live";
  const scene = params.get("scene") as SceneId | null;
  if (scene) document.documentElement.dataset.rendering = "";
  // A picture shows the interface, not the tour's pointer.
  root.toggleAttribute("data-still", !!scene);
  const ready = () => {
    if (!embedded) return;
    const api = film(root);
    window.magnetiteDemo = api;
    // Not from inside React's own work: playing a scene renders.
    if (scene) setTimeout(() => void still(api, scene, Number(params.get("t") ?? 0)));
    else parent.postMessage("magnetite-demo-ready" satisfies DemoReady, location.origin);
  };
  createRoot(root).render(<Demo onReady={ready} />);
}

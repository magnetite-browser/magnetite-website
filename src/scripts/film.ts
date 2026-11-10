// The tour on the home page ([data-film]): a window that shows Magnetite's
// own sidebar, live (src/demo/), and goes through the tour's scenes.
//
// On large screens with motion the window is pinned while the page scrolls
// (data-mode="scroll"): the scroll position picks the scene and how far into
// it we are, so scrolling back plays it backwards. Elsewhere the window stays
// in the page (data-mode="auto") and plays by itself while it is on screen;
// with reduced motion it shows one still per scene instead. In both, the
// scene's caption and its link in the rail are marked `data-current`, and a
// camera moves the window so that the part the scene is about fills the view.
//
// Without this script the section is a picture of the window and the six
// captions below it.
//
// Further down, the smaller features ([data-show]) have a live window of
// their own that plays the scene of the card being pointed at (`showcase`).
import type { DemoApi, DemoReady, SceneId } from "../demo/api";

const READY: DemoReady = "magnetite-demo-ready";
/** The demo's window, in its own pixels. */
const WINDOW = { w: 1280, h: 800 };
/** A scene's length when it plays by itself. */
const SCENE_MS = 6500;
/** Where a scene's still is taken, with reduced motion. */
const STILL = 0.55;
/** The share of a scene, at its end, in which the camera moves on to the next. */
const HANDOVER = 0.16;
/** How long a feature card's scene plays. */
const CARD_MS = 9000;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const ease = (x: number) => x * x * (3 - 2 * x);

/** "x y w h" in window pixels: the part of the window a scene is about. */
function rect(text: string | undefined): Rect {
  const [x = 0, y = 0, w = WINDOW.w, h = WINDOW.h] = (text ?? "").split(" ").map(Number);
  return { x, y, w, h };
}

const between = (a: Rect, b: Rect, k: number): Rect => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  w: a.w + (b.w - a.w) * k,
  h: a.h + (b.h - a.h) * k,
});

/**
 * Where the window goes so that `focus` fills a view of `width` by `height`
 * with `pad` around it: never larger than life, and no gap beyond the pad
 * next to an edge of the window while the window is larger than the view.
 */
function place(focus: Rect, width: number, height: number, pad: number) {
  const scale = Math.min(1, (width - 2 * pad) / focus.w, (height - 2 * pad) / focus.h);
  const along = (view: number, from: number, size: number, whole: number) => {
    const all = whole * scale;
    if (all + 2 * pad <= view) return (view - all) / 2;
    return clamp((view - size * scale) / 2 - from * scale, view - pad - all, pad);
  };
  return { scale, x: along(width, focus.x, focus.w, WINDOW.w), y: along(height, focus.y, focus.h, WINDOW.h) };
}

/**
 * Add the live demo to `shell` as a frame of 1280 × 800 and hand over its
 * controls once it runs. It is a page of its own (/demo/?film); it must
 * never take the keyboard or the pointer, so it is inert.
 */
function embed(shell: HTMLElement, className: string, ready: (demo: DemoApi) => void) {
  const frame = document.createElement("iframe");
  frame.className = className;
  frame.title = "Magnetite’s sidebar and command bar, live";
  frame.tabIndex = -1;
  frame.inert = true;
  frame.src = "/demo/?film";
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow || e.data !== READY) return;
    const demo = frame.contentWindow?.magnetiteDemo;
    if (demo) ready(demo);
  });
  shell.append(frame);
}

/** Run `load` once, when `el` is about a screen away. */
function whenNear(el: Element, load: () => void) {
  const near = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      near.disconnect();
      load();
    },
    { rootMargin: "100% 0px" },
  );
  near.observe(el);
}

export function film() {
  const section = document.querySelector<HTMLElement>("[data-film]");
  const track = section?.querySelector<HTMLElement>("[data-film-track]");
  const stage = track?.firstElementChild;
  const view = section?.querySelector<HTMLElement>(".film-view");
  const cam = section?.querySelector<HTMLElement>(".film-cam");
  const shell = section?.querySelector<HTMLElement>(".film-window");
  if (!section || !track || !(stage instanceof HTMLElement) || !view || !cam || !shell) return;

  const captions = [...section.querySelectorAll<HTMLElement>("[data-scene]")];
  const links = [...section.querySelectorAll<HTMLAnchorElement>("[data-rail]")];
  const count = captions.length;
  if (!count) return;
  section.style.setProperty("--scenes", String(count));

  const pinned = matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let demo: DemoApi | undefined;
  let at = { scene: 0, t: 0 };
  let cameIn = 1;
  let size = { w: view.clientWidth, h: view.clientHeight };

  /** Show scene `scene` at `t`; `entered` (0 to 1) is how far the pinned window has come in. */
  const render = (scene: number, t: number, entered = 1) => {
    at = { scene, t };
    cameIn = entered;
    const caption = captions[scene];
    if (!caption) return;
    section.dataset.scene = caption.dataset.scene ?? "";
    section.style.setProperty("--t", t.toFixed(4));
    section.style.setProperty("--entered", entered.toFixed(4));
    captions.forEach((c, i) => c.toggleAttribute("data-current", i === scene));
    links.forEach((l, i) => {
      l.toggleAttribute("data-current", i === scene);
      l.toggleAttribute("data-done", i < scene);
    });

    // The camera rests on this scene's part of the window and, towards the
    // end, moves on to the next one's (by itself, the last leads to the first).
    const narrow = !pinned.matches && size.w < 640;
    const focusOf = (c: HTMLElement) => rect(narrow ? c.dataset.focusNarrow : c.dataset.focus);
    const next = captions[scene + 1] ?? (pinned.matches ? caption : captions[0]!);
    const focus = between(focusOf(caption), focusOf(next), ease(clamp((t - (1 - HANDOVER)) / HANDOVER)));
    const to = place(focus, size.w, size.h, pinned.matches ? 28 : 0);
    cam.style.transform = `translate3d(${to.x.toFixed(2)}px, ${to.y.toFixed(2)}px, 0) scale(${to.scale.toFixed(4)})`;
    // How much of the window's left part is out of the view (the stylesheet fades that edge).
    section.style.setProperty("--cut", clamp(-to.x / 60).toFixed(3));

    demo?.show(caption.dataset.scene as SceneId, t);
  };

  // ---- pinned: the scroll position is the playhead ----
  let frame = 0;
  const scrolled = () => {
    frame = 0;
    if (!pinned.matches) return;
    const top = parseFloat(getComputedStyle(stage).top) || 0;
    const from = track.getBoundingClientRect().top;
    const run = track.offsetHeight - stage.offsetHeight;
    const playhead = Math.min(clamp((top - from) / run) * count, count - 1e-4);
    const scene = Math.floor(playhead);
    // The window comes in while the stage rises to where it pins.
    render(scene, playhead - scene, clamp(1 - (from - top) / (innerHeight - top)));
  };
  const onScroll = () => {
    frame ||= requestAnimationFrame(scrolled);
  };

  // ---- in the page: it plays by itself while on screen ----
  let onScreen = false;
  let playing = 0;
  let last = 0;
  const tick = (now: number) => {
    playing = 0;
    if (pinned.matches || reduced.matches || !onScreen) return;
    const t = at.t + Math.min(100, now - last) / SCENE_MS;
    last = now;
    if (t < 1) render(at.scene, t);
    else render((at.scene + 1) % count, 0);
    playing = requestAnimationFrame(tick);
  };
  const play = () => {
    if (playing || pinned.matches || reduced.matches || !onScreen) return;
    last = performance.now();
    playing = requestAnimationFrame(tick);
  };

  /** Go to the start of a scene: scroll there when pinned, else show it. */
  const jump = (scene: number) => {
    if (pinned.matches) {
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const run = track.offsetHeight - stage.offsetHeight;
      scrollTo({ top: track.getBoundingClientRect().top + scrollY - top + (run * (scene + 0.06)) / count });
    } else {
      render(scene, reduced.matches ? STILL : 0);
      play();
    }
  };
  links.forEach((link, i) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      jump(i);
    }),
  );

  const layout = () => {
    section.dataset.mode = pinned.matches ? "scroll" : "auto";
    size = { w: view.clientWidth, h: view.clientHeight };
    if (pinned.matches) scrolled();
    else {
      render(at.scene, reduced.matches ? STILL : at.t);
      play();
    }
  };

  // The live window is loaded once the tour is about a screen away.
  whenNear(section, () =>
    embed(shell, "film-frame", (api) => {
      demo = api;
      section.dataset.live = "";
      render(at.scene, at.t, cameIn);
    }),
  );

  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    play();
  }).observe(view);
  new ResizeObserver(layout).observe(view);
  addEventListener("scroll", onScroll, { passive: true });
  pinned.addEventListener("change", layout);
  reduced.addEventListener("change", layout);
  layout();
}

/**
 * The smaller features ([data-show]): cards ([data-card], the scene's name)
 * and one live window beside them. The window plays the scene of one card,
 * marked `data-current`: the card under the pointer or with the keyboard,
 * else the one in the middle of the screen. Its camera rests on the card's
 * `data-focus`. With reduced motion it shows the scene's still instead.
 */
export function showcase() {
  const host = document.querySelector<HTMLElement>("[data-show]");
  const view = host?.querySelector<HTMLElement>(".show-view");
  const cam = host?.querySelector<HTMLElement>(".show-cam");
  const shell = host?.querySelector<HTMLElement>(".show-window");
  const all = host ? [...host.querySelectorAll<HTMLElement>("[data-card]")] : [];
  if (!host || !view || !cam || !shell || !all.length) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let demo: DemoApi | undefined;
  let onScreen = false;
  let pointed: HTMLElement | null = null;
  const middle = new Set<HTMLElement>();
  let current: HTMLElement | null = null;
  let t = 0;
  let last = 0;
  let frame = 0;

  const tick = (now: number) => {
    frame = 0;
    const card = pointed ?? all.find((c) => middle.has(c)) ?? current ?? all[0]!;
    if (!demo || !onScreen) return;
    if (card !== current) {
      current = card;
      t = 0;
      for (const c of all) c.toggleAttribute("data-current", c === card);
      const to = place(rect(card.dataset.focus), view.clientWidth, view.clientHeight, 0);
      cam.style.transform = `translate3d(${to.x.toFixed(2)}px, ${to.y.toFixed(2)}px, 0) scale(${to.scale.toFixed(4)})`;
    } else {
      t += Math.min(100, now - last) / CARD_MS;
      if (t >= 1) t = 0;
    }
    last = now;
    const scene = card.dataset.card as SceneId;
    if (reduced.matches) return demo.show(scene, Number(card.dataset.still));
    demo.show(scene, t);
    frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    frame ||= requestAnimationFrame((now) => {
      last = now;
      tick(now);
    });
  };

  // The card in the middle of the screen, for when nothing is pointed at.
  const inMiddle = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) middle.add(e.target as HTMLElement);
        else middle.delete(e.target as HTMLElement);
      }
      wake();
    },
    { rootMargin: "-50% 0px -50% 0px" },
  );
  for (const card of all) {
    inMiddle.observe(card);
    const point = (on: boolean) => () => {
      pointed = on ? card : pointed === card ? null : pointed;
      wake();
    };
    card.addEventListener("pointerenter", point(true));
    card.addEventListener("pointerleave", point(false));
    card.addEventListener("click", point(true));
  }
  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    wake();
  }).observe(view);
  new ResizeObserver(() => {
    current = null;
    wake();
  }).observe(view);
  reduced.addEventListener("change", wake);

  whenNear(host, () => {
    host.dataset.live = "";
    embed(shell, "film-frame", (api) => {
      demo = api;
      wake();
    });
  });
}

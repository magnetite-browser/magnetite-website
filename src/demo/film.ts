// What the embedded demo plays: the scenes of the home page's tour and of
// its feature cards. The home page picks a scene and how far into it we are
// (src/scripts/film.ts); `film` below shows that.
//
// There are two kinds of scene. A tour scene is a function from its progress
// to what the window shows (`frame`), so the scroll can run it both ways; its
// pointer only points. A card scene starts from a state (`start`) and is
// then played by using the window: where its pointer clicks, the element
// under it is really clicked, and the sidebar and the demo's host do the
// rest. It only runs forwards, and starts over from a fresh window.
//
// A label at the bottom of the page area says what happens on the keyboard
// or off screen.
import { flushSync } from "react-dom";
import type { DemoApi, SceneId } from "./api";
import { run, store } from "./host";
import { LOADED, REVIEWS, derived, urlOf, worldOf, type Moment, type SiteId, type World } from "./world";

/** The window at one point of a tour scene: its state, plus what moves between states. */
interface Frame extends Moment {
  /** Typed into the command bar so far. */
  query?: string;
  /** The result the command bar's selection rests on. */
  selected?: number;
  /** The sidebar shows the archive. */
  archive?: boolean;
  /** How far in the part that is arriving is (the newest page of a split, the peek, the command bar): 0 to 1. */
  arriving?: number;
}

/** Where the pointer goes: an element of the window (a CSS selector) or a point in it (1280 × 800). */
type Target = string | readonly [x: number, y: number];

interface Scene {
  frame?: (t: number) => Frame;
  start?: () => World;
  /**
   * Where the pointer is at which progress (it shows from the first entry
   * on), and when it presses. In a tour scene a click is the moment `frame`
   * changes the state.
   */
  pointer?: { path: readonly (readonly [t: number, target: Target])[]; clicks: readonly number[] };
  /** What else happens in a card scene, and when. */
  events?: readonly (readonly [t: number, happen: () => void])[];
  /** The label: keys being pressed, or a few words, between two moments. */
  labels?: readonly { from: number; to: number; keys?: readonly string[]; text?: string }[];
  /** The middle of the label, when the bottom of the page area is out of the card's picture. */
  labelAt?: readonly [x: number, y: number];
}

const TODAY: SiteId[] = ["rust", "css"];
/** Today once the peek was kept as a tab; the tour archives it from the bottom. */
const KEPT: SiteId[] = ["design", ...TODAY];
const WORK: Moment = { space: "work", today: TODAY, active: "roadmap" };

/** Progress within the stretch `from`…`to` of a scene, 0 to 1. */
const within = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)));
const ease = (x: number) => x * x * (3 - 2 * x);

const row = (id: SiteId): Target => `.row[title="${urlOf(id)}"]`;
const HOME: Target = '.sp[title="Home"]';
const LINK: Target = "[data-peek-link]";

/** The window with something about it changed, for card scenes. */
const change = (edit: (world: World) => World) => store.set(edit(store.get()));
const withUi = (world: World, ui: Partial<World["ui"]>): World => ({ ...world, ui: derived({ ...world.ui, ...ui }) });
/** The smart folder is asking its server (or done). */
const fetching = (world: World, on: boolean): World =>
  withUi(world, { smart: { [REVIEWS]: { ...world.ui.smart[REVIEWS]!, fetching: on } } });

const SCENES: Record<SceneId, Scene> = {
  // ---- the tour ----

  // Pinned tabs, then a merge request from the smart folder.
  sidebar: {
    frame: (t) => ({ ...WORK, active: t < 0.36 ? "roadmap" : t < 0.7 ? "notes" : "mr482" }),
    pointer: { path: [[0.1, [600, 560]], [0.32, row("notes")], [0.46, row("notes")], [0.66, row("mr482")]], clicks: [0.36, 0.7] },
  },
  // On to another space and around in it.
  spaces: {
    frame: (t) => (t < 0.32 ? { ...WORK, active: "mr482" } : { space: "home", today: TODAY, active: t < 0.7 ? "hike" : "recipe" }),
    pointer: { path: [[0, row("mr482")], [0.28, HOME], [0.42, HOME], [0.66, row("recipe")]], clicks: [0.32, 0.7] },
  },
  // The command bar finds a tab of another space and switches to it.
  command: {
    frame: (t) => {
      if (t < 0.12) return { space: "home", today: TODAY, active: "recipe" };
      if (t >= 0.8) return WORK;
      const typed = Math.round(within(t, 0.24, 0.5) * 4);
      return { space: "home", today: TODAY, active: "recipe", palette: true, arriving: ease(within(t, 0.12, 0.2)), query: "road".slice(0, typed), selected: t < 0.64 ? 0 : 1 };
    },
    labels: [
      { from: 0.06, to: 0.22, keys: ["⌘", "T"] },
      { from: 0.6, to: 0.72, keys: ["↓"] },
      { from: 0.77, to: 0.88, keys: ["↩"] },
    ],
  },
  // One page, then two, then three side by side.
  split: {
    frame: (t) => {
      if (t < 0.16) return WORK;
      if (t < 0.58) return { ...WORK, active: "notes", split: ["roadmap", "notes"], arriving: ease(within(t, 0.16, 0.4)) };
      return { ...WORK, active: "mr482", split: ["roadmap", "notes", "mr482"], arriving: ease(within(t, 0.58, 0.82)) };
    },
    labels: [
      { from: 0.1, to: 0.3, keys: ["⌘", "⇧", "="] },
      { from: 0.52, to: 0.72, keys: ["⌘", "⇧", "="] },
    ],
  },
  // A link opens as a peek, which is then kept as a tab.
  peek: {
    frame: (t) => {
      if (t < 0.3) return { ...WORK, active: "notes" };
      if (t < 0.78) return { ...WORK, active: "notes", peek: "design", arriving: ease(within(t, 0.3, 0.42)) };
      return { ...WORK, today: KEPT, active: "design" };
    },
    pointer: { path: [[0.04, [760, 640]], [0.25, LINK], [0.5, LINK], [0.73, ".peek-buttons button:nth-child(2)"]], clicks: [0.3, 0.78] },
    labels: [{ from: 0.2, to: 0.38, keys: ["⇧"], text: "click" }],
  },
  // Today's tabs leave one by one; the archive has them.
  archive: {
    frame: (t) => {
      const gone = t < 0.18 ? 0 : t < 0.3 ? 1 : t < 0.42 ? 2 : 3;
      const kept = KEPT.length - gone;
      return { ...WORK, today: KEPT.slice(0, kept), archived: KEPT.slice(kept), active: gone < 3 ? "design" : "roadmap", archive: t >= 0.62 };
    },
    pointer: { path: [[0, [1100, 180]], [0.56, ".library > button"]], clicks: [0.62] },
    labels: [{ from: 0.1, to: 0.5, text: "12 hours later" }],
  },

  // ---- the feature cards ----

  // A tab is closed, and the shortcut brings it back.
  reopen: {
    start: () => worldOf({ ...WORK, today: KEPT }),
    pointer: { path: [[0.06, [330, 470]], [0.3, `${row("css")} .close`], [0.5, `${row("css")} .close`], [0.62, [330, 470]]], clicks: [0.36] },
    events: [[0.72, () => void run({ cmd: "reopen_closed" })]],
    labels: [{ from: 0.64, to: 0.86, keys: ["⌘", "⇧", "T"] }],
    labelAt: [344, 505],
  },
  // A playing video is left; it floats, with its own controls.
  pip: {
    start: () => {
      const world = worldOf({ ...WORK, today: ["video", ...TODAY], active: "video" });
      const media = { playing: true, title: "Dawn chorus", artist: "", video: true, pip: false, live: false, can_next: false, can_prev: false };
      return withUi(world, { runtime: { ...world.ui.runtime, video: { ...LOADED, media } } });
    },
    pointer: {
      path: [[0.04, [1000, 620]], [0.18, row("notes")], [0.26, row("notes")], [0.4, ".pip"], [0.5, ".pip-play"], [0.64, ".pip-play"], [0.8, ".pip-top button"]],
      clicks: [0.22, 0.56, 0.88],
    },
  },
  // The folder asks its server and fills itself.
  smart: {
    start: () => worldOf({ ...WORK, reviews: ["mr482"] }),
    events: [
      [0.14, () => change((w) => fetching(w, true))],
      [0.34, () => change(() => fetching(worldOf({ ...WORK, reviews: ["mr482", "mr479"] }), true))],
      [0.5, () => change(() => worldOf({ ...WORK, reviews: ["mr482", "mr479", "mr485"] }))],
    ],
    pointer: { path: [[0.6, [330, 300]], [0.8, row("mr485")]], clicks: [0.86] },
  },
  // Settings → Isolation: a space gets logins of its own, another forgets them.
  profiles: {
    start: () => worldOf({ ...WORK, today: ["isolation", ...TODAY], active: "isolation" }),
    pointer: {
      path: [[0.06, [900, 640]], [0.28, ".iso-row:nth-child(1) .seg button:nth-child(2)"], [0.48, ".iso-row:nth-child(1) .seg button:nth-child(2)"], [0.68, ".iso-row:nth-child(2) .seg button:nth-child(3)"]],
      clicks: [0.34, 0.74],
    },
  },
  // Extensions are pinned to the sidebar; one is opened.
  extensions: {
    start: () => {
      const world = worldOf(WORK);
      const { settings } = world.ui;
      return withUi(world, { settings: { ...settings, appearance: { ...settings.appearance, sidebar_width: 306 } } });
    },
    events: [
      [0.12, () => void run({ cmd: "pin_extension", id: "shield.png", pinned: true })],
      [0.24, () => void run({ cmd: "pin_extension", id: "reader.png", pinned: true })],
      [0.36, () => void run({ cmd: "pin_extension", id: "keyring.png", pinned: true })],
    ],
    pointer: { path: [[0.42, [330, 150]], [0.6, '.ext-btn[title="Keyring"]']], clicks: [0.66] },
  },
  // The media row: pause, play, mute.
  media: {
    start: () => worldOf(WORK),
    pointer: {
      path: [[0.06, [330, 170]], [0.22, '.media [title="Pause"]'], [0.4, '.media [title="Play"]'], [0.5, '.media [title="Play"]'], [0.7, '.media [title="Mute"]']],
      clicks: [0.28, 0.46, 0.76],
    },
  },
  // Copy Link leaves the trackers behind.
  links: {
    start: () => worldOf({ ...WORK, active: "rust" }),
    pointer: { path: [[0.08, [330, 150]], [0.3, ".addr-copy"]], clicks: [0.38] },
    labels: [{ from: 0.3, to: 0.56, keys: ["⌘", "⇧", "C"] }],
    labelAt: [344, 150],
  },
  // The capture tool picks an element of the page; the result waits in the sidebar.
  capture: {
    start: () => worldOf(WORK),
    events: [[0.14, () => void run({ cmd: "capture_start" })]],
    pointer: { path: [[0.2, [760, 620]], [0.46, ".pg-columns section:nth-child(1) .pg-card:nth-of-type(3)"]], clicks: [0.56] },
    labels: [{ from: 0.06, to: 0.3, keys: ["⌘", "⇧", "2"] }],
    labelAt: [700, 610],
  },
  // The site panel: what the site may do, changed with a click.
  site: {
    start: () => worldOf({ ...WORK, space: "home", active: "hike" }),
    pointer: {
      path: [
        [0.06, [330, 200]],
        [0.22, ".addr-chip"],
        [0.34, ".addr-chip"],
        [0.52, ".site-panel .perm:nth-child(3) button:nth-child(1)"],
        [0.66, ".site-panel .perm:nth-child(3) button:nth-child(1)"],
        [0.8, ".site-panel .perm:nth-child(2) button:nth-child(2)"],
      ],
      clicks: [0.28, 0.58, 0.86],
    },
  },
  // Settings → Data: another browser's spaces are added.
  import: {
    start: () => worldOf({ ...WORK, today: ["importing", ...TODAY], active: "importing" }),
    pointer: { path: [[0.08, [900, 420]], [0.32, ".pg-app .btn:nth-child(1)"]], clicks: [0.4] },
  },
};

/** Type `text` into a field the way a person would, so React notices. */
function type(input: HTMLInputElement, text: string) {
  if (input.value === text) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Play scenes inside `root`, the demo's element. */
export function film(root: HTMLElement): DemoApi {
  /** The tour: the state on screen, and whether the archive is open. */
  let shown = "";
  let archiveOpen = false;
  let again = 0;
  /** A card scene: which one runs, and how far it has been played. */
  let playing: SceneId | null = null;
  let played = -1;
  let label = "";
  /** Where each target was last seen: a row that has just left keeps its place. */
  const seen = new Map<Target, { x: number; y: number }>();

  /** A target's place in the window, a little below and right of its middle so it stays readable. */
  const place = (target: Target) => {
    if (typeof target !== "string") return { x: target[0], y: target[1] };
    const el = root.querySelector(target);
    if (el) {
      // A link that wraps is pointed at where it starts.
      const [box, frame] = [el.getClientRects()[0] ?? el.getBoundingClientRect(), root.getBoundingClientRect()];
      seen.set(target, { x: box.left - frame.left + box.width * 0.62, y: box.top - frame.top + box.height * 0.62 });
    }
    return seen.get(target);
  };

  /** The mouse at `at` in the window; the capture tool has a window of its own in the app, and gets it in those terms. */
  const mouse = (type: string, el: Element, at: { x: number; y: number }) => {
    const frame = root.getBoundingClientRect();
    const tool = el.closest(".capture-host")?.getBoundingClientRect();
    const [clientX, clientY] = tool ? [at.x + frame.left - tool.left, at.y + frame.top - tool.top] : [at.x + frame.left, at.y + frame.top];
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }));
  };

  /** The part of the path `t` is in: the two targets around it and how far between them. */
  const leg = (path: NonNullable<Scene["pointer"]>["path"], t: number) => {
    const next = path.findIndex(([at]) => at > t);
    const [from, to] = next === -1 ? [path.at(-1)!, path.at(-1)!] : [path[next - 1]!, path[next]!];
    return { from: from[1], to: to[1], k: to[0] === from[0] ? 1 : ease(within(t, from[0], to[0])) };
  };

  /** Click what the pointer is on at `t`: the capture tool if it is open, else that element. */
  const click = (scene: Scene, t: number) => {
    const target = scene.pointer && leg(scene.pointer.path, t).from;
    const at = target && place(target);
    const el = root.querySelector(".capture-root") ?? (typeof target === "string" ? root.querySelector(target) : null);
    if (!el || !at) return;
    for (const type of ["mousedown", "mouseup", "click"]) mouse(type, el, at);
  };

  /**
   * Mark what the pointer is on (`data-hover`, styled in demo.css like the
   * app's :hover). Only what changes is touched: taking the mark off and
   * putting it back would start each fade over, on every frame.
   */
  const hover = (on: readonly Element[]) => {
    for (const el of root.querySelectorAll("[data-hover]")) if (!on.includes(el)) el.removeAttribute("data-hover");
    for (const el of on) if (!el.hasAttribute("data-hover")) el.setAttribute("data-hover", "");
  };

  const point = (scene: Scene, t: number) => {
    const first = scene.pointer?.path[0];
    if (!scene.pointer || !first || t < first[0]) {
      hover([]);
      delete root.dataset["pointer"];
      return;
    }
    const { from, to, k } = leg(scene.pointer.path, t);
    const [a, b] = [place(from), place(to)];
    if (!a || !b) return;
    const at = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    root.style.setProperty("--pointer-x", `${at.x.toFixed(1)}px`);
    root.style.setProperty("--pointer-y", `${at.y.toFixed(1)}px`);
    root.dataset["pointer"] = scene.pointer.clicks.some((c) => Math.abs(t - c) < 0.03) ? "pressed" : "moving";
    // What the pointer rests on looks as it does under a real one (demo.css),
    // as does the floating video while the pointer moves about on it; and
    // the capture tool follows the pointer.
    const [left, reached] = [from, to].map((target) => (typeof target === "string" ? root.querySelector(target) : null));
    const video = reached?.closest(".pip");
    hover([...(reached && (k === 1 || from === to) ? [reached] : []), ...(video && left?.closest(".pip") === video ? [video] : [])]);
    const tool = root.querySelector(".capture-root");
    if (tool) mouse("mousemove", tool, at);
  };

  const say = (scene: Scene, t: number) => {
    const now = scene.labels?.find((l) => t >= l.from && t < l.to);
    const key = JSON.stringify(now ?? null);
    const box = root.querySelector<HTMLElement>(".keys");
    if (!box) return;
    box.toggleAttribute("data-on", !!now);
    box.toggleAttribute("data-placed", !!scene.labelAt);
    if (scene.labelAt) {
      box.style.setProperty("--keys-x", `${scene.labelAt[0]}px`);
      box.style.setProperty("--keys-y", `${scene.labelAt[1]}px`);
    }
    // The last label stays in the box while it fades out.
    if (!now || key === label) return;
    label = key;
    box.replaceChildren(
      ...(now.keys ?? []).map((k) => Object.assign(document.createElement("kbd"), { textContent: k })),
      ...(now.text ? [Object.assign(document.createElement("span"), { textContent: now.text })] : []),
    );
  };

  /** A tour scene at `t`. */
  const set = (f: Frame) => {
    const key = JSON.stringify([f.space, f.active, f.today, f.split, f.peek, f.palette, f.archived]);
    if (key !== shown) {
      shown = key;
      // At once: the steps below look for what this renders.
      flushSync(() => store.set(worldOf(f)));
    }
    root.style.setProperty("--arriving", String(f.arriving ?? 1));

    const input = root.querySelector<HTMLInputElement>(".cmdbar input");
    if (input) {
      type(input, f.query ?? "");
      // The command bar selects what the pointer is over.
      const target = root.querySelectorAll(".cmdbar .result")[f.selected ?? 0];
      if (target && !target.hasAttribute("data-selected")) target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    }

    if (!!f.archive !== archiveOpen) {
      archiveOpen = !!f.archive;
      if (archiveOpen) window.__magnetite.openArchive();
      else window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }
  };

  /** A card scene up to `t`: from the start if it is new or went back, then whatever is due. */
  const play = (id: SceneId, scene: Scene, t: number) => {
    if (id !== playing || t < played) {
      playing = id;
      played = -1;
      seen.clear();
      shown = "";
      root.style.removeProperty("--arriving");
      flushSync(() => store.restart(scene.start!()));
    }
    const due = [
      ...(scene.events ?? []).map(([at, happen]) => ({ at, happen })),
      ...(scene.pointer?.clicks ?? []).map((at) => ({ at, happen: () => click(scene, at) })),
    ]
      .filter(({ at }) => at > played && at <= t)
      .sort((a, b) => a.at - b.at);
    // One at a time, each seeing what the one before it did.
    for (const { happen } of due) flushSync(happen);
    played = t;
  };

  return {
    show(id, progress) {
      const t = Math.min(1, Math.max(0, progress));
      const scene = SCENES[id];
      window.clearTimeout(again);
      if (scene.frame) {
        const frame = scene.frame(t);
        playing = null;
        set(frame);
        // The command bar's results arrive a moment after typing: select again then.
        if (frame.palette) again = window.setTimeout(() => set(frame), 220);
      } else {
        play(id, scene, t);
      }
      point(scene, t);
      say(scene, t);
    },
  };
}

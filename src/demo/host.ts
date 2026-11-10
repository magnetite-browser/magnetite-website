// The demo's stand-in for the Rust application. It keeps the state, pushes
// each change to the sidebar (`window.__magnetite.setState`) and answers the
// sidebar's commands (`window.magnetiteQuery`), as crates/app does in the
// browser. Only what a visitor can reach by clicking around is covered;
// every other command is accepted and does nothing.
import {
  findTab,
  findTabInSpace,
  hostOf,
  splitIds,
  type ArchiveItem,
  type CaptureFrame,
  type Command,
  type CopyResult,
  type LinkVariant,
  type PermissionRow,
  type SearchResult,
  type Side,
  type SidebarNode,
  type Space,
  type SplitNode,
  type TabItem,
  type UiState,
} from "@app/bridge";
import type { Info } from "@app/settings/types";
import { LOADED, START, derived, row, worldOf, type World } from "./world";

let world: World = worldOf(START);
const listeners = new Set<() => void>();
/** As the tour's picture the demo acts by itself: then it must not reach outside the page (the clipboard). */
const staged = new URLSearchParams(location.search).has("film");

/** The demo's state; a change goes to the sidebar and to every subscriber. */
export const store = {
  get: (): World => world,
  set(next: World) {
    world = next;
    window.__magnetite.setState(next.ui);
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /**
   * Start over from `next`: the window is built anew, so nothing that the
   * sidebar keeps to itself (an open menu, a panel, a status line) is left.
   */
  restart(next: World) {
    epoch++;
    store.set(next);
  },
  /** Counts the restarts. */
  epoch: () => epoch,
};
let epoch = 0;

/** Most pages one split holds, as in the app. */
const MAX_PANES = 4;
let serial = 0;
const now = () => Math.floor(Date.now() / 1000);

const change = (ui: Partial<UiState>, rest: Partial<Omit<World, "ui">> = {}) =>
  store.set({ ...world, ...rest, ui: derived({ ...world.ui, ...ui }) });

/** What happens to a tab: the tab to keep in its place, or null to remove it. */
type Edit = (tab: TabItem) => TabItem | null;

function editNodes(nodes: SidebarNode[], edit: Edit): SidebarNode[] {
  return nodes.flatMap((n): SidebarNode[] => {
    if (n.kind === "folder") return [{ ...n, children: editNodes(n.children, edit) }];
    const kept = edit(n);
    return kept ? [{ ...kept, kind: "tab" }] : [];
  });
}

/** The sidebar with `edit` applied to every tab. */
function editTabs(ui: UiState, edit: Edit): UiState["sidebar"] {
  const list = (tabs: TabItem[]) => tabs.flatMap((t) => edit(t) ?? []);
  return {
    ...ui.sidebar,
    favorites: ui.sidebar.favorites.map((f) => ({ ...f, items: list(f.items) })),
    spaces: ui.sidebar.spaces.map((s) => ({ ...s, pinned: editNodes(s.pinned, edit), today: list(s.today) })),
  };
}

function editSpace(ui: UiState, id: string, edit: (space: Space) => Space): UiState["sidebar"] {
  return { ...ui.sidebar, spaces: ui.sidebar.spaces.map((s) => (s.id === id ? edit(s) : s)) };
}

const spaceOf = (ui: UiState, tab: string) => ui.sidebar.spaces.find((s) => findTabInSpace(s, tab) !== null);
const inToday = (ui: UiState, tab: string) => ui.sidebar.spaces.some((s) => s.today.some((t) => t.id === tab));

/** The tab a space shows when nothing says otherwise: its first pinned tab, else the first of Today. */
function firstTab(space: Space | undefined): string | null {
  const walk = (nodes: SidebarNode[]): string | null => {
    for (const n of nodes) {
      const id = n.kind === "tab" ? n.id : walk(n.children);
      if (id) return id;
    }
    return null;
  };
  return space ? (walk(space.pinned) ?? space.today[0]?.id ?? null) : null;
}

/** `splits` without page `id`; a split left with one page is no split. */
const withoutPane = (splits: SplitNode[], id: string): SplitNode[] =>
  splits.flatMap((s) => {
    const ids = splitIds(s);
    if (!ids.includes(id)) return [s];
    return ids.length > 2 ? [row(ids.filter((p) => p !== id))] : [];
  });

/** `splits` with page `id` beside `anchor`; unchanged when that split is full. */
function withPane(splits: SplitNode[], anchor: string, id: string, side: Side = "right"): SplitNode[] {
  const rest = withoutPane(splits, id);
  const current = rest.find((s) => splitIds(s).includes(anchor));
  const ids = current ? splitIds(current) : [anchor];
  if (ids.length >= MAX_PANES) return splits;
  const at = ids.indexOf(anchor) + (side === "left" || side === "top" ? 0 : 1);
  return [...rest.filter((s) => s !== current), row([...ids.slice(0, at), id, ...ids.slice(at)])];
}

/** Bring tab `id` to the front, in `ui` (a state about to be set). */
function activate(id: string, ui: UiState = world.ui, rest: Partial<Omit<World, "ui">> = {}) {
  const space = spaceOf(ui, id)?.id ?? ui.active_space;
  // A playing video floats (picture-in-picture) while its tab is not in front.
  const runtime = Object.fromEntries(
    Object.entries({ ...ui.runtime, [id]: ui.runtime[id] ?? LOADED }).map(([tab, rt]) => [
      tab,
      rt.media?.video ? { ...rt, media: { ...rt.media, pip: ui.settings.auto_pip && rt.media.playing && tab !== id } } : rt,
    ]),
  );
  change(
    {
      ...ui,
      sidebar: editTabs(ui, (t) => (t.id === id && t.unread ? { ...t, unread: false } : t)),
      active_space: space,
      active_tab: id,
      runtime,
    },
    { ...rest, lastActive: { ...world.lastActive, [space]: id } },
  );
}

/** Open an address as a new Today tab of the active space: in front, in the background, or beside the page in front. */
function open(title: string, url: string, how: { background?: boolean | undefined; beside?: Side | undefined } = {}, rest: Partial<Omit<World, "ui">> = {}) {
  const { ui } = world;
  const id = `t${++serial}`;
  const tab: TabItem = { id, title, url, custom_title: false, unread: !!how.background, created_at: now(), last_active_at: now() };
  const next: UiState = {
    ...ui,
    sidebar: editSpace(ui, ui.active_space, (s) => ({ ...s, today: [tab, ...s.today] })),
    runtime: { ...ui.runtime, [id]: LOADED },
    splits: how.beside && ui.active_tab ? withPane(ui.splits, ui.active_tab, id, how.beside) : ui.splits,
  };
  if (how.background) change(next, rest);
  else activate(id, next, rest);
}

/** What typing `text` into the command bar opens: an address as it is, anything else as a search. */
function typed(text: string): { title: string; url: string } {
  if (text.startsWith("magnetite://ui/settings")) return { title: "Settings", url: text };
  if (/^[a-z]+:\/\//i.test(text)) return { title: hostOf(text), url: text };
  if (/^[^\s]+\.[^\s]{2,}$/.test(text)) return { title: hostOf(`https://${text}`), url: `https://${text}` };
  return { title: text, url: world.ui.settings.search_template.replace("%s", encodeURIComponent(text)) };
}

/** Move tabs to the archive; pinned tabs and favorites are only unloaded. */
function close(ids: string[]) {
  const { ui } = world;
  const archived = ids.filter((id) => inToday(ui, id));
  const gone = new Set(archived);
  const items: ArchiveItem[] = archived.flatMap((id) => {
    const tab = findTab(ui, id);
    return tab ? [{ id: `a${++serial}`, title: tab.title, url: tab.url, archived_at: now(), space: spaceOf(ui, id)?.title ?? null }] : [];
  });
  const sidebar = editTabs(ui, (t) => (gone.has(t.id) ? null : t));
  const runtime = Object.fromEntries(Object.entries(ui.runtime).filter(([id]) => !ids.includes(id)));
  const next: UiState = { ...ui, sidebar, runtime, splits: ids.reduce(withoutPane, ui.splits), archive_count: ui.archive_count + items.length };
  const rest = { archive: [...items, ...world.archive] };
  if (ui.active_tab === null || !ids.includes(ui.active_tab)) return change(next, rest);
  const fallback = sidebar.spaces.find((s) => s.id === ui.active_space);
  const other = fallback?.today[0]?.id ?? firstTab(fallback);
  // A pinned tab that was closed in front stays where it is, unloaded.
  if (other && other !== ui.active_tab) activate(other, next, rest);
  else change({ ...next, active_tab: null }, rest);
}

function restore(item: ArchiveItem | undefined) {
  if (!item) return;
  open(item.title, item.url, {}, { archive: world.archive.filter((a) => a !== item) });
  change({ archive_count: Math.max(0, world.ui.archive_count - 1) });
}

function switchSpace(id: string | undefined) {
  const space = world.ui.sidebar.spaces.find((s) => s.id === id);
  if (!space) return;
  const remembered = world.lastActive[space.id];
  const tab = remembered && findTabInSpace(space, remembered) ? remembered : firstTab(space);
  change({ active_space: space.id, active_tab: tab });
}

function stepSpace(by: 1 | -1) {
  const { spaces } = world.ui.sidebar;
  switchSpace(spaces[spaces.findIndex((s) => s.id === world.ui.active_space) + by]?.id);
}

/** Take tab `id` out of the sidebar and put it into `section` of `space` at `index`. */
function move(c: Extract<Command, { cmd: "move_tab" }>) {
  const { ui } = world;
  const found = findTab(ui, c.id);
  if (!found) return;
  const { home_url: _home, ...loose } = found;
  const tab: TabItem = c.section === "today" ? loose : { ...loose, home_url: found.home_url ?? found.url };
  const without: UiState = { ...ui, sidebar: editTabs(ui, (t) => (t.id === c.id ? null : t)) };
  const at = <T,>(list: T[], item: T) => [...list.slice(0, c.index), item, ...list.slice(c.index)];
  const into = (nodes: SidebarNode[]): SidebarNode[] =>
    c.folder ? nodes.map((n) => (n.kind === "folder" ? { ...n, children: n.id === c.folder ? at(n.children, { ...tab, kind: "tab" }) : into(n.children) } : n)) : at(nodes, { ...tab, kind: "tab" });
  const sidebar: UiState["sidebar"] =
    c.section === "favorites"
      ? { ...without.sidebar, favorites: without.sidebar.favorites.map((f, i) => (i === 0 ? { ...f, items: at(f.items, tab) } : f)) }
      : editSpace(without, c.space, (s) => (c.section === "today" ? { ...s, today: at(s.today, tab) } : { ...s, pinned: into(s.pinned) }));
  change({ sidebar });
}

const TRACKERS = /^(utm_|fbclid$|gclid$|mc_eid$)/;

/** Copy the address in front; `clean` and `markdown` drop tracking parameters, as the app's Copy Link does. */
function copyLink(variant: LinkVariant): CopyResult {
  const tab = findTab(world.ui, world.ui.active_tab ?? undefined);
  if (!tab || (!staged && !navigator.clipboard)) return { copied: false };
  const url = new URL(tab.url);
  let removed = 0;
  if (variant !== "original") {
    for (const key of [...url.searchParams.keys()]) {
      if (!TRACKERS.test(key)) continue;
      url.searchParams.delete(key);
      removed++;
    }
  }
  if (!staged) void navigator.clipboard.writeText(variant === "markdown" ? `[${tab.title}](${url.href})` : url.href).catch(() => {});
  return { copied: true, removed, variant };
}

function search(query: string): SearchResult[] {
  const q = query.toLowerCase();
  const hit = (t: { title: string; url: string }) => t.title.toLowerCase().includes(q) || hostOf(t.url).includes(q);
  const { sidebar } = world.ui;
  const tabs = (nodes: SidebarNode[]): TabItem[] => nodes.flatMap((n) => (n.kind === "tab" ? [n] : tabs(n.children)));
  return [
    ...sidebar.favorites.flatMap((f) => f.items).filter(hit).map((t): SearchResult => ({ kind: "tab", id: t.id, title: t.title, url: t.url })),
    ...sidebar.spaces.flatMap((s) => [...tabs(s.pinned), ...s.today].filter(hit).map((t): SearchResult => ({ kind: "tab", id: t.id, title: t.title, url: t.url, space: s.title }))),
    ...world.archive.filter(hit).map((a): SearchResult => ({ kind: "archived", id: a.id, title: a.title, url: a.url, ...(a.space ? { space: a.space } : {}) })),
  ];
}

/** What the Settings page shows about the sample browser. */
function info(): Info {
  const { ui } = world;
  return {
    settings: ui.settings,
    sync_signed_in: false,
    profiles: ui.sidebar.profiles,
    spaces: ui.sidebar.spaces.map(({ id, title, icon, accent, profile_id }) => ({ id, title, profile_id, ...(icon ? { icon } : {}), ...(accent ? { accent } : {}) })),
    active_space: ui.active_space,
    favorites: ui.sidebar.favorites.flatMap((f) => f.items).map(({ id, title, url, profile_id }) => ({ id, title, url, ...(profile_id ? { profile_id } : {}) })),
    archive_count: ui.archive_count,
    version: "0.1.0",
    commit: null,
    repository: "https://github.com/magnetite-browser/magnetite",
    engine: { chromium: "156.0.8078.88", cef: "156.0.26" },
    data_dir: "~/Library/Application Support/Magnetite",
    extensions: ui.extensions,
    keychain: "keychain",
  };
}

/** Browsers the sample computer has, and what importing one adds. */
const IMPORTS: Record<string, { name: string; spaces: { title: string; icon: string; accent: [number, number, number] }[]; tabs: number }> = {
  arc: { name: "Arc", spaces: [{ title: "Side projects", icon: "flask", accent: [214, 122, 168] }, { title: "Travel", icon: "plane", accent: [112, 178, 214] }], tabs: 47 },
  firefox: { name: "Firefox", spaces: [{ title: "Firefox", icon: "flame", accent: [224, 138, 46] }], tabs: 12 },
  zen: { name: "Zen", spaces: [{ title: "Studio", icon: "camera", accent: [150, 132, 220] }], tabs: 23 },
};

function importFrom(key: string): Promise<{ spaces: number; tabs: number }> {
  const source = IMPORTS[key];
  if (!source) return Promise.reject(new Error("not found on this computer"));
  // Reading a profile takes a moment in the app; the button says so meanwhile.
  return new Promise((done) =>
    setTimeout(() => {
      const { ui } = world;
      const added = source.spaces
        .filter((sp) => !ui.sidebar.spaces.some((s) => s.title === sp.title))
        .map(({ title, icon, accent: [red, green, blue] }): Space => ({ id: `s${++serial}`, title, icon, accent: { red: red / 255, green: green / 255, blue: blue / 255 }, profile_id: "default", pinned: [], today: [] }));
      change({ sidebar: { ...ui.sidebar, spaces: [...ui.sidebar.spaces, ...added] } });
      done({ spaces: source.spaces.length, tabs: source.tabs });
    }, 900),
  );
}

/** A profile with its own logins, for a space or a favorite (Settings → Isolation). */
function newProfile(name: string, ephemeral: boolean): { id: string } {
  const id = `p${++serial}`;
  change({ sidebar: { ...world.ui.sidebar, profiles: [...world.ui.sidebar.profiles, { id, name, is_default: false, ...(ephemeral ? { ephemeral } : {}) }] } });
  return { id };
}

/** What the sample site was asked for, for the site panel. */
const PERMISSIONS = (origin: string): PermissionRow[] => [
  { kind: "location", origin, value: "allow", requested: true },
  { kind: "notifications", origin, value: "block", requested: true },
];

/**
 * The capture tool's frozen page. The demo's page stays visible under the
 * tool, so the picture is not used (demo.css hides it); the boxes are the
 * page's elements, for picking one. Everything is in the tool's own pixels.
 */
function captureFrame(): CaptureFrame | Record<string, never> {
  const pane = document.querySelector(".capture-host");
  if (!pane) return {};
  const at = pane.getBoundingClientRect();
  const boxes = [...pane.parentElement!.querySelectorAll(".pg :is(h1, .pg-lead, .pg-card, .pg-diff, .pg-stats, pre, svg, ul, ol)")]
    .map((el) => el.getBoundingClientRect())
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .map((b): [number, number, number, number] => [b.left - at.left, b.top - at.top, b.width, b.height]);
  // The tool scales by its window's width, which here is the demo's: no scaling.
  return { image: "/favicon.svg", css_width: window.innerWidth, css_height: at.height, boxes, element_ok: true };
}

/** Open the page at `url` as a peek over the page in front. */
export function peek(title: string, url: string) {
  change({ peek: { url, title, favicon: null, loading: false } });
}

/** Run one of the sidebar's commands; the return value is its reply. */
export function run(c: Command): unknown {
  const { ui } = world;
  const active = ui.active_tab;
  switch (c.cmd) {
    case "ready":
      return void window.__magnetite.setState(ui);
    case "get_state":
      return ui;
    case "activate_tab":
      return activate(c.id);
    case "close_tab":
      return close([c.id]);
    case "archive_today":
      return close(ui.sidebar.spaces.find((s) => s.id === ui.active_space)?.today.map((t) => t.id) ?? []);
    case "switch_space":
      return switchSpace(c.id);
    case "next_space":
      return stepSpace(1);
    case "prev_space":
      return stepSpace(-1);
    case "open_palette":
      return store.set({ ...world, palette: { mode: c.mode, ...(c.side ? { side: c.side } : {}) } });
    case "palette_close":
      return world.palette && store.set({ ...world, palette: null });
    case "search":
      return { results: search(c.query) };
    case "new_tab": {
      const { title, url } = typed(c.url);
      return open(title, url, { background: c.background, beside: c.split ? (c.side ?? "right") : undefined });
    }
    case "navigate": {
      const to = typed(c.url);
      return change({ sidebar: editTabs(ui, (t) => (t.id === active ? { ...t, ...to } : t)) });
    }
    case "archive": {
      const q = (c.query ?? "").toLowerCase();
      return { items: world.archive.filter((a) => a.title.toLowerCase().includes(q) || a.url.includes(q)) };
    }
    case "restore_archived":
      return restore(world.archive.find((a) => a.id === c.id));
    case "reopen_closed":
      return restore(world.archive[0]);
    case "show_archive":
      return window.__magnetite.openArchive();
    case "show_downloads":
      return window.__magnetite.openDownloads();
    case "downloads":
      return { items: world.downloads };
    case "close_peek":
      return change({ peek: null });
    case "peek_to_tab":
    case "peek_to_split": {
      if (!ui.peek) return;
      change({ peek: null });
      return open(ui.peek.title, ui.peek.url, { beside: c.cmd === "peek_to_split" ? "right" : undefined });
    }
    case "add_split":
      return active && c.id !== active && activate(c.id, { ...ui, splits: withPane(ui.splits, active, c.id, c.side) });
    case "split_insert":
      return activate(c.tab, { ...ui, splits: withPane(ui.splits, c.target ?? active ?? c.tab, c.tab, c.side) });
    case "remove_split": {
      const rest = splitIds(ui.split ?? { kind: "pane", id: c.id }).filter((id) => id !== c.id);
      const next = { ...ui, splits: withoutPane(ui.splits, c.id) };
      return c.id === active && rest[0] ? activate(rest[0], next) : change(next);
    }
    case "separate_all": {
      const of = c.id ?? active;
      return change({ splits: ui.splits.filter((s) => !of || !splitIds(s).includes(of)) });
    }
    case "pin":
      return move({ cmd: "move_tab", id: c.id, space: spaceOf(ui, c.id)?.id ?? ui.active_space, section: "pinned", index: Number.MAX_SAFE_INTEGER });
    case "unpin":
      return move({ cmd: "move_tab", id: c.id, space: spaceOf(ui, c.id)?.id ?? ui.active_space, section: "today", index: 0 });
    case "move_tab":
      return move(c);
    case "reset_tab":
      return change({ sidebar: editTabs(ui, (t) => (t.id === c.id && t.home_url ? { ...t, url: t.home_url } : t)) });
    case "rename_tab":
      return c.title && change({ sidebar: editTabs(ui, (t) => (t.id === c.id ? { ...t, title: c.title, custom_title: true } : t)) });
    case "rename_space":
      return change({ sidebar: editSpace(ui, c.id, (s) => ({ ...s, title: c.title || s.title, ...(c.icon ? { icon: c.icon } : {}) })) });
    case "set_space_color":
      return change({ sidebar: editSpace(ui, c.id, ({ accent: _accent, ...s }) => (c.color ? { ...s, accent: c.color } : s)) });
    case "media":
      return change({ runtime: { ...ui.runtime, [c.id]: { ...LOADED, ...ui.runtime[c.id], media: ui.runtime[c.id]?.media ? { ...ui.runtime[c.id]!.media!, playing: c.action === "play" } : null } } });
    case "set_muted":
      return change({ runtime: { ...ui.runtime, [c.id]: { ...LOADED, ...ui.runtime[c.id], muted: c.muted } } });
    case "set_zoom":
      return active && change({ runtime: { ...ui.runtime, [active]: { ...LOADED, ...ui.runtime[active], site: { secure: true, cert_error: false, zoom: c.percent } } } });
    case "copy_link":
      return copyLink(c.variant);
    case "get_settings":
      return info();
    case "set_settings":
      return change({ settings: c.settings });
    case "update_status":
    case "check_updates":
      return { status: { state: "unavailable" }, version: "0.1.0" };
    case "import_sources":
      return { sources: Object.entries(IMPORTS).map(([key, { name }]) => ({ key, name })) };
    case "import_from":
      return importFrom(c.key);
    case "new_profile":
      return newProfile(c.name, !!c.ephemeral);
    case "set_space_profile":
      return change({ sidebar: editSpace(ui, c.id, (s) => ({ ...s, profile_id: c.profile })) });
    case "set_tab_profile":
      return change({
        sidebar: editTabs(ui, (t) => {
          if (t.id !== c.id) return t;
          const { profile_id: _old, ...rest } = t;
          return c.profile ? { ...rest, profile_id: c.profile } : rest;
        }),
      });
    case "pin_extension": {
      const pinned = ui.settings.pinned_extensions.filter((id) => id !== c.id).concat(c.pinned ? [c.id] : []);
      return change({ settings: { ...ui.settings, pinned_extensions: pinned } });
    }
    case "open_extension":
      return store.set({ ...world, popup: world.popup === c.id ? null : c.id });
    case "picture_in_picture": {
      const rt = ui.runtime[c.id];
      return rt?.media && change({ runtime: { ...ui.runtime, [c.id]: { ...rt, media: { ...rt.media, pip: !rt.media.pip } } } });
    }
    case "site_permissions":
      return { rows: active ? PERMISSIONS(new URL(findTab(ui, active)?.url ?? "https://example.org").origin) : [] };
    case "capture_start":
      // Only the tour stages a capture: the tool reads the pointer in its own window's terms.
      return staged && active && store.set({ ...world, capturing: true });
    case "capture_frame":
      return captureFrame();
    case "capture_cancel":
      return world.capturing && store.set({ ...world, capturing: false });
    case "capture_select":
    case "capture_visible":
    case "capture_full": {
      store.set({ ...world, capturing: false });
      const [, , width, height] = c.cmd === "capture_select" ? c.rect : [0, 0, 1000, 784];
      return window.__magnetite.captureReady({ width: Math.round(width * 2), height: Math.round(height * 2), thumb: "/cards/capture-thumb.webp", cut_at: null });
    }
    case "capture_copy":
      return { copied: true };
    case "sidebar_width":
      return change({ settings: { ...ui.settings, appearance: { ...ui.settings.appearance, sidebar_width: Math.min(360, Math.max(220, c.width)) } } });
    case "shortcut":
      if (c.shortcut === "new_tab") return run({ cmd: "open_palette", mode: "new" });
      if (c.shortcut === "focus_address") return run({ cmd: "open_palette", mode: active ? "navigate" : "new" });
      if (c.shortcut === "close_tab") return active && close([active]);
      if (c.shortcut === "reopen_closed") return restore(world.archive[0]);
      if (c.shortcut === "next_space") return stepSpace(1);
      if (c.shortcut === "prev_space") return stepSpace(-1);
      if (c.shortcut === "toggle_pin") return active && run(inToday(ui, active) ? { cmd: "pin", id: active } : { cmd: "unpin", id: active });
      return;
    default:
      return;
  }
}

window.magnetiteQuery = ({ request, onSuccess, onFailure }) => {
  // Most answers are there at once; an import takes a moment.
  Promise.resolve()
    .then(() => run(JSON.parse(request) as Command))
    .then(
      (reply) => onSuccess(JSON.stringify(reply ?? {})),
      (e: unknown) => onFailure(0, e instanceof Error ? e.message : String(e)),
    );
};

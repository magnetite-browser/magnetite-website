// The live demo's sample browser: its tabs and spaces, and the state the
// app's own sidebar (crates/ui/web) renders from them. Nothing here is real
// data, and nothing is loaded from the web: every address is on example.org
// (reserved for examples) and shows one of the sample pages in pages.tsx.
import {
  splitIds,
  type ArchiveItem,
  type Color,
  type DownloadEntry,
  type ExtensionInfo,
  type PaletteMode,
  type Settings,
  type Side,
  type Space,
  type SplitNode,
  type TabItem,
  type TabRuntime,
  type UiState,
} from "@app/bridge";

/** A sample page (pages.tsx). */
export type PageId = "roadmap" | "notes" | "design" | "review" | "article" | "recipe" | "hike" | "video" | "home" | "sample";

const SITES = {
  mail: { title: "Inbox", url: "https://mail.example.org/inbox", page: "sample" },
  calendar: { title: "Calendar", url: "https://calendar.example.org/week", page: "sample" },
  chat: { title: "Team chat", url: "https://chat.example.org/general", page: "sample" },
  radio: { title: "Field notes radio", url: "https://radio.example.org/episode-12", page: "sample" },
  maps: { title: "Maps", url: "https://maps.example.org/", page: "sample" },
  photos: { title: "Photos", url: "https://photos.example.org/", page: "sample" },
  wiki: { title: "Team wiki", url: "https://wiki.example.org/", page: "sample" },
  magnetite: { title: "Magnetite", url: "https://magnetitebrowser.org/", page: "home" },
  roadmap: { title: "Roadmap", url: "https://roadmap.example.org/2027", page: "roadmap" },
  notes: { title: "Team notes", url: "https://notes.example.org/weekly", page: "notes" },
  mr482: { title: "Fix tab drag on hover", url: "https://git.example.org/studio/app/-/merge_requests/482", page: "review" },
  mr479: { title: "Retry sync on 503", url: "https://git.example.org/studio/app/-/merge_requests/479", page: "review" },
  mr485: { title: "Faster photo import", url: "https://git.example.org/studio/app/-/merge_requests/485", page: "review" },
  // Tracking parameters, so Copy Link has something to remove.
  rust: { title: "Error handling in Rust", url: "https://blog.example.org/error-handling-in-rust?utm_source=newsletter&utm_medium=email", page: "article" },
  css: { title: "Scroll-driven animations", url: "https://docs.example.org/css/scroll-driven-animations", page: "sample" },
  design: { title: "Archive: design note", url: "https://notes.example.org/archive-design", page: "design" },
  video: { title: "Dawn chorus", url: "https://video.example.org/dawn-chorus", page: "video" },
  // Magnetite's own Settings page, at two of its sections (pages.tsx shows the real one).
  isolation: { title: "Settings", url: "magnetite://ui/settings#spaces", page: "sample" },
  importing: { title: "Settings", url: "magnetite://ui/settings#data", page: "sample" },
  hike: { title: "Ridge loop, 14 km", url: "https://trails.example.org/ridge-loop", page: "hike" },
  recipe: { title: "Lentil soup", url: "https://kitchen.example.org/lentil-soup", page: "recipe" },
  rail: { title: "Train times", url: "https://rail.example.org/", page: "sample" },
  hut: { title: "Hut booking", url: "https://trails.example.org/huts/ridge", page: "sample" },
  packing: { title: "Packing list", url: "https://notes.example.org/packing", page: "sample" },
  weather: { title: "Weather radar", url: "https://maps.example.org/weather", page: "sample" },
  essay: { title: "On keeping fewer tabs", url: "https://blog.example.org/fewer-tabs", page: "sample" },
  type: { title: "A short history of type", url: "https://docs.example.org/type/history", page: "sample" },
} as const satisfies Record<string, { title: string; url: string; page: PageId }>;

/** A sample tab's id; also its key in `SITES`. */
export type SiteId = keyof typeof SITES;

/** The sample page behind an address; `sample` for anything typed in the demo. */
export function pageFor(url: string): PageId {
  return Object.values(SITES).find((s) => s.url === url)?.page ?? "sample";
}

/** The demo's address for a sample page, e.g. for the link a peek opens. */
export const urlOf = (id: SiteId): string => SITES[id].url;
export const titleOf = (id: SiteId): string => SITES[id].title;

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const DAY = 24 * HOUR;

const tab = (id: SiteId, extra: Partial<TabItem> = {}): TabItem => ({
  id,
  title: SITES[id].title,
  url: SITES[id].url,
  custom_title: false,
  unread: false,
  ...extra,
});
/** A pinned tab or favorite: it remembers the address it was pinned at. */
const pinned = (id: SiteId, extra: Partial<TabItem> = {}): TabItem => tab(id, { home_url: SITES[id].url, ...extra });

const rgb = (red: number, green: number, blue: number): Color => ({ red: red / 255, green: green / 255, blue: blue / 255 });

export type SpaceId = "work" | "home" | "reading";

/** The smart folder's id. */
export const REVIEWS = "reviews";

/** The spaces as the demo starts; `today` is what Work's Today section holds. */
function spaces(today: readonly SiteId[], reviews: readonly SiteId[] = ["mr482", "mr479"]): Space[] {
  return [
    {
      id: "work",
      title: "Work",
      icon: "briefcase",
      accent: rgb(215, 166, 101),
      profile_id: "default",
      pinned: [
        { kind: "tab", ...pinned("roadmap") },
        { kind: "tab", ...pinned("notes") },
        {
          kind: "folder",
          id: REVIEWS,
          title: "Review requests",
          children: reviews.map((id, i) => ({ kind: "tab", ...pinned(id, { unread: i > 0 }) })),
          smart: {
            source: { service: "gitlab", host: "git.example.org", show: "review_requests", group: "" },
            limit: 20,
            refresh_minutes: 10,
            items: reviews.map((id) => SITES[id].url),
            hidden: [],
          },
        },
      ],
      today: today.map((id) => tab(id)),
    },
    {
      id: "home",
      title: "Home",
      icon: "home",
      accent: rgb(143, 196, 150),
      profile_id: "default",
      pinned: [
        { kind: "tab", ...pinned("hike") },
        { kind: "tab", ...pinned("recipe") },
        {
          kind: "folder",
          id: "trip",
          title: "Weekend trip",
          children: [
            { kind: "tab", ...pinned("hut") },
            { kind: "tab", ...pinned("packing") },
          ],
        },
      ],
      today: [tab("weather"), tab("rail")],
    },
    {
      id: "reading",
      title: "Reading",
      icon: "book",
      accent: rgb(138, 170, 229),
      profile_id: "default",
      pinned: [{ kind: "tab", ...pinned("essay") }],
      today: [tab("type")],
    },
  ];
}

const FAVORITES: SiteId[] = ["mail", "calendar", "chat", "radio", "maps", "photos", "wiki", "magnetite"];

/** Tabs archived before the demo starts, newest first. */
const OLD_ARCHIVE: ArchiveItem[] = [
  { id: "a-bike", title: "Road bike sizing guide", url: "https://cycling.example.org/sizing", archived_at: NOW - DAY - 3 * HOUR, space: "Home" },
  { id: "a-pool", title: "Connection pooling in Postgres", url: "https://docs.example.org/postgres/pooling", archived_at: NOW - DAY - 5 * HOUR, space: "Work" },
  { id: "a-bread", title: "Sourdough starter schedule", url: "https://kitchen.example.org/sourdough", archived_at: NOW - 3 * DAY, space: "Home" },
  { id: "a-keys", title: "Keyboard layouts compared", url: "https://blog.example.org/keyboard-layouts", archived_at: NOW - 3 * DAY - 2 * HOUR, space: "Reading" },
];

const DOWNLOADS: DownloadEntry[] = [
  { id: "d-gpx", name: "ridge-loop.gpx", status: "finished", received: 48_200, total: 48_200, at: NOW - 2 * HOUR, changed_at: 0, missing: false, risky: false },
  { id: "d-pdf", name: "lentil-soup.pdf", status: "finished", received: 1_240_000, total: 1_240_000, at: NOW - DAY - HOUR, changed_at: 0, missing: false, risky: false },
];

const SETTINGS: Settings = {
  auto_archive_hours: 12,
  unload_minutes: 30,
  search_template: "https://duckduckgo.com/?q=%s",
  external_links: "tab",
  chrome_toolbar: false,
  appearance: { text_scale: 100, density: "comfortable", sidebar_width: 264 },
  auto_pip: true,
  strip_trackers: true,
  devtools_dock: "right",
  sync: { enabled: false, server_url: "", last_sync_at: null, last_error: null },
  pinned_extensions: [],
  check_updates: false,
  library_opens: "archive",
};

/** A loaded page with nothing special about it. */
export const LOADED: TabRuntime = {
  loaded: true,
  loading: false,
  can_go_back: false,
  can_go_forward: false,
  favicon: null,
  media: null,
  muted: false,
  site: { secure: true, cert_error: false, zoom: 100 },
  camera: false,
  microphone: false,
};

/** Extensions the sample browser has installed. Their ids are file names: the sidebar asks for `/ext-icons/<id>`. */
export const EXTENSIONS: ExtensionInfo[] = [
  { id: "keyring.png", name: "Keyring", options_url: null, chromium_pinned: false },
  { id: "reader.png", name: "Reader view", options_url: null, chromium_pinned: false },
  { id: "shield.png", name: "Tracker shield", options_url: null, chromium_pinned: false },
];

/** Every sample tab is loaded except a few, which show dimmed as in the app. */
const UNLOADED: ReadonlySet<SiteId> = new Set(["photos", "packing", "rail", "type"]);

function runtime(): Record<string, TabRuntime> {
  const all = Object.fromEntries(
    (Object.keys(SITES) as SiteId[]).filter((id) => !UNLOADED.has(id)).map((id) => [id, LOADED]),
  );
  return {
    ...all,
    radio: {
      ...LOADED,
      media: { playing: true, title: "Episode 12 · Field notes", artist: "", video: false, pip: false, live: false, can_next: true, can_prev: true },
    },
  };
}

/**
 * The demo's whole state: what the sidebar renders (`ui`) and the parts the
 * app keeps outside of it.
 */
export interface World {
  ui: UiState;
  /** The command bar over the page, while open. */
  palette: { mode: PaletteMode; side?: Side } | null;
  /** Archived tabs, newest first. */
  archive: ArchiveItem[];
  downloads: DownloadEntry[];
  /** The tab each space shows when switched to. */
  lastActive: Partial<Record<string, string>>;
  /** The extension whose popup is open. */
  popup: string | null;
  /** The capture tool is open over the page. */
  capturing: boolean;
}

/** Mix 8% of the space's colour into the graphite, as the app does (`chrome_rgb`). */
function chromeOf(space: Space | undefined): string {
  const base = [27, 27, 30];
  const c = space?.accent;
  const mixed = c ? [c.red, c.green, c.blue].map((v, i) => base[i]! * 0.92 + v * 255 * 0.08) : base;
  return `#${mixed.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Fill in what follows from the rest of `ui`: the split on screen, the pages
 * it shows, and the window's colour.
 */
export function derived(ui: UiState): UiState {
  const split = ui.splits.find((s) => ui.active_tab !== null && splitIds(s).includes(ui.active_tab)) ?? null;
  return {
    ...ui,
    split,
    panes: split ? splitIds(split) : ui.active_tab ? [ui.active_tab] : [],
    chrome: chromeOf(ui.sidebar.spaces.find((s) => s.id === ui.active_space)),
  };
}

/** Pages side by side in equal widths. */
export const row = (ids: readonly string[]): SplitNode => ({
  kind: "split",
  axis: "row",
  children: ids.map((id) => ({ kind: "pane", id })),
  sizes: ids.map(() => 1),
});

/** One moment of the tour: everything that picks what the window shows. */
export interface Moment {
  space: SpaceId;
  active: SiteId;
  /** Work's Today tabs, top to bottom. */
  today: readonly SiteId[];
  /** Pages side by side, if a split is on screen. */
  split?: readonly SiteId[];
  /** The page open as a peek. */
  peek?: SiteId;
  /** The command bar is open. */
  palette?: boolean;
  /** Today tabs the tour archived, newest first. */
  archived?: readonly SiteId[];
  /** What the smart folder holds (all of it unless given); the first item counts as seen. */
  reviews?: readonly SiteId[];
}

/** The state of the window at that moment. */
export function worldOf(moment: Moment): World {
  const ui: UiState = {
    sidebar: {
      profiles: [{ id: "default", name: "Default", is_default: true }],
      favorites: [{ profile_id: "default", items: FAVORITES.map((id) => pinned(id)) }],
      spaces: spaces(moment.today, moment.reviews),
    },
    active_space: moment.space,
    active_tab: moment.active,
    runtime: runtime(),
    sidebar_visible: true,
    archive_count: OLD_ARCHIVE.length + (moment.archived?.length ?? 0),
    panes: [],
    split: null,
    splits: moment.split ? [row(moment.split)] : [],
    peek: moment.peek ? { url: SITES[moment.peek].url, title: SITES[moment.peek].title, favicon: null, loading: false } : null,
    settings: SETTINGS,
    chrome: "",
    accounts: [{ id: "account", service: "gitlab", host: "git.example.org", login: "sam", name: "Sam" }],
    smart: { [REVIEWS]: { fetching: false, checked_at: NOW - 120, updated_at: NOW - 120, error: null, needs_account: false, needs_approval: false } },
    extensions: EXTENSIONS,
  };
  return {
    ui: derived(ui),
    palette: moment.palette ? { mode: "new" } : null,
    archive: [
      ...(moment.archived ?? []).map((id, i) => ({ id: `a-${id}`, title: SITES[id].title, url: SITES[id].url, archived_at: NOW - i * 60, space: "Work" })),
      ...OLD_ARCHIVE,
    ],
    downloads: DOWNLOADS,
    lastActive: { work: "roadmap", home: "hike", reading: "essay", [moment.space]: moment.active },
    popup: null,
    capturing: false,
  };
}

/** How the demo starts. */
export const START: Moment = { space: "work", active: "roadmap", today: ["rust", "css"] };

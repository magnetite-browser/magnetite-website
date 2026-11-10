import { useEffect, useRef, useState } from "react";
import { Favicon } from "./Favicon";
import { Arrow, Command as CommandIcon } from "./Icons";
import { findTab, hostOf, send, type Command, type PaletteMode, type SearchResult, type Side, type UiState } from "./bridge";
import { useDismiss } from "./dismiss";

type Item =
  | (SearchResult & { run: () => void })
  | { kind: "action"; id: string; title: string; run: () => void }
  | { kind: "url"; title: string; url: string; run: () => void };

const ACTIONS: { id: string; title: string; keywords: string[]; cmd: Command }[] = [
  { id: "new_space", title: "New space", keywords: ["space"], cmd: { cmd: "new_space", title: "" } },
  { id: "new_folder", title: "New folder", keywords: ["folder"], cmd: { cmd: "new_folder", title: "" } },
  { id: "archive_today", title: "Archive all Today tabs", keywords: ["clear", "archive"], cmd: { cmd: "archive_today" } },
  { id: "reopen", title: "Reopen last archived tab", keywords: ["restore", "closed"], cmd: { cmd: "reopen_closed" } },
  { id: "downloads", title: "Open downloads", keywords: ["downloads", "files"], cmd: { cmd: "show_downloads" } },
  { id: "toggle_sidebar", title: "Toggle sidebar", keywords: ["hide", "show"], cmd: { cmd: "toggle_sidebar" } },
  { id: "import", title: "Import from another browser…", keywords: ["import", "chrome", "firefox", "zen", "arc", "brave", "edge"], cmd: { cmd: "new_tab", url: "magnetite://ui/settings#data" } },
  { id: "copy_link", title: "Copy link without trackers", keywords: ["copy", "link", "url", "clean"], cmd: { cmd: "copy_link", variant: "clean" } },
  { id: "copy_original", title: "Copy original link", keywords: ["copy", "link", "url", "raw"], cmd: { cmd: "copy_link", variant: "original" } },
  { id: "copy_markdown", title: "Copy link as Markdown", keywords: ["copy", "markdown", "md"], cmd: { cmd: "copy_link", variant: "markdown" } },
  { id: "zoom_reset", title: "Reset zoom", keywords: ["zoom", "100"], cmd: { cmd: "set_zoom", percent: 100 } },
  { id: "split_right", title: "Add right split…", keywords: ["split", "right", "side"], cmd: { cmd: "open_palette", mode: "split", side: "right" } },
  { id: "split_left", title: "Add left split…", keywords: ["split", "left", "side"], cmd: { cmd: "open_palette", mode: "split", side: "left" } },
  { id: "split_top", title: "Add top split…", keywords: ["split", "top", "above"], cmd: { cmd: "open_palette", mode: "split", side: "top" } },
  { id: "split_bottom", title: "Add bottom split…", keywords: ["split", "bottom", "below"], cmd: { cmd: "open_palette", mode: "split", side: "bottom" } },
  { id: "split_even", title: "Even out split sizes", keywords: ["split", "equal", "even", "reset"], cmd: { cmd: "split_equalize", path: [] } },
  { id: "separate", title: "Separate split tabs", keywords: ["split", "separate", "unsplit"], cmd: { cmd: "separate_all" } },
  { id: "devtools", title: "Toggle developer tools", keywords: ["devtools", "developer", "console", "inspect", "f12"], cmd: { cmd: "toggle_devtools" } },
  { id: "capture", title: "Capture page…", keywords: ["capture", "screenshot", "snap"], cmd: { cmd: "capture_start" } },
  { id: "capture_copy", title: "Copy last capture", keywords: ["capture", "screenshot", "copy"], cmd: { cmd: "capture_copy" } },
];

/**
 * Search, open and name things: the whole page of the centred palette window
 * (`CommandPalette`). `split` opens the pick on `splitSide` of the current
 * tab; `new_profile` assigns the new profile to `profileFor` (a favorite) or
 * else the active space.
 */
export function CommandBar({ mode, state, profileFor, splitSide, onClose, onOpenArchive, onOpenSettings }: { mode: PaletteMode; state: UiState; profileFor?: string | null; splitSide?: Side; onClose: () => void; onOpenArchive: () => void; onOpenSettings: () => void }) {
  const activeTab = state.active_tab ? findTab(state, state.active_tab) : null;
  // `navigate` starts with the current address, selected so typing replaces it.
  const [query, setQuery] = useState(() => (mode === "navigate" && activeTab ? activeTab.url : ""));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // The palette window is focused already; it closes on Esc or when it loses focus.
  useDismiss(onClose, { takeFocus: false });

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  // Debounced backend search.
  useEffect(() => {
    if (mode === "new_space" || mode === "new_profile") return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      send({ cmd: "search", query: q }).then((r) => {
        if (!cancelled) setResults(r.results ?? []);
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, mode]);

  const q = query.trim();
  const items: Item[] = [];
  const groups: { label: string; items: Item[] }[] = [];
  if (mode === "new_space") {
    items.push({ kind: "action", id: "create_space", title: q ? `Create space "${q}"` : "Create space", run: () => send({ cmd: "new_space", title: q }) });
    groups.push({ label: "", items });
  } else if (mode === "new_profile") {
    const target = profileFor ? "this favorite" : "this space";
    items.push({ kind: "action", id: "create_profile", title: q ? `Create profile "${q}" and use it for ${target}` : "Name the profile", run: async () => {
      if (!q) return;
      const r = await send({ cmd: "new_profile", name: q });
      if (!r.id) return;
      if (profileFor) send({ cmd: "set_tab_profile", id: profileFor, profile: r.id });
      else send({ cmd: "set_space_profile", id: state.active_space, profile: r.id });
    } });
    groups.push({ label: "", items });
  } else {
    const top: Item[] = [];
    if (q) {
      const looksUrl = /^[a-z]+:\/\//i.test(q) || (/^[^\s]+\.[^\s]{2,}/.test(q) && !q.includes(" "));
      top.push({ kind: "url", title: looksUrl ? `Open ${q}` : `Search for "${q}"`, url: q, run: () => (mode === "navigate" ? send({ cmd: "navigate", url: q }) : send({ cmd: "new_tab", url: q, split: mode === "split", side: splitSide })) });
    }
    const actions: Item[] = [];
    if (q) {
      for (const a of ACTIONS) {
        if (a.title.toLowerCase().includes(q.toLowerCase()) || a.keywords.some((k) => k.startsWith(q.toLowerCase()))) actions.push({ kind: "action", id: a.id, title: a.title, run: () => send(a.cmd) });
      }
      if ("archive".startsWith(q.toLowerCase())) actions.push({ kind: "action", id: "open_archive", title: "Open archive", run: onOpenArchive });
      if ("settings".startsWith(q.toLowerCase()) || "preferences".startsWith(q.toLowerCase())) actions.push({ kind: "action", id: "open_settings", title: "Open settings", run: onOpenSettings });
    }
    const tabs: Item[] = results.filter((r) => r.kind === "tab").map((r) => ({ ...r, run: () => send(mode === "split" ? { cmd: "add_split", id: r.id, side: splitSide } : { cmd: "activate_tab", id: r.id }) }));
    const archived: Item[] = results.filter((r) => r.kind === "archived").map((r) => ({ ...r, run: () => send({ cmd: "restore_archived", id: r.id }) }));
    if (top.length) groups.push({ label: "", items: top });
    if (tabs.length) groups.push({ label: "Tabs", items: tabs });
    if (actions.length) groups.push({ label: "Commands", items: actions });
    if (archived.length) groups.push({ label: "Archive", items: archived });
    for (const g of groups) items.push(...g.items);
  }
  const sel = Math.min(selected, Math.max(0, items.length - 1));

  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[data-selected]")?.scrollIntoView({ block: "nearest" });
  }, [sel, results]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[sel];
      if (!item) return;
      if (e.metaKey && item.kind === "url") send({ cmd: "new_tab", url: item.url });
      else item.run();
      onClose();
    }
  };

  let flat = -1;
  return (
    <div className="cmdbar" role="combobox" aria-expanded={items.length > 0}>
      <input
        ref={input}
        aria-label="Command bar"
        value={query}
        placeholder={mode === "new_space" ? "Name the new space" : mode === "new_profile" ? "Name the new profile" : mode === "split" ? `Open ${splitSide === "left" ? "left of" : splitSide === "top" ? "above" : splitSide === "bottom" ? "below" : "beside"} this tab…` : "Search or enter URL"}
        onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
        onKeyDown={onKey}
        spellCheck={false}
      />
      {items.length > 0 && (
        <div ref={list} className="results scroll" role="listbox">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <div className="group">{g.label}</div>}
              {g.items.map((it) => {
                const i = ++flat;
                return (
                  <div key={it.kind + ("id" in it ? it.id : it.title)} className="result" role="option" aria-selected={i === sel} data-selected={i === sel || undefined} onMouseEnter={() => setSelected(i)} onClick={() => { it.run(); onClose(); }}>
                    {it.kind === "action" ? <span className="icon-slot"><CommandIcon width={14} height={14} /></span> : it.kind === "url" ? <span className="icon-slot"><Arrow width={14} height={14} /></span> : <Favicon url={it.url} src={it.favicon} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{it.title}</div>
                      {it.kind !== "action" && it.kind !== "url" && <div className="meta">{it.kind === "archived" ? "Archived · " : it.space ? `${it.space} · ` : ""}{hostOf(it.url)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

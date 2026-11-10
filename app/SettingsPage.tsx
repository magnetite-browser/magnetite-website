// Full-page settings, opened as its own tab (magnetite://ui/settings).
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Archive, CodeIcon, CookieIcon, DevicesIcon, InfoIcon, PaletteIcon, PrivacyIcon, PuzzleIcon, Search, SettingsIcon, SmartFolderIcon, type IconComponent } from "./Icons";
import { IsolationSection } from "./IsolationSection";
import { applyAppearance, send, type ImportSource, type Settings } from "./bridge";
import { About } from "./settings/AboutSection";
import { AppearanceSection } from "./settings/AppearanceSection";
import { Field, Switch, Toggle } from "./settings/fields";
import { SmartFoldersSection } from "./settings/SmartFoldersSection";
import { SyncSection } from "./settings/SyncSection";
import type { Info, SettingsPatch } from "./settings/types";

/** The Chrome Web Store's extensions section. */
const EXTENSION_STORE = "https://chromewebstore.google.com/category/extensions";

type Section = { id: string; label: string; Icon: IconComponent; title: string; intro: string };

const GROUPS: { label: string; sections: Section[] }[] = [
  {
    label: "Browsing",
    sections: [
      { id: "general", label: "General", Icon: SettingsIcon, title: "General", intro: "Magnetite keeps everything on this computer. No account is needed." },
      { id: "appearance", label: "Appearance", Icon: PaletteIcon, title: "Appearance", intro: "How the sidebar and Magnetite's own pages look. Web pages keep their own design." },
      { id: "tabs", label: "Tabs & archive", Icon: Archive, title: "Tabs & archive", intro: "Closing a tab never deletes it. Today tabs you stop using move to the archive on their own." },
      { id: "search", label: "Search", Icon: Search, title: "Search", intro: "Used when what you type in the command bar is not a web address." },
    ],
  },
  {
    label: "Spaces & services",
    sections: [
      { id: "spaces", label: "Isolation", Icon: CookieIcon, title: "Isolation", intro: "Websites remember you with cookies. Isolation decides which spaces and favorites share them, so you can be signed in to two accounts of the same site at once." },
      { id: "smart", label: "Smart folders", Icon: SmartFolderIcon, title: "Smart folders", intro: "Folders that fill themselves with your pull requests, issues or tickets and stay up to date. Magnetite asks the service directly from this computer; tokens stay on this device and are never synced." },
      { id: "extensions", label: "Extensions", Icon: PuzzleIcon, title: "Extensions", intro: "Chrome extensions install from the Chrome Web Store, right here in Magnetite. Choose which ones sit in the sidebar; all of them are in the menu bar under Extensions." },
      { id: "sync", label: "Sync", Icon: DevicesIcon, title: "Sync", intro: "Optional, zero-knowledge sync between your devices, through Magnetite's free server or one you host yourself. No account: a 24-word sync code is the only key." },
    ],
  },
  {
    label: "Magnetite",
    sections: [
      { id: "data", label: "Data & privacy", Icon: PrivacyIcon, title: "Data & privacy", intro: "No telemetry, no Magnetite account. Magnetite talks only to the sites you open, the services you connect (sync, smart folders), GitHub for update checks, and Google's component server, from which Chromium fetches the Widevine module for protected video." },
      { id: "developer", label: "Developer", Icon: CodeIcon, title: "Developer", intro: "Tools for building and debugging websites." },
      { id: "about", label: "About", Icon: InfoIcon, title: "About Magnetite", intro: "A free, open-source browser built around a sidebar, on a Chromium engine, made in Europe." },
    ],
  },
];
const SECTIONS = GROUPS.flatMap((g) => g.sections);

const SEARCH_ENGINES = [
  { label: "DuckDuckGo", template: "https://duckduckgo.com/?q=%s" },
  { label: "Startpage", template: "https://www.startpage.com/do/search?q=%s" },
  { label: "Ecosia", template: "https://www.ecosia.org/search?q=%s" },
  { label: "Brave Search", template: "https://search.brave.com/search?q=%s" },
  { label: "Kagi", template: "https://kagi.com/search?q=%s" },
  { label: "Google", template: "https://www.google.com/search?q=%s" },
];

export function SettingsPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [sectionId, setSectionId] = useState(() => SECTIONS.find((s) => s.id === location.hash.slice(1))?.id ?? "general");
  const reload = useCallback(() => send({ cmd: "get_settings" }).then(setInfo), []);
  useEffect(() => {
    document.title = "Settings";
    void reload();
  }, [reload]);
  // Text size and density of this page, as saved (Appearance previews its draft itself).
  const textScale = info?.settings.appearance.text_scale;
  const density = info?.settings.appearance.density;
  useLayoutEffect(() => {
    if (textScale !== undefined && density !== undefined) applyAppearance({ text_scale: textScale, density });
  }, [textScale, density]);
  if (!info) return <div className="h-full" />;
  const settings = info.settings;
  const update = (patch: SettingsPatch) => {
    const next = { ...settings, ...patch };
    setInfo({ ...info, settings: next });
    send({ cmd: "set_settings", settings: next });
  };
  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0]!;

  return (
    <div className="flex h-full" style={{ background: "var(--bg)" }}>
      <nav className="set-nav scroll w-[232px] shrink-0 border-r border-[var(--line)] p-3">
        <div className="px-2 pb-2 pt-1 text-[16px] font-semibold">Settings</div>
        {GROUPS.map((g) => (
          <div key={g.label} className="mt-3">
            <div className="set-nav-label">{g.label}</div>
            {g.sections.map((s) => (
              <button key={s.id} className="row w-full" data-active={sectionId === s.id || undefined} onClick={() => { setSectionId(s.id); location.hash = s.id; }}>
                <span className="icon-slot" style={{ color: sectionId === s.id ? "var(--accent)" : "var(--muted)" }}><s.Icon width={16} height={16} /></span>
                <span className="title text-left">{s.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <main className="scroll flex-1 min-h-0 px-10 py-8">
        <div className="max-w-[680px]">
          <header className="mb-6 flex items-start gap-4">
            <span className="set-icon"><section.Icon width={22} height={22} /></span>
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{section.title}</h1>
              <p className="mt-1 max-w-[560px] text-[14px] leading-5 text-[var(--muted)]">{section.intro}</p>
            </div>
          </header>
          <div className="space-y-3">
          {sectionId === "general" && (
            <>
              <Field label="Open links from other apps in" hint="Links from Mail, Slack and other apps, when Magnetite is your default browser.">
                <select className="field" value={settings.external_links} onChange={(e) => update({ external_links: e.target.value as Settings["external_links"] })}>
                  <option value="tab">a new tab in the current space</option>
                  <option value="peek">a peek window</option>
                </select>
              </Field>
              <Toggle label="Pop out playing videos" hint="When you leave a tab with a playing video, it continues in a floating picture-in-picture window. Coming back puts it into the page again." checked={settings.auto_pip} onChange={(v) => update({ auto_pip: v })} />
              <Toggle label="Remove trackers from copied links" hint="Copy Link (⇧⌘C) drops tracking parameters such as utm_source and fbclid." checked={settings.strip_trackers} onChange={(v) => update({ strip_trackers: v })} />
            </>
          )}
          {sectionId === "tabs" && (
            <>
              <Field label="Archive Today tabs after" hint="Pinned tabs and favorites are never archived.">
                <select className="field" value={settings.auto_archive_hours} onChange={(e) => update({ auto_archive_hours: Number(e.target.value) })}>
                  <option value={12}>12 hours</option><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option>
                </select>
              </Field>
              <Field label="Suspend inactive tabs after" hint="Suspended tabs keep their place and reload when opened. This is what keeps hundreds of tabs cheap.">
                <select className="field" value={settings.unload_minutes} onChange={(e) => update({ unload_minutes: Number(e.target.value) })}>
                  <option value={10}>10 minutes</option><option value={30}>30 minutes</option><option value={120}>2 hours</option><option value={0}>Never</option>
                </select>
              </Field>
              <Field label="Clicking the archive button opens" hint="The button at the bottom left of the sidebar; resting on it shows both. While a download runs, a click opens downloads.">
                <select className="field" value={settings.library_opens} onChange={(e) => update({ library_opens: e.target.value as Settings["library_opens"] })}>
                  <option value="archive">the archive</option>
                  <option value="downloads">downloads</option>
                </select>
              </Field>
              <Field label="Archive" hint={`${info.archive_count} archived tabs. Search them from the command bar or the archive view in the sidebar.`}>
                <button className="btn" onClick={() => send({ cmd: "reopen_closed" })}>Reopen last archived tab</button>
              </Field>
            </>
          )}
          {sectionId === "appearance" && <AppearanceSection info={info} update={update} reload={reload} />}
          {sectionId === "smart" && <SmartFoldersSection />}
          {sectionId === "search" && (
            <>
              <Field label="Search engine">
                <div className="grid grid-cols-3 gap-2">
                  {SEARCH_ENGINES.map((e) => (
                    <button key={e.template} className="choice" data-active={settings.search_template === e.template || undefined} onClick={() => update({ search_template: e.template })}>{e.label}</button>
                  ))}
                </div>
              </Field>
              <Field label="Custom search address" hint="Use %s where the query goes. Takes effect when it contains %s.">
                <input className="field" defaultValue={settings.search_template} key={settings.search_template} onBlur={(e) => e.target.value.includes("%s") && e.target.value !== settings.search_template && update({ search_template: e.target.value })} spellCheck={false} />
              </Field>
            </>
          )}
          {sectionId === "spaces" && <IsolationSection info={info} reload={reload} />}
          {sectionId === "developer" && (
            <Field label="Developer tools open" hint="F12, ⌥⌘I, or DevTools in the site panel. Docked tools sit next to the page inside the window; the page gets narrower or shorter to make room.">
              <div className="seg">
                {([["right", "Right of the page"], ["bottom", "Below the page"], ["window", "In a separate window"]] as const).map(([v, label]) => (
                  <button key={v} data-on={settings.devtools_dock === v || undefined} onClick={() => update({ devtools_dock: v })}>{label}</button>
                ))}
              </div>
            </Field>
          )}
          {sectionId === "extensions" && (
            <>
              <Field label="In the sidebar" hint="Pinned extensions sit above your tabs. Chromium's own “Pin” on its extensions page works too.">
                {info.extensions.length === 0 ? (
                  <p className="text-[13px] text-[var(--muted)]">No extensions installed yet.</p>
                ) : (
                  <div className="list">
                    {info.extensions.map((e) => {
                      const pinned = settings.pinned_extensions.includes(e.id);
                      return (
                        <label key={e.id} className="list-row">
                          <span className="min-w-0 flex-1 truncate">{e.name}</span>
                          <Switch
                            label={`${e.name} in the sidebar`}
                            checked={pinned}
                            onChange={(v) => {
                              const list = settings.pinned_extensions.filter((x) => x !== e.id).concat(v ? [e.id] : []);
                              setInfo({ ...info, settings: { ...settings, pinned_extensions: list } });
                              send({ cmd: "pin_extension", id: e.id, pinned: v });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </Field>
              <Field label="Install and manage" hint="Removing, turning off and site access live on Chromium's extensions page.">
                <div className="flex gap-2">
                  <button className="btn" onClick={() => send({ cmd: "new_tab", url: EXTENSION_STORE })}>Chrome Web Store</button>
                  <button className="btn" onClick={() => send({ cmd: "new_tab", url: "chrome://extensions" })}>Manage extensions</button>
                </div>
              </Field>
              <Toggle label="Show the Chrome toolbar inside pages" hint="Chromium's own toolbar row above every page, with its extension buttons. Applies to tabs loaded from now on." checked={settings.chrome_toolbar} onChange={(v) => update({ chrome_toolbar: v })} />
            </>
          )}
          {sectionId === "sync" && <SyncSection info={info} reload={reload} />}
          {sectionId === "data" && (
            <>
              <ImportBrowsers />
              <Field label="Where your data lives" hint="The sidebar, archive and settings are in state.json; Chromium's profile data (cookies, cache, extensions) in the cef folder next to it.">
                <code className="block rounded-lg bg-white/5 px-3 py-2 text-[12px] text-[var(--secondary)]">{info.data_dir}</code>
              </Field>
              {info.keychain === "test" && (
                <Field
                  label="Development mode: cookies use a fixed key"
                  hint="This data folder runs with --mock-keychain: Chromium encrypts cookies and saved passwords with its built-in test key instead of one in your macOS Keychain, so any program that can read the folder can read them. Fine while developing; a signed release build uses the Keychain."
                />
              )}
            </>
          )}
          {sectionId === "about" && <About info={info} update={update} />}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Browsers on this computer to import from; every import adds spaces. */
function ImportBrowsers() {
  const [sources, setSources] = useState<ImportSource[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; failed: boolean } | null>(null);
  useEffect(() => {
    send({ cmd: "import_sources" }).then((r) => setSources(r.sources ?? []));
  }, []);
  const run = (source: ImportSource) => {
    setBusy(source.key);
    setResult(null);
    send({ cmd: "import_from", key: source.key })
      .then((r) => setResult({ text: `${source.name}: added ${count(r.spaces, "space")} with ${count(r.tabs, "tab")}.`, failed: false }))
      .catch((e: unknown) => setResult({ text: `${source.name}: ${e instanceof Error ? e.message : String(e)}`, failed: true }))
      .finally(() => setBusy(null));
  };
  return (
    <Field
      label="Import from another browser"
      hint="Adds a space for each profile (for Zen: each workspace) with its open tabs, pinned tabs, tab groups and bookmarks. Your sidebar stays as it is. Passwords, cookies and extensions are not copied, and nothing leaves this computer."
    >
      {sources?.length === 0 && <p className="set-hint">No other browser found on this computer.</p>}
      {sources && sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <button key={s.key} className="btn" disabled={busy !== null} onClick={() => run(s)}>
              {busy === s.key ? `Importing ${s.name}…` : s.name}
            </button>
          ))}
        </div>
      )}
      {result && <p className="set-hint" style={result.failed ? { color: "var(--danger)" } : undefined}>{result.text}</p>}
    </Field>
  );
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

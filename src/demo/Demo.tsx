// The demo's window. The sidebar and the command bar are the app's own
// components (crates/ui/web), running on the state in host.ts. What the app
// draws natively is drawn here to its measurements (crates/engine): the page
// area inset by 8 px with 10 px corners, the ring around the page of a split
// that has the keyboard, the peek with its dimmed backdrop and button column,
// the command bar a sixth down the page area, and the controls on a floating
// video. An extension's popup belongs to the extension; the sample one here
// is made up.
import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { ArrowUpLeft, Columns2, Maximize2, Minus, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { App } from "@app/App";
import { CaptureOverlay } from "@app/CaptureOverlay";
import { CommandBar } from "@app/CommandBar";
import { accentCss, findTab, type TabItem, type UiState } from "@app/bridge";
import { run, store } from "./host";
import { Page } from "./pages";
import { EXTENSIONS } from "./world";

/** A video that left its tab: the picture, and Magnetite's controls over it (`pip.rs` in the engine). */
function FloatingVideo({ tab, playing }: { tab: TabItem; playing: boolean }) {
  return (
    <div className="pip" data-playing={playing || undefined}>
      <div className="footage" />
      <div className="pip-controls">
        <div className="pip-top">
          <button onClick={() => run({ cmd: "activate_tab", id: tab.id })}>
            <ArrowUpLeft size={13} strokeWidth={2.4} />
            Back to Tab
          </button>
          <button aria-label="Minimize">
            <Minus size={13} strokeWidth={2.4} />
          </button>
          <button aria-label="Close" onClick={() => run({ cmd: "picture_in_picture", id: tab.id })}>
            <X size={13} strokeWidth={2.4} />
          </button>
        </div>
        <div className="pip-middle">
          <button aria-label="Back 15 seconds">
            <RotateCcw size={18} strokeWidth={2.2} />
          </button>
          <button className="pip-play" aria-label={playing ? "Pause" : "Play"} onClick={() => run({ cmd: "media", id: tab.id, action: playing ? "pause" : "play" })}>
            {playing ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
          </button>
          <button aria-label="Forward 15 seconds">
            <RotateCw size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** The popup of the sample password manager: what an extension shows is its own. */
function Popup({ id }: { id: string }) {
  const name = EXTENSIONS.find((e) => e.id === id)?.name ?? "Extension";
  return (
    <div className="ext-popup">
      <strong>{name}</strong>
      <p>Logins for mail.example.org</p>
      <ul>
        <li data-on>
          <span>sam@example.org</span>
          <small>Fill</small>
        </li>
        <li>
          <span>studio@example.org</span>
          <small>Fill</small>
        </li>
      </ul>
    </div>
  );
}

/** The tab whose video floats, if one does. */
function floating(ui: UiState): { tab: TabItem; playing: boolean } | null {
  for (const [id, rt] of Object.entries(ui.runtime)) {
    const tab = rt.media?.pip ? findTab(ui, id) : null;
    if (tab && rt.media) return { tab, playing: rt.media.playing };
  }
  return null;
}

/** `onReady` runs once the window is on screen. */
export function Demo({ onReady }: { onReady?: () => void }) {
  const { ui, palette, popup, capturing } = useSyncExternalStore(store.subscribe, store.get);
  useEffect(() => onReady?.(), [onReady]);
  const video = floating(ui);
  const space = ui.sidebar.spaces.find((s) => s.id === ui.active_space);
  const style = {
    background: ui.chrome,
    "--side": `${ui.settings.appearance.sidebar_width}px`,
    "--space": accentCss(space?.accent),
  } as CSSProperties;
  return (
    // Built anew when a scene starts over (store.restart).
    <div className="win" key={store.epoch()} style={style}>
      <div className="lights" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="side">
        <App />
      </div>
      <div className="area">
        <div className="panes">
          {ui.panes.map((id) => {
            const tab = findTab(ui, id);
            if (!tab) return null;
            const focused = ui.panes.length > 1 && id === ui.active_tab;
            const zoom = (ui.runtime[id]?.site?.zoom ?? 100) / 100;
            return (
              <div key={id} className="pane" data-focused={focused || undefined} onPointerDown={() => id !== ui.active_tab && run({ cmd: "activate_tab", id })}>
                {/* The site panel's zoom. */}
                <div className="zoomed" style={{ zoom }}>
                  <Page url={tab.url} title={tab.title} />
                </div>
                {capturing && id === ui.active_tab && (
                  <div className="capture-host">
                    <CaptureOverlay />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {popup && <Popup id={popup} />}
        {video && <FloatingVideo tab={video.tab} playing={video.playing} />}
        {ui.peek && (
          <>
            <div className="dim" onClick={() => run({ cmd: "close_peek" })} />
            <div className="peek">
              <Page url={ui.peek.url} title={ui.peek.title} />
            </div>
            <div className="peek-buttons">
              <button title="Close (Esc)" aria-label="Close" onClick={() => run({ cmd: "close_peek" })}>
                <X size={15} strokeWidth={2.4} />
              </button>
              <button title="Open as tab (⌘O)" aria-label="Open as tab" onClick={() => run({ cmd: "peek_to_tab" })}>
                <Maximize2 size={14} strokeWidth={2.4} />
              </button>
              <button title="Open in split view" aria-label="Open in split view" onClick={() => run({ cmd: "peek_to_split" })}>
                <Columns2 size={15} strokeWidth={2.2} />
              </button>
            </div>
          </>
        )}
        {palette && (
          <>
            <div className="palette-away" onPointerDown={() => run({ cmd: "palette_close" })} />
            <div className="palette">
              <CommandBar
                key={`${palette.mode} ${palette.side ?? ""}`}
                mode={palette.mode}
                state={ui}
                {...(palette.side ? { splitSide: palette.side } : {})}
                onClose={() => run({ cmd: "palette_close" })}
                onOpenArchive={() => window.__magnetite.openArchive()}
                onOpenSettings={() => run({ cmd: "new_tab", url: "magnetite://ui/settings" })}
              />
            </div>
          </>
        )}
      </div>
      {/* The tour's pointer and its label for keys (film.ts moves and fills them). */}
      <div className="pointer" aria-hidden>
        <svg viewBox="0 0 20 20" width="22" height="22">
          <path d="M4 2.5v13.2l3.6-3.2 2.5 5.3 2.2-1-2.5-5.2h4.9z" />
        </svg>
      </div>
      <div className="keys" aria-hidden />
    </div>
  );
}

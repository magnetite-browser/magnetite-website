// Site panel: identity and connection, quick tools for the page (capture,
// share, developer tools), then this site's permissions, zoom and sound.
// Opens under the address row; Esc or a click outside closes it.
import { useEffect, useRef, useState } from "react";
import { useDismiss } from "./dismiss";
import { Favicon } from "./Favicon";
import { CaptureIcon, CodeIcon, Minus, Plus, ShareIcon, Speaker, SpeakerOff } from "./Icons";
import { hostOf, onSiteDataCleared, send, ZOOM_STEPS, type ClearReport, type PermissionKind, type PermissionRow, type PermissionValue, type TabItem, type TabRuntime, type UiState } from "./bridge";

const PERMISSION_LABEL: Record<PermissionKind, string> = {
  camera: "Camera",
  microphone: "Microphone",
  location: "Location",
  notifications: "Notifications",
  popups: "Pop-ups and redirects",
  clipboard: "Clipboard",
};

/** Pop-ups have no "ask" state in Chromium. */
const CHOICES = (kind: PermissionKind): PermissionValue[] => (kind === "popups" ? ["allow", "block"] : ["allow", "ask", "block"]);

function Permissions({ pageHost }: { pageHost: string }) {
  const [rows, setRows] = useState<PermissionRow[] | null>(null);
  useEffect(() => {
    send({ cmd: "site_permissions" }).then((r) => setRows(r.rows ?? []));
  }, []);
  const set = (row: PermissionRow, value: PermissionValue) => {
    send({ cmd: "set_permission", origin: row.origin, kind: row.kind, value });
    setRows((rs) => rs?.map((r) => (r === row ? { ...r, value } : r)) ?? null);
  };
  return (
    <div className="panel-group">
      <div className="panel-label">Permissions</div>
      {rows === null && <div className="panel-note">Loading…</div>}
      {rows?.length === 0 && <div className="panel-note">This site has not asked for any permissions.</div>}
      {rows?.map((row) => {
        const via = hostOf(row.origin) !== pageHost ? hostOf(row.origin) : null;
        return (
          <div key={row.kind + row.origin} className="panel-row perm">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{PERMISSION_LABEL[row.kind]}</span>
              {via && <span className="block truncate text-[11.5px] text-[var(--muted)]">via {via}</span>}
            </span>
            <span className="seg sm" role="radiogroup" aria-label={PERMISSION_LABEL[row.kind]}>
              {CHOICES(row.kind).map((v) => (
                <button key={v} role="radio" aria-checked={row.value === v} data-on={row.value === v || undefined} onClick={() => set(row, v)}>
                  {v === "allow" ? "Allow" : v === "ask" ? "Ask" : "Block"}
                </button>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** "Clear cookies and site storage": confirm with the exact scope, then report each part. */
function ClearData({ profileName }: { profileName: string | null }) {
  const [step, setStep] = useState<"idle" | "confirm" | "working">("idle");
  const [scope, setScope] = useState<{ domain: string; origins: string[] } | null>(null);
  const [report, setReport] = useState<ClearReport | null>(null);
  useEffect(() => onSiteDataCleared((r) => { setReport(r); setStep("idle"); }), []);
  const ask = async () => {
    setReport(null);
    const r = await send({ cmd: "site_data_scope" });
    setScope(r.domain ? r : null);
    setStep("confirm");
  };
  const clear = () => { setStep("working"); send({ cmd: "clear_site_data" }); };
  if (step === "confirm" && scope?.domain) {
    return (
      <div className="confirm">
        <p>Remove the cookies of <b>{scope.domain}</b> and its subdomains{profileName ? <> in profile <b>{profileName}</b></> : null}, and the site storage of:</p>
        <ul>{scope.origins.map((o) => <li key={o}>{hostOf(o)}</li>)}</ul>
        <p className="text-[var(--muted)]">You will be signed out. Storage of parts of the site you did not open this session may remain.</p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={() => setStep("idle")}>Cancel</button>
          <button className="btn" data-danger onClick={clear}>Clear</button>
        </div>
      </div>
    );
  }
  const failed = report && (report.cookies === null || report.failed_origins.length > 0);
  return (
    <>
      <button className="panel-row w-full" disabled={step === "working"} onClick={ask}>
        <span className="flex-1 text-left">{step === "working" ? "Clearing…" : "Clear cookies and site storage…"}</span>
      </button>
      {report && (
        <div className="panel-note" role="status" style={{ color: failed ? "var(--warn)" : undefined }}>
          {report.cookies === null ? "Cookies could not be removed" : `Cookies: ${report.cookies} removed`}
          {" · "}Storage: {report.origins.length - report.failed_origins.length} of {report.origins.length} origins
          {failed && <> · <button className="link" onClick={ask}>Retry</button></>}
        </div>
      )}
    </>
  );
}

function connection(item: TabItem, rt: TabRuntime | undefined): { text: string; tone?: "warn" | "bad" } {
  if (item.url.startsWith("magnetite://")) return { text: "Magnetite page" };
  if (item.url.startsWith("file://")) return { text: "Local file" };
  if (!rt?.site) return { text: "Loading…" };
  if (rt.site.cert_error) return { text: "Certificate problem", tone: "bad" };
  if (rt.site.secure === false) return { text: "Not encrypted", tone: "warn" };
  if (rt.site.secure) return { text: "Encrypted connection" };
  return { text: "Unavailable" };
}

export function SitePanel({ state, item, rt, onClose }: { state: UiState; item: TabItem; rt: TabRuntime | undefined; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useDismiss(onClose);
  useEffect(() => box.current?.focus(), []);
  const internal = item.url.startsWith("magnetite://");
  const conn = connection(item, rt);
  const zoom = rt?.site?.zoom ?? 100;
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom) : [...ZOOM_STEPS].reverse().find((z) => z < zoom);
    if (next) send({ cmd: "set_zoom", percent: next });
  };
  const space = state.sidebar.spaces.find((s) => s.id === state.active_space);
  const profileId = item.profile_id ?? space?.profile_id;
  const profile = state.sidebar.profiles.find((p) => p.id === profileId);

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div ref={box} tabIndex={-1} className="site-panel no-drag" role="dialog" aria-label={`Site controls for ${hostOf(item.url)}`}>
        <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
          <Favicon url={item.url} src={rt?.favicon} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{hostOf(item.url)}</div>
            <div className="truncate text-[12px]" style={{ color: conn.tone === "bad" ? "var(--danger)" : conn.tone === "warn" ? "var(--warn)" : "var(--muted)" }}>
              {conn.text}{profile && !profile.is_default ? ` · Profile: ${profile.name}` : ""}
            </div>
          </div>
        </div>

        <div className="panel-tools">
          {!internal && (
            <button title="Capture (⇧⌘2)" onClick={() => { send({ cmd: "capture_start" }); onClose(); }}>
              <CaptureIcon width={16} height={16} />
              <span>Capture</span>
              <kbd>⇧⌘2</kbd>
            </button>
          )}
          <button title="Share" onClick={(e) => { send({ cmd: "share", id: item.id, x: e.clientX, y: e.clientY }); onClose(); }}>
            <ShareIcon width={16} height={16} />
            <span>Share</span>
          </button>
          {!internal && (
            <button title="Developer tools (⌥⌘I)" onClick={() => { send({ cmd: "toggle_devtools" }); onClose(); }}>
              <CodeIcon width={16} height={16} />
              <span>Developer tools</span>
              <kbd>⌥⌘I</kbd>
            </button>
          )}
        </div>

        {!internal && <Permissions pageHost={hostOf(item.url)} />}

        {!internal && (
          <div className="panel-group">
            <div className="panel-label">This site</div>
            <div className="panel-row">
              <span className="flex-1">Zoom</span>
              <button className="ib sm" aria-label="Zoom out" disabled={zoom <= ZOOM_STEPS[0]!} onClick={() => step(-1)}><Minus width={14} height={14} /></button>
              <button className="zoom-value" aria-label="Reset zoom to 100%" title="Reset to 100%" onClick={() => send({ cmd: "set_zoom", percent: 100 })}>{zoom}%</button>
              <button className="ib sm" aria-label="Zoom in" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]!} onClick={() => step(1)}><Plus width={14} height={14} /></button>
            </div>
            <button className="panel-row w-full" disabled={!rt?.loaded} onClick={() => send({ cmd: "set_muted", id: item.id, muted: !rt?.muted })}>
              <span className="flex-1 text-left">{rt?.muted ? "Unmute site" : "Mute site"}</span>
              {rt?.muted ? <SpeakerOff width={15} height={15} /> : <Speaker width={15} height={15} />}
            </button>
            <ClearData profileName={profile && !profile.is_default ? profile.name : null} />
          </div>
        )}
      </div>
    </>
  );
}

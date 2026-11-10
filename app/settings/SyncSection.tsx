// Settings → Sync: start or join a chain, show the sync code, leave or delete.
import { useState } from "react";
import { send } from "../bridge";
import { useArmed } from "../dismiss";
import { Field } from "./fields";
import type { Info } from "./types";

/** Magnetite's own sync server: free to use, run by StackForge (docs/adr/0008-public-sync-server.md). */
const PUBLIC_SYNC = "https://sync.magnetitebrowser.org";

export function SyncSection({ info, reload }: { info: Info; reload: () => void }) {
  const sy = info.settings.sync;
  const ownAtStart = !!sy.server_url && sy.server_url !== PUBLIC_SYNC;
  const [own, setOwn] = useState(ownAtStart);
  const [custom, setCustom] = useState(ownAtStart ? sy.server_url : "");
  const server = own ? custom.trim() : PUBLIC_SYNC;
  const [invite, setInvite] = useState("");
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const { armed, arm } = useArmed(4000);
  // The code is shown on demand, and right away after starting a new chain.
  const [code, setCode] = useState<string[] | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const showCode = async () => {
    const r = await send({ cmd: "sync_code" });
    setCode(r.words ? r.words.split(" ") : null);
  };
  const afterJob = (then?: () => void) => setTimeout(() => { setBusy(false); reload(); then?.(); }, 1500);
  const when = sy.last_sync_at ? new Date(sy.last_sync_at * 1000).toLocaleString() : "not yet";
  const wordCount = words.trim().split(/\s+/).filter(Boolean).length;

  if (sy.enabled && info.sync_signed_in) {
    return (
      <div className="space-y-3">
        <div className="set-card">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: sy.last_error ? "var(--danger)" : "#7fc98f" }} />
            <div className="min-w-0 flex-1">
              <div className="truncate">Syncing with <b>{sy.server_url}</b></div>
              <div className="hint" style={{ marginTop: 2 }}>Last sync {when}</div>
              {sy.last_error && <div className="hint" style={{ color: "var(--danger)" }}>{sy.last_error}</div>}
            </div>
            <button className="btn" onClick={() => { send({ cmd: "sync_now" }); setTimeout(reload, 2000); }}>Sync now</button>
          </div>
        </div>

        <Field label="Your sync code" hint="Enter these 24 words on another computer to sync it. They are the only key to your synced data: the server cannot read it, and nobody can recover the words for you.">
          {code ? (
            <div className="rounded-xl border p-4" style={{ borderColor: justCreated ? "var(--accent)" : "var(--line)" }}>
              {justCreated && <p className="mb-3 text-[14px]" style={{ color: "var(--accent)" }}>Write these words down or keep them in your password manager now.</p>}
              <ol className="grid grid-cols-4 gap-x-4 gap-y-1.5 font-mono text-[13px]">
                {code.map((w, i) => <li key={i}><span className="inline-block w-6 text-right text-[var(--muted)]">{i + 1}</span> {w}</li>)}
              </ol>
              <div className="mt-4 flex gap-2">
                <button className="btn" onClick={() => { navigator.clipboard?.writeText(code.join(" ")); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy words"}</button>
                <button className="btn" onClick={() => { setCode(null); setJustCreated(false); }}>Hide</button>
              </div>
            </div>
          ) : (
            <button className="btn" onClick={showCode}>Show sync code</button>
          )}
        </Field>

        <Field label="Stop syncing" hint="Leaving keeps the chain and your other devices as they are. Deleting removes the chain and all its data from the server for every device.">
          <div className="flex gap-2">
            <button className="btn" onClick={() => { send({ cmd: "sync_leave" }); setCode(null); afterJob(); }}>Leave on this device</button>
            <button className="btn" data-danger={armed === "del" || undefined} onClick={() => arm("del", () => { send({ cmd: "sync_delete_chain" }); setCode(null); afterJob(); })}>{armed === "del" ? "Click again to delete it from the server" : "Delete sync chain…"}</button>
          </div>
        </Field>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Field
        label="Server"
        hint={own
          ? "Your own magnetite-sync server. github.com/magnetite-browser/magnetite-sync shows how to run one."
          : "Free to use, run by StackForge on servers in Germany. Starting a chain needs no account."}
      >
        <div className="grid grid-cols-2 gap-2">
          <button className="choice" data-active={!own || undefined} onClick={() => setOwn(false)}>Magnetite Sync</button>
          <button className="choice" data-active={own || undefined} onClick={() => setOwn(true)}>Your own server</button>
        </div>
        {own && <input className="field mt-3" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="https://sync.example.org" spellCheck={false} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <div className="set-card">
          <div className="font-semibold">First device</div>
          <p className="hint" style={{ marginTop: 4 }}>Magnetite creates a sync code for you to use on your other devices.</p>
          {own && <input className="field mt-3" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invite code, if the server needs one" spellCheck={false} />}
          <button className="btn mt-3" disabled={busy || !server} onClick={() => { setBusy(true); send({ cmd: "sync_create", server, invite: (own && invite) || undefined }); afterJob(() => { setJustCreated(true); void showCode(); }); }}>Start syncing</button>
        </div>
        <div className="set-card">
          <div className="font-semibold">Another device</div>
          <p className="hint" style={{ marginTop: 4 }}>Enter the 24 words from Settings → Sync on a device that already syncs.</p>
          <textarea className="field mt-3 h-[72px] resize-none py-2 font-mono text-[12px]" value={words} onChange={(e) => setWords(e.target.value)} placeholder="24 words" spellCheck={false} autoComplete="off" />
          <button className="btn mt-3" disabled={busy || !server || wordCount !== 24} onClick={() => { setBusy(true); send({ cmd: "sync_join", server, words }); setWords(""); afterJob(); }}>{wordCount > 0 && wordCount !== 24 ? `${wordCount} of 24 words` : "Join"}</button>
        </div>
      </div>
      {sy.last_error && <div className="hint" style={{ color: "var(--danger)" }}>{sy.last_error}</div>}
      <p className="hint">Zero knowledge: the server only ever sees an anonymous key and encrypted data padded to fixed sizes. No email, no password, no device names, no content. Chains nobody uses for 400 days are deleted.</p>
    </div>
  );
}

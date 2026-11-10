// Archive and Downloads share one footer button, so the spaces stay centred.
// Resting on it grows a small labelled menu upwards with both; a plain click
// opens the view chosen in Settings (`opens`), or Downloads while something
// downloads (a ring shows the progress).
import { useEffect, useState } from "react";
import { Archive, DownloadIcon } from "./Icons";
import { IS_MAC, onDownloads, type DownloadEntry, type LibraryView } from "./bridge";

const DOWNLOADS_KEY = IS_MAC ? "⌥⌘L" : "Ctrl+J";

export function LibraryButton({ opens, onOpen }: { opens: LibraryView; onOpen: (view: LibraryView) => void }) {
  const [items, setItems] = useState<DownloadEntry[]>([]);
  useEffect(() => onDownloads(setItems), []);
  const running = items.filter((d) => d.status === "in_progress");
  const sized = running.filter((d) => d.total);
  const total = sized.reduce((n, d) => n + (d.total ?? 0), 0);
  // Several downloads: one ring for all of them; unknown sizes spin.
  const share = sized.length === running.length && total > 0 ? sized.reduce((n, d) => n + d.received, 0) / total : null;
  const busy = running.length > 0;
  const label = !busy ? "Archive and downloads" : running.length === 1 ? `Downloading ${running[0]!.name}` : `Downloading ${running.length} files`;
  return (
    <div className="library">
      <button className="ib lg" aria-label={label} onClick={() => onOpen(busy ? "downloads" : opens)}>
        {busy ? (
          <>
            <DownloadIcon width={18} height={18} />
            <svg className="download-ring" data-spin={share === null || undefined} viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r="14" pathLength={100} strokeDasharray={`${share === null ? 25 : Math.max(3, share * 100)} 100`} />
            </svg>
          </>
        ) : (
          <span className="library-mini" aria-hidden>
            <Archive />
            <DownloadIcon />
          </span>
        )}
      </button>
      <div className="library-pop" role="menu">
        <button role="menuitem" onClick={() => onOpen("downloads")}>
          <DownloadIcon width={18} height={18} />
          Downloads
          <span className="hint">{busy ? (share === null ? `${running.length} running` : `${Math.round(share * 100)} %`) : DOWNLOADS_KEY}</span>
        </button>
        <button role="menuitem" onClick={() => onOpen("archive")}>
          <Archive width={18} height={18} />
          Archive
        </button>
      </div>
    </div>
  );
}

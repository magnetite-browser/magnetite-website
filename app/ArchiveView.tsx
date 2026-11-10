import { useEffect, useState } from "react";
import { Favicon } from "./Favicon";
import { Back } from "./Icons";
import { hostOf, send, type ArchiveItem } from "./bridge";
import { groupByDay } from "./groupByDay";

export function ArchiveView({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      send({ cmd: "archive", query }).then((r) => {
        if (!cancelled) setItems(r.items ?? []);
      });
    }, query ? 120 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const groups = groupByDay(items ?? [], (it) => it.archived_at);

  return (
    <div className="flex flex-col h-full">
      <div className="titlebar-drag h-[38px] shrink-0" />
      <div className="flex h-9 shrink-0 items-center gap-1 px-2">
        <button className="ib no-drag" onClick={onClose} title="Back"><Back /></button>
        <div className="font-semibold">Archive</div>
      </div>
      <div className="shrink-0 px-2 pb-1 no-drag">
        <input className="field" placeholder="Search archived tabs" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus aria-label="Search archived tabs" />
      </div>
      <div className="scroll flex-1 min-h-0 px-2 pb-3 no-drag">
        {groups.map(([day, list]) => (
          <div key={day}>
            <div className="section"><span>{day}</span></div>
            {list.map((it) => (
              <button key={it.id} className="row w-full" onClick={() => send({ cmd: "restore_archived", id: it.id })} title={it.url}>
                <Favicon url={it.url} />
                <span className="title text-left">{it.title || hostOf(it.url)}</span>
                {it.space && <span className="meta max-w-[72px] truncate">{it.space}</span>}
              </button>
            ))}
          </div>
        ))}
        {items && items.length === 0 && <div className="px-2 py-6 text-[var(--muted)]">{query ? "No matching archived tabs." : "Nothing archived yet."}</div>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

/** A line between groups, or an action. */
export type MenuItem =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      onClick: () => void;
      danger?: boolean;
      /** Ask first: the first click shows this label in place, the second runs `onClick`. */
      confirm?: string;
    };

/** The line between groups of a menu. */
export const SEPARATOR: MenuItem = { separator: true };

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);
  const [armed, setArmed] = useState<number | null>(null);
  const height = items.reduce((h, it) => h + (it.separator ? 9 : 28), 8);
  const left = Math.min(x, window.innerWidth - 208);
  const top = Math.min(y, window.innerHeight - height - 8);
  return (
    <div className="menu no-drag" style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}>
      {items.map((it, i) =>
        it.separator ? (
          <hr key={i} />
        ) : (
          <button
            key={i}
            data-danger={it.danger || undefined}
            onClick={() => {
              if (it.confirm && armed !== i) {
                setArmed(i);
                return;
              }
              it.onClick();
              onClose();
            }}
          >
            {armed === i ? it.confirm : it.label}
          </button>
        ),
      )}
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./primitives";

export function Modal({
  title,
  onClose,
  closable = true,
  children,
  footer,
  tone,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  /** False while an irreversible operation is in flight. */
  closable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "warn";
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closableRef = useRef(closable);
  closableRef.current = closable;

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])");
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closableRef.current) onClose();
      if (e.key !== "Tab" || !el) return;
      const nodes = el.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select, textarea, [href]",
      );
      if (!nodes.length) return;
      const a = nodes[0];
      const b = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && closable && onClose()}>
      <div
        ref={ref}
        className={`modal ${tone === "warn" ? "modal-warn" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ maxWidth: width }}
      >
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          {closable && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog" data-close>
              <Icon name="x" />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

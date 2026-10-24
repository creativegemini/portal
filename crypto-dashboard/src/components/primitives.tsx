import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ---------- Icons: wayfinding and status only ---------- */

const paths: Record<string, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  strategies: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  power: (
    <>
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
      <path d="M12 2v10" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  warn: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  unplug: (
    <>
      <path d="m19 5 3-3M2 22l3-3M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4zM7.5 13.5 10 11M10.5 16.5 13 14M12 6l6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0z" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6 9 17l-5-5" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

/* ---------- Live number: neutral flash whenever the value changes ---------- */

export function LiveNumber({
  value,
  children,
  className = "",
}: {
  value: number;
  children: ReactNode;
  className?: string;
}) {
  const prev = useRef(value);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setTick((t) => t + 1);
    }
  }, [value]);
  return (
    <span key={tick} className={`num ${tick > 0 ? "flash" : ""} ${className}`}>
      {children}
    </span>
  );
}

/* ---------- Skeleton block ---------- */

export function Sk({ w, h = 12, style }: { w: number | string; h?: number; style?: CSSProperties }) {
  return <span className="sk" style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}

/* ---------- Two-click confirm button ---------- */

/** First click arms it (label changes to the outcome), second click runs it. Disarms after 4s. */
export function ConfirmButton({
  idle,
  armed,
  busy,
  onConfirm,
  className = "",
  ariaLabel,
  disabled,
}: {
  idle: ReactNode;
  armed: string;
  busy: string;
  onConfirm: () => Promise<unknown>;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "armed" | "busy">("idle");
  useEffect(() => {
    if (phase !== "armed") return;
    const id = setTimeout(() => setPhase("idle"), 4000);
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <button
      type="button"
      className={`btn btn-sm ${phase === "armed" ? "btn-warn" : "btn-ghost"} ${className}`}
      aria-label={phase === "idle" ? ariaLabel : undefined}
      disabled={disabled || phase === "busy"}
      onBlur={() => phase === "armed" && setPhase("idle")}
      onClick={async () => {
        if (phase === "idle") return setPhase("armed");
        if (phase === "armed") {
          setPhase("busy");
          await onConfirm();
          setPhase("idle");
        }
      }}
    >
      {phase === "idle" ? idle : phase === "armed" ? armed : busy}
    </button>
  );
}

/* ---------- Panel ---------- */

export function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || meta) && (
        <header className="panel-head">
          <h2 className="panel-title">{title}</h2>
          {meta && <div className="panel-meta">{meta}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ message, action }: { message: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{message}</p>
      {action}
    </div>
  );
}

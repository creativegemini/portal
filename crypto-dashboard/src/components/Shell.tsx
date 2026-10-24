import { useState } from "react";
import { fmtAgo, fmtTime } from "../lib/format";
import { useNow, useStore } from "../lib/store";
import type { Page, Scenario } from "../lib/types";
import { Icon, type IconName } from "./primitives";

const NAV: { page: Page; label: string; icon: IconName }[] = [
  { page: "overview", label: "Overview", icon: "overview" },
  { page: "strategies", label: "Strategies", icon: "strategies" },
  { page: "history", label: "Trade History", icon: "history" },
  { page: "settings", label: "Settings", icon: "settings" },
];

export function Sidebar({ page, onKill }: { page: Page; onKill: () => void }) {
  const s = useStore();
  const running = s.strategies.filter((x) => x.status === "running").length;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ◆
        </span>
        <span className="brand-name">CreativeGemini Crypto</span>
      </div>

      <nav className="nav" aria-label="Main">
        <div className="eyebrow nav-label">Navigation</div>
        {NAV.map((n) => (
          <a
            key={n.page}
            href={`#/${n.page}`}
            className={`nav-item ${page === n.page ? "active" : ""}`}
            aria-current={page === n.page ? "page" : undefined}
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>

      <div className="engine-status">
        <div className="eyebrow">Trading engine</div>
        {s.connected ? (
          <div className="engine-line">
            <span className="dot dot-live" aria-hidden="true" />
            Connected <span className="num muted">· {s.latencyMs} ms</span>
          </div>
        ) : (
          <div className="engine-line warn-text">
            <span className="dot dot-warn" aria-hidden="true" />
            Disconnected
          </div>
        )}
      </div>

      <div className="kill-zone">
        <div className="eyebrow">Emergency</div>
        <button type="button" className="kill-btn" onClick={onKill}>
          <Icon name="power" />
          <span className="kill-label">Kill switch</span>
        </button>
        <div className="kill-scope">
          Closes <span className="num">{s.positions.length}</span> position{s.positions.length === 1 ? "" : "s"} · pauses{" "}
          <span className="num">{running}</span> strateg{running === 1 ? "y" : "ies"}
        </div>
      </div>
    </aside>
  );
}

export function ConnectionBanner() {
  const s = useStore();
  const now = useNow();
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (s.connected) return null;

  return (
    <div className="conn-banner" role="alert">
      <Icon name="unplug" size={18} />
      <div className="conn-text">
        <strong>
          Not connected to trading engine — last update <span className="num">{fmtTime(s.lastUpdate)}</span>{" "}
          <span className="num conn-ago">({fmtAgo(now - s.lastUpdate)})</span>
        </strong>
        <span>
          {msg ??
            "Prices and P&L below are frozen at that time. Closing positions and changing strategies won't work until the connection is back."}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        disabled={checking}
        onClick={async () => {
          setChecking(true);
          const r = await s.retryConnection();
          setChecking(false);
          setMsg(r.ok ? null : r.error ?? null);
        }}
      >
        {checking ? "Reconnecting…" : "Retry connection"}
      </button>
    </div>
  );
}

export function Toasts() {
  const s = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === "warn" ? "toast-warn" : ""}`}>
          {t.tone === "warn" && <Icon name="warn" />}
          <div>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
          <button type="button" className="icon-btn" onClick={() => s.dismissToast(t.id)} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Floating panel for reviewers to force each designed state. Not part of the product UI. */
export function ReviewPanel() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const sc = s.scenario;

  const Seg = <K extends keyof Scenario>({
    k,
    label,
    options,
  }: {
    k: K;
    label: string;
    options: [Scenario[K], string][];
  }) => (
    <div className="seg-row">
      <span>{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={l}
            type="button"
            className={sc[k] === v ? "on" : ""}
            aria-pressed={sc[k] === v}
            onClick={() => s.setScenario({ [k]: v } as Partial<Scenario>)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`review ${open ? "open" : ""}`}>
      {open && (
        <div className="review-panel">
          <div className="review-head">
            <strong>Review states</strong>
            <span>Design review only — not in the product</span>
          </div>
          <Seg k="connection" label="Engine" options={[["connected", "Connected"], ["disconnected", "Disconnected"]]} />
          <Seg k="forceLoading" label="Data" options={[[false, "Loaded"], [true, "Loading"]]} />
          <Seg k="empty" label="Account" options={[[false, "Sample data"], [true, "No strategies"]]} />
          <Seg k="killOutcome" label="Kill switch" options={[["success", "Succeeds"], ["partial", "Partly fails"]]} />
        </div>
      )}
      <button type="button" className="review-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Hide states" : "Review states"}
      </button>
    </div>
  );
}

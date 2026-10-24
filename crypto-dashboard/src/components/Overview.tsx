import type { ReactNode } from "react";
import { fmtPct, fmtPrice, fmtQty, fmtUsd, notional, pnlClass, pnlPct, unrealized } from "../lib/format";
import { useStore } from "../lib/store";
import type { Position } from "../lib/types";
import { ConfirmButton, EmptyState, Icon, LiveNumber, Panel, Sk } from "./primitives";

/* ---------- Alerts ---------- */

interface Alert {
  id: string;
  title: string;
  body: ReactNode;
  href?: string;
}

export function Alerts() {
  const s = useStore();
  if (s.loading) return null;
  const name = (id: string) => s.strategies.find((x) => x.id === id)?.name ?? "Unknown strategy";

  const alerts: Alert[] = [];
  for (const p of s.positions) {
    const pct = pnlPct(p);
    if (pct <= -0.05) {
      alerts.push({
        id: `dd-${p.id}`,
        title: `${p.pair} ${p.side} position in drawdown`,
        body: (
          <>
            Unrealized loss of{" "}
            <span className="num loss">
              {fmtUsd(unrealized(p))} ({fmtPct(pct)})
            </span>{" "}
            · {name(p.strategyId)} · stop loss at{" "}
            <span className="num">
              {fmtPct(-(s.strategies.find((x) => x.id === p.strategyId)?.params.stopLossPct ?? 0))}
            </span>
          </>
        ),
      });
    }
  }
  for (const st of s.strategies) {
    if (st.status === "error") {
      alerts.push({
        id: `err-${st.id}`,
        title: `${st.name} stopped by the engine`,
        body: st.error,
        href: "#/strategies",
      });
    } else if (st.status === "running" && st.realizedPnl < -500) {
      alerts.push({
        id: `under-${st.id}`,
        title: `${st.name} underperforming`,
        body: (
          <>
            Running at a realized loss of <span className="num loss">{fmtUsd(st.realizedPnl)}</span> ·{" "}
            {st.pairs.join(", ")}
          </>
        ),
        href: "#/strategies",
      });
    }
  }
  const visible = alerts.filter((a) => !s.dismissedAlerts.includes(a.id));
  if (!visible.length) return null;

  return (
    <div className="alerts" aria-label="Risk alerts">
      {visible.map((a) => (
        <div key={a.id} className="alert">
          <Icon name="warn" />
          <div className="alert-text">
            <div className="alert-title">{a.title}</div>
            <div className="alert-body">{a.body}</div>
          </div>
          {a.href && (
            <a className="btn btn-sm btn-ghost" href={a.href}>
              View strategy
            </a>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label={`Dismiss alert: ${a.title}`}
            onClick={() => s.dismissAlert(a.id)}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Stat tiles ---------- */

function Tile({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="tile">
      <div className="eyebrow">{label}</div>
      <div className="tile-value">{children}</div>
      <div className="tile-sub">{sub}</div>
    </div>
  );
}

export function StatTiles() {
  const s = useStore();
  if (s.loading) {
    return (
      <div className="tiles" aria-busy="true">
        {["Balance", "Today's P&L", "Win rate", "Open positions"].map((l) => (
          <div key={l} className="tile">
            <div className="eyebrow">{l}</div>
            <div className="tile-value">
              <Sk w={l === "Win rate" || l === "Open positions" ? 72 : 170} h={24} />
            </div>
            <div className="tile-sub">
              <Sk w={110} h={11} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const trades = s.strategies.reduce((a, x) => a + x.trades, 0);
  const wins = s.strategies.reduce((a, x) => a + x.wins, 0);
  const exposure = s.positions.reduce((a, p) => a + notional(p), 0);
  const stratCount = new Set(s.positions.map((p) => p.strategyId)).size;
  const todayPct = s.todayPnl / s.startOfDayEquity;

  return (
    <div className={`tiles ${s.connected ? "" : "stale"}`}>
      <Tile
        label="Balance"
        sub={
          <>
            Unrealized{" "}
            <LiveNumber value={s.unrealizedTotal} className={pnlClass(s.unrealizedTotal)}>
              {fmtUsd(s.unrealizedTotal, { sign: true })}
            </LiveNumber>
          </>
        }
      >
        <LiveNumber value={s.equityNow}>{fmtUsd(s.equityNow)}</LiveNumber>
      </Tile>
      <Tile
        label="Today's P&L"
        sub={<span className={`num ${pnlClass(s.todayPnl)}`}>{fmtPct(todayPct, { sign: true })}</span>}
      >
        <LiveNumber value={s.todayPnl} className={pnlClass(s.todayPnl)}>
          {fmtUsd(s.todayPnl, { sign: true })}
        </LiveNumber>
      </Tile>
      <Tile
        label="Win rate"
        sub={
          trades ? (
            <>
              <span className="num">{wins}</span> of <span className="num">{trades}</span> closed trades
            </>
          ) : (
            "No closed trades yet"
          )
        }
      >
        <span className="num">{trades ? fmtPct(wins / trades, { decimals: 1 }) : "—"}</span>
      </Tile>
      <Tile
        label="Open positions"
        sub={
          s.positions.length ? (
            <>
              <span className="num">{fmtUsd(exposure)}</span> exposure · {stratCount} strateg
              {stratCount === 1 ? "y" : "ies"}
            </>
          ) : (
            "Nothing at risk"
          )
        }
      >
        <span className="num">{s.positions.length}</span>
      </Tile>
    </div>
  );
}

/* ---------- Positions table ---------- */

const COLS = [
  { key: "pair", label: "Pair", num: false, sk: 84 },
  { key: "side", label: "Side", num: false, sk: 44 },
  { key: "size", label: "Size", num: true, sk: 40 },
  { key: "entry", label: "Entry", num: true, sk: 84 },
  { key: "mark", label: "Mark", num: true, sk: 84 },
  { key: "upnl", label: "Unrealized P&L", num: true, sk: 74 },
  { key: "pct", label: "P&L %", num: true, sk: 52 },
  { key: "strategy", label: "Strategy", num: false, sk: 110 },
] as const;

export function PositionsTable({
  positions,
  showStrategy = true,
  loading,
  emptyMessage,
  emptyAction,
}: {
  positions: Position[];
  showStrategy?: boolean;
  loading?: boolean;
  emptyMessage: ReactNode;
  emptyAction?: ReactNode;
}) {
  const s = useStore();
  const cols = COLS.filter((c) => showStrategy || c.key !== "strategy");
  const name = (id: string) => s.strategies.find((x) => x.id === id)?.name ?? "—";

  if (!loading && positions.length === 0) return <EmptyState message={emptyMessage} action={emptyAction} />;

  const total = positions.reduce((a, p) => a + unrealized(p), 0);

  return (
    <div className="table-scroll">
      <table className={`table ${s.connected ? "" : "stale"}`} aria-busy={loading || undefined}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.num ? "r" : ""} scope="col">
                {c.label}
              </th>
            ))}
            <th className="r" scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c.key} className={c.num ? "r" : ""}>
                      <Sk w={c.sk} h={12} />
                    </td>
                  ))}
                  <td className="r">
                    <Sk w={56} h={12} />
                  </td>
                </tr>
              ))
            : positions.map((p) => {
                const u = unrealized(p);
                const pct = pnlPct(p);
                return (
                  <tr key={p.id}>
                    <td className="pair">{p.pair}</td>
                    <td>
                      <span className={`side side-${p.side}`}>{p.side.toUpperCase()}</span>
                    </td>
                    <td className="r num">{fmtQty(p.size)}</td>
                    <td className="r num muted">{fmtPrice(p.entry)}</td>
                    <td className="r">
                      <LiveNumber value={p.mark}>{fmtPrice(p.mark)}</LiveNumber>
                    </td>
                    <td className="r">
                      <LiveNumber value={u} className={pnlClass(u)}>
                        {fmtUsd(u, { sign: true })}
                      </LiveNumber>
                    </td>
                    <td className="r">
                      <LiveNumber value={pct} className={pnlClass(pct)}>
                        {fmtPct(pct, { sign: true })}
                      </LiveNumber>
                    </td>
                    {showStrategy && <td className="muted-strong">{name(p.strategyId)}</td>}
                    <td className="r actions">
                      <ConfirmButton
                        idle={
                          <>
                            <Icon name="x" size={14} /> Close
                          </>
                        }
                        armed="Close at market"
                        busy="Closing…"
                        ariaLabel={`Close ${p.pair} ${p.side} position`}
                        onConfirm={() => s.closePosition(p.id)}
                      />
                    </td>
                  </tr>
                );
              })}
        </tbody>
        {!loading && positions.length > 1 && (
          <tfoot>
            <tr>
              <td colSpan={cols.findIndex((c) => c.key === "upnl")} className="muted">
                Total
              </td>
              <td className="r">
                <LiveNumber value={total} className={pnlClass(total)}>
                  {fmtUsd(total, { sign: true })}
                </LiveNumber>
              </td>
              <td colSpan={cols.length - cols.findIndex((c) => c.key === "upnl")} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function OpenPositionsPanel() {
  const s = useStore();
  const hasStrategies = s.strategies.length > 0;
  return (
    <Panel
      title="Open positions"
      meta={!s.loading && <span className="num">{s.positions.length} active</span>}
    >
      <PositionsTable
        positions={s.positions}
        loading={s.loading}
        emptyMessage={
          hasStrategies
            ? "No open positions. They appear here when a running strategy enters a trade."
            : "No open positions — you don't have any strategies yet, so nothing is trading."
        }
        emptyAction={
          !hasStrategies && (
            <a className="btn btn-primary btn-sm" href="#/strategies?new=1">
              <Icon name="plus" size={14} /> Create first strategy
            </a>
          )
        }
      />
    </Panel>
  );
}

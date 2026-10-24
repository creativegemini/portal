import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Modal } from "../components/Modal";
import { PositionsTable } from "../components/Overview";
import { EmptyState, Icon, LiveNumber, Panel, Sk } from "../components/primitives";
import { fmtAgoShort, fmtPct, fmtUsd, notional, pnlClass, unrealized } from "../lib/format";
import { useNow, useStore, type NewStrategyInput } from "../lib/store";
import { KIND_LABEL, PAIRS, type Strategy, type StrategyKind } from "../lib/types";

const COLS = [
  { label: "Strategy", num: false, sk: 150 },
  { label: "Status", num: false, sk: 64 },
  { label: "Allocation", num: true, sk: 80 },
  { label: "Realized P&L", num: true, sk: 80 },
  { label: "Unrealized P&L", num: true, sk: 72 },
  { label: "Win rate", num: true, sk: 44 },
  { label: "Max DD", num: true, sk: 48 },
  { label: "Last signal", num: true, sk: 64 },
];

function wantsNew() {
  return /[?&]new=1/.test(window.location.hash);
}

export function StrategiesPage() {
  const s = useStore();
  const now = useNow(5000);
  const [creating, setCreating] = useState(wantsNew);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const on = () => wantsNew() && setCreating(true);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const closeCreate = () => {
    setCreating(false);
    if (wantsNew()) history.replaceState(null, "", "#/strategies");
  };

  const running = s.strategies.filter((x) => x.status === "running").length;
  const paused = s.strategies.filter((x) => x.status === "paused").length;
  const stopped = s.strategies.filter((x) => x.status === "error").length;
  const allocated = s.strategies.reduce((a, x) => a + x.allocation, 0);
  const hasAny = s.strategies.length > 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Strategies</h1>
          <p className="page-meta">
            {s.loading ? (
              <Sk w={320} h={12} />
            ) : hasAny ? (
              <>
                {s.strategies.length} strategies · {running} running · {paused} paused
                {stopped > 0 && <span className="warn-text"> · {stopped} stopped by engine</span>} ·{" "}
                <span className="num">{fmtUsd(allocated)}</span> allocated of{" "}
                <span className="num">{fmtUsd(s.equityNow)}</span>
              </>
            ) : (
              "Nothing is trading yet."
            )}
          </p>
        </div>
        {hasAny && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)} disabled={s.loading}>
            <Icon name="plus" size={14} /> New strategy
          </button>
        )}
      </div>

      <Panel>
        {!s.loading && !hasAny ? (
          <EmptyState
            message="No strategies yet. A strategy tells the engine which pairs to trade, how much to risk, and when to enter and exit."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={14} /> Create first strategy
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className={`table strat-table ${s.connected ? "" : "stale"}`} aria-busy={s.loading || undefined}>
              <thead>
                <tr>
                  <th aria-hidden="true" className="chev-col" />
                  {COLS.map((c) => (
                    <th key={c.label} className={c.num ? "r" : ""} scope="col">
                      {c.label}
                    </th>
                  ))}
                  <th className="r" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.loading
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i}>
                        <td className="chev-col" />
                        {COLS.map((c, j) => (
                          <td key={c.label} className={c.num ? "r" : ""}>
                            <Sk w={c.sk} h={12} />
                            {j === 0 && <Sk w={110} h={10} style={{ display: "block", marginTop: 6 }} />}
                          </td>
                        ))}
                        <td className="r">
                          <Sk w={104} h={26} />
                        </td>
                      </tr>
                    ))
                  : s.strategies.map((st) => (
                      <StrategyRow
                        key={st.id}
                        st={st}
                        now={now}
                        open={expanded === st.id}
                        onToggle={() => setExpanded((e) => (e === st.id ? null : st.id))}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating && <CreateStrategyModal onClose={closeCreate} />}
    </>
  );
}

function StatusLabel({ st }: { st: Strategy }) {
  if (st.status === "running")
    return (
      <span className="status status-running">
        <span className="dot dot-live" aria-hidden="true" /> Running
      </span>
    );
  if (st.status === "paused")
    return (
      <span className="status status-paused">
        <span className="dot dot-off" aria-hidden="true" /> Paused
      </span>
    );
  return (
    <span className="status warn-text">
      <span className="dot dot-warn" aria-hidden="true" /> Stopped
    </span>
  );
}

function StrategyRow({ st, now, open, onToggle }: { st: Strategy; now: number; open: boolean; onToggle: () => void }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const positions = s.positions.filter((p) => p.strategyId === st.id);
  const upnl = positions.reduce((a, p) => a + unrealized(p), 0);
  const inUse = positions.reduce((a, p) => a + notional(p), 0);
  const detailId = `strat-detail-${st.id}`;
  const run = st.status !== "running";

  return (
    <Fragment>
      <tr className={`strat-row ${open ? "open" : ""} ${st.status === "error" ? "has-error" : ""}`}>
        <td className="chev-col">
          <button
            type="button"
            className="icon-btn chev"
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`${open ? "Hide" : "Show"} details for ${st.name}`}
            onClick={onToggle}
          >
            <Icon name="chevron" size={14} />
          </button>
        </td>
        <td>
          <button type="button" className="strat-name" onClick={onToggle}>
            {st.name}
          </button>
          <div className="strat-sub">
            {KIND_LABEL[st.kind]} · {st.pairs.join(", ")}
          </div>
        </td>
        <td>
          <StatusLabel st={st} />
        </td>
        <td className="r">
          <span className="num">{fmtUsd(st.allocation)}</span>
          <div className="cell-sub">
            <span className="num">{fmtUsd(inUse)}</span> in use
          </div>
        </td>
        <td className={`r num ${pnlClass(st.realizedPnl)}`}>{fmtUsd(st.realizedPnl, { sign: true })}</td>
        <td className="r">
          {positions.length ? (
            <LiveNumber value={upnl} className={pnlClass(upnl)}>
              {fmtUsd(upnl, { sign: true })}
            </LiveNumber>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
        <td className="r">
          <span className="num">{st.trades ? fmtPct(st.wins / st.trades, { decimals: 1 }) : "—"}</span>
          <div className="cell-sub">
            <span className="num">{st.wins}</span>/<span className="num">{st.trades}</span> trades
          </div>
        </td>
        <td className="r num">{st.trades ? fmtPct(st.maxDrawdownPct, { decimals: 1 }) : "—"}</td>
        <td className="r num muted">{st.lastSignalAt ? fmtAgoShort(now - st.lastSignalAt) : "None yet"}</td>
        <td className="r actions">
          <button
            type="button"
            className={`btn btn-sm ${run ? "btn-outline" : "btn-ghost"}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await s.setStrategyRunning(st.id, run);
              setBusy(false);
            }}
          >
            {busy ? (run ? "Resuming…" : "Pausing…") : run ? "Resume strategy" : "Pause strategy"}
          </button>
        </td>
      </tr>
      {st.error && (
        <tr className="strat-error-row">
          <td />
          <td colSpan={COLS.length + 1}>
            <div className="strat-error">
              <Icon name="warn" size={14} />
              {st.error}
            </div>
          </td>
        </tr>
      )}
      {open && (
        <tr className="strat-detail-row" id={detailId}>
          <td />
          <td colSpan={COLS.length + 1}>
            <div className="strat-detail">
              <dl className="params">
                <div>
                  <dt>Timeframe</dt>
                  <dd className="num">{st.params.timeframe}</dd>
                </div>
                <div>
                  <dt>Max position size</dt>
                  <dd>
                    <span className="num">{fmtPct(st.params.maxPositionPct, { decimals: 0 })}</span>{" "}
                    <span className="muted">
                      of allocation · <span className="num">{fmtUsd(st.allocation * st.params.maxPositionPct)}</span>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Stop loss</dt>
                  <dd className="num">{fmtPct(st.params.stopLossPct, { decimals: 1 })}</dd>
                </div>
                <div>
                  <dt>Take profit</dt>
                  <dd className="num">{fmtPct(st.params.takeProfitPct, { decimals: 1 })}</dd>
                </div>
                <div>
                  <dt>When paused</dt>
                  <dd className="muted">Opens no new trades. Existing positions stay open.</dd>
                </div>
              </dl>
              <div className="detail-positions">
                <div className="eyebrow">Open positions · {positions.length}</div>
                <PositionsTable
                  positions={positions}
                  showStrategy={false}
                  emptyMessage={
                    st.status === "running"
                      ? "No open positions. Waiting for an entry signal."
                      : "No open positions."
                  }
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/* ---------- Create strategy ---------- */

interface FormState {
  name: string;
  kind: StrategyKind;
  pairs: string[];
  allocation: string;
  maxPositionPct: string;
  stopLossPct: string;
  takeProfitPct: string;
  timeframe: string;
  start: boolean;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

function CreateStrategyModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [f, setF] = useState<FormState>({
    name: "",
    kind: "momentum",
    pairs: ["BTC/USDT"],
    allocation: "",
    maxPositionPct: "25",
    stopLossPct: "5",
    takeProfitPct: "10",
    timeframe: "1h",
    start: false,
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const unallocated = s.equityNow - s.strategies.reduce((a, x) => a + x.allocation, 0);
  const alloc = Number(f.allocation);
  const maxPos = Number(f.maxPositionPct);
  const sl = Number(f.stopLossPct);
  const tp = Number(f.takeProfitPct);

  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.name.trim()) errors.name = "Give the strategy a name — it's how you'll find it in alerts and trade history.";
  else if (s.strategies.some((x) => x.name.toLowerCase() === f.name.trim().toLowerCase()))
    errors.name = "A strategy with this name already exists. Pick a different name.";
  if (!f.pairs.length) errors.pairs = "Pick at least one pair to trade.";
  if (!f.allocation || !(alloc > 0)) errors.allocation = "Enter how much of your balance this strategy can use.";
  else if (alloc > unallocated)
    errors.allocation = `Allocation exceeds available balance — ${fmtUsd(Math.max(0, unallocated))} unallocated. Lower the allocation.`;
  if (!(maxPos > 0 && maxPos <= 100)) errors.maxPositionPct = "Use a value between 1 and 100%.";
  if (!(sl > 0 && sl <= 50)) errors.stopLossPct = "Use a stop loss between 0.1 and 50%.";
  if (!(tp > 0 && tp <= 200)) errors.takeProfitPct = "Use a take profit between 0.1 and 200%.";
  const valid = Object.keys(errors).length === 0;
  const show = (k: keyof FormState) => touched && errors[k];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (!valid) return;
    setBusy(true);
    const input: NewStrategyInput = {
      name: f.name.trim(),
      kind: f.kind,
      pairs: f.pairs,
      allocation: alloc,
      start: f.start,
      params: {
        timeframe: f.timeframe,
        maxPositionPct: maxPos / 100,
        stopLossPct: sl / 100,
        takeProfitPct: tp / 100,
      },
    };
    const r = await s.createStrategy(input);
    setBusy(false);
    if (r.ok) onClose();
    else setSubmitError(r.error ?? "Couldn't create strategy. Try again.");
  }

  return (
    <Modal
      title="New strategy"
      onClose={onClose}
      closable={!busy}
      width={620}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="new-strategy" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : f.start ? "Create and start trading" : "Create paused"}
          </button>
        </>
      }
    >
      <form id="new-strategy" className="form" onSubmit={submit} noValidate>
        {submitError && (
          <div className="inline-warn" role="alert">
            <Icon name="warn" size={16} />
            <span>{submitError}</span>
          </div>
        )}

        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. BTC Breakout 4h"
            aria-invalid={!!show("name")}
          />
          {show("name") && <span className="field-error">{errors.name}</span>}
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Type</span>
            <select className="input" value={f.kind} onChange={(e) => set("kind", e.target.value as StrategyKind)}>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Timeframe</span>
            <select className="input num" value={f.timeframe} onChange={(e) => set("timeframe", e.target.value)}>
              {TIMEFRAMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="field">
          <legend className="field-label">Pairs to trade</legend>
          <div className="chips">
            {PAIRS.map((p) => {
              const on = f.pairs.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  className={`chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => set("pairs", on ? f.pairs.filter((x) => x !== p) : [...f.pairs, p])}
                >
                  {p}
                </button>
              );
            })}
          </div>
          {show("pairs") && <span className="field-error">{errors.pairs}</span>}
        </fieldset>

        <label className="field">
          <span className="field-label">Allocation (USD)</span>
          <input
            className="input num"
            inputMode="decimal"
            value={f.allocation}
            onChange={(e) => set("allocation", e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="10000"
            aria-invalid={!!show("allocation")}
          />
          {show("allocation") ? (
            <span className="field-error">{errors.allocation}</span>
          ) : (
            <span className="field-hint">
              <span className="num">{fmtUsd(Math.max(0, unallocated))}</span> of your balance isn't allocated to a strategy.
            </span>
          )}
        </label>

        <div className="field-row three">
          <PctField label="Max position size" hint="of allocation, per trade" value={f.maxPositionPct} onChange={(v) => set("maxPositionPct", v)} error={show("maxPositionPct")} />
          <PctField label="Stop loss" hint="exit when a trade is down" value={f.stopLossPct} onChange={(v) => set("stopLossPct", v)} error={show("stopLossPct")} />
          <PctField label="Take profit" hint="exit when a trade is up" value={f.takeProfitPct} onChange={(v) => set("takeProfitPct", v)} error={show("takeProfitPct")} />
        </div>

        <fieldset className="field">
          <legend className="field-label">After creating</legend>
          <div className="radio-group">
            <label className={`radio ${!f.start ? "on" : ""}`}>
              <input type="radio" name="start" checked={!f.start} onChange={() => set("start", false)} />
              <span>
                <strong>Keep it paused</strong>
                <span className="muted">Review it first, then resume when you're ready.</span>
              </span>
            </label>
            <label className={`radio ${f.start ? "on" : ""}`}>
              <input type="radio" name="start" checked={f.start} onChange={() => set("start", true)} />
              <span>
                <strong>Start trading now</strong>
                <span className="muted">Opens positions as soon as its entry rules trigger.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function PctField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | false;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-affix">
        <input
          className="input num"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          aria-invalid={!!error}
        />
        <span className="affix">%</span>
      </span>
      {error ? <span className="field-error">{error}</span> : <span className="field-hint">{hint}</span>}
    </label>
  );
}

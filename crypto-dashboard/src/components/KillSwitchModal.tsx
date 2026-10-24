import { useState } from "react";
import { fmtPrice, fmtQty, fmtTime, fmtUsd, pnlClass, unrealized } from "../lib/format";
import { useStore } from "../lib/store";
import type { CloseRowState, KillResult, Position } from "../lib/types";
import { Modal } from "./Modal";
import { Icon } from "./primitives";

const PHRASE = "CLOSE ALL";

type Phase = "confirm" | "running" | "done";

export function KillSwitchModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [typed, setTyped] = useState("");
  // Snapshot so rows stay visible while they're being closed and removed from the store.
  const [rows, setRows] = useState<Position[]>(s.positions);
  const [status, setStatus] = useState<Record<string, CloseRowState>>({});
  const [result, setResult] = useState<KillResult | null>(null);
  const [finishedAt, setFinishedAt] = useState(0);

  const n = s.positions.length;
  const running = s.strategies.filter((x) => x.status === "running").length;
  const est = s.unrealizedTotal;
  const armed = typed.trim().toUpperCase() === PHRASE;

  const actionLabel =
    n > 0
      ? `Close ${n} position${n === 1 ? "" : "s"} and pause ${running} strateg${running === 1 ? "y" : "ies"}`
      : `Pause ${running} strateg${running === 1 ? "y" : "ies"}`;

  async function run(retry = false) {
    const targets = retry ? rows.filter((r) => status[r.id]?.state === "failed") : s.positions;
    if (!retry) setRows(s.positions);
    setStatus((prev) => {
      const next = retry ? { ...prev } : {};
      targets.forEach((p) => (next[p.id] = { state: "pending" }));
      return next;
    });
    setPhase("running");
    const r = await s.killAll((id, row) => setStatus((prev) => ({ ...prev, [id]: row })), { retry });
    setResult((prev) =>
      retry && prev
        ? { ...r, closed: prev.closed + r.closed, realized: prev.realized + r.realized, paused: prev.paused + r.paused }
        : r,
    );
    setFinishedAt(Date.now());
    setPhase("done");
  }

  /* ---------- Result ---------- */
  if (phase === "done" && result) {
    const total = rows.length;
    const outcome = result.error ? "none" : result.failed > 0 ? "partial" : "ok";
    return (
      <Modal
        title={
          outcome === "ok"
            ? "Kill switch complete"
            : outcome === "partial"
              ? "Kill switch partly failed"
              : "Kill switch failed — nothing was closed"
        }
        onClose={onClose}
        tone={outcome === "ok" ? undefined : "warn"}
        footer={
          outcome === "ok" ? (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-warn-solid"
                onClick={() => (outcome === "partial" ? run(true) : run(false))}
              >
                {outcome === "partial"
                  ? `Retry closing ${result.failed} position${result.failed === 1 ? "" : "s"}`
                  : "Try again"}
              </button>
            </>
          )
        }
      >
        <div className={`result result-${outcome}`}>
          <Icon name={outcome === "ok" ? "check" : "warn"} size={18} />
          <div>
            {outcome === "ok" && (
              <>
                <strong>
                  {total > 0 ? `All ${total} positions closed` : "No positions were open"} and {result.paused} strateg
                  {result.paused === 1 ? "y" : "ies"} paused.
                </strong>
                <p>
                  Realized{" "}
                  <span className={`num ${pnlClass(result.realized)}`}>{fmtUsd(result.realized, { sign: true })}</span>{" "}
                  · finished at <span className="num">{fmtTime(finishedAt)}</span>. Strategies stay paused until you resume
                  them on the Strategies page.
                </p>
              </>
            )}
            {outcome === "partial" && (
              <>
                <strong>
                  {result.closed} of {total} positions closed. {result.failed} still open.
                </strong>
                <p>
                  The exchange rejected {result.failed === 1 ? "an order" : "some orders"} (rate limit). All {result.paused}{" "}
                  strategies are paused, so nothing new will open. Retry now, or close the remaining positions on the
                  exchange directly.
                </p>
              </>
            )}
            {outcome === "none" && (
              <>
                <strong>{result.error}.</strong>
                <p>
                  {total > 0 ? `Your ${total} positions are still open and strategies` : "Strategies"} are still
                  running. Check the engine connection and try again — or close positions on the exchange directly if
                  this is urgent.
                </p>
              </>
            )}
          </div>
        </div>
        {total > 0 && <ProgressList rows={rows} status={status} />}
      </Modal>
    );
  }

  /* ---------- Running ---------- */
  if (phase === "running") {
    return (
      <Modal title="Closing positions…" onClose={onClose} closable={false} tone="warn">
        <p className="modal-lead">Sending market orders. Don't close this window — it'll take a few seconds.</p>
        {rows.length > 0 ? <ProgressList rows={rows} status={status} /> : <p className="muted">Pausing strategies…</p>}
      </Modal>
    );
  }

  /* ---------- Confirm ---------- */
  return (
    <Modal
      title="Kill switch"
      onClose={onClose}
      tone="warn"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Keep everything running
          </button>
          <button type="button" className="btn btn-warn-solid" disabled={!armed} onClick={() => run(false)}>
            <Icon name="power" size={14} /> {actionLabel}
          </button>
        </>
      }
    >
      <p className="modal-lead">
        {n > 0 ? (
          <>
            This <strong>closes all {n} open positions at market price</strong> and{" "}
            <strong>
              pauses all {running} running strateg{running === 1 ? "y" : "ies"}
            </strong>{" "}
            so none of them opens a new trade until you resume it.
          </>
        ) : (
          <>
            You have no open positions. This{" "}
            <strong>
              pauses all {running} running strateg{running === 1 ? "y" : "ies"}
            </strong>{" "}
            so none of them opens a new trade until you resume it.
          </>
        )}
      </p>

      {!s.connected && (
        <div className="inline-warn">
          <Icon name="unplug" size={16} />
          <span>
            Not connected to trading engine. The kill switch will most likely fail until the connection is back — close
            positions on the exchange directly if this is urgent.
          </span>
        </div>
      )}

      {n > 0 && (
        <div className="kill-summary">
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th className="r" scope="col">
                  Size
                </th>
                <th className="r" scope="col">
                  Mark
                </th>
                <th className="r" scope="col">
                  Unrealized P&L
                </th>
              </tr>
            </thead>
            <tbody>
              {s.positions.map((p) => {
                const u = unrealized(p);
                return (
                  <tr key={p.id}>
                    <td>
                      {p.pair} <span className={`side side-${p.side}`}>{p.side.toUpperCase()}</span>
                    </td>
                    <td className="r num">{fmtQty(p.size)}</td>
                    <td className="r num">{fmtPrice(p.mark)}</td>
                    <td className={`r num ${pnlClass(u)}`}>{fmtUsd(u, { sign: true })}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="muted">
                  Estimated realized P&L at current marks
                </td>
                <td className={`r num ${pnlClass(est)}`}>{fmtUsd(est, { sign: true })}</td>
              </tr>
            </tfoot>
          </table>
          <p className="fine">Market orders fill at the best available price. Final fills may differ from the marks above.</p>
        </div>
      )}

      <label className="field">
        <span className="field-label">
          Type <span className="num kbd">{PHRASE}</span> to confirm
        </span>
        <input
          className="input num"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && armed && run(false)}
          placeholder={PHRASE}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="kill-hint"
        />
        <span id="kill-hint" className="field-hint">
          This can't be undone. Closed positions stay closed.
        </span>
      </label>
    </Modal>
  );
}

function ProgressList({ rows, status }: { rows: Position[]; status: Record<string, CloseRowState> }) {
  return (
    <ul className="progress-list">
      {rows.map((p) => {
        const st = status[p.id] ?? { state: "pending" };
        return (
          <li key={p.id} className={`progress-row ps-${st.state}`}>
            <span className="progress-pos">
              {p.pair} <span className={`side side-${p.side}`}>{p.side.toUpperCase()}</span>
            </span>
            <span className="progress-state">
              {st.state === "pending" && <span className="muted">Waiting</span>}
              {st.state === "closing" && <span>Closing at market…</span>}
              {st.state === "closed" && (
                <>
                  <span className="muted">Closed at</span> <span className="num">{fmtPrice(st.fill)}</span>{" "}
                  <span className={`num ${pnlClass(st.pnl)}`}>{fmtUsd(st.pnl, { sign: true })}</span>
                </>
              )}
              {st.state === "failed" && <span className="warn-text">Still open — {st.reason}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

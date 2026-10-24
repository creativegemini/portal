import { useEffect, useMemo, useState } from "react";
import { fmtCompactUsd, fmtDate, fmtDateTime, fmtPct, fmtUsd, pnlClass } from "../lib/format";
import { useStore } from "../lib/store";
import { LiveNumber, Sk } from "./primitives";

const RANGES = [
  { key: "24h", label: "24H", hours: 24 },
  { key: "7d", label: "7D", hours: 24 * 7 },
  { key: "30d", label: "30D", hours: 24 * 30 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const H = 260;
const PAD = { l: 64, r: 16, t: 12, b: 28 };

/** Callback ref, so it starts observing when the chart mounts after the skeleton. */
function useWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w] as const;
}

function niceTicks(min: number, max: number, count = 4) {
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

export function EquityChart() {
  const s = useStore();
  const [range, setRange] = useState<RangeKey>("30d");
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, width] = useWidth<HTMLDivElement>();

  const hours = RANGES.find((r) => r.key === range)!.hours;
  const pts = useMemo(() => s.equity.slice(-(hours + 1)), [s.equity, hours]);

  if (s.loading) return <EquityChartSkeleton />;

  const open = pts[0].v;
  const last = pts[pts.length - 1].v;
  const change = last - open;
  const vals = pts.map((p) => p.v);
  const { lo, hi, ticks } = niceTicks(Math.min(...vals), Math.max(...vals));
  const iw = Math.max(10, width - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / (pts.length - 1)) * iw;
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ih;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1)},${PAD.t + ih}L${PAD.l},${PAD.t + ih}Z`;

  const labelCount = Math.max(2, Math.min(8, Math.floor(iw / 110)));
  const xLabels = Array.from({ length: labelCount }, (_, k) => Math.round((k / (labelCount - 1)) * (pts.length - 1)));
  const xFmt = (t: number) => (range === "24h" ? fmtDateTime(t).split(" ")[1] : fmtDate(t));

  const hp = hover != null ? pts[hover] : null;
  const stale = !s.connected;

  return (
    <section className="panel chart-panel" aria-label="Equity curve">
      <header className="chart-head">
        <div>
          <div className="eyebrow">Equity curve</div>
          <div className={`chart-value ${stale ? "stale" : ""}`}>
            <LiveNumber value={last} className="big">
              {fmtUsd(last)}
            </LiveNumber>
            <span className={`num chart-change ${pnlClass(change)}`}>
              {fmtUsd(change, { sign: true })} ({fmtPct(change / open, { sign: true })})
            </span>
            <span className="muted chart-change-label">{RANGES.find((r) => r.key === range)!.label} change</span>
          </div>
        </div>
        <div className="chart-controls">
          {stale ? (
            <span className="live-tag warn-text">
              <span className="dot dot-warn" aria-hidden="true" /> STALE
            </span>
          ) : (
            <span className="live-tag">
              <span className="dot dot-live pulse" aria-hidden="true" /> LIVE
            </span>
          )}
          <div className="seg" role="group" aria-label="Chart range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={r.key === range ? "on" : ""}
                aria-pressed={r.key === range}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        ref={wrapRef}
        className={`chart-wrap ${stale ? "stale" : ""}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - PAD.l) / iw) * (pts.length - 1));
          setHover(i >= 0 && i < pts.length ? i : null);
        }}
      >
        <svg width={width} height={H} role="img" aria-label={`Equity ${fmtUsd(last)}, ${fmtUsd(change, { sign: true })} over ${range}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={PAD.l + iw} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" className="axis">
                {fmtCompactUsd(t)}
              </text>
            </g>
          ))}
          {xLabels.map((i, k) => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor={k === 0 ? "start" : k === xLabels.length - 1 ? "end" : "middle"}
              className="axis"
            >
              {xFmt(pts[i].t)}
            </text>
          ))}
          <line x1={PAD.l} x2={PAD.l + iw} y1={y(open)} y2={y(open)} className="baseline" />
          <path d={area} className="area" />
          <path d={line} className="line" />
          {hp && hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} className="crosshair" />
              <circle cx={x(hover)} cy={y(hp.v)} r={3.5} className="hover-dot" />
            </g>
          )}
        </svg>
        {hp && hover != null && (
          <div
            className="chart-tip"
            style={{ left: Math.min(x(hover) + 12, width - 190), top: Math.max(4, y(hp.v) - 56) }}
          >
            <div className="muted num">{fmtDateTime(hp.t)}</div>
            <div className="num">{fmtUsd(hp.v)}</div>
            <div className={`num ${pnlClass(hp.v - open)}`}>
              {fmtUsd(hp.v - open, { sign: true })} vs period open
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function EquityChartSkeleton() {
  return (
    <section className="panel chart-panel" aria-busy="true" aria-label="Loading equity curve">
      <header className="chart-head">
        <div>
          <div className="eyebrow">Equity curve</div>
          <div className="chart-value">
            <Sk w={190} h={26} />
            <Sk w={150} h={14} />
          </div>
        </div>
        <div className="chart-controls">
          <Sk w={44} h={12} />
          <Sk w={118} h={26} />
        </div>
      </header>
      <div className="chart-wrap">
        <div className="chart-sk" style={{ height: H }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="chart-sk-row" style={{ top: PAD.t + (i / 4) * (H - PAD.t - PAD.b) }}>
              <Sk w={38} h={10} />
              <span className="chart-sk-grid" />
            </div>
          ))}
          <div className="chart-sk-x">
            {Array.from({ length: 7 }, (_, i) => (
              <Sk key={i} w={40} h={10} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

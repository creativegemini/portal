import type { Position } from "./types";

const MINUS = "−";

const usd = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function isZero(n: number, decimals = 2) {
  return Math.abs(n) < 0.5 * 10 ** -decimals;
}

/** $1,234.56 — pass sign to always show +/−. */
export function fmtUsd(n: number, opts: { sign?: boolean } = {}) {
  const body = "$" + usd.format(Math.abs(n));
  if (isZero(n)) return opts.sign ? " " + body : body;
  if (n < 0) return MINUS + body;
  return opts.sign ? "+" + body : body;
}

export function priceDecimals(n: number) {
  if (n < 1) return 6;
  if (n < 1000) return 4;
  return 2;
}

export function fmtPrice(n: number) {
  const d = priceDecimals(n);
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    })
  );
}

/** Fraction in, percent out: 0.0535 → 5.35% */
export function fmtPct(n: number, opts: { sign?: boolean; decimals?: number } = {}) {
  const d = opts.decimals ?? 2;
  const body = (Math.abs(n) * 100).toFixed(d) + "%";
  if (isZero(n * 100, d)) return opts.sign ? " " + body : body;
  if (n < 0) return MINUS + body;
  return opts.sign ? "+" + body : body;
}

export function fmtQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function fmtCompactUsd(n: number) {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return "$" + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + "k";
  }
  return "$" + n.toFixed(0);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtDateTime(ts: number) {
  const d = new Date(ts);
  return `${fmtDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtAgo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad(s % 60)}s ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${pad(m % 60)}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Coarse: 42s ago, 7m ago, 3h ago, 2d ago */
export function fmtAgoShort(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Only P&L values get gain/loss color. */
export function pnlClass(n: number) {
  if (isZero(n)) return "";
  return n > 0 ? "gain" : "loss";
}

export function unrealized(p: Position) {
  const diff = p.mark - p.entry;
  return (p.side === "long" ? diff : -diff) * p.size;
}

export function pnlPct(p: Position) {
  return unrealized(p) / (p.entry * p.size);
}

export function notional(p: Position) {
  return p.mark * p.size;
}

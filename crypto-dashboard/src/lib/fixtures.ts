import type { EquityPoint, Position, Strategy } from "./types";

const HOUR = 3_600_000;

export const START_EQUITY = 134_833.48;
export const TODAY_PNL = 1_197.61;

export function samplePositions(now: number): Position[] {
  return [
    { id: "p1", pair: "AVAX/USDT", side: "long", size: 200, entry: 28.4, mark: 26.8809, strategyId: "s1", openedAt: now - 31 * HOUR },
    { id: "p2", pair: "BTC/USDT", side: "long", size: 0.85, entry: 61_250, mark: 61_973.42, strategyId: "s1", openedAt: now - 9 * HOUR },
    { id: "p3", pair: "ETH/USDT", side: "short", size: 12.5, entry: 3_420, mark: 3_418.12, strategyId: "s2", openedAt: now - 4 * HOUR },
    { id: "p4", pair: "SOL/USDT", side: "long", size: 150, entry: 142.5, mark: 146.15, strategyId: "s3", openedAt: now - 14 * HOUR },
    { id: "p5", pair: "BTC/USDT", side: "short", size: 0.3, entry: 62_100, mark: 62_126.06, strategyId: "s3", openedAt: now - 1.5 * HOUR },
  ];
}

export function sampleStrategies(now: number): Strategy[] {
  return [
    {
      id: "s1",
      name: "BTC Momentum",
      kind: "momentum",
      pairs: ["BTC/USDT", "AVAX/USDT"],
      status: "running",
      allocation: 40_000,
      realizedPnl: 4_212.55,
      trades: 64,
      wins: 46,
      maxDrawdownPct: -0.062,
      lastSignalAt: now - 7 * 60_000,
      error: null,
      params: { timeframe: "1h", maxPositionPct: 0.25, stopLossPct: 0.06, takeProfitPct: 0.12 },
    },
    {
      id: "s2",
      name: "ETH Mean Reversion",
      kind: "mean-reversion",
      pairs: ["ETH/USDT"],
      status: "running",
      allocation: 25_000,
      realizedPnl: -842.1,
      trades: 41,
      wins: 24,
      maxDrawdownPct: -0.098,
      lastSignalAt: now - 42 * 60_000,
      error: null,
      params: { timeframe: "15m", maxPositionPct: 0.4, stopLossPct: 0.03, takeProfitPct: 0.025 },
    },
    {
      id: "s3",
      name: "Arbitrage Hunter",
      kind: "arbitrage",
      pairs: ["SOL/USDT", "BTC/USDT"],
      status: "running",
      allocation: 30_000,
      realizedPnl: 3_118.4,
      trades: 84,
      wins: 72,
      maxDrawdownPct: -0.021,
      lastSignalAt: now - 95_000,
      error: null,
      params: { timeframe: "1m", maxPositionPct: 0.6, stopLossPct: 0.01, takeProfitPct: 0.008 },
    },
    {
      id: "s4",
      name: "SOL Range Grid",
      kind: "grid",
      pairs: ["SOL/USDT"],
      status: "error",
      allocation: 15_000,
      realizedPnl: 512.2,
      trades: 37,
      wins: 28,
      maxDrawdownPct: -0.044,
      lastSignalAt: now - 3 * HOUR,
      error:
        "Order failed — insufficient USDT balance on exchange. Transfer USDT to the exchange or lower max position size, then resume.",
      params: { timeframe: "5m", maxPositionPct: 0.1, stopLossPct: 0.08, takeProfitPct: 0.015 },
    },
  ];
}

/** Deterministic PRNG so the curve looks the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 30 days of hourly equity, ending exactly at `end`. */
export function sampleEquity(now: number, end: number): EquityPoint[] {
  const rand = mulberry32(44);
  const n = 30 * 24;
  const start = now - n * HOUR;
  const out: EquityPoint[] = [];
  let noise = 0;
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const trend =
      p < 0.62
        ? 112_000 + 29_500 * (1 - Math.pow(1 - p / 0.62, 1.7))
        : 141_500 - 6_400 * ((p - 0.62) / 0.38);
    noise = noise * 0.96 + (rand() - 0.5) * 260;
    out.push({ t: start + i * HOUR, v: trend + noise });
  }
  const delta = end - out[n].v;
  return out.map((pt, i) => ({ t: pt.t, v: pt.v + delta * (i / n) }));
}

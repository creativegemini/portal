export type Side = "long" | "short";
export type StrategyKind = "momentum" | "mean-reversion" | "arbitrage" | "grid";
export type StrategyStatus = "running" | "paused" | "error";
export type Page = "overview" | "strategies" | "history" | "settings";

export interface Position {
  id: string;
  pair: string;
  side: Side;
  size: number;
  entry: number;
  mark: number;
  strategyId: string;
  openedAt: number;
}

export interface StrategyParams {
  timeframe: string;
  maxPositionPct: number;
  stopLossPct: number;
  takeProfitPct: number;
}

export interface Strategy {
  id: string;
  name: string;
  kind: StrategyKind;
  pairs: string[];
  status: StrategyStatus;
  allocation: number;
  realizedPnl: number;
  trades: number;
  wins: number;
  maxDrawdownPct: number;
  lastSignalAt: number | null;
  /** Plain-language reason the engine stopped this strategy. */
  error: string | null;
  params: StrategyParams;
}

export interface EquityPoint {
  t: number;
  v: number;
}

export interface Toast {
  id: string;
  tone: "info" | "warn";
  title: string;
  body?: string;
}

/** Design-review switches for forcing each UI state. Not part of the product. */
export interface Scenario {
  connection: "connected" | "disconnected";
  forceLoading: boolean;
  empty: boolean;
  killOutcome: "success" | "partial";
}

export type CloseRowState =
  | { state: "pending" }
  | { state: "closing" }
  | { state: "closed"; fill: number; pnl: number }
  | { state: "failed"; reason: string };

export interface KillResult {
  closed: number;
  failed: number;
  realized: number;
  paused: number;
  /** Set when nothing could be attempted at all. */
  error: string | null;
}

export interface OpResult {
  ok: boolean;
  error?: string;
}

export const KIND_LABEL: Record<StrategyKind, string> = {
  momentum: "Momentum",
  "mean-reversion": "Mean reversion",
  arbitrage: "Arbitrage",
  grid: "Grid",
};

export const PAIRS = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "AVAX/USDT",
  "LINK/USDT",
  "ARB/USDT",
];

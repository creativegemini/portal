import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { START_EQUITY, TODAY_PNL, sampleEquity, samplePositions, sampleStrategies } from "./fixtures";
import { fmtPrice, fmtUsd, unrealized } from "./format";
import type {
  CloseRowState,
  EquityPoint,
  KillResult,
  OpResult,
  Position,
  Scenario,
  Strategy,
  StrategyKind,
  StrategyParams,
  Toast,
} from "./types";

/*
 * Stand-in for the trading engine API. Every action goes through a simulated
 * network round-trip and honours the review scenario (disconnected, partial
 * kill-switch failure) so each UI state can be exercised.
 */

const NOT_CONNECTED = "Not connected to trading engine";
const TICK_MS = 1500;

interface State {
  booting: boolean;
  scenario: Scenario;
  lastUpdate: number;
  positions: Position[];
  strategies: Strategy[];
  equity: EquityPoint[];
  /** Equity excluding unrealized P&L. */
  realizedBase: number;
  startOfDayEquity: number;
  dismissedAlerts: string[];
  toasts: Toast[];
  latencyMs: number;
}

export interface NewStrategyInput {
  name: string;
  kind: StrategyKind;
  pairs: string[];
  allocation: number;
  params: StrategyParams;
  start: boolean;
}

const sumUnrealized = (ps: Position[]) => ps.reduce((a, p) => a + unrealized(p), 0);

function readScenario(): Scenario {
  const q = new URLSearchParams(window.location.search);
  return {
    connection: q.get("engine") === "down" ? "disconnected" : "connected",
    forceLoading: q.get("loading") === "1",
    empty: q.get("empty") === "1",
    killOutcome: q.get("kill") === "partial" ? "partial" : "success",
  };
}

function initialState(): State {
  const now = Date.now();
  const scenario = readScenario();
  const positions = scenario.empty ? [] : samplePositions(now);
  return {
    booting: true,
    scenario,
    lastUpdate: now,
    positions,
    strategies: scenario.empty ? [] : sampleStrategies(now),
    equity: sampleEquity(now, START_EQUITY),
    realizedBase: START_EQUITY - sumUnrealized(positions),
    startOfDayEquity: START_EQUITY - TODAY_PNL,
    dismissedAlerts: [],
    toasts: [],
    latencyMs: 38,
  };
}

/** Move a position's unrealized P&L into realized and credit its strategy. */
function applyClose(s: State, id: string): State {
  const p = s.positions.find((x) => x.id === id);
  if (!p) return s;
  const pnl = unrealized(p);
  return {
    ...s,
    positions: s.positions.filter((x) => x.id !== id),
    realizedBase: s.realizedBase + pnl,
    strategies: s.strategies.map((st) =>
      st.id === p.strategyId
        ? { ...st, realizedPnl: st.realizedPnl + pnl, trades: st.trades + 1, wins: st.wins + (pnl > 0 ? 1 : 0) }
        : st,
    ),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let toastSeq = 0;

function useStoreValue() {
  const [state, setState] = useState<State>(initialState);
  const ref = useRef(state);
  ref.current = state;

  const loading = state.booting || state.scenario.forceLoading;
  const connected = state.scenario.connection === "connected";

  useEffect(() => {
    const id = setTimeout(() => setState((s) => ({ ...s, booting: false })), 1400);
    return () => clearTimeout(id);
  }, []);

  // Live price feed. Stops while disconnected so numbers visibly freeze.
  useEffect(() => {
    if (loading || !connected) return;
    const id = setInterval(() => {
      setState((s) => {
        const positions = s.positions.map((p) =>
          Math.random() < 0.55 ? { ...p, mark: p.mark * (1 + (Math.random() - 0.5) * 0.0014) } : p,
        );
        const equity = s.equity.slice();
        const last = equity[equity.length - 1];
        equity[equity.length - 1] = { t: last.t, v: s.realizedBase + sumUnrealized(positions) };
        return {
          ...s,
          positions,
          equity,
          lastUpdate: Date.now(),
          latencyMs: Math.round(30 + Math.random() * 25),
        };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [loading, connected]);

  const dismissToast = useCallback((id: string) => {
    setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = `t${++toastSeq}`;
      setState((s) => ({ ...s, toasts: [...s.toasts.slice(-3), { ...t, id }] }));
      setTimeout(() => dismissToast(id), t.tone === "warn" ? 9000 : 5000);
    },
    [dismissToast],
  );

  const setScenario = useCallback((patch: Partial<Scenario>) => {
    setState((s) => {
      let next: State = { ...s, scenario: { ...s.scenario, ...patch } };
      if (patch.empty !== undefined && patch.empty !== s.scenario.empty) {
        const equityNow = s.realizedBase + sumUnrealized(s.positions);
        const now = Date.now();
        const positions = patch.empty ? [] : samplePositions(now);
        next = {
          ...next,
          positions,
          strategies: patch.empty ? [] : sampleStrategies(now),
          realizedBase: equityNow - sumUnrealized(positions),
          dismissedAlerts: [],
        };
      }
      if (patch.connection === "connected" && s.scenario.connection === "disconnected") {
        next.lastUpdate = Date.now();
      }
      return next;
    });
  }, []);

  const retryConnection = useCallback(async (): Promise<OpResult> => {
    await sleep(1200);
    if (ref.current.scenario.connection === "disconnected") {
      return { ok: false, error: "Still can't reach the trading engine. Check that it's running and reachable." };
    }
    return { ok: true };
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setState((s) => ({ ...s, dismissedAlerts: [...s.dismissedAlerts, id] }));
  }, []);

  const closePosition = useCallback(
    async (id: string): Promise<OpResult> => {
      await sleep(650);
      const s = ref.current;
      const p = s.positions.find((x) => x.id === id);
      if (!p) return { ok: false, error: "Position was already closed" };
      const label = `${p.pair} ${p.side}`;
      if (s.scenario.connection === "disconnected") {
        toast({
          tone: "warn",
          title: `Couldn't close ${label} — ${NOT_CONNECTED.toLowerCase()}`,
          body: "The position is still open. Try again once the engine reconnects.",
        });
        return { ok: false, error: NOT_CONNECTED };
      }
      const pnl = unrealized(p);
      setState((st) => applyClose(st, id));
      toast({
        tone: "info",
        title: `Closed ${label} at ${fmtPrice(p.mark)}`,
        body: `Realized ${fmtUsd(pnl, { sign: true })}`,
      });
      return { ok: true };
    },
    [toast],
  );

  const killAll = useCallback(
    async (onProgress: (id: string, row: CloseRowState) => void, opts: { retry?: boolean } = {}): Promise<KillResult> => {
      const s = ref.current;
      if (s.scenario.connection === "disconnected") {
        await sleep(1100);
        return { closed: 0, failed: s.positions.length, realized: 0, paused: 0, error: NOT_CONNECTED };
      }
      const ids = s.positions.map((p) => p.id);
      let closed = 0;
      let failed = 0;
      let realized = 0;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        onProgress(id, { state: "closing" });
        await sleep(450);
        if (!opts.retry && s.scenario.killOutcome === "partial" && (i === 1 || i === 3)) {
          failed++;
          onProgress(id, { state: "failed", reason: "exchange rejected the order (rate limit)" });
          continue;
        }
        const p = ref.current.positions.find((x) => x.id === id);
        if (!p) continue;
        const pnl = unrealized(p);
        realized += pnl;
        closed++;
        setState((st) => applyClose(st, id));
        onProgress(id, { state: "closed", fill: p.mark, pnl });
      }
      const paused = ref.current.strategies.filter((st) => st.status === "running").length;
      setState((st) => ({
        ...st,
        strategies: st.strategies.map((x) => (x.status === "running" ? { ...x, status: "paused" } : x)),
      }));
      return { closed, failed, realized, paused, error: null };
    },
    [],
  );

  const setStrategyRunning = useCallback(
    async (id: string, run: boolean): Promise<OpResult> => {
      await sleep(450);
      const s = ref.current;
      const st = s.strategies.find((x) => x.id === id);
      if (!st) return { ok: false };
      const verb = run ? "resume" : "pause";
      if (s.scenario.connection === "disconnected") {
        toast({
          tone: "warn",
          title: `Couldn't ${verb} ${st.name} — ${NOT_CONNECTED.toLowerCase()}`,
          body: "Nothing changed. Try again once the engine reconnects.",
        });
        return { ok: false, error: NOT_CONNECTED };
      }
      setState((x) => ({
        ...x,
        strategies: x.strategies.map((y) =>
          y.id === id ? { ...y, status: run ? "running" : "paused", error: run ? null : y.error } : y,
        ),
      }));
      const open = s.positions.filter((p) => p.strategyId === id).length;
      toast({
        tone: "info",
        title: run ? `${st.name} resumed` : `${st.name} paused`,
        body: run
          ? "It will open new trades when its entry rules trigger."
          : open > 0
            ? `No new trades will open. Its ${open} open position${open === 1 ? " stays" : "s stay"} open.`
            : "No new trades will open.",
      });
      return { ok: true };
    },
    [toast],
  );

  const createStrategy = useCallback(
    async (input: NewStrategyInput): Promise<OpResult> => {
      await sleep(800);
      if (ref.current.scenario.connection === "disconnected") {
        return {
          ok: false,
          error: `Couldn't create strategy — ${NOT_CONNECTED.toLowerCase()}. Your settings are kept; try again once it reconnects.`,
        };
      }
      const strategy: Strategy = {
        id: `s${Date.now()}`,
        name: input.name,
        kind: input.kind,
        pairs: input.pairs,
        status: input.start ? "running" : "paused",
        allocation: input.allocation,
        realizedPnl: 0,
        trades: 0,
        wins: 0,
        maxDrawdownPct: 0,
        lastSignalAt: null,
        error: null,
        params: input.params,
      };
      setState((s) => ({ ...s, strategies: [...s.strategies, strategy] }));
      toast({
        tone: "info",
        title: `${input.name} created`,
        body: input.start ? "Trading now — watching for entry signals." : "Paused. Resume it when you're ready to trade.",
      });
      return { ok: true };
    },
    [toast],
  );

  const equityNow = state.realizedBase + sumUnrealized(state.positions);

  return {
    ...state,
    loading,
    connected,
    equityNow,
    unrealizedTotal: sumUnrealized(state.positions),
    todayPnl: equityNow - state.startOfDayEquity,
    setScenario,
    retryConnection,
    dismissAlert,
    dismissToast,
    closePosition,
    killAll,
    setStrategyRunning,
    createStrategy,
  };
}

export type Store = ReturnType<typeof useStoreValue>;

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

/** Re-renders every `ms` — for "x seconds ago" labels. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useHashPage<T extends string>(pages: readonly T[], fallback: T) {
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, "").split("?")[0] as T;
    return pages.includes(h) ? h : fallback;
  };
  const [page, setPage] = useState<T>(read);
  useEffect(() => {
    const on = () => setPage(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return page;
}


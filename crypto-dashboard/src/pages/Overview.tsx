import { EquityChart } from "../components/EquityChart";
import { Alerts, OpenPositionsPanel, StatTiles } from "../components/Overview";
import { Sk } from "../components/primitives";
import { fmtTime } from "../lib/format";
import { useStore } from "../lib/store";

export function OverviewPage() {
  const s = useStore();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="page-meta">
            {s.loading ? (
              <Sk w={130} h={12} />
            ) : (
              <span className={s.connected ? "" : "warn-text"}>
                Last update <span className="num">{fmtTime(s.lastUpdate)}</span>
                {!s.connected && " · stale"}
              </span>
            )}
          </p>
        </div>
      </div>
      <Alerts />
      <EquityChart />
      <StatTiles />
      <OpenPositionsPanel />
    </>
  );
}

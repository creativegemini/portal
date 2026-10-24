import { useState } from "react";
import { KillSwitchModal } from "./components/KillSwitchModal";
import { ConnectionBanner, ReviewPanel, Sidebar, Toasts } from "./components/Shell";
import { useHashPage } from "./lib/store";
import type { Page } from "./lib/types";
import { OverviewPage } from "./pages/Overview";
import { PlaceholderPage } from "./pages/Placeholder";
import { StrategiesPage } from "./pages/Strategies";

const PAGES = ["overview", "strategies", "history", "settings"] as const satisfies readonly Page[];

export function App() {
  const page = useHashPage(PAGES, "overview");
  const [killOpen, setKillOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar page={page} onKill={() => setKillOpen(true)} />
      <main className="main">
        <ConnectionBanner />
        <div className="page">
          {page === "overview" && <OverviewPage />}
          {page === "strategies" && <StrategiesPage />}
          {page === "history" && <PlaceholderPage title="Trade History" />}
          {page === "settings" && <PlaceholderPage title="Settings" />}
        </div>
      </main>
      {killOpen && <KillSwitchModal onClose={() => setKillOpen(false)} />}
      <Toasts />
      <ReviewPanel />
    </div>
  );
}

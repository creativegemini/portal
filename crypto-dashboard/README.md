# CreativeGemini Crypto

Monitoring and control dashboard for the automated trading engine. Standalone
Vite + React + TypeScript app — independent of the Docusaurus site in the repo
root.

```sh
cd crypto-dashboard
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

Data comes from a simulated engine (`src/lib/store.tsx`) with live price ticks,
so every state can be reviewed without a backend.

## Review states

Use the **Review states** button (bottom right) or URL params to force each
designed state:

| State                    | URL                    |
| ------------------------ | ---------------------- |
| Disconnected from engine | `?engine=down`         |
| Skeleton loading         | `?loading=1`           |
| No strategies yet        | `?empty=1#/strategies` |
| Kill switch partly fails | `?kill=partial`        |

## Color rules

- `--accent` (blue): primary actions and focus rings only.
- `--gain` / `--loss`: sign of P&L only. Nowhere else — side badges, status
  dots and the equity line are neutral.
- `--warn` (amber): kill switch, alerts, disconnected and error states. Kept
  separate from loss red so red always means "losing money".

All numbers use JetBrains Mono with tabular figures; labels use Inter.

## Scope

Overview and Strategies are designed. Trade History and Settings are
placeholders pending review.

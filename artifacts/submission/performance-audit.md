# Production performance audit

Baseline production build: `pnpm web:build`, run 2026-08-29 with Next.js 16.3.2 and webpack. Compilation, TypeScript, static generation, and build tracing passed without hydration or server/client-boundary warnings.

| Route | Mobile profile | Desktop profile | LCP | CLS | INP/TBT | Bundle observation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | production, browser throttling pending | production, browser throttling pending | Pending | Pending | Pending | No Recharts import; motion is limited to the landing mechanism | Browser measurement pending |
| `/markets` | pending | pending | Pending | Pending | Pending | Instrument code is absent from the schedule route | Browser measurement pending |
| mandate detail | pending | pending | Pending | Pending | Pending | Recharts is behind a focused client-only dynamic chart boundary with fixed loading geometry | Browser measurement pending |
| acquisition detail | pending | pending | Pending | Pending | Pending | Same focused instrument boundary; canonical reads retained | Browser measurement pending |
| solver reservation | pending | pending | Pending | Pending | Pending | No broad feature barrel import found | Browser measurement pending |
| `/activity` | pending | pending | Pending | Pending | Pending | No chart dependency; schedule skeleton matches rows | Browser measurement pending |
| Delivery Receipt | pending | pending | Pending | Pending | Pending | No chart dependency; relationship stacks without horizontal scrolling | Browser measurement pending |

No performance-sensitive implementation was changed without a measured browser baseline. The existing Acquisition Instrument already isolates Recharts through `next/dynamic`, and independent balance/receipt reads use `Promise.all` or focused query hooks. Complete the numeric rows against the production server before recording the final video; do not infer web-vital values from development mode or testnet RPC latency.

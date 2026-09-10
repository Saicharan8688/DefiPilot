# DeFiPilot — Project Status

Status of the buildathon build, how to run it, and what is next.

---

## 1. What is implemented so far

### Foundation (P0 shell)
- **Next.js 16.3.4 (App Router, Turbopack) + React 19 + TypeScript strict + Tailwind CSS 4**, scaffolded at the repo root.
- **Wallet layer**
  - Real mode: wagmi v2 + viem + RainbowKit (`connect-wallet.tsx` renders `ConnectButton`).
  - Demo fallback: three deterministic demo wallets ("Portfolio A/B/C") with a custom connect menu, persisted in `localStorage` via `useSyncExternalStore` (no hydration mismatch, lint-clean).
- **Application shell**: sticky header with logo + connect button; dark, polished landing page with hero, feature cards, and a "How it works" flow.
- **Error/loading states**: reusable `Card`, `Badge`, `Skeleton`, `Spinner`, `ErrorState`; app-level `app/error.tsx` boundary; per-component loading skeletons and retry handlers.

### Portfolio (demo data)
- `GET /api/portfolio?address=0x…` → returns deterministic, address-seeded mock balances (ETH/WETH/USDC/DAI/USDT/LINK/ARB), valued in USD.
- Portfolio UI shows total value, token list (symbol, name, balance, price, USD value), and **explicitly labels `source: "demo"`**.
- Validation: 400 on invalid address; demo wallets map to curated conservative/balanced/growth profiles for a compelling story.

### DeFi data layer (live)
- **Adapter/service**: `lib/defi/defillama.ts` fetches `https://yields.llama.fi/pools`, validates the response, and **normalizes pools into `DeFiOpportunity`**. No fabricated numbers — all APY/TVL come from DefiLlama.
- **Chain of responsibility**: live fetch → server-side in-memory TTL cache (default 5 min, `DEFILLAMA_CACHE_TTL_MS`) → normalized, filtered, sorted, limited.
- **Deterministic risk scoring**: `lib/defi/risk.ts` — weighted, explainable score (0–99) from APY magnitude, reward-vs-base share, APY volatility, TVL/liquidity, and impermanent-loss exposure → `Low | Medium | High`. No LLM, no guessing.
- **API layer**: `GET /api/opportunities?chains=&limit=&minTvl=&minApy=` with input validation (400), graceful upstream failures (502 `OPPORTUNITIES_UNAVAILABLE`), and stale-cache fallback.
- **Frontend**: "Live yield scan" section with an APY/TVL sortable table (Protocol, Asset, APY, TVL, Chain, Risk), loading skeleton, error + retry, and a `Live data` / `Cached` badge.
- Anomaly handling: pools flagged `outlier` by DefiLlama are excluded; default `minTvl` is $1M to keep the default view credible.

### AI agent (tool-using, financial)
- **Explicit tools** (`lib/ai/tools.ts`) — each backed by deterministic code over ground-truth data:
  - `getWalletPortfolio` — wallet snapshot + metrics (demo balances, always labelled).
  - `getDeFiOpportunities` — live DefiLlama pools (`source: "live"`), APY-sorted.
  - `getProtocolData` — protocol-pool lookup (e.g. Aave/Compound).
  - `calculatePortfolioMetrics` — deployable capital, concentration, stablecoin share, top holdings.
  - `calculateExpectedYield` — `amountUsd × apy%` computed by code; APY from ground truth only.
  - `calculateRiskScore` — deterministic score from `lib/defi/risk.ts`.
  - `simulateAllocation` — per-opportunity and blended yield/risk via `lib/ai/simulation.ts`.
  - `finalizeRecommendation` — validates that every `opportunityId` exists in live data, normalizes percentages to 100%, computes amounts from the wallet's idle stablecoin capital and returns the definitive numbers. The LLM proposes percentages only; it can never write APYs/prices/TVL/balances into the plan.
- **Orchestration** (`lib/ai/agent.ts`): multi-round tool-calling loop (OpenAI, `gpt-4o-mini` default), then a second call that writes the *explanation* (summary / reasoning / warnings / assumptions) over the code-computed plan. Anti-fabrication: unknown ids are rejected, arithmetic is never delegated to the model, and any upstream failure propagates as an explicit "data unavailable" warning.
- **Deterministic fallback** (`lib/ai/fallback.ts`): when `OPENAI_API_KEY` is absent or the LLM path errors, a rule-based planner produces the same schema using the same math. It searches pools **risk-first** (safest match → e.g. Maple USDC 4.96%, Fluid Lending 4.60%, Sparklend DAI 2.46%) and adds a small high-yield sleeve with a clear risk label — demo output matches the "Aave/Compound + one higher-risk option" narrative.
- **API routes**: `POST /api/recommend` (address → `Recommendation`), `POST /api/simulate` (address + allocations → deterministic `SimulationResult`). Both validate addresses/ids (400) and fail gracefully (502) when live data is down.
- **UI** (`components/recommendation/*`): "AI ANALYSIS" flow exactly as specced — Current portfolio → Opportunities analyzed → Risk assessment → Recommended allocation → Why (reasoning/assumptions/warnings) → **Simulate strategy** panel. Includes an animated 6-step analysis progress, engine badge (AI agent vs rule-based), re-analyze, and a "Simulation only · nothing executed" disclaimer.
- Schema follows the required shape: `{ summary, currentPortfolio, opportunities, recommendedAllocation, expectedYield, riskLevel(+score), reasoning, warnings, assumptions }` plus provenance (`engine`, `dataProvidedAt`).

### Blockchain layer — real, read-only on-chain reads (done)
- **Chain metadata + RPC config**: `lib/chain/chains.ts` — Ethereum mainnet, Sepolia, Base, Base Sepolia, Arbitrum One, OP Mainnet (names, chain ids, testnet flags, RPC, explorer). Defaults: `RPC_URL` → `https://ethereum.publicnode.com`, `TESTNET_RPC_URL` → `https://ethereum-sepolia.publicnode.com` (both overridable).
- **Read path** (`lib/chain/client.ts`, `lib/chain/balances.ts`): viem public clients; `readChainState` returns block number + gas price (gwei); `getLiveBalances` reads native + USDC/USDT/DAI/WETH ERC20 balances via `eth_call`, priced by DefiLlama coins (`coins.llama.fi/prices/current`). `priceUsd` is `null` when pricing fails — no fabricated values. **Nothing is signed or broadcast**; all RPC usage is read-only.
- **Endpoints**:
  - `GET /api/chain?chainId=` → live block/gas, or a clearly-labelled `rpc: "simulated"` fallback when the RPC is unreachable (graceful, never down).
  - `GET /api/portfolio?address=&mode=live&chainId=` → real on-chain balances (`source: "live"`) on Ethereum mainnet only; non-mainnet chainIds or missing chainId → 502/400 with an explicit message. `mode=demo` keeps the deterministic mock as default (no chainId needed).
  - `POST /api/transactions/preview` — `{ address, chainId, allocations: [{ opportunityId, amountUsd }] }` → deterministic **sandbox transaction preview** (reuses `buildSimulation` math + `getOpportunitiesByIds` ground truth): steps with network, protocol, asset, amount, APY, risk, estimated result, tx type, wallet address, warnings; plus `approved: false`, `executed: false`, and an explicit "AI recommendation ≠ executed transaction" disclaimer. Invalid/unknown ids → 400; live-data failure → 502 `PREVIEW_UNAVAILABLE`.
- **UI**: `ChainInfo` strip under the header (live "On-chain feed": network, chain id, block, gas gwei, `Live RPC read` vs `Simulated` badge, testnet badge, 30s auto-refresh); `TransactionPreviewCard` in the recommendation view — "Prepare transaction (preview)" → steps + required on-chain context + two explicit consent checkboxes → `Approve (simulated)` → in-app `SimulatedReceipt` (`status: prepared_not_broadcast`, deterministic `sandbox ref`). The boundary is glued into the header of every recommendation: **AI recommendation ≠ executed transaction — you stay in control.**
- Live portfolio UI now switches to on-chain data in real-wallet mode (badge "On-chain"); token rows show `price unavailable` when pricing is null.

### Product polish — "AI-native DeFi terminal" (done)
- **Landing answers in ~5 seconds**: hero states what it is / what the AI does / where the chain is / what's different; primary CTA flow is spelled out as a numbered **journey strip** (Connect wallet → Analyze portfolio → Ask AI → Get recommendation → Simulate) with an explicit on-page CTA ("Analyze my wallet →", "See the live yield scan").
- **On-chain evidence chips** under the hero (read-only RPC · viem, live yields · DefiLlama, prices · DefiLlama coins, sandbox previews only); header gained anchor nav (Analyze / Live scan / AI analysis).
- **Allocation donut** (`components/ui/donut.tsx`, dependency-free SVG) in the portfolio card with a matched color-coded legend + mini progress bars, plus an empty-chart state; same donut reused in the recommendation's allocation card (center = blended APY).
- **Risk meter** (`components/ui/risk-meter.tsx`) in the risk assessment card (gradient Low→High, score marker).
- **Opportunity top-pick cards** (Top APY / Largest pool / Lowest risk) above the sortable table.
- Consistent **section eyebrows** across Portfolio ("Your wallet · on-chain"), Live yield scan ("Live data · yield scan"), and AI analysis ("AI agent · explainable plan"); tables stay horizontally scrollable on small screens.

### Engineering / hygiene
- Scripts: `dev`, `build`, `start`, `test` (vitest, unit tests), `lint` (ESLint flat config), `typecheck` (`tsc --noEmit`).
- README fully rewritten with architecture diagram, trust-boundary table, honest limitations, and all 17 requested sections.
- Mobile header nav (`components/app/mobile-nav.tsx`) with accessible hamburger toggle.
- Env template: `.env.example` (documented in the README).
- Turbopack `ignoreIssue` for `@coinbase/cdp-sdk` optional deps (unused by this app) so the build stays green.

### Verified
- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- `npm run test` (vitest) — **34 unit tests** pass: risk model, simulation math, formatting utilities, portfolio snapshots, isStablecoin, getMockPortfolio determinism, notification templates + subscriber store + Telegram command parser.
- Hostile QA battery (41 adversarial cases): all invalid inputs return 400, zero 500s/500s-unexpected (the only non-validation codes now are intentional 429 rate limits), dead upstreams return honest 502s, no fabricated data.
- Headless Chrome E2E: mobile overflow clean (scrollWidth = clientWidth), 0 console errors, 0 page errors, full demo flow (connect → recommendation → chat) works.
- Security headers present: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- Portfolio route correctly rejects missing/invalid chainId (400), Sepolia reads (502), and mainnet reads (200 with real balances).
- README fully rewritten with honest architecture diagram, trust-boundary table, correct RainbowKit version (2.2.11), all 17 requested sections.

### Security hardening applied
- `next.config.ts` adds basic security headers for all routes (X-Frame-Options DENY, CSP frame-ancestors 'none', nosniff, referrer, permissions). Full CSP omitted (Next/Turbopack inline scripts would break a judging demo).
- `/api/portfolio` now requires `chainId` (positive integer); invalid values → 400 INVALID_CHAIN_ID. Non-mainnet chains → 502 with an explicit message ("supports Ethereum mainnet only"). This prevents silent mislabeling of mainnet reads against a wallet on another network.
- **Rate limiting (all routes, in-memory sliding window)**: `read` 60/min, `write` 10/min, `llm` 2/min → `429 RATE_LIMITED` + `Retry-After`. Verified over-limit: 60×200 then 5×429.
- **Request body cap 64 KB** (`413 PAYLOAD_TOO_LARGE`, verified) + `amountUsd` ≤ $1T + ≤20 allocations checked **before** iterating (verified 21 allocs → 400).
- **LLM endpoint hardened**: `/api/recommend` 2/min + body cap — closes the unauthenticated "up to 8 OpenAI calls/request" credit-drain (audit C1).
- **Sanitized errors**: raw exception messages removed from all route responses (fixed codes only, e.g. `INVALID_PARAMS`, `*_UNAVAILABLE`).
- `chainId` hardening on `/api/chain` + preview (strict `^\d{1,10}$`, unsupported chain → 400).
- **Telegram notifications live** (`lib/notifications/*`, `app/api/notifications/*`) with zero new deps: templates (MarkdownV2, escaped), subscriber store, yield-alert threshold ±1.0 APY point, on-demand portfolio summary, and automatic recommendation delivery after `/api/recommend`. Alerts trigger is Bearer-guarded by `NOTIFICATION_CRON_SECRET`; without a bot token all endpoints return `503 NOT_CONFIGURED` gracefully.
- **Live bot verified** against a real bot (@My_dei_ai_bot, token set in gitignored `.env.local`): `getMe`/`setMyCommands` ok; `sendMessage` round-trips to api.telegram.org (a bogus chat correctly returns Telegram's own `400 chat not found`). Command dispatch (`/start`, `/portfolio`, `/status`, `/stop`) and register/status/unregister all work across routes; alerts endpoint returns `401` without the cron secret, `200` (50 pools checked, 0 errors) with it, and `POST ...?type=portfolio&address=0x…` delivers a snapshot. **Human delivery confirmed** — a live `/start` + `/portfolio` + a direct confirmation message were successfully delivered (`ok:true, message_id:5`) to the user's real chat (id 6238105110).
- **Local bot integration** — `scripts/telegram-poll.mjs` + `npm run telegram:watch` long-polls `getUpdates` and forwards updates to `/api/notifications/webhook`, so the bot works on localhost with no public webhook URL (production instead uses Telegram `setWebhook` → https://host/api/notifications/webhook).
- **Subscriber store shared across route handlers** via `globalThis` (Symbol-keyed) so `/webhook` → `/register` → `/alerts` → `/recommend` see the same registry under `next start`. Store resets on process restart (demo scope; DB is the production answer).
- **Command parser bug fixed**: `/start …` was being stripped to an empty command (regex dropped the whole token) so registrations never happened — parse logic extracted to `lib/notifications/commands.ts` (pure, unit-tested) and used by the webhook handler.
- Deep security audit recorded 19 findings (C1, H1, H2, H3, 5 Medium, rest Low/Info); C1 + H1 + H3 resolved. **H2 (28 npm audit advisories − 2 high: `@coinbase/cdp-sdk`/axios + url-parse... ; ws via walletconnect) pending a dependency decision.**
- Performance (prod build, port 3140, `ms`): home 11; opportunities 822 cold / 20 warm (DefiLlama fetch = main bottleneck, cached 5 min); ask 114 cold / 55 warm; recommend fallback 67; chain 301; simulate 33; portfolio demo 48. `.next` 284 MB (static 6.7 MB).

---

## 2. How to run

### Prerequisites
- Node.js ≥ 20.9 (built/tested on Node 23)
- npm

### Quick start (Demo Mode — no wallet or API key needed)
```bash
npm install
npm run dev
```
Open http://localhost:3000. Click **Connect Wallet** → pick **Portfolio A/B/C**. The portfolio section appears, the "Live yield scan" pulls real data from DefiLlama, and the **AI ANALYSIS** section auto-runs (via the deterministic rule-based planner if `OPENAI_API_KEY` isn't set). Requires network for live data; errors are surfaced cleanly if offline.

### AI agent with the LLM (optional)
```bash
# .env.local
OPENAI_API_KEY=<your key>
```
The agent then runs the multi-round tool-calling loop (the LLM proposes allocation percentages; all APYs/yields/risks/balances still come from deterministic code). Leave unset to keep the always-available rule-based fallback.

### Real wallet mode
```bash
cp .env.example .env.local
# edit .env.local, add:
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your walletconnect cloud id>
npm run dev
```
Then connect with MetaMask etc. via the RainbowKit modal.

### Other commands
```bash
npm run build            # production build (Turbopack)
npm start                # serve the production build
npm run test             # unit tests (vitest, offline, 34 tests)
npm run lint             # ESLint
npm run typecheck        # TypeScript checking
```

### Useful endpoints
- `GET /api/portfolio?address=0x…&mode=demo|live&chainId=1` (chainId required; live = on-chain mainnet balances only, other chains → 502)
- `GET /api/opportunities?chains=Ethereum,Arbitrum,Base&limit=10&minTvl=1000000`
- `GET /api/chain?chainId=1|11155111|…` (live RPC read with labelled simulated fallback; unsupported chainId → 400)
- `POST /api/recommend` — body `{ "address": "0x…" }` → `Recommendation` (LLM-limited 2/min; pushes recommendation to the wallet's Telegram subscriber if registered)
- `POST /api/simulate` — body `{ "address": "0x…", "allocations": [{ "opportunityId", "amountUsd" }] }` → `SimulationResult`
- `POST /api/transactions/preview` — same body (+ optional `chainId`) → sandbox-only `TransactionPreview` (never broadcasts)
- `POST /api/notifications/register` — body `{ "action": "register|unregister|status", "chatId", "address" }` (Telegram bot integration; requires `TELEGRAM_BOT_TOKEN`)
- `GET/POST /api/notifications/webhook` — Telegram bot updates handler (commands `/start <wallet>`, `/stop`, `/portfolio`, `/status`, `/help`)
- `POST /api/notifications/alerts` — yield-alert trigger (Bearer `NOTIFICATION_CRON_SECRET` when set); or `POST /api/notifications/alerts?type=portfolio&address=0x…` for an on-demand portfolio snapshot; `GET` shows subscriber counts

### Demo data note
Demo-mode portfolio balances are simulated and always labelled `source: "demo"`. In real-wallet mode, balances come from read-only on-chain reads and are labelled `source: "live"`. Yield data is live from DefiLlama and labelled `source: "live"`. **Every "AI recommendation" is a proposal only — the app deliberately never signs or broadcasts transactions.**

---

## 3. What to do next (in priority order)

1. **Resolve the `npm audit` advisories (H2)** — 2 high (axios via `@coinbase/cdp-sdk`, url-parse/ws via walletconnect `@walletconnect/ethereum-provider`) + 26 moderate. Most are in unused-for-this-app optional deps (`@coinbase/cdp-sdk` has the Turbopack ignoreIssue); decides whether to drop/upgrade those deps or accept demo-scope risk.
2. **Integration / E2E test suite** — extend beyond the current 34 vitest unit tests to cover end-to-end flows (API contract tests, browser-based integration with a test wallet provider, notification webhook → command dispatch).
3. **Persistent notification store** — subscribers currently live in memory (shared across routes via `globalThis`, but reset on process restart and not shared across multiple server instances); move to Redis/SQLite so Telegram registrations survive deploys. Add a Telegram long-polling runner as a webhook-less option for local dev.
4. **Reporting/ops follow-ups** — mark testnet as buyable in demo wallets; add gas estimates to the preview; final pass on copy/tone.
5. **Hackathon checklist** — init the Git repo for the submission, keep commits inside the build window, write the 1-minute demo script (walk the journey strip: Connect → Analyze → Ask AI → Recommendation → Simulate → Telegram), record the demo video and link it from the README.
6. **Asset-relevance depth** — the fallback already searches risk-first by the wallet's assets; add the same asset targeting to the LLM path's discovery prompt (e.g. prefer pools whose `asset` matches the wallet's stables).
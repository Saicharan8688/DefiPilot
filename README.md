# DeFiPilot

**AI DeFi financial agent that explains its reasoning** — reads a wallet on-chain, analyzes live yield markets, and produces a fully explainable, risk-scored allocation plan. Built for the *SwarmFi — AI Agents x DeFi* buildathon.

> **Safety first**: DeFiPilot is **read-only and simulation-only**. It never signs, never broadcasts, never handles private keys, and never moves funds. Live on-chain interactions are reads; every "transaction" is a sandboxed preview.


## 1. One-line pitch

> An AI agent that tells you *exactly* why your DeFi allocation makes sense — with every number traceable to deterministic code over live market data.

## 2. Problem

DeFi is powerful but opaque. Yield markets change by the hour, risk is multi-dimensional (APY magnitude, reward durability, TVL/liquidity, impermanent loss), and most "AI DeFi" tools just write marketing copy around hard-coded numbers. Retail users can't tell a reasoned recommendation from a hallucination — and nobody gets to see *why* an allocation was chosen.

## 3. Solution

DeFiPilot gives users a **readable, provable plan**:

- Analyzes the connected wallet (balances, idle stablecoin capital, concentration).
- Discovers live yield pools across protocols and chains.
- Produces a concrete allocation: **60% / 30% / 10%** style diversification across pools, with per-pool amounts, APYs, expected annual yield, blended APY, and a weighted portfolio risk score.
- Explains the plan in a 7-part breakdown (portfolio insight → opportunities → risk → recommended action → why → expected outcome → warnings).

The critical design guarantee: **the AI never does math and never invents numbers.** It reasons and orchestrates; deterministic application code computes every figure.

## 4. Why AI is necessary

- **Reasoning + orchestration**: the agent decides *which* tools to call, in what order (inspect portfolio → scan markets → compare candidates → finalize), and *why* — e.g. "this wallet is 45% stablecoins, so idle capital should be diversified into low-risk lending pools".
- **Natural-language explanations**: it converts structured, tool-returned data into a concise, honest, human explanation (why these pools, which risks apply, what assumptions are baked in).
- **Conversation**: a chat integration answers follow-up questions ("why not Aave?", "what happens at 50% allocation?", "which pick is riskiest?") by re-running the same deterministic math — not by freewheeling.

None of these tasks is arithmetic. When there is no LLM key configured, a rule-based planner replaces the reasoning layer so the demo never depends on a paid API.

## 5. Why blockchain is necessary

The product's input and output are blockchain-native:

- **Wallet/state**: portfolio analysis reads real on-chain token balances and chain state (block number, gas price) via a read-only public RPC, using `viem`.
- **Transaction infrastructure**: the recommended plan maps to concrete, simulated approval + deposit/supply transactions (`/api/transactions/preview`) — the same shape a real signer would execute, clearly sandboxed.
- **Ground truth**: balances come from the chain, not from a database the app controls.

The blockchain layer is deliberately **read-only**: no signatures, no broadcasts, no private keys. The app shows what it would do; a human (or a future executor) decides whether to sign.

## 6. How the AI agent works

```
User request ─► Recommendation engine
                  │
        ┌─────────┴──────────┐
        │                    │
  LLM mode (optional)   Rule-based mode (default)
  gpt-4o-mini            deterministic planner
  tool-calling loop      (lib/ai/fallback.ts)
        │                    │
        └─────────┬──────────┘
                  ▼
        AI reasons & orchestrates (never does math)
        ┌────────────────────────────────────┐
        │  8 tools, all code-backed:          │
        │  · getWalletPortfolio               │
        │  · getDeFiOpportunities             │
        │  · getProtocolData                  │
        │  · calculatePortfolioMetrics        │
        │  · calculateExpectedYield           │
        │  · calculateRiskScore               │
        │  · simulateAllocation               │
        │  · finalizeRecommendation           │
        └────────────────────────────────────┘
                  ▼
      Deterministic application code computes
      every financial number (finalizeRecommendation,
      metrics, risk model, simulation)
                  ▼
      Plan: allocations, expected yield, risk,
      explanations (all labelled engine: llm|fallback)
```

The LLM proposes only **percentages**; code validates them against live data, normalizes them to 100%, computes dollar amounts, expected annual yield, blended APY, and weighted risk, and refuses unknown pool ids. If the LLM fails or no key is set, the exact same plan shape is produced by the rule-based planner. The user can always see `engine: "llm"` vs `engine: "fallback"` in the UI.

The Q&A chat (`/api/ask`) is **always deterministic** — it classifies the intent and answers by recomputing the recommendation and its related numbers, so it can never fabricate a figure.

## 7. Architecture

```
┌──────────────────────────── App (Next.js 16 App Router, React 19) ────────────────────────────┐
│                                                                                                │
│  Landing page        Header/nav          Chain feed   Wallet connect   Portfolio view          │
│  Opportunity scan    AI analysis (7-part)  Chat  Simulation  Tx preview                        │
│                                                                                                │
│  ┌─────────────────────────────── Client (React query) ─────────────────────────────────────┐ │
│  │  components/*            demo wallet provider          wagmi + RainbowKit (real mode)    │ │
│  └──────────────────────────────────────┬───────────────────────────────────────────────────┘ │
│                                          │ JSON over REST                                    │
│  ┌───────────────────────────────────────▼─────────────────────────────────────────────────┐ │
│  │  API routes (Node runtime)                                                                 │  │
│  │  /api/portfolio   balances (demo | mainnet RPC)                                            │  │
│  │  /api/opportunities   yield pools (DefiLlama)                                              │  │
│  │  /api/chain       block + gas (public RPC, simulated fallback)                             │  │
│  │  /api/recommend   recommendation (agent)                                                   │  │
│  │  /api/simulate    allocation simulation                                                   │  │
│  │  /api/transactions/preview   simulated approve + supply steps                              │  │
│  │  /api/ask         deterministic Q&A over the recommendation                                │  │
│  └──────────────────────────────────────┬─────────────────────────────────────────────────┘ │
│                                          │                                                    │
│                                          ▼                                                    │
│  ┌────────────────────────────────── lib (deterministic, shared) ──────────────────────────┐  │
│  │  ai/      agent (LLM orchestrator) · fallback (rule planner) · tools · simulation ·      │  │
│  │           metrics · qa (chat engine)                                                     │  │
│  │  defi/    DefiLlama adapter + 5-min cache + risk model                                   │  │
│  │  chain/   viem clients · chain metadata · live balances (read-only)                      │  │
│  │  mock/    deterministic demo portfolios                                                  │  │
│  └──────────────────────────────────────┬─────────────────────────────────────────────────┘  │
│                                          │                                                    │
│  ┌───────────────────────────────────────▼─────────────────────────────────────────────────┐ │
│  │  External (read-only)                                                                      │ │
│  │  · DefiLlama yields API (APY/TVL)  · DefiLlama coins API (prices)                        │ │
│  │  · Ethereum mainnet / Sepolia public RPC (balance + chain state)                         │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Trust boundary.** The three layers are strictly separated:

| Layer | Responsibility | Trust rule |
| ----- | -------------- | ---------- |
| **AI (LLM or rule planner)** | Reasoning, orchestration, prose | Never performs financial arithmetic; never writes numbers into the plan |
| **Deterministic code** | All financial calculations (amounts, yields, risk, simulation) | Quoted numbers come only from here |
| **Blockchain (RPC)** | Wallet balances, chain state, transaction shape | Read-only; no signatures, no broadcasts |

## 8. Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- **Styling**: Tailwind CSS 4
- **Blockchain**: `wagmi` 2.19, `viem` 2.56, RainbowKit 2.2.11 (mainnet + Sepolia; read-only)
- **Data**: DefiLlama `yields` + `coins` APIs (live), public RPCs
- **AI**: OpenRouter SDK (`openai/gpt-4o-mini`, optional) + deterministic fallback/QA engines
- **State/data fetching**: `@tanstack/react-query`

## 9. Main features

- **Wallet connection** — real RainbowKit wallet (with a WalletConnect project ID) or 3 built-in deterministic demo wallets (A: stablecoin-heavy, B: balanced, C: growth). Demo mode is the default and needs zero configuration.
- **Live yield scan** — real APY/TVL across chains from DefiLlama, filtered/sorted, with a transparent, code-computed risk score (APY magnitude, reward share, APY volatility, TVL/liquidity, impermanent-loss exposure → clamped 1–99, Low/Medium/High).
- **Portfolio analysis** — total value, idle stablecoin capital, concentration, token split with a donut chart. Demo balances are labelled as such; live mode reads real on-chain balances.
- **Explainable AI recommendation** — 7-part breakdown of the plan with per-pool amounts, APYs, expected annual yield, blended APY, and weighted portfolio risk.
- **AI chat** — deterministic Q&A ("why Aave?", "allocate 50% instead?", "which is riskiest?") that always recomputes from ground truth.
- **Simulation** — reconstructs APY/yield/risk for any allocation you propose; input-validated sandbox, not real execution.
- **Transaction preview** — shows the concrete approval + supply/deposit steps the plan implies, clearly marked `approved: false / executed: false`.
- **Chain feed** — live block number + gas price; degraded to clearly-labelled simulated values when an RPC is unreachable.
- **Telegram notifications** — a Telegram bot sends the AI's findings to your chat: yield alerts when a tracked pool's APY changes significantly, on-demand portfolio snapshots, and AI recommendation delivery. Register by sending `/start <wallet>` to the bot or via the API.
- **Honest failure handling** — every data failure surfaces a labelled error/retry state; nothing is silently presented as real.

## 10. Setup

Requirements: **Node 20+** (tested on Node 23), npm 10+.

```bash
npm install
```

## 11. Environment variables

All variables are optional — the app runs fully in **Demo Mode** with none of them. Copy `.env.example` to `.env.local` and fill in what you need.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | *(empty)* | Empty = Demo Mode (simulated wallets). Set to enable RainbowKit real wallets. |
| `NEXT_PUBLIC_CHAIN_ID` | `1` | Default chain for reads (mainnet). |
| `NEXT_PUBLIC_OPPORTUNITY_LIMIT` | `10` | Default number of opportunities returned. |
| `OPENROUTER_API_KEY` | *(empty)* | Empty = rule-based planner. Set to enable the LLM tool-calling agent. Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys). |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Model used for the agent + explanations. See [openrouter.ai/models](https://openrouter.ai/models) for free models. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | App URL for OpenRouter attribution (optional but recommended). |
| `DEFILLAMA_BASE_URL` | `https://yields.llama.fi` | Yield data endpoint override (mainly for testing). |
| `DEFILLAMA_CACHE_TTL_MS` | `300000` | In-memory pool cache TTL (min 30 000). |
| `RPC_URL` | `https://ethereum.publicnode.com` | Mainnet RPC (read-only). |
| `TESTNET_RPC_URL` | `https://ethereum-sepolia.publicnode.com` | Testnet RPC (read-only). |
| `COINS_BASE_URL` | `https://coins.llama.fi` | Asset price endpoint for live balances. |
| `TELEGRAM_BOT_TOKEN` | *(empty)* | Empty = notifications endpoints report "not configured" (HTTP 503). Set to enable the Telegram bot. |
| `NOTIFICATION_CRON_SECRET` | *(empty)* | Bearer token required by `/api/notifications/alerts` when set (protects cron/API-triggered sends). |

## 12. Running locally

```bash
npm install
npm run dev        # development (http://localhost:3000)
npm run dev:all    # start app + Telegram poller together (single command)
npm run build      # production build
npm run start      # serve the production build
npm run test       # unit tests (vitest, offline)
npm run test:demo  # Playwright demo recording test (records 60s video)
npm run lint       # ESLint (flat config)
npm run typecheck  # tsc --noEmit
npm run telegram:watch  # Telegram long-poller (local bot integration)
```

Open http://localhost:3000. No configuration needed.

### Recording a demo video (Playwright)

```bash
npm run build
npm run start &
npm run test:demo
```

This records a full 60-second demo flow as `test-results/**/*.webm` (headless Chromium, 1280x720). The test covers the full judge flow: connect wallet → portfolio → AI analysis → yield scan → recommendation → simulation → transaction preview.

### Quick Demo Start (for judges)

```bash
npm install
npm run dev:all
```

This starts both the Next.js app (port 3000) and the Telegram long-poller in one command. Then:

1. Open http://localhost:3000
2. Click **Connect Wallet** → pick **Portfolio B**
3. Message `@My_dei_ai_bot` on Telegram: `/start 0xdcf1a13b2a5e2c4f9a8e7d1c3b5f9a7e1c3d5b2a`
4. Watch the AI analysis auto-run, then try `/portfolio` and `/status` in the chat

### Setting up Telegram notifications

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy its token into `TELEGRAM_BOT_TOKEN` in `.env.local`. All notification endpoints return `503 NOT_CONFIGURED` until a valid token is present.
2. Optionally set `NOTIFICATION_CRON_SECRET` (generate with `openssl rand -hex 32`) to guard the alert-trigger endpoint.

**Run it locally (zero setup, no public URL needed):**

```bash
npm run dev             # terminal 1 — start the app (http://localhost:3000)
npm run telegram:watch  # terminal 2 — polls Telegram and forwards updates to the app
```

`telegram:watch` uses Telegram's long-polling API (`getUpdates`) and forwards each message to your local webhook endpoint automatically — no ngrok/tunneling required for development. Then on Telegram, message your bot:

```
/start 0xYourWalletAddress
```

The bot replies, registers the wallet for all three triggers (yield alerts, portfolio summaries, recommendation delivery), and from then on forwards the AI's outputs to your chat.

**Production / deployed app:** instead of polling, point Telegram at the app's webhook handler — call `setWebhook` with your public URL `https://your-host/api/notifications/webhook`, then run the app with the bot token set (no `telegram:watch` needed; Telegram pushes updates to the endpoint).

**Commands:** `/start <wallet>`, `/portfolio` (snapshot on demand), `/status`, `/help`, `/stop`.

**Triggers:**
- **Yield alerts** — periodic call (e.g. cron) to `POST /api/notifications/alerts` notifies subscribers when a watched pool's APY moves by more than ±1.0 percentage point. Send `Authorization: Bearer <NOTIFICATION_CRON_SECRET>` (enforced whenever a token is set; 401 without it).
- **Portfolio summary** — `POST /api/notifications/alerts?type=portfolio&address=0x<wallet>` pushes a snapshot to that wallet's subscriber.
- **Recommendation delivery** — `/api/recommend` automatically pushes the AI plan to the wallet's Telegram subscriber after each analysis.

*Demo caveat:* subscribers live in an in-memory store that is shared across route handlers (so `/webhook`, `/register`, `/alerts`, `/recommend` all see the same registry) but resets on server restart or when `telegram:watch` restarts along with the app. A persistent store is future work. *Telegram privacy:* the bot can only message a user after that user has sent `/start` to the bot once — that step can't be automated.

## 13. Demo flow (judge-ready, offline-safe)

1. Load the app (Demo Mode if no WalletConnect ID set).
2. Click **Connect Wallet** and pick **Portfolio B** (mixed ETH + stablecoins).
3. The **live yield scan** loads real DefiLlama pools; the **AI analysis** renders a 7-part explainable recommendation with allocation donut, per-pool APYs, expected annual yield, and a risk meter.
4. Expand **Simulate** to tweak the proposed split and see deterministic outcomes, or **Prepare transaction (preview)** to inspect the simulated approval + supply steps.
5. Ask the chat questions — *"why this allocation?"*, *"allocate 50% instead"*, *"which pick is riskiest?"* — and see it recompute honest answers.

Recommended: leave `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `OPENROUTER_API_KEY` **empty** for judging (deterministic, free, fully functional). To see the LLM agent in action, set `OPENROUTER_API_KEY` and re-analyze — the plan shape is identical, only the reasoning/prose layer changes.

## 14. Limitations (honest)

- **Demo portfolio is simulated.** Benefits drawing the wallet's balance — live-balance mode reads on-chain (Ethereum mainnet); **other chains (e.g. Sepolia) return an explicit error** rather than mislabeling mainnet readings. The **AI analysis always uses the deterministic demo snapshot**, even in live mode. (Security-by-design: analysis never runs against real balances.) Every demo dataset is labelled `source: "demo"`.
- **Demo wallets are deterministic happy-path only** — there is no wallet-rejection or empty-wallet path in demo mode.
- **No real execution.** Transactions are previews; nothing is signed, broadcast, or executed. A real executor (e.g. a smart-contract execution layer) is future work.
- **Prices can be absent.** DefiLlama price misses surface as `priceUsd: null` with a "price unavailable" label — never a fabricated price.
- **Live data can be down.** DefiLlama or public RPC outages degrade to labelled fallbacks (error states, simulated chain feed). Cached successes are kept for 5 minutes.
- **Optional LLM quality.** Without a key the two-word-cost round is rule-based; the LLM path adds latency and a paid dependency. On any LLM failure the app falls back automatically.
- **Unit tests cover deterministic core + protection layer.** The current `npm run test` (vitest) tests the pure, offline modules — risk model, simulation math, formatting utilities, portfolio snapshots, and the notification templates/store. **A Playwright demo recording test (`npm run test:demo`) covers the full 60s judge flow but is not a comprehensive integration/E2E test suite.**

## 15. Security considerations

- **Read-only blockchain layer**: the app never signs, broadcasts, or touches private keys; all RPC reads are `eth_*`/`call` only. No executor wallet exists.
- **Input validation on every route**: addresses via `viem` checksum, numeric bounds, ≤20 allocations, ≤12 chains, ≤400-char questions, charset allowlists, strict integer `chainId`. Invalid input returns `400 INVALID_*`, upstream failures return `502 *_UNAVAILABLE`.
- **Rate limiting on every route** (in-memory sliding window): `read` 60 req/min, `write` 10 req/min, `llm` (recommend) 2 req/min. Over-limit requests get `429 RATE_LIMITED` with a `Retry-After` header. The limiter is per-process (resets on restart); production should move to Redis/Upstash/Vercel KV.
- **Request body cap (64 KB)** → `413 PAYLOAD_TOO_LARGE`, plus explicit bounds on `amountUsd` (≤ $1T) so unbounded loops can't be forced through simulate/preview.
- **Sanitized error responses** — internal exception messages never leak to clients; routes return fixed error codes.
- **LLM endpoint hardening** — `/api/recommend` is limited to 2 req/min and rejects oversized bodies, closing the "unauthenticated OpenAI credit drain" hole.
- **No runtime injected HTML** — user-provided question text is rendered as React text nodes.
- **Secrets**: no credentials are committed; `.env.example` carries no real keys; only `NEXT_PUBLIC_*` reads appear client-side.
- **Basic security headers applied**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a minimal `Content-Security-Policy` (`frame-ancestors 'none'`) are set in `next.config.ts`. A full CSP is omitted deliberately (Next.js/Turbopack injects inline scripts/styles; a strict policy would break a demo).
- **Known remaining demo-scope gaps**: no auth on general API routes, no per-user data isolation, no integration/E2E tests, and the notify endpoint's cron secret is skipped when unset (demo).

## 17. Troubleshooting

### Hydration Error: `<div>` cannot be a descendant of `<p>`
If you see `In HTML, <div> cannot be a descendant of <p>. This will cause a hydration error`, check for `<p>` tags containing block-level elements like `<div>`, `<ul>`, `<ol>`, or `<table>`. React's HTML parser closes `<p>` tags before block elements, causing a server/client mismatch.

**Fix**: Replace `<p>` with `<div>` or use inline elements (`<span>`) for inline content. In this codebase, the `Card` component uses `<section>` and `<div>` instead of `<p>` for block content.

### Multiple Telegram Bot Instances (409 Conflict)
```
[1] [telegram:watch] getUpdates failed: {"ok":false,"error_code":409,"description":"Conflict: terminated by other getUpdates request"}
```
**Cause**: Multiple `npm run telegram:watch` or `npm run dev` processes running simultaneously.

**Fix**:
```bash
# Kill all instances
pkill -f "telegram-poll" && pkill -f "next dev"
# Restart cleanly
npm run dev:all
```

### No `/portfolio` Reply in Telegram
**Cause**: User hasn't sent `/start <wallet>` to the bot first (Telegram privacy restriction).

**Fix**: User must first message the bot `/start 0xYourWalletAddress` to register. The bot cannot initiate conversations.

### No `/portfolio` Reply for Empty Wallet
**Behavior**: Bot replies with a valid snapshot showing `$0` total with "No USD-valued balances to chart yet" message (never fails silently).

### Yield Alerts Not Firing
- Alerts trigger only when a watched pool's APY changes by **≥1.0 percentage point**
- First run establishes baseline (0 alerts)
- Trigger via cron: `POST /api/notifications/alerts` with `Authorization: Bearer <NOTIFICATION_CRON_SECRET>` and `{"type":"yield"}`
- **Portfolio alerts**: `POST /api/notifications/alerts?type=portfolio&address=0x...`

### Build Fails with "Module not found"
After `rm -rf node_modules && npm install`, ensure `.next/` is cleared:
```bash
rm -rf .next node_modules && npm install && npm run build
```



- Real executor (safe signer, intents/EIP-7702) so the plan can actually be executed — with explicit consent UI.
- Analysis over real on-chain balances (optionally opt-in), with a no-telemetry guarantee.
- Multi-chain portfolio reads (the RPC layer already knows Base/Arbitrum/OP).
- Deeper per-protocol risk inputs (audits, insurance, governance) beyond the current pool-level model.
- Persistent + per-user notification store, Telegram long-polling fallback for local dev, and a hosted deployment.
- Distributed rate limiting (Redis/Upstash KV) and a real integration/E2E test suite.




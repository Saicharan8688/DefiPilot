import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/app/header";
import { ChainInfo } from "@/components/chain/chain-info";
import { Badge } from "@/components/ui/badge";
import { PortfolioSection } from "@/components/portfolio/portfolio-section";
import { OpportunitiesSection } from "@/components/opportunities/opportunities-section";
import { RecommendationSection } from "@/components/recommendation/recommendation-section";

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-3 grid size-10 place-items-center rounded-xl bg-zinc-800 text-emerald-300">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>
    </div>
  );
}

const JOURNEY = [
  {
    title: "Connect your wallet",
    text: "Read-only. No private keys leave your browser — nothing is ever signed here.",
  },
  {
    title: "Analyze your portfolio",
    text: "On-chain balances are read from the network and valued automatically.",
  },
  {
    title: "Ask the AI",
    text: "The agent scores live pools for yield, liquidity and risk — it never invents numbers.",
  },
  {
    title: "Get a recommendation",
    text: "An explainable allocation plan where every figure is computed by code.",
  },
  {
    title: "Simulate",
    text: "Preview the exact steps before you approve anything. Sandbox only.",
  },
];

const FEATURES = [
  {
    icon: <span className="text-lg font-bold">%</span>,
    title: "Live DeFi yields",
    description: "Pool data pulled straight from DefiLlama, normalized and risk-scored per pool.",
  },
  {
    icon: <span className="text-lg font-bold">O</span>,
    title: "Explainable AI",
    description: "Each allocation comes with a written reason. The AI shows its work, always.",
  },
  {
    icon: <span className="text-lg font-bold">↑</span>,
    title: "Simulate first",
    description: "Preview every step of the plan before committing. Non-custodial by design.",
  },
  {
    icon: <span className="text-lg font-bold">Ø</span>,
    title: "No fabricated numbers",
    description: "APYs, prices, TVL and balances all come from code over ground-truth sources.",
  },
];

const EVIDENCE = [
  "Read-only RPC · viem",
  "Live yields · DefiLlama",
  "Prices · DefiLlama coins",
  "Sandbox previews only",
];

export default function Home() {
  return (
    <>
      <Header />
      <ChainInfo />

      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 blur-3xl"
        />

        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          {/* Hero — answers the four questions in ~5 seconds */}
          <section className="py-16 text-center sm:py-24">
            <Badge tone="brand" className="mb-6">
              AI Agent × DeFi · read-only
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
              Your AI DeFi analyst — plans you can see and explain
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-zinc-400">
              DeFiPilot reads your wallet on-chain, scans live yield pools across
              protocols, and explains exactly why each allocation makes sense. It
              proposes — you stay in control.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="#portfolio"
                className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
              >
                Analyze my wallet →
              </Link>
              <Link
                href="#opportunities"
                className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/60"
              >
                See the live yield scan
              </Link>
            </div>
            <p className="mt-6 text-xs text-zinc-500">
              Demo mode pre-enabled · testnet &amp; simulation only · no funds at risk
            </p>
          </section>

          {/* Evidence chips — where the blockchain + data actually live */}
          <section className="pb-14">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
              {EVIDENCE.map((e) => (
                <span
                  key={e}
                  className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-400"
                >
                  {e}
                </span>
              ))}
            </div>
          </section>

          {/* Journey — the primary CTA flow, top to bottom */}
          <section className="pb-16">
            <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
              The journey
            </p>
            <div className="mx-auto mt-6 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {JOURNEY.map((step, i) => (
                <div
                  key={step.title}
                  className="relative flex gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-xs font-bold text-zinc-950">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{step.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </section>
        </main>
      </div>

      <PortfolioSection />
      <OpportunitiesSection />
      <RecommendationSection />
    </>
  );
}
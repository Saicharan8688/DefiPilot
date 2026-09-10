"use client";

import { useState } from "react";
import type {
  ApiResponse,
  Recommendation,
  SimulationResult,
} from "@/lib/types";
import { formatPct, formatUsd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RiskMeter } from "@/components/ui/risk-meter";
import { useWallet } from "@/components/wallet/wallet-provider";
import { AllocationBars } from "./allocation-bars";
import { AllocationDonut } from "@/components/ui/donut";
import { SimulationPanel } from "./simulate-panel";
import { TransactionPreviewCard } from "@/components/transactions/transaction-preview";

const RISK_TONE: Record<string, "success" | "warning" | "danger"> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

const ENGINE_LABEL: Record<string, string> = {
  llm: "AI agent",
  fallback: "Rule-based planner",
};

export function RecommendationView({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const { chainId } = useWallet();
  const {
    summary,
    currentPortfolio,
    opportunities,
    recommendedAllocation,
    expectedYield,
    riskLevel,
    riskScore,
    reasoning,
    warnings,
    assumptions,
  } = recommendation;

  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  async function runSimulation() {
    setSimulating(true);
    setSimError(null);
    setSimulation(null);
    try {
      const payload = {
        address: currentPortfolio.address,
        allocations: recommendedAllocation.map((a) => ({
          opportunityId: a.opportunityId,
          amountUsd: a.amountUsd,
        })),
      };
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<SimulationResult>;
      if (!res.ok || !json.success) {
        throw new Error(json.success ? "Simulation failed" : json.error.message);
      }
      setSimulation(json.data);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold tracking-wide text-emerald-300">
            AI ANALYSIS
          </p>
          <div className="flex items-center gap-2">
            {recommendation.dataProvidedAt && (
              <span className="text-xs text-zinc-500">
                {new Date(recommendation.dataProvidedAt).toLocaleString()}
              </span>
            )}
            <Badge tone="brand">
              {ENGINE_LABEL[recommendation.engine] ?? recommendation.engine}
            </Badge>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-200">{summary}</p>
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">AI recommendation</span>
          <span aria-hidden>≠</span>
          <span className="font-semibold text-amber-300">executed transaction</span>
          <span className="ml-auto hidden sm:inline">
            You stay in control — nothing is signed or broadcast.
          </span>
        </p>
      </div>

      {/* 1. Portfolio insight */}
      <Card
        eyebrow="01 · Portfolio insight"
        title="Current portfolio"
        subtitle="Snapshot used for the analysis."
        action={
          currentPortfolio.source === "demo" ? (
            <Badge tone="warning">Demo balances</Badge>
          ) : (
            <Badge tone="success">On-chain</Badge>
          )
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Total value" value={formatUsd(currentPortfolio.totalUsdValue)} />
          <Stat
            label="Idle stablecoin capital"
            value={formatUsd(currentPortfolio.idleCashUsd)}
          />
          <Stat
            label="Concentration (largest holding)"
            value={formatPct(currentPortfolio.concentration * 100)}
          />
        </div>
        <ul className="mt-5 flex flex-wrap gap-2">
          {currentPortfolio.tokens.map((t) => (
            <li
              key={t.symbol}
              className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs text-zinc-400"
            >
              <span className="font-medium text-zinc-200">{t.symbol}</span>{" "}
              {t.percentage}% · {formatUsd(t.usdValue)}
            </li>
          ))}
        </ul>
      </Card>

      {/* 2. Opportunities found */}
      <Card
        eyebrow="02 · Opportunities found"
        title="Opportunities analyzed"
        subtitle="Shortlist the agent scored using live DefiLlama data."
      >
        {opportunities.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No opportunities could be matched from available live data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">Protocol</th>
                  <th className="pb-2 pr-4 font-medium">Asset</th>
                  <th className="pb-2 pr-4 font-medium">Chain</th>
                  <th className="pb-2 pr-4 text-right font-medium">APY</th>
                  <th className="pb-2 pr-4 text-right font-medium">TVL</th>
                  <th className="pb-2 text-right font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-zinc-800/60 text-zinc-400"
                  >
                    <td className="py-2.5 pr-4 font-medium text-zinc-100">
                      {o.protocol}
                    </td>
                    <td className="py-2.5 pr-4">{o.asset}</td>
                    <td className="py-2.5 pr-4">{o.chain}</td>
                    <td className="py-2.5 pr-4 text-right text-emerald-300">
                      {o.apy.toFixed(2)}%
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {formatUsd(o.tvl, 0)}
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge tone={RISK_TONE[o.riskLevel] ?? "default"}>
                        {o.riskLevel} · {o.riskScore}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 3. Risk analysis */}
      <Card
        eyebrow="03 · Risk analysis"
        title="Risk assessment"
        subtitle="Weighted risk of the recommended plan."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={RISK_TONE[riskLevel] ?? "default"}>
            Overall risk: {riskLevel}
          </Badge>
          <span className="text-sm text-zinc-400">
            Weighted score{" "}
            <span className="font-semibold text-zinc-100">{riskScore}/99</span> —
            computed from APY magnitude, reward share, volatility, liquidity and
            impermanent-loss exposure.
          </span>
        </div>
        <div className="mt-5">
          <RiskMeter score={riskScore} />
        </div>
        <ul className="mt-5 flex flex-wrap gap-2">
          {recommendedAllocation.map((a) => (
            <li key={a.opportunityId} className="text-xs text-zinc-500">
              <span className="text-zinc-300">
                {a.protocol} {a.asset}
              </span>{" "}
              {a.riskLevel} ({a.riskScore})
            </li>
          ))}
        </ul>
      </Card>

      {/* 4. Recommended action */}
      <Card
        eyebrow="04 · Recommended action"
        title="Recommended allocation"
        subtitle="Percentages of deployable capital, normalized by code."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-zinc-500">Expected annual yield</p>
              <p className="text-sm font-semibold text-emerald-300">
                ≈ {formatUsd(expectedYield.totalUsd)}/yr
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Blended APY</p>
              <p className="text-sm font-semibold text-zinc-100">
                {expectedYield.blendedApy.toFixed(2)}%
              </p>
            </div>
          </div>
        }
      >
        {recommendedAllocation.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No allocation was recommended — see the warnings below.
          </p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[auto_1fr]">
            <div className="mx-auto">
              <AllocationDonut
                segments={recommendedAllocation.map((a) => ({
                  label: `${a.protocol} ${a.asset}`,
                  value: a.amountUsd,
                }))}
                size={150}
                centerValue={`${expectedYield.blendedApy.toFixed(2)}%`}
                centerLabel="blended APY"
              />
            </div>
            <div className="w-full min-w-0">
              <AllocationBars allocations={recommendedAllocation} />
            </div>
          </div>
        )}
      </Card>

      {/* 5. Why this recommendation */}
      <Card
        eyebrow="05 · Why this recommendation"
        title="Why?"
        subtitle="The agent's reasoning — every figure verified by code."
      >
        <ul className="space-y-2.5">
          {reasoning.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-zinc-300">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-zinc-800 text-[11px] font-semibold text-emerald-300">
                {i + 1}
              </span>
              <span className="leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Assumptions
          </p>
          <ul className="mt-2 space-y-2">
            {assumptions.map((a, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-zinc-500">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-zinc-600" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* 6. Expected outcome */}
      <Card
        eyebrow="06 · Expected outcome"
        title="Expected outcome"
        subtitle="Code-computed projection at the APYs captured for this analysis."
        action={
          <div className="text-right">
            <p className="text-xs text-zinc-500">Expected annual yield</p>
            <p className="text-sm font-semibold text-emerald-300">
              ≈ {formatUsd(expectedYield.totalUsd)}/yr
            </p>
          </div>
        }
      >
        {recommendedAllocation.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No allocation to project — see warnings below.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {expectedYield.perItemUsd.map((yieldUsd, i) => {
              const a = recommendedAllocation[i];
              if (!a) return null;
              return (
                <div
                  key={a.opportunityId}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <p className="text-xs text-zinc-500">
                    {a.protocol} <span className="text-zinc-700">·</span> {a.asset}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
                    ≈ {formatUsd(yieldUsd)}/yr
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatPct(a.percentage)} · {formatUsd(a.amountUsd)} at {a.apy.toFixed(2)}% APY
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 7. Risks / warnings */}
      <Card
        eyebrow="07 · Risks / warnings"
        title="Warnings"
        subtitle="What could go wrong, stated plainly."
      >
        <ul className="space-y-2">
          {warnings.map((w, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-amber-300/90">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400/60" />
              {w}
            </li>
          ))}
        </ul>
      </Card>

      {/* Actions: simulate + prepare (never executed) */}
      {recommendedAllocation.length > 0 && (
        <div>
          <button
            type="button"
            onClick={runSimulation}
            disabled={simulating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {simulating ? "Simulating…" : "Simulate strategy"}
          </button>
          {simulation && (
            <SimulationPanel
              simulation={simulation}
              loading={simulating}
              error={simError}
            />
          )}
          {simError && !simulating && (
            <SimulationPanel simulation={null} loading={false} error={simError} />
          )}
        </div>
      )}

      {/* Hand-off to the blockchain layer: prepare, never execute. */}
      {recommendedAllocation.length > 0 && (
        <TransactionPreviewCard
          allocations={recommendedAllocation}
          walletAddress={currentPortfolio.address}
          chainId={chainId}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
"use client";

import { useState } from "react";
import type { DeFiOpportunity } from "@/lib/types";
import { formatApy, formatCompactUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "apy" | "tvl";

const RISK_STYLES: Record<string, string> = {
  Low: "bg-emerald-500/15 text-emerald-300",
  Medium: "bg-amber-500/15 text-amber-300",
  High: "bg-red-500/15 text-red-300",
};

function RiskBadge({ level, score }: { level: string; score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        RISK_STYLES[level] ?? "bg-zinc-800 text-zinc-300"
      )}
    >
      <span className="sr-only">Risk: </span>
      {level}
      <span className="text-[10px] opacity-70">{score}</span>
    </span>
  );
}

export function OpportunityTable({
  opportunities,
}: {
  opportunities: DeFiOpportunity[];
}) {
  const [sort, setSort] = useState<SortKey>("apy");

  const sorted = [...opportunities].sort((a, b) =>
    sort === "apy" ? b.apy - a.apy : b.tvl - a.tvl
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-sm text-zinc-400">
        <span>Sort by</span>
        {(["apy", "tvl"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              sort === key
                ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            )}
          >
            {key === "apy" ? "APY" : "TVL"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60">
        {/* Header */}
        <div className="hidden grid-cols-[1.2fr_1fr_0.7fr_1fr_0.7fr_0.7fr] gap-x-4 border-b border-zinc-800 bg-zinc-900 px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 sm:grid">
          <span>Protocol</span>
          <span>Asset</span>
          <span className="text-right">APY</span>
          <span className="text-right">TVL</span>
          <span>Chain</span>
          <span className="text-right">Risk</span>
        </div>

        {/* Rows */}
        <div>
          {sorted.map((opp) => (
            <div
              key={opp.id}
              className="grid grid-cols-1 gap-x-4 gap-y-2 border-b border-zinc-800/50 px-5 py-3 sm:grid-cols-[1.2fr_1fr_0.7fr_1fr_0.7fr_0.7fr] sm:items-center last:border-0 hover:bg-zinc-800/20"
            >
              <span className="text-sm font-medium text-zinc-100">{opp.protocol}</span>
              <span className="text-sm text-zinc-300">{opp.asset}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-emerald-300">
                {formatApy(opp.apy)}
              </span>
              <span className="text-right text-sm tabular-nums text-zinc-400">
                {formatCompactUsd(opp.tvl)}
              </span>
              <span className="text-sm text-zinc-400">{opp.chain}</span>
              <span className="sm:text-right">
                <RiskBadge level={opp.riskLevel} score={opp.riskScore} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
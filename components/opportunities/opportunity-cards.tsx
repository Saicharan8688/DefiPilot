import type { DeFiOpportunity } from "@/lib/types";
import { formatApy, formatCompactUsd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const RISK_TONE: Record<string, "success" | "warning" | "danger"> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

function PickCard({
  label,
  opp,
}: {
  label: string;
  opp: DeFiOpportunity;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge tone="outline">{label}</Badge>
        <Badge tone={RISK_TONE[opp.riskLevel] ?? "default"}>
          {opp.riskLevel} · {opp.riskScore}
        </Badge>
      </div>
      <p className="truncate text-sm font-medium text-zinc-100">
        {opp.protocol} <span className="text-zinc-500">·</span> {opp.asset}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-300">
        {formatApy(opp.apy)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {formatCompactUsd(opp.tvl)} TVL · {opp.chain}
      </p>
    </div>
  );
}

export function OpportunityTopPicks({
  opportunities,
}: {
  opportunities: DeFiOpportunity[];
}) {
  if (opportunities.length === 0) return null;

  const picks = [
    { label: "Top APY", opp: [...opportunities].sort((a, b) => b.apy - a.apy)[0] },
    { label: "Largest pool", opp: [...opportunities].sort((a, b) => b.tvl - a.tvl)[0] },
    { label: "Lowest risk", opp: [...opportunities].sort((a, b) => a.riskScore - b.riskScore)[0] },
  ];

  return (
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      {picks.map((p) => (
        <PickCard key={p.label} label={p.label} opp={p.opp} />
      ))}
    </div>
  );
}
"use client";

import type { RecommendedAllocationItem } from "@/lib/types";
import { formatApy, formatUsd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const RISK_TONE: Record<string, "success" | "warning" | "danger"> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

export function AllocationBars({
  allocations,
}: {
  allocations: RecommendedAllocationItem[];
}) {
  const max = Math.max(...allocations.map((a) => a.percentage), 1);

  return (
    <ul className="space-y-4">
      {allocations.map((a) => (
        <li key={a.opportunityId}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-zinc-100">
                {a.protocol} <span className="text-zinc-400">·</span> {a.asset}
              </span>
              <span className="text-xs text-zinc-500">{a.chain}</span>
            </div>
            <span className="shrink-0 text-zinc-400">
              <span className="font-semibold text-zinc-100">{a.percentage}%</span>{" "}
              · {formatUsd(a.amountUsd)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500"
                style={{ width: `${(a.percentage / max) * 100}%` }}
              />
            </div>
            <Badge tone={RISK_TONE[a.riskLevel] ?? "default"}>
              {a.riskLevel} · {a.riskScore}
            </Badge>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-zinc-500">
            <span>{formatApy(a.apy)}</span>
            <span>≈ {formatUsd(a.expectedYieldUsd)}/yr expected</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
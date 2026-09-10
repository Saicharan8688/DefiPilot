"use client";

import type { SimulationResult } from "@/lib/types";
import { formatApy, formatUsd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const RISK_TONE: Record<string, "success" | "warning" | "danger"> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

export function SimulationPanel({
  simulation,
  loading,
  error,
}: {
  simulation: SimulationResult | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Card
      title="Simulate strategy"
      subtitle="A read-only preview. Nothing is executed, signed or broadcast."
      action={
        <Badge tone="warning" className="shrink-0">
          Simulation only
        </Badge>
      }
      className="mt-4"
    >
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-zinc-400">
          <Spinner className="size-4" /> Simulating the recommended strategy…
        </div>
      )}

      {error && (
        <p className="py-4 text-sm text-red-300">
          Simulation failed: {error}. Please try again.
        </p>
      )}

      {!loading && !error && simulation && (
        <div>
          <ul className="divide-y divide-zinc-800">
            {simulation.steps.map((s) => (
              <li
                key={s.opportunityId}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">
                    {s.protocol} <span className="text-zinc-400">·</span>{" "}
                    {s.asset}
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {s.chain}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatUsd(s.amountUsd)} at {formatApy(s.apy)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={RISK_TONE[s.riskLevel] ?? "default"}>
                    {s.riskLevel}
                  </Badge>
                  <span className="text-sm text-emerald-300">
                    ≈ {formatUsd(s.expectedYieldUsd)}/yr
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-500">Capital deployed</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-100">
                {formatUsd(simulation.totalCapitalUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Expected annual yield</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-300">
                ≈ {formatUsd(simulation.totalExpectedYieldUsd)}/yr
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">
                Blended APY · Weighted risk
              </p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-100">
                {formatApy(simulation.blendedApy)}
                <span className="text-zinc-500"> · </span>
                <span className={simulation.riskLevel === "High" ? "text-red-300" : sentimentColor(simulation.riskLevel)}>
                  {simulation.riskLevel} ({simulation.riskScore})
                </span>
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-zinc-500">{simulation.disclaimer}</p>
        </div>
      )}
    </Card>
  );
}

function sentimentColor(level: string): string {
  if (level === "Low") return "text-emerald-300";
  if (level === "Medium") return "text-amber-300";
  return "text-red-300";
}
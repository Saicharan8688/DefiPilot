"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Loading portfolio",
  "Inspecting wallet assets",
  "Discovering yield opportunities",
  "Comparing risks and yields",
  "Computing allocations",
  "Writing your explanation",
];

export function AnalysisProgress() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setActive((a) => (a + 1) % STEPS.length),
      1400
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <p className="text-sm font-semibold text-zinc-100">AI ANALYSIS</p>
      <p className="mt-0.5 text-sm text-zinc-400">
        The agent is analyzing the wallet with live data. It never invents
        figures.
      </p>
      <ol className="mt-6 space-y-3">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className="flex items-center gap-3 text-sm"
            aria-current={i === active ? "step" : undefined}
          >
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                i < active
                  ? "bg-emerald-500/15 text-emerald-300"
                  : i === active
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "bg-zinc-800 text-zinc-500"
              )}
            >
              {i < active ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="size-3.5"
                  aria-hidden
                >
                  <path d="M5 13l4 4 10-10" />
                </svg>
              ) : i === active ? (
                <span
                  aria-hidden
                  className="size-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"
                />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                i === active ? "text-zinc-100" : i < active ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/components/wallet/wallet-provider";
import { AnalysisProgress } from "./analysis-progress";
import { RecommendationView } from "./recommendation-view";
import { AgentChat } from "./agent-chat";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import type { ApiResponse, Recommendation } from "@/lib/types";

export function RecommendationSection() {
  const { address, isConnected } = useWallet();

  const { data, isLoading, error, refetch, isFetching } = useQuery<
    Recommendation
  >({
    queryKey: ["recommendation", address ?? "none"],
    queryFn: async () => {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const json = (await res.json()) as ApiResponse<Recommendation>;
      if (!res.ok || !json.success) {
        throw new Error(json.success ? "Analysis failed" : json.error.message);
      }
      return json.data;
    },
    enabled: isConnected && !!address,
    staleTime: 8 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <section id="ai-analysis" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      {!isConnected || !address ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-sm font-semibold text-zinc-300">AI ANALYSIS</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Connect a wallet to get a personalized DeFi yield analysis. Read-only:
            no signing, no transactions.
          </p>
        </div>
      ) : isLoading ? (
        <AnalysisProgress />
      ) : error ? (
        <ErrorState
          title="The AI analysis could not be completed"
          message={
            error instanceof Error
              ? error.message
              : "The analysis service is unavailable right now."
          }
          onRetry={() => refetch()}
        />
      ) : data ? (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                AI agent · explainable plan
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
                Your AI analysis
              </h2>
            </div>
            <Badge tone="outline" className="shrink-0">
              {data.engine === "llm" ? "AI agent (tool-using)" : "Rule-based fallback"}
            </Badge>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="ml-auto rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isFetching ? "Re-analyzing…" : "Re-analyze"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <RecommendationView recommendation={data} />
            <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
              <AgentChat address={address} />
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}
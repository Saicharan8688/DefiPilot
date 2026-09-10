"use client";

import { useQuery } from "@tanstack/react-query";
import { OpportunityTable } from "./opportunity-table";
import { OpportunitySkeleton } from "./opportunity-skeleton";
import { OpportunityTopPicks } from "./opportunity-cards";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import type { ApiResponse, OpportunitiesResponse } from "@/lib/types";

const QUERY = "?chains=Ethereum,Arbitrum,Base&limit=10";

export function OpportunitiesSection() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<
    ApiResponse<OpportunitiesResponse>
  >({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch(`/api/opportunities${QUERY}`);
      const json = (await res.json()) as ApiResponse<OpportunitiesResponse>;
      if (!res.ok || !json.success) {
        throw new Error(
          json.success ? "Failed to load opportunities" : json.error.message
        );
      }
      return json;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <section id="opportunities" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Live data · yield scan
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            Live yield scan
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Top opportunities from DefiLlama, normalized and risk-scored.
          </p>
        </div>
        {data?.success && data.data.source === "live" && (
          <Badge tone={data.data.fromCache ? "default" : "success"}>
            {data.data.fromCache ? "Cached live data" : "Live data"}
          </Badge>
        )}
      </div>

      {isLoading && <OpportunitySkeleton />}

      {error && (
        <ErrorState
          title="Could not load opportunities"
          message={
            error instanceof Error
              ? error.message
              : "The live data source is unavailable right now."
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && data?.success && (
        <div className={isRefetching ? "opacity-70 transition-opacity" : undefined}>
          <OpportunityTopPicks opportunities={data.data.opportunities} />
          <OpportunityTable opportunities={data.data.opportunities} />
        </div>
      )}
    </section>
  );
}
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/components/wallet/wallet-provider";
import { Badge } from "@/components/ui/badge";
import type { ApiResponse, ChainInfoResponse } from "@/lib/types";

/**
 * Live read-only network feed: shows where the app is reading from the chain
 * (real RPC reads of block number + gas price). Answers "where is the
 * blockchain?" in the first seconds.
 */
export function ChainInfo() {
  const { chainId } = useWallet();

  const query = useQuery<ApiResponse<ChainInfoResponse>>({
    queryKey: ["chain", chainId],
    queryFn: async () => {
      const res = await fetch(`/api/chain?chainId=${chainId}`);
      const json = (await res.json()) as ApiResponse<ChainInfoResponse>;
      if (!res.ok || !json.success) throw new Error("Chain feed unavailable");
      return json;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const info = query.data?.success ? query.data.data : null;

  return (
    <div className="border-b border-zinc-800/80 bg-zinc-950/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 text-[11px] text-zinc-500 sm:px-6">
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${
              info?.rpc === "live"
                ? "animate-pulse bg-emerald-400"
                : "bg-amber-400"
            }`}
            aria-hidden
          />
          <span className="font-medium uppercase tracking-wider text-zinc-400">
            On-chain feed
          </span>
        </span>

        {info ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-400">Network</span>
              <span className="font-medium text-zinc-200">{info.network}</span>
              {info.isTestnet ? <Badge tone="warning">Testnet</Badge> : null}
            </span>
            <span>
              Chain ID <span className="font-mono text-zinc-300">{info.chainId}</span>
            </span>
            {info.blockNumber != null ? (
              <span>
                Block{" "}
                <span className="font-mono tabular-nums text-zinc-300">
                  {info.blockNumber.toLocaleString()}
                </span>
              </span>
            ) : null}
            {info.gasPriceGwei != null ? (
              <span>
                Gas{" "}
                <span className="font-mono tabular-nums text-zinc-300">
                  {info.gasPriceGwei} gwei
                </span>
              </span>
            ) : null}
            <Badge
              tone={info.rpc === "live" ? "success" : "warning"}
              className="ml-auto shrink-0"
            >
              {info.rpc === "live" ? "Live RPC read" : "Simulated (RPC down)"}
            </Badge>
          </>
        ) : (
          <span>
            {query.isLoading
              ? "Talking to an RPC node…"
              : "Network feed unavailable"}
          </span>
        )}
      </div>
    </div>
  );
}
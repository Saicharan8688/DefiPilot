"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/components/wallet/wallet-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { AllocationDonut, donutColor } from "@/components/ui/donut";
import { formatNumber, formatRelativeTime, formatUsd, shortenAddress } from "@/lib/format";
import type { ApiResponse, Portfolio } from "@/lib/types";

function PortfolioSkeleton() {
  return (
    <Card>
      <div className="mb-5 space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function TokenRow({
  symbol,
  name,
  formattedBalance,
  priceUsd,
  usdValue,
  decimals,
}: {
  symbol: string;
  name: string;
  formattedBalance: number;
  priceUsd: number | null;
  usdValue: number;
  decimals: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-200">
          {symbol.slice(0, 4)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{symbol}</p>
          <p className="truncate text-xs text-zinc-400">{name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums text-zinc-100">
          {formatNumber(formattedBalance, decimals < 9 ? 4 : 6)} {symbol}
        </p>
        {priceUsd != null ? (
          <p className="text-xs tabular-nums text-zinc-400">
            @ {formatUsd(priceUsd)} = {formatUsd(usdValue)}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">price unavailable</p>
        )}
      </div>
    </div>
  );
}

export function PortfolioView() {
  const { address, isConnected, isDemo, chainId } = useWallet();

  const { data, isLoading, error, refetch, isRefetching } = useQuery<ApiResponse<Portfolio>>({
    queryKey: ["portfolio", address, isDemo, chainId],
    queryFn: async () => {
      const mode = isDemo ? "demo" : "live";
      const res = await fetch(
        `/api/portfolio?address=${address}&mode=${mode}&chainId=${chainId}`
      );
      const json = (await res.json()) as ApiResponse<Portfolio>;
      if (!res.ok || !json.success) {
        throw new Error(json.success ? "Failed to load portfolio" : json.error.message);
      }
      return json;
    },
    enabled: Boolean(address && isConnected),
    staleTime: isDemo ? 30_000 : 60_000,
  });

  if (!isConnected || !address) {
    return (
      <Card title="Your portfolio" subtitle="Connect a wallet to analyze your holdings.">
        <p className="py-6 text-center text-sm text-zinc-500">
          Connect a wallet above to get started.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return <PortfolioSkeleton />;
  }

  if (error || !data?.success) {
    return (
      <ErrorState
        title="Could not load your portfolio"
        message={error instanceof Error ? error.message : "An unexpected error occurred."}
        onRetry={() => refetch()}
      />
    );
  }

  const portfolio = data.data;
  const holdings = portfolio.tokens
    .map((t, i) => ({ token: t, color: donutColor(i) }))
    .filter(({ token }) => token.usdValue > 0);

  return (
    <Card
      title="Your portfolio"
      subtitle={shortenAddress(portfolio.address)}
      className={isRefetching ? "opacity-70 transition-opacity" : undefined}
      action={
        portfolio.source === "demo" ? (
          <Badge tone="warning">Demo balances</Badge>
        ) : (
          <Badge tone="success">On-chain</Badge>
        )
      }
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Total value</p>
          <p className="text-3xl font-semibold tabular-nums text-zinc-50">
            {formatUsd(portfolio.totalUsdValue)}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>{isDemo ? "Simulated balances" : "On-chain balances"}</p>
          <p className="mt-0.5">Updated {formatRelativeTime(portfolio.updatedAt)}</p>
        </div>
      </div>

      {/* Allocation chart */}
      {holdings.length > 0 ? (
        <div className="mb-6 grid items-center gap-6 lg:grid-cols-[auto_1fr]">
          <div className="mx-auto">
            <AllocationDonut
              segments={holdings.map(({ token }) => ({
                label: token.symbol,
                value: token.usdValue,
              }))}
              centerValue={formatUsd(portfolio.totalUsdValue, 0)}
              centerLabel={portfolio.source === "demo" ? "demo total" : "total value"}
            />
          </div>
          <ul className="space-y-2.5">
            {holdings.map(({ token, color }) => (
              <li key={token.symbol} className="flex items-center gap-3 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="w-16 truncate font-medium text-zinc-100">
                  {token.symbol}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(token.usdValue / portfolio.totalUsdValue) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </span>
                <span className="w-16 text-right tabular-nums text-zinc-400">
                  {((token.usdValue / portfolio.totalUsdValue) * 100).toFixed(1)}%
                </span>
                <span className="w-20 text-right tabular-nums text-zinc-300">
                  {formatUsd(token.usdValue)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
          No USD-valued balances to chart yet — balances and prices are listed below.
        </p>
      )}

      <div className="divide-y divide-zinc-800/70">
        {portfolio.tokens.map((token) => (
          <TokenRow
            key={token.address}
            symbol={token.symbol}
            name={token.name}
            formattedBalance={token.formattedBalance}
            priceUsd={token.priceUsd}
            usdValue={token.usdValue}
            decimals={token.decimals}
          />
        ))}
      </div>
    </Card>
  );
}
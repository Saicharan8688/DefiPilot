import { createTTLCache } from "@/lib/defi/cache";
import { computeRiskScore, riskLevelFor } from "@/lib/defi/risk";
import type { DefiLlamaPool, DefiLlamaPoolsResponse } from "@/lib/defi/defillama-types";
import type { DeFiOpportunity, OpportunitiesResponse } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.DEFILLAMA_BASE_URL ?? "https://yields.llama.fi";
const CACHE_TTL_MS = Math.max(
  Number(process.env.DEFILLAMA_CACHE_TTL_MS ?? 5 * 60 * 1000),
  30_000
);

const DEFAULT_CHAINS = ["Ethereum", "Arbitrum", "Base"];
const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_TVL = 1_000_000;
const DEFAULT_MIN_APY = 0;

/* ------------------------------------------------------------------ */
/* Error                                                               */
/* ------------------------------------------------------------------ */

export class DefiLlamaError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DefiLlamaError";
  }
}

/* ------------------------------------------------------------------ */
/* Internal cache                                                      */
/* ------------------------------------------------------------------ */

const poolCache = createTTLCache<DefiLlamaPool[]>(CACHE_TTL_MS);

/* ------------------------------------------------------------------ */
/* Normalisation                                                        */
/* ------------------------------------------------------------------ */

function normalizePool(pool: DefiLlamaPool): DeFiOpportunity | null {
  if (!pool.pool || !pool.chain || !pool.project || !pool.symbol) return null;
  // Skip pools DefiLlama flags as data anomalies.
  if (pool.outlier === true) return null;
  const apy = pool.apy ?? 0;
  const tvl = pool.tvlUsd ?? 0;
  if (!Number.isFinite(apy) || apy < 0) return null;
  if (!Number.isFinite(tvl) || tvl < 0) return null;

  const riskScore = computeRiskScore(pool);
  return {
    id: pool.pool,
    protocol: prettifyProtocol(pool.project),
    chain: pool.chain,
    asset: pool.symbol,
    apy: round2(apy),
    tvl,
    riskScore,
    riskLevel: riskLevelFor(riskScore),
  };
}

function prettifyProtocol(slug: string): string {
  if (!slug) return slug;
  return slug
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Fetch + cache                                                        */
/* ------------------------------------------------------------------ */

async function fetchPoolsFromApi(): Promise<DefiLlamaPool[]> {
  const url = `${BASE_URL}/pools`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

  if (!res.ok) {
    throw new DefiLlamaError(`DefiLlama responded with status ${res.status}`);
  }

  const json: unknown = await res.json();

  if (
    !json ||
    typeof json !== "object" ||
    !Array.isArray((json as DefiLlamaPoolsResponse).data)
  ) {
    throw new DefiLlamaError("DefiLlama returned an unexpected response shape");
  }

  return (json as DefiLlamaPoolsResponse).data;
}

/**
 * Returns pools from cache or live fetch. Always populates cache on success.
 * Throws DefiLlamaError on network / upstream failure.
 */
async function getPools(): Promise<{
  pools: DefiLlamaPool[];
  fromCache: boolean;
  fetchedAt: string;
}> {
  const cached = poolCache.get();
  if (cached) {
    return { pools: cached, fromCache: true, fetchedAt: new Date().toISOString() };
  }

  const pools = await fetchPoolsFromApi();
  poolCache.set(pools);
  return { pools, fromCache: false, fetchedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Public service                                                       */
/* ------------------------------------------------------------------ */

export interface OpportunityQuery {
  chains?: string[];
  limit?: number;
  minTvl?: number;
  minApy?: number;
}

export async function getOpportunities(
  query: OpportunityQuery = {}
): Promise<OpportunitiesResponse> {
  const chains = query.chains ?? DEFAULT_CHAINS;
  const limit = query.limit ?? DEFAULT_LIMIT;
  const minTvl = query.minTvl ?? DEFAULT_MIN_TVL;
  const minApy = query.minApy ?? DEFAULT_MIN_APY;

  const { pools, fromCache, fetchedAt } = await getPools();

  const chainSet = new Set(chains.map((c) => c.toLowerCase()));

  const opportunities = pools
    .map(normalizePool)
    .filter((o): o is DeFiOpportunity => o !== null)
    .filter((o) => chainSet.has(o.chain.toLowerCase()))
    .filter((o) => o.tvl >= minTvl && o.apy >= minApy)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, limit);

  return {
    opportunities,
    source: "live",
    fromCache,
    updatedAt: fetchedAt,
    count: opportunities.length,
  };
}

/**
 * Returns opportunities whose asset symbol matches any of the given patterns
 * (case-insensitive), ranked by risk ascending (safest first). Used by the
 * agent/fallback to find pools relevant to the wallet's assets.
 */
export async function getOpportunitiesByAssets(
  assetPatterns: string[],
  opts: { chains?: string[]; minTvl?: number; limit?: number } = {}
): Promise<DeFiOpportunity[]> {
  const patterns = assetPatterns
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (patterns.length === 0) return [];

  const chains = opts.chains ?? DEFAULT_CHAINS;
  const minTvl = opts.minTvl ?? 1_000_000;
  const limit = opts.limit ?? 20;
  const chainSet = new Set(chains.map((c) => c.toLowerCase()));

  const { pools } = await getPools();

  return pools
    .map(normalizePool)
    .filter((o): o is DeFiOpportunity => o !== null)
    .filter((o) => chainSet.has(o.chain.toLowerCase()))
    .filter((o) => o.tvl >= minTvl)
    .filter((o) => patterns.some((p) => o.asset.toUpperCase().includes(p)))
    .sort((a, b) => a.riskScore - b.riskScore || b.apy - a.apy)
    .slice(0, limit);
}

/**
 * Looks up specific pools by id from ground-truth DefiLlama data.
 * Used to validate agent allocations — the agent can never invent an APY/TVL.
 */
export async function getOpportunitiesByIds(
  ids: string[]
): Promise<DeFiOpportunity[]> {
  if (ids.length === 0) return [];
  const { pools } = await getPools();
  const idSet = new Set(ids);
  return pools
    .map(normalizePool)
    .filter((o): o is DeFiOpportunity => o !== null && idSet.has(o.id));
}

/**
 * Returns opportunities whose protocol matches the given name (case-insensitive).
 * Used by the agent's getProtocolData tool.
 */
export async function getProtocolOpportunities(
  protocol: string,
  limit = 8
): Promise<DeFiOpportunity[]> {
  const query = protocol.trim().toLowerCase();
  if (!query) return [];
  const { pools } = await getPools();
  return pools
    .map(normalizePool)
    .filter((o): o is DeFiOpportunity => o !== null)
    .filter((o) => o.protocol.toLowerCase().includes(query))
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, limit);
}
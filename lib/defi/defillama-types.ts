/**
 * Narrow, typed view of the DefiLlama yields API response.
 * See https://yields.llama.fi/pools
 */
export interface DefiLlamaPool {
  /** Pool identifier (UUID). */
  pool: string;
  /** Protocol slug, e.g. "aave", "compound". */
  project: string;
  /** Asset symbol, e.g. "USDC". */
  symbol: string;
  /** Chain name, e.g. "Ethereum". */
  chain: string;
  /** Total value locked, USD. */
  tvlUsd: number;
  /** Base APY in percent, null when unavailable. */
  apyBase: number | null;
  /** Reward APY in percent, null when unavailable. */
  apyReward: number | null;
  /** Combined APY (base + reward) in percent, null when unavailable. */
  apy: number | null;
  /** Optional pool label, e.g. "Aave V3". */
  poolMeta?: string | null;
  /** Daily APY change, percent. */
  apyPct1D?: number | null;
  /** 7-day APY change, percent. */
  apyPct7D?: number | null;
  /** 30-day APY change, percent. */
  apyPct30D?: number | null;
  stablecoin?: boolean;
  /** DefiLlama's own anomaly detection flag. */
  outlier?: boolean;
  ilRisk?: "yes" | "no";
  exposure?: "single" | "multi";
  predictions?: {
    predictedClass?: string | null;
    predictedProbability?: number | null;
  } | null;
}

export interface DefiLlamaPoolsResponse {
  status: string;
  data: DefiLlamaPool[];
}
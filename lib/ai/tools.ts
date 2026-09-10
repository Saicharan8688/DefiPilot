/**
 * Explicit tools the financial agent can call. Every tool is backed by
 * deterministic code over ground-truth data (DefiLlama / demo portfolio).
 * The LLM orchestrates tool calls and reasons over the returned structured
 * numbers — it never performs financial arithmetic and never invents figures.
 */
import { getWalletSnapshot } from "@/lib/ai/metrics";
import { buildSimulation } from "@/lib/ai/simulation";
import {
  getOpportunities,
  getOpportunitiesByIds,
  getProtocolOpportunities,
} from "@/lib/defi/defillama";
import { riskLevelFor } from "@/lib/defi/risk";
import type {
  Address,
  DeFiOpportunity,
  PortfolioSnapshot,
} from "@/lib/types";

export interface ToolContext {
  address: Address;
}

export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolExecutionError";
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Tool 1: getWalletPortfolio                                          */
/* ------------------------------------------------------------------ */

async function getWalletPortfolio(
  args: Record<string, unknown>,
  ctx: ToolContext
) {
  const address = (args.address as Address | undefined) ?? ctx.address;
  if (!address) {
    throw new ToolExecutionError("Missing required argument: address");
  }
  const { snapshot } = getWalletSnapshot(address);
  return snapshot;
}

/* ------------------------------------------------------------------ */
/* Tool 2: getDeFiOpportunities                                        */
/* ------------------------------------------------------------------ */

async function getDeFiOpportunities(args: Record<string, unknown>) {
  try {
    const chains =
      args.chains && Array.isArray(args.chains)
        ? (args.chains as string[])
        : undefined;
    const limit =
      typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 10;
    const minTvl =
      typeof args.minTvl === "number" && args.minTvl > 0 ? args.minTvl : 1_000_000;
    const result = await getOpportunities({ chains, limit, minTvl });
    return {
      available: true,
      source: result.source,
      fromCache: result.fromCache,
      count: result.count,
      opportunities: result.opportunities.map(compactOpportunity),
      note: "APY and TVL come from DefiLlama. opportunityId maps to `id` on each item.",
    };
  } catch (error) {
    return unavailableOpportunities(error);
  }
}

function compactOpportunity(o: DeFiOpportunity) {
  return {
    id: o.id,
    protocol: o.protocol,
    chain: o.chain,
    asset: o.asset,
    apy: o.apy,
    tvlUsd: Math.round(o.tvl),
    riskScore: o.riskScore,
    riskLevel: o.riskLevel,
  };
}

function unavailableOpportunities(error: unknown) {
  return {
    available: false,
    source: "live",
    count: 0,
    opportunities: [],
    error: `Live yield data is unavailable right now: ${
      error instanceof Error ? error.message : "unknown failure"
    }`,
  };
}

/* ------------------------------------------------------------------ */
/* Tool 3: getProtocolData                                             */
/* ------------------------------------------------------------------ */

async function getProtocolData(args: Record<string, unknown>) {
  const protocol = typeof args.protocol === "string" ? args.protocol : "";
  if (!protocol.trim()) {
    throw new ToolExecutionError("Missing required argument: protocol");
  }
  try {
    const opportunities = await getProtocolOpportunities(protocol, 8);
    return {
      protocol,
      available: true,
      count: opportunities.length,
      opportunities: opportunities.map(compactOpportunity),
    };
  } catch (error) {
    return {
      protocol,
      available: false,
      count: 0,
      opportunities: [],
      error: error instanceof Error ? error.message : "unknown failure",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Tool 4: calculatePortfolioMetrics                                    */
/* ------------------------------------------------------------------ */

async function calculatePortfolioMetrics(
  args: Record<string, unknown>,
  ctx: ToolContext
) {
  const address = (args.address as Address | undefined) ?? ctx.address;
  if (!address) {
    throw new ToolExecutionError("Missing required argument: address");
  }
  const { snapshot } = getWalletSnapshot(address);
  const stables = snapshot.tokens.filter((t) =>
    ["USDC", "USDT", "DAI"].includes(t.symbol.toUpperCase())
  );
  const stableUsd = round2(stables.reduce((s, t) => s + t.usdValue, 0));
  return {
    address,
    totalUsdValue: snapshot.totalUsdValue,
    deployableCapitalUsd: snapshot.idleCashUsd,
    stablecoinUsd: stableUsd,
    stablecoinShare: round2(
      snapshot.totalUsdValue > 0
        ? (snapshot.idleCashUsd / snapshot.totalUsdValue) * 100
        : 0
    ),
    concentration: snapshot.concentration,
    assetCount: snapshot.assetCount,
    topHoldings: snapshot.tokens.slice(0, 5).map((t) => ({
      symbol: t.symbol,
      percentage: t.percentage,
      usdValue: t.usdValue,
    })),
    source: snapshot.source,
  };
}

/* ------------------------------------------------------------------ */
/* Tool 5: calculateExpectedYield                                       */
/* ------------------------------------------------------------------ */

async function calculateExpectedYield(args: Record<string, unknown>) {
  const opportunityId = String(args.opportunityId ?? "");
  const amountUsd =
    typeof args.amountUsd === "number" && Number.isFinite(args.amountUsd)
      ? Math.max(args.amountUsd, 0)
      : 0;
  const [opportunity] = await requireOpportunities([opportunityId], "calculateExpectedYield");
  const expectedYieldUsd = round2(amountUsd * (opportunity.apy / 100));
  return {
    opportunityId,
    asset: opportunity.asset,
    protocol: opportunity.protocol,
    apy: opportunity.apy,
    amountUsd: round2(amountUsd),
    expectedYieldUsd,
  };
}

/* ------------------------------------------------------------------ */
/* Tool 6: calculateRiskScore                                           */
/* ------------------------------------------------------------------ */

async function calculateRiskScore(args: Record<string, unknown>) {
  const opportunityId = String(args.opportunityId ?? "");
  const [opportunity] = await requireOpportunities([opportunityId], "calculateRiskScore");
  return {
    opportunityId,
    asset: opportunity.asset,
    protocol: opportunity.protocol,
    apy: opportunity.apy,
    tvlUsd: Math.round(opportunity.tvl),
    riskScore: opportunity.riskScore,
    riskLevel: opportunity.riskLevel,
  };
}

async function requireOpportunities(
  ids: string[],
  toolName: string
): Promise<DeFiOpportunity[]> {
  let opportunities: DeFiOpportunity[];
  try {
    opportunities = await getOpportunitiesByIds(ids);
  } catch (error) {
    throw new ToolExecutionError(
      `${toolName}: live yield data is unavailable right now (${
        error instanceof Error ? error.message : "unknown failure"
      }).`
    );
  }
  const found = new Map(opportunities.map((o) => [o.id, o]));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ToolExecutionError(
      `${toolName}: no ground-truth data for opportunityId(s) ${missing.join(", ")}. ` +
        "All opportunityIds must come from the getDeFiOpportunities / getProtocolData tools."
    );
  }
  return opportunities;
}

/* ------------------------------------------------------------------ */
/* Tool 7: simulateAllocation                                           */
/* ------------------------------------------------------------------ */

async function simulateAllocation(args: Record<string, unknown>) {
  const raw = Array.isArray(args.allocations) ? args.allocations : [];
  const rows = raw
    .map((r) => {
      const row = r as { opportunityId?: unknown; amountUsd?: unknown };
      return {
        opportunityId: String(row.opportunityId ?? ""),
        amountUsd:
          typeof row.amountUsd === "number" && Number.isFinite(row.amountUsd)
            ? Math.max(row.amountUsd, 0)
            : 0,
      };
    })
    .filter((r) => r.opportunityId && r.amountUsd > 0);

  if (rows.length === 0) {
    throw new ToolExecutionError(
      "simulateAllocation: provide at least one allocation with amountUsd > 0."
    );
  }

  const opportunities = await requireOpportunities(
    rows.map((r) => r.opportunityId),
    "simulateAllocation"
  );
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const simulation = buildSimulation(
    rows.map((r) => ({ opportunity: byId.get(r.opportunityId)!, amountUsd: r.amountUsd }))
  );
  return { simulation };
}

/* ------------------------------------------------------------------ */
/* Tool 8: finalizeRecommendation                                       */
/* ------------------------------------------------------------------ */

export interface FinalizedPlan {
  available: boolean;
  /** Present when live data was unavailable (available: false). */
  note?: string;
  portfolio: PortfolioSnapshot;
  capitalDeployedUsd: number;
  allocations: Array<{
    opportunityId: string;
    protocol: string;
    asset: string;
    chain: string;
    percentage: number;
    amountUsd: number;
    apy: number;
    riskScore: number;
    riskLevel: "Low" | "Medium" | "High";
    expectedYieldUsd: number;
  }>;
  expectedYield: {
    totalUsd: number;
    blendedApy: number;
    perItemUsd: number[];
  };
  risk: { riskScore: number; riskLevel: "Low" | "Medium" | "High" };
  opportunities: Array<{
    id: string;
    protocol: string;
    asset: string;
    chain: string;
    apy: number;
    tvl: number;
    riskScore: number;
    riskLevel: "Low" | "Medium" | "High";
  }>;
}

async function finalizeRecommendation(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<FinalizedPlan | { valid: false; message: string }> {
  const raw = Array.isArray(args.allocations) ? args.allocations : [];
  const rows = raw.map((r) => {
    const row = r as { opportunityId?: unknown; percentage?: unknown };
    return {
      opportunityId: String(row.opportunityId ?? ""),
      percentage:
        typeof row.percentage === "number" && Number.isFinite(row.percentage)
          ? row.percentage
          : NaN,
    };
  });

  if (rows.length === 0) {
    return {
      valid: false,
      message:
        "finalizeRecommendation: allocations must contain at least one item with opportunityId and percentage (share of deployable capital, summing to 100).",
    };
  }

  const { snapshot } = getWalletSnapshot(ctx.address);

  let opportunities: DeFiOpportunity[];
  try {
    opportunities = await getOpportunitiesByIds(rows.map((r) => r.opportunityId));
  } catch (error) {
    return {
      available: false,
      portfolio: snapshot,
      capitalDeployedUsd: 0,
      allocations: [],
      expectedYield: { totalUsd: 0, blendedApy: 0, perItemUsd: [] },
      risk: { riskScore: 1, riskLevel: "Low" },
      opportunities: [],
      note: `Live yield data unavailable (${
        error instanceof Error ? error.message : "unknown failure"
      }).`,
    };
  }

  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const missing = rows
    .map((r) => r.opportunityId)
    .filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return {
      valid: false,
      message:
        `Unknown opportunityId(s): ${missing.join(", ")}. ` +
        "All ids must come from getDeFiOpportunities or getProtocolData results.",
    };
  }

  const invalid = rows.filter((r) => !Number.isFinite(r.percentage) || r.percentage < 0);
  if (invalid.length > 0) {
    return {
      valid: false,
      message: "Percentages must be non-negative finite numbers between 0 and 100.",
    };
  }
  if (rows.every((r) => r.percentage === 0)) {
    return { valid: false, message: "At least one percentage must be greater than 0." };
  }

  // Normalize the proposed distribution to exactly 100%.
  const totalPct = rows.reduce((s, r) => s + r.percentage, 0);
  const normalized = rows.map((r) => round2((r.percentage / totalPct) * 100));

  const capital = snapshot.idleCashUsd;
  const allocations = rows.map((r, i) => {
    const opp = byId.get(r.opportunityId)!;
    const percentage = normalized[i];
    const amountUsd = round2(capital * (percentage / 100));
    const expectedYieldUsd = round2(amountUsd * (opp.apy / 100));
    return {
      opportunityId: opp.id,
      protocol: opp.protocol,
      asset: opp.asset,
      chain: opp.chain,
      percentage,
      amountUsd,
      apy: opp.apy,
      riskScore: opp.riskScore,
      riskLevel: opp.riskLevel,
      expectedYieldUsd,
    };
  });

  const sorted = allocations.slice().sort((a, b) => b.amountUsd - a.amountUsd);
  const totalYield = round2(sorted.reduce((s, a) => s + a.expectedYieldUsd, 0));
  const blendedApy =
    capital > 0 ? round2((totalYield / capital) * 100) : 0;
  const weightedRisk =
    capital > 0
      ? sorted.reduce((s, a) => s + a.riskScore * a.amountUsd, 0) / capital
      : 1;
  const riskScore = Math.round(weightedRisk);

  return {
    available: true,
    portfolio: snapshot,
    capitalDeployedUsd: round2(capital),
    allocations: sorted,
    expectedYield: {
      totalUsd: totalYield,
      blendedApy,
      perItemUsd: sorted.map((a) => a.expectedYieldUsd),
    },
    risk: { riskScore, riskLevel: riskLevelFor(riskScore) },
    opportunities: sorted.map((a) => ({ id: a.opportunityId, protocol: a.protocol, asset: a.asset, chain: a.chain, apy: a.apy, tvl: byId.get(a.opportunityId)!.tvl, riskScore: byId.get(a.opportunityId)!.riskScore, riskLevel: byId.get(a.opportunityId)!.riskLevel })),
  };
}

/* ------------------------------------------------------------------ */
/* Registry + OpenAI-compatible schemas                                 */
/* ------------------------------------------------------------------ */

export type ToolExecutor = (
  _args: Record<string, unknown>,
  _ctx: ToolContext
) => Promise<unknown>;

export const TOOL_SCHEMAS: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: "function",
    function: {
      name: "getWalletPortfolio",
      description:
        "Fetch the wallet's current portfolio: token balances, USD values, and portfolio metrics (total value, idle stablecoin capital, concentration). All balances are simulated demo data.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address (0x...)." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDeFiOpportunities",
      description:
        "Discover live DeFi yield opportunities. Returns normalized pools with id, protocol, asset, chain, apy (%), tvlUsd, riskScore and riskLevel. Data is real and comes from DefiLlama. Sort by apy descending.",
      parameters: {
        type: "object",
        properties: {
          chains: {
            type: "array",
            items: { type: "string" },
            description: "Chains to include (e.g. Ethereum, Arbitrum, Base).",
          },
          limit: {
            type: "number",
            description: "Max opportunities to return (1-25).",
          },
          minTvl: {
            type: "number",
            description: "Minimum TVL in USD to filter by.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProtocolData",
      description:
        "Look up a protocol by name and return its yield pools with live data (id, asset, chain, apy, tvlUsd, risk).",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Protocol name, e.g. 'Aave', 'Compound', 'Spark'.",
          },
        },
        required: ["protocol"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculatePortfolioMetrics",
      description:
        "Compute deterministic portfolio metrics: deployable capital (stablecoins), stablecoin share, concentration, asset count and top holdings.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address (0x...)." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateExpectedYield",
      description:
        "Compute the expected annual yield for a given opportunityId and capital amount (USD). The APY used is ground-truth live data; the multiplication is done by code. amountUsd is a proposed allocation you choose.",
      parameters: {
        type: "object",
        properties: {
          opportunityId: {
            type: "string",
            description: "The `id` from a getDeFiOpportunities/getProtocolData result.",
          },
          amountUsd: {
            type: "number",
            description: "Capital to deploy, USD.",
          },
        },
        required: ["opportunityId", "amountUsd"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateRiskScore",
      description:
        "Return the deterministic risk score and level for a given opportunityId (computed from APY magnitude, reward share, volatility, TVL and impermanent-loss exposure).",
      parameters: {
        type: "object",
        properties: {
          opportunityId: {
            type: "string",
            description: "The `id` from a getDeFiOpportunities/getProtocolData result.",
          },
        },
        required: ["opportunityId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulateAllocation",
      description:
        "Simulate a specific allocation: given a list of { opportunityId, amountUsd }, code computes the expected annual yield, blended APY and weighted risk. Use this to compare candidate strategies. Amounts are chosen by you; APYs/risks come from live data.",
      parameters: {
        type: "object",
        properties: {
          allocations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                opportunityId: { type: "string" },
                amountUsd: { type: "number" },
              },
              required: ["opportunityId", "amountUsd"],
              additionalProperties: false,
            },
          },
        },
        required: ["allocations"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalizeRecommendation",
      description:
        "Finalize the recommendation. Pass your proposed allocations as { opportunityId, percentage } where percentage is the share of deployable stablecoin capital and must sum to 100. Code validates the ids against live data, computes amounts, expected yield, blended APY and weighted risk, and returns the final plan. Call this exactly once, in the final step, after exploring.",
      parameters: {
        type: "object",
        properties: {
          allocations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                opportunityId: { type: "string" },
                percentage: { type: "number" },
              },
              required: ["opportunityId", "percentage"],
              additionalProperties: false,
            },
          },
        },
        required: ["allocations"],
        additionalProperties: false,
      },
    },
  },
];

const EXECUTORS: Record<string, ToolExecutor> = {
  getWalletPortfolio,
  getDeFiOpportunities,
  getProtocolData,
  calculatePortfolioMetrics,
  calculateExpectedYield,
  calculateRiskScore,
  simulateAllocation,
  finalizeRecommendation,
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const executor = EXECUTORS[name];
  if (!executor) {
    throw new ToolExecutionError(`Unknown tool: ${name}`);
  }
  return executor(args, ctx);
}
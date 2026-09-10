/**
 * Deterministic fallback "agent": produces a Recommendation from code alone
 * when no OPENAI_API_KEY is set or the LLM path fails. It uses the exact same
 * data sources and math, so figures are never invented.
 */
import { getMockPortfolio } from "@/lib/mock/portfolio";
import {
  getOpportunities,
  getOpportunitiesByAssets,
} from "@/lib/defi/defillama";
import { buildSnapshot } from "@/lib/ai/metrics";
import { buildSimulation } from "@/lib/ai/simulation";
import type {
  Address,
  DeFiOpportunity,
  Recommendation,
  RecommendedAllocationItem,
} from "@/lib/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Asset symbols the wallet holds that are deployable (stablecoins). */
function stableTargets(symbols: string[]): string[] {
  const stables = new Set(["USDC", "USDT", "DAI", "FRAX", "USDE", "PYUSD"]);
  return symbols.filter((s) => stables.has(s.toUpperCase()));
}

function matchesAsset(asset: string, targets: string[]): boolean {
  const a = asset.toUpperCase();
  return targets.some((t) => a.includes(t));
}

function dedupeById(pools: DeFiOpportunity[]): DeFiOpportunity[] {
  const seen = new Set<string>();
  return pools.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

export async function createFallbackRecommendation(
  address: Address
): Promise<Recommendation> {
  const portfolio = getMockPortfolio(address);
  const snapshot = buildSnapshot(portfolio);

  const warnings: string[] = [];
  const assumptions: string[] = [
    "Deployable capital is the wallet's holdings in stablecoins (idle cash).",
    "APYs are annualized percentages from live DefiLlama data at analysis time and can change.",
    "The simulation assumes yields remain constant for a year; no fees, gas or slippage are modeled.",
    "This is a fallback, rule-based plan (no LLM). Figures come from the same deterministic code as the LLM agent.",
  ];

  const walletSymbols = portfolio.tokens.map((t) => t.symbol);
  let targets = stableTargets(walletSymbols);
  if (targets.length === 0) {
    // No stables → fall back to ETH/WETH for ETH-dominant wallets.
    targets = walletSymbols.filter((s) => ["ETH", "WETH"].includes(s.toUpperCase()));
    if (targets.length > 0) {
      assumptions.push("No stablecoin holdings detected — ETH-denominated pools were considered.");
    }
  }

  // Candidate pools matching the wallet's deployable assets.
  //
  // 1. A risk-first targeted search (safest match first) so the plan is built
  //    on low-risk lending pools (e.g. Aave/Compound), not just high-APY ones.
  // 2. A broader APY scan for the small high-yield (upside) sleeve.
  let relevant: DeFiOpportunity[] = [];
  let broad: DeFiOpportunity[] = [];
  try {
    relevant = await getOpportunitiesByAssets(targets, {
      minTvl: 500_000,
      limit: 20,
    });
    const scan = await getOpportunities({ limit: 30, minTvl: 1_000_000 });
    broad = scan.opportunities.filter((o) => matchesAsset(o.asset, targets));
  } catch (error) {
    warnings.push(
      `Live yield data is unavailable right now so opportunities could not be analyzed: ${
        error instanceof Error ? error.message : "unknown failure"
      }`
    );
  }

  const byRisk = relevant; // already sorted riskScore asc, then apy desc.
  const byApy = dedupeById([...relevant, ...broad])
    .filter((o) => o.tvl >= 500_000)
    .sort((a, b) => b.apy - a.apy);

  // Diversified pick: 2 of the safest pools (distinct protocols) + 1 high-yield.
  const pickDistinctProtocol = (
    pool: DeFiOpportunity[],
    usedProtocols: Set<string>
  ): DeFiOpportunity[] => pool.filter((o) => !usedProtocols.has(o.protocol.toLowerCase()));

  const chosen: Array<{ opportunity: DeFiOpportunity; percentage: number }> = [];
  const usedProtocols = new Set<string>();
  const safe = pickDistinctProtocol(byRisk, usedProtocols);
  if (safe[0]) {
    chosen.push({ opportunity: safe[0], percentage: 60 });
    usedProtocols.add(safe[0].protocol.toLowerCase());
    const safe2 = pickDistinctProtocol(byRisk, usedProtocols);
    if (safe2[0]) {
      chosen.push({ opportunity: safe2[0], percentage: 30 });
      usedProtocols.add(safe2[0].protocol.toLowerCase());
    }
  }
  if (chosen.length > 0) {
    const upside = pickDistinctProtocol(byApy, usedProtocols);
    if (upside[0]) {
      chosen.push({ opportunity: upside[0], percentage: 10 });
    }
  }

  if (chosen.length === 0) {
    warnings.push(
      relevant.length === 0 && broad.length === 0
        ? "No eligible opportunities matched this wallet's assets (or live data is unavailable), so no capital allocation is recommended."
        : "No suitable allocation could be constructed from available opportunities."
    );
  }

  // Recompute true weights so they sum to 100%.
  const totalPct = chosen.reduce((s, c) => s + c.percentage, 0);
  const deployable = snapshot.idleCashUsd;

  const allocations: RecommendedAllocationItem[] = [];
  chosen.forEach(({ opportunity, percentage }) => {
    const pct = round2((percentage / totalPct) * 100);
    const amountUsd = round2(deployable * (pct / 100));
    allocations.push({
      opportunityId: opportunity.id,
      protocol: opportunity.protocol,
      asset: opportunity.asset,
      chain: opportunity.chain,
      percentage: pct,
      amountUsd,
      apy: opportunity.apy,
      riskScore: opportunity.riskScore,
      riskLevel: opportunity.riskLevel,
      expectedYieldUsd: round2(amountUsd * (opportunity.apy / 100)),
    });
  });

  const simulation = buildSimulation(
    allocations.map((a) => ({
      opportunity: {
        id: a.opportunityId,
        protocol: a.protocol,
        chain: a.chain,
        asset: a.asset,
        apy: a.apy,
        tvl: 0,
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
      },
      amountUsd: a.amountUsd,
    }))
  );

  const tvlById = new Map(
    dedupeById([...relevant, ...broad]).map((o) => [o.id, o.tvl])
  );
  const usedOpportunities = allocations.map((a) => ({
    id: a.opportunityId,
    protocol: a.protocol,
    chain: a.chain,
    asset: a.asset,
    apy: a.apy,
    tvl: tvlById.get(a.opportunityId) ?? 0,
    riskScore: a.riskScore,
    riskLevel: a.riskLevel,
  }));

  const reasoning: string[] = [];
  if (allocations.length > 0) {
    const lead = allocations[0];
    reasoning.push(
      `Allocated ${lead.percentage}% of deployable capital ($${lead.amountUsd}) to ${lead.protocol} ${lead.asset} at ${lead.apy}% APY — the best low-risk match for the wallet's assets.`
    );
    if (allocations[1]) {
      const second = allocations[1];
      reasoning.push(
        `A second, distinct protocol (${second.protocol} ${second.asset}, ${second.apy}% APY) reduces protocol-concentration risk while still beating idle cash.`
      );
    }
    if (allocations[2]) {
      const third = allocations[2];
      reasoning.push(
        `A smaller high-yield sleeve (${third.percentage}% → ${third.protocol} ${third.asset} at ${third.apy}% APY, risk ${third.riskLevel}) captures upside while capping exposure.`
      );
    }
    reasoning.push(
      `Combined, the plan deploys $${simulation.totalCapitalUsd} for an expected ≈$${simulation.totalExpectedYieldUsd}/year at ≈${simulation.blendedApy}% blended APY.`
    );
  } else {
    reasoning.push("No allocation could be constructed from the available data.");
  }

  const concentrationNote =
    snapshot.concentration >= 0.75
      ? `The wallet is heavily concentrated in ${snapshot.tokens[0]?.symbol} (${snapshot.concentration * 100}%). Diversifying via yield positions is advised.`
      : `The wallet holds ${snapshot.assetCount} assets with moderate concentration (${snapshot.concentration * 100}%).`;

  if (allocations.length > 0) {
    reasoning.push(
      snapshot.idleCashUsd > 0
        ? `$${snapshot.idleCashUsd} was sitting idle in stablecoins — deploying it is the primary yield lever identified. ${concentrationNote}`
        : "No idle stablecoin capital was found, so the recommendation focuses on the existing asset mix."
    );
  }

  warnings.push(
    "Live APYs and TVL change constantly — this plan is a snapshot, not a guarantee."
  );

  const summary =
    allocations.length > 0
      ? `Deploying $${simulation.totalCapitalUsd} of idle capital across ${
          allocations.length
        } opportunities (${allocations
          .map((a) => `${a.protocol} ${a.asset}`)
          .join(", ")}) is expected to earn ≈$${simulation.totalExpectedYieldUsd}/year at ≈${
          simulation.blendedApy
        }% blended APY (weighted risk ${simulation.riskLevel}).`
      : "No deployable opportunities were found — keeping capital as-is is the safest option right now.";

  return {
    summary,
    currentPortfolio: snapshot,
    opportunities: usedOpportunities.filter(
      (o, i, arr) => arr.findIndex((x) => x.id === o.id) === i
    ),
    recommendedAllocation: allocations,
    expectedYield: {
      totalUsd: simulation.totalExpectedYieldUsd,
      blendedApy: simulation.blendedApy,
      perItemUsd: allocations.map((a) => a.expectedYieldUsd),
    },
    riskLevel: simulation.riskLevel,
    riskScore: simulation.riskScore,
    reasoning,
    warnings: [
      ...warnings,
      "Portfolio balances are simulated demo data — the plan is for demonstration, not live funds.",
    ],
    assumptions,
    engine: "fallback",
    dataProvidedAt: new Date().toISOString(),
  };
}
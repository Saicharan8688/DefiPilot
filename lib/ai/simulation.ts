/**
 * Deterministic simulation math — shared by the agent tool, /api/simulate
 * and the fallback planner. All financial arithmetic lives here in code;
 * the LLM never performs math itself.
 */
import { riskLevelFor } from "@/lib/defi/risk";
import type { DeFiOpportunity, SimulationResult, SimulationStep } from "@/lib/types";

export interface SimulationInput {
  opportunity: DeFiOpportunity;
  /** Capital allocated to this opportunity, USD. */
  amountUsd: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildSimulation(items: SimulationInput[]): SimulationResult {
  const steps: SimulationStep[] = items.map(({ opportunity, amountUsd }) => {
    const amount = round2(Math.max(amountUsd, 0));
    const apy = opportunity.apy;
    const expectedYieldUsd = round2(amount * (apy / 100));
    return {
      opportunityId: opportunity.id,
      protocol: opportunity.protocol,
      asset: opportunity.asset,
      chain: opportunity.chain,
      amountUsd: amount,
      apy,
      riskScore: opportunity.riskScore,
      riskLevel: opportunity.riskLevel,
      expectedYieldUsd,
    };
  });

  const totalCapitalUsd = round2(
    steps.reduce((sum, s) => sum + s.amountUsd, 0)
  );
  const totalExpectedYieldUsd = round2(
    steps.reduce((sum, s) => sum + s.expectedYieldUsd, 0)
  );

  // Capital-weighted blended APY and risk score.
  let weightedApy = 0;
  let weightedRisk = 0;
  if (totalCapitalUsd > 0) {
    weightedApy =
      steps.reduce((sum, s) => sum + s.apy * s.amountUsd, 0) / totalCapitalUsd;
    weightedRisk =
      steps.reduce((sum, s) => sum + s.riskScore * s.amountUsd, 0) /
      totalCapitalUsd;
  }
  const riskScore = Math.round(weightedRisk);

  return {
    steps,
    totalCapitalUsd,
    totalExpectedYieldUsd,
    blendedApy: round2(weightedApy),
    riskScore,
    riskLevel: steps.length > 0 ? riskLevelFor(riskScore) : "Low",
    executed: false,
    disclaimer:
      "Simulation only — a preview of the strategy. Nothing is executed, signed or broadcast.",
  };
}
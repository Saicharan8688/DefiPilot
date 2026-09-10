import { describe, it, expect } from "vitest";
import { buildSimulation, type SimulationInput } from "@/lib/ai/simulation";
import type { DeFiOpportunity } from "@/lib/types";

function opp(id: string, apy: number, riskScore: number): DeFiOpportunity {
  return {
    id,
    protocol: "Aave",
    chain: "Ethereum",
    asset: "USDC",
    apy,
    tvl: 1_000_000,
    riskScore,
    riskLevel: "Medium",
  };
}

describe("buildSimulation", () => {
  it("computes step yield as amount × apy%", () => {
    const sim = buildSimulation([
      { opportunity: opp("o1", 10, 20), amountUsd: 100 },
    ]);
    expect(sim.steps[0].expectedYieldUsd).toBe(10);
    expect(sim.totalCapitalUsd).toBe(100);
    expect(sim.totalExpectedYieldUsd).toBe(10);
  });

  it("blends APY and risk by capital, weighted", () => {
    const items: SimulationInput[] = [
      { opportunity: opp("o1", 5, 10), amountUsd: 300 },
      { opportunity: opp("o2", 15, 90), amountUsd: 100 },
    ];
    const sim = buildSimulation(items);
    expect(sim.totalCapitalUsd).toBe(400);
    expect(sim.blendedApy).toBeCloseTo(7.5, 2); // (5*300 + 15*100)/400
    expect(sim.riskScore).toBe(30); // (10*300 + 90*100)/400 = 30
    expect(sim.riskLevel).toBe("Medium");
  });

  it("is deterministic and never claims execution", () => {
    const items = [
      { opportunity: opp("o1", 12.34, 35), amountUsd: 250 },
      { opportunity: opp("o2", 8.76, 22), amountUsd: 250 },
    ];
    const a = buildSimulation(items);
    const b = buildSimulation(items);
    expect(a).toEqual(b);
    expect(a.executed).toBe(false);
    expect(a.disclaimer).toContain("Simulation only");
  });

  it("rounds to two decimals and clamps negative amounts to zero", () => {
    const sim = buildSimulation([
      { opportunity: opp("o1", 10, 20), amountUsd: 12.345 },
      { opportunity: opp("o2", 10, 20), amountUsd: -50 },
    ]);
    expect(sim.totalCapitalUsd).toBe(12.35);
  });

  it("handles empty input", () => {
    const sim = buildSimulation([]);
    expect(sim.steps).toEqual([]);
    expect(sim.totalCapitalUsd).toBe(0);
    expect(sim.totalExpectedYieldUsd).toBe(0);
    expect(sim.blendedApy).toBe(0);
    expect(sim.riskLevel).toBe("Low");
  });
});
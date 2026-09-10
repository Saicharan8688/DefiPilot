import { describe, it, expect } from "vitest";
import { computeRiskScore, riskLevelFor } from "@/lib/defi/risk";
import type { DefiLlamaPool } from "@/lib/defi/defillama-types";

function pool(overrides: Partial<DefiLlamaPool> = {}): DefiLlamaPool {
  return {
    pool: "0x-test-pool",
    symbol: "usdc-test",
    chain: "ethereum",
    project: "test",
    apy: 5,
    apyReward: 0,
    apyBase: 5,
    tvlUsd: 100_000_000,
    stablecoin: true,
    ilRisk: "no",
    exposure: "single",
    apyPct1D: 0,
    apyPct7D: 0,
    apyPct30D: 0,
    ...overrides,
  };
}

describe("computeRiskScore", () => {
  it("scores a low, liquid, stable pool as Low", () => {
    const score = computeRiskScore(pool({ apy: 5, tvlUsd: 500_000_000 }));
    expect(score).toBeLessThan(30);
    expect(riskLevelFor(score)).toBe("Low");
  });

  it("scores a high-yield, illiquid, multi-asset pool as High", () => {
    const score = computeRiskScore(
      pool({
        apy: 200,
        apyReward: 180,
        tvlUsd: 10_000,
        ilRisk: "yes",
        exposure: "multi",
        apyPct30D: 80,
      })
    );
    expect(score).toBeGreaterThan(60);
    expect(riskLevelFor(score)).toBe("High");
  });

  it("clamps into 1..99 even for extreme inputs", () => {
    expect(
      computeRiskScore(
        pool({
          apy: 50_000,
          apyReward: 50_000,
          tvlUsd: 1,
          ilRisk: "yes",
          exposure: "multi",
          apyPct30D: 400,
        })
      )
    ).toBe(99);
    expect(computeRiskScore(pool({ apy: 0, apyReward: 0, tvlUsd: 100_000_000_000 }))).toBe(1);
  });

  it("is deterministic for identical input", () => {
    const p = pool({ apy: 24.5, apyReward: 10, tvlUsd: 3_000_000, apyPct7D: -12 });
    expect(computeRiskScore(p)).toBe(computeRiskScore(p));
  });

  it("handles null change fields", () => {
    const base = computeRiskScore(pool({}));
    const nulled = computeRiskScore(
      pool({ apyPct1D: null, apyPct7D: null, apyPct30D: null })
    );
    expect(nulled).toBe(base);
  });
});

describe("riskLevelFor", () => {
  it("maps thresholds", () => {
    expect(riskLevelFor(0)).toBe("Low");
    expect(riskLevelFor(29)).toBe("Low");
    expect(riskLevelFor(30)).toBe("Medium");
    expect(riskLevelFor(60)).toBe("Medium");
    expect(riskLevelFor(61)).toBe("High");
    expect(riskLevelFor(99)).toBe("High");
  });
});
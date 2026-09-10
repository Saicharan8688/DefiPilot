import { describe, it, expect } from "vitest";
import { buildSnapshot, isStablecoin } from "@/lib/ai/metrics";
import { getMockPortfolio } from "@/lib/mock/portfolio";
import type { Address, Portfolio, TokenBalance } from "@/lib/types";

const ADDRESS: Address = "0xdcf1a13b2a5e2c4f9a8e7d1c3b5f9a7e1c3d5b2a";

function token(
  symbol: string,
  usdValue: number,
  formattedBalance: number
): TokenBalance {
  return {
    address: "0x0000000000000000000000000000000000000000" as Address,
    symbol,
    name: symbol,
    decimals: 18,
    balance: "0",
    formattedBalance,
    priceUsd: 1,
    usdValue,
  };
}

function portfolio(tokens: TokenBalance[]): Portfolio {
  return {
    address: ADDRESS,
    tokens,
    totalUsdValue: tokens.reduce((s, t) => s + t.usdValue, 0),
    source: "demo",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("buildSnapshot", () => {
  it("sorts tokens descending by value and computes percentages", () => {
    const snap = buildSnapshot(
      portfolio([token("USDC", 3000, 3000), token("ETH", 7000, 2)])
    );
    expect(snap.tokens.map((t) => t.symbol)).toEqual(["ETH", "USDC"]);
    expect(snap.tokens[0].percentage).toBe(70);
    expect(snap.tokens[1].percentage).toBe(30);
    expect(snap.totalUsdValue).toBe(10000);
  });

  it("treats stablecoins as idle cash and computes concentration", () => {
    const snap = buildSnapshot(
      portfolio([token("USDC", 4000, 4000), token("DAI", 1000, 1000), token("ETH", 5000, 1)])
    );
    expect(snap.idleCashUsd).toBe(5000);
    expect(snap.concentration).toBe(0.5); // ETH is the largest holding
    expect(snap.assetCount).toBe(3);
  });

  it("avoids division by zero on an empty wallet", () => {
    const snap = buildSnapshot(portfolio([]));
    expect(snap.totalUsdValue).toBe(0);
    expect(snap.idleCashUsd).toBe(0);
    expect(snap.concentration).toBe(0);
    expect(snap.assetCount).toBe(0);
  });
});

describe("getMockPortfolio", () => {
  it("returns deterministic demo data for a given address", () => {
    // Balances are deterministic; only the freshness timestamp can differ.
    const a = getMockPortfolio(ADDRESS);
    const b = getMockPortfolio(ADDRESS);
    expect(a.tokens).toEqual(b.tokens);
    expect(a.totalUsdValue).toBe(b.totalUsdValue);
    expect(a.source).toBe("demo");
  });

  it("yields consistent, self-valid wallets across addresses", () => {
    const a = getMockPortfolio(ADDRESS);
    const b = getMockPortfolio("0x1111111111111111111111111111111111111111");
    for (const p of [a, b]) {
      expect(p.totalUsdValue).toBeCloseTo(
        p.tokens.reduce((s, t) => s + t.usdValue, 0),
        2
      );
      expect(p.tokens.length).toBeGreaterThan(0);
      const snap = buildSnapshot(p);
      const pctSum = snap.tokens.reduce((s, t) => s + t.percentage, 0);
      // Percentages are rounded per token; allow 0.1 rounding slack.
      expect(pctSum).toBeGreaterThan(99.85);
      expect(pctSum).toBeLessThan(100.15);
    }
  });
});

describe("isStablecoin", () => {
  it("recognizes common stables", () => {
    expect(isStablecoin(token("USDC", 1, 1))).toBe(true);
    expect(isStablecoin(token("usdt", 1, 1))).toBe(true);
    expect(isStablecoin(token("ETH", 1, 1))).toBe(false);
  });
});
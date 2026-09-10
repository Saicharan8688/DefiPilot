/**
 * Deterministic portfolio analysis — computes snapshot + metrics in code.
 * No LLM arithmetic; the agent reasons over these structured numbers.
 */
import { getMockPortfolio } from "@/lib/mock/portfolio";
import type {
  Address,
  Portfolio,
  PortfolioSnapshot,
  TokenBalance,
} from "@/lib/types";

const STABLECOIN_SYMBOLS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "FRAX",
  "USDE",
  "PYUSD",
  "TUSD",
  "LUSD",
  "GUSD",
]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildSnapshot(portfolio: Portfolio): PortfolioSnapshot {
  const sorted = portfolio.tokens
    .slice()
    .sort((a, b) => b.usdValue - a.usdValue);

  const tokens = sorted.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    balance: round2(t.formattedBalance),
    priceUsd: t.priceUsd,
    usdValue: round2(t.usdValue),
    percentage: round2(
      portfolio.totalUsdValue > 0 ? (t.usdValue / portfolio.totalUsdValue) * 100 : 0
    ),
  }));

  const idleCashUsd = round2(
    sorted
      .filter((t) => STABLECOIN_SYMBOLS.has(t.symbol.toUpperCase()))
      .reduce((sum, t) => sum + t.usdValue, 0)
  );

  const top = sorted[0];
  const concentration =
    portfolio.totalUsdValue > 0 && top
      ? round2(top.usdValue / portfolio.totalUsdValue)
      : 0;

  return {
    address: portfolio.address,
    totalUsdValue: round2(portfolio.totalUsdValue),
    tokens,
    idleCashUsd,
    concentration,
    assetCount: tokens.length,
    source: portfolio.source,
  };
}

export function getWalletSnapshot(address: Address): {
  portfolio: Portfolio;
  snapshot: PortfolioSnapshot;
} {
  const portfolio = getMockPortfolio(address);
  return { portfolio, snapshot: buildSnapshot(portfolio) };
}

export function isStablecoin(token: TokenBalance): boolean {
  return STABLECOIN_SYMBOLS.has(token.symbol.toUpperCase());
}
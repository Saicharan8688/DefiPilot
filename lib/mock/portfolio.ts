import type { Address, Portfolio, TokenBalance } from "@/lib/types";
import { DEMO_WALLETS, findDemoWallet, type DemoWalletStyle } from "@/lib/demo/wallets";

interface TokenDef {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  priceUsd: number;
}

const NATIVE_ETH: Address = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const TOKENS: TokenDef[] = [
  {
    symbol: "ETH",
    name: "Ether",
    address: NATIVE_ETH,
    decimals: 18,
    priceUsd: 2385.4,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    decimals: 18,
    priceUsd: 2385.4,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimals: 6,
    priceUsd: 1.0,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimals: 6,
    priceUsd: 1.0,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x6b175474e89094c44da98b954eedeac495271d0f",
    decimals: 18,
    priceUsd: 1.0,
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    address: "0x514910771af9ca656af840dff83e8264ecf986ca",
    decimals: 18,
    priceUsd: 14.82,
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
    decimals: 18,
    priceUsd: 1.05,
  },
];

/** Allocation weights by asset symbol for each demo wallet style. Sum to 1. */
const PROFILES: Record<DemoWalletStyle, Record<string, number>> = {
  conservative: { USDC: 0.45, DAI: 0.3, USDT: 0.15, WETH: 0.05, LINK: 0.05 },
  balanced: { WETH: 0.32, USDC: 0.3, DAI: 0.15, LINK: 0.13, USDT: 0.1 },
  growth: { WETH: 0.48, LINK: 0.25, ETH: 0.1, ARB: 0.1, DAI: 0.07 },
};

const TOTAL_USD_BY_STYLE: Record<DemoWalletStyle, number> = {
  conservative: 4_860,
  balanced: 15_240,
  growth: 27_640,
};

function hashToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEIGHTED_STYLES: Array<[DemoWalletStyle, number]> = [
  ["conservative", 0.4],
  ["balanced", 0.35],
  ["growth", 0.25],
];

function pickStyle(rand: () => number): DemoWalletStyle {
  let roll = rand();
  for (const [style, weight] of WEIGHTED_STYLES) {
    if (roll < weight) return style;
    roll -= weight;
  }
  return "balanced";
}

function profileFor(address: Address): { weights: Record<string, number>; totalUsd: number } {
  const demoWallet = findDemoWallet(address);
  if (demoWallet) {
    return {
      weights: PROFILES[demoWallet.style],
      totalUsd: TOTAL_USD_BY_STYLE[demoWallet.style],
    };
  }
  const rand = mulberry32(hashToSeed(address.toLowerCase()));
  const style = pickStyle(rand);
  return {
    weights: PROFILES[style],
    // Deterministic but wallet-specific total value.
    totalUsd: 800 + rand() * 34_000,
  };
}

/**
 * Generates a deterministic portfolio for demo purposes.
 * This is simulated data and is always labelled `source: "demo"`.
 * Real on-chain reads will replace this in the blockchain milestone.
 */
export function getMockPortfolio(address: Address): Portfolio {
  const { weights, totalUsd } = profileFor(address);

  const tokens: TokenBalance[] = TOKENS.filter((t) => weights[t.symbol])
    .map((def) => {
      const usdValue = totalUsd * weights[def.symbol];
      const formattedBalance = usdValue / def.priceUsd;
      const raw = BigInt(Math.round(formattedBalance * 10 ** def.decimals)).toString();
      return {
        address: def.address,
        symbol: def.symbol,
        name: def.name,
        decimals: def.decimals,
        balance: raw,
        formattedBalance,
        priceUsd: def.priceUsd,
        usdValue,
      };
    })
    .sort((a, b) => b.usdValue - a.usdValue);

  return {
    address,
    tokens,
    totalUsdValue: tokens.reduce((sum, t) => sum + t.usdValue, 0),
    source: "demo",
    updatedAt: new Date().toISOString(),
  };
}

/** The native ETH token def is exported for reuse (e.g. gas+price tooling). */
export const NATIVE_TOKEN = TOKENS[0];

export { DEMO_WALLETS };
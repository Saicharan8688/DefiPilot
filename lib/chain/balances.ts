/**
 * Read-only on-chain wallet balances (ETH + common ERC-20s) via a public RPC,
 * priced with live DefiLlama coin data. Used in real-wallet mode.
 * Nothing is signed or broadcast; balances are reads only.
 *
 * On-chain balance reads currently support Ethereum mainnet (chain 1).
 * Other networks return an explicit error rather than mislabeled readings.
 */
import { createPublicClient, getAddress, http } from "viem";
import { mainnet } from "viem/chains";
import type { Address, Portfolio, TokenBalance } from "@/lib/types";

export const PRICE_BASE_URL =
  process.env.COINS_BASE_URL ?? "https://coins.llama.fi";

const NATIVE_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

interface TokenDef {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
}

const TOKENS: TokenDef[] = [
  { symbol: "ETH", name: "Ether", address: NATIVE_ADDRESS, decimals: 18 },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimals: 6,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x6b175474e89094c44da98b954eedeac495271d0f",
    decimals: 18,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    decimals: 18,
  },
];

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

const RPC_URL =
  process.env.RPC_URL ?? "https://ethereum.publicnode.com";

function getMainnetClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL, { timeout: 10_000, retryCount: 0 }),
  });
}

interface CoinPrices {
  [key: string]: { price?: number; decimals?: number };
}

async function fetchPrices(
  addresses: string[]
): Promise<Record<string, number>> {
  const ids = addresses.map((a) => `ethereum:${a.toLowerCase()}`).join(",");
  const url = `${PRICE_BASE_URL}/prices/current/${ids}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`price API ${res.status}`);
  const json = (await res.json()) as { coins?: CoinPrices };
  const prices: Record<string, number> = {};
  for (const [key, value] of Object.entries(json.coins ?? {})) {
    if (value && typeof value.price === "number") {
      const address = key.split(":")[1];
      prices[address] = value.price;
    }
  }
  return prices;
}

/**
 * Reads on-chain balances for the wallet. Prices come from DefiLlama coins;
 * if pricing fails the balances are still returned (priceUsd: null).
 * Only Ethereum mainnet (chainId 1) is supported — passing another chainId
 * returns an explicit error instead of a misleading mainnet read.
 */
export async function getLiveBalances(
  address: Address,
  chainId: number = 1
): Promise<Portfolio> {
  if (chainId !== 1) {
    throw new Error(
      `On-chain balance reads currently support Ethereum mainnet only (wallet is on chain ${chainId}). Switch to Mainnet or use Demo Mode.`
    );
  }
  const client = getMainnetClient();
  const erc20s = TOKENS.filter((t) => t.address !== NATIVE_ADDRESS);

  const results = await Promise.allSettled([
    client.getBalance({ address }),
    ...erc20s.map((t) =>
      client.readContract({
        address: t.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      })
    ),
  ]);

  // The native-ETH read is the chain health check. If it fails the wallet is
  // NOT provably empty — report an outage instead of a fake $0 "live" wallet.
  if (results[0].status === "rejected") {
    const reason =
      results[0].reason instanceof Error
        ? results[0].reason.message
        : "network error";
    throw new Error(`RPC unreachable — could not read on-chain balances (${reason}).`);
  }

  const rawBalances = results.map((r) => (r.status === "fulfilled" ? r.value : null));
  let priceMap: Record<string, number> = {};
  try {
    priceMap = await fetchPrices(TOKENS.map((t) => t.address));
  } catch {
    // Prices unavailable — balances are still shown with priceUsd: null.
  }

  const tokens: TokenBalance[] = []; 
  TOKENS.forEach((def, i) => {
    const raw = rawBalances[i];
    const formattedBalance =
      raw != null ? Number(raw) / 10 ** def.decimals : 0;
    const price = priceMap[def.address.toLowerCase()] ?? null;
    tokens.push({
      address: def.address,
      symbol: def.symbol,
      name: def.name,
      decimals: def.decimals,
      balance: raw != null ? raw.toString() : "0",
      formattedBalance: Math.round(formattedBalance * 1e6) / 1e6,
      priceUsd: price,
      usdValue: price != null ? price * formattedBalance : 0,
    });
  });

  const priced = tokens.filter((t) => t.priceUsd != null);
  const totalUsdValue = priced.reduce((sum, t) => sum + t.usdValue, 0);

  return {
    address: getAddress(address),
    tokens: tokens.sort((a, b) => b.usdValue - a.usdValue),
    totalUsdValue: Math.round(totalUsdValue * 100) / 100,
    source: "live",
    updatedAt: new Date().toISOString(),
  };
}
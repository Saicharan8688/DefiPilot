/**
 * Read-only viem clients and chain-state reads. Nothing here signs or
 * broadcasts — the blockchain layer is strictly informative.
 */
import { createPublicClient, http } from "viem";
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  sepolia,
  type Chain,
} from "viem/chains";
import { getChain } from "@/lib/chain/chains";

const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  8453: base,
  84532: baseSepolia,
  42161: arbitrum,
  10: optimism,
};

export class ChainReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainReadError";
  }
}

export function clientFor(chainId: number) {
  const descriptor = getChain(chainId);
  if (!descriptor?.rpcUrl) return null;
  const chain = VIEM_CHAINS[chainId] ?? mainnet;
  return createPublicClient({
    chain,
    transport: http(descriptor.rpcUrl, { timeout: 8_000, retryCount: 0 }),
  });
}

export interface ChainState {
  blockNumber: number;
  gasPriceGwei: number;
}

/** Reads the latest block number and gas price. Throws ChainReadError. */
export async function readChainState(chainId: number): Promise<ChainState> {
  const client = clientFor(chainId);
  if (!client) {
    throw new ChainReadError(`No RPC configured for chain ${chainId}.`);
  }
  try {
    const [blockNumber, gasPrice] = await Promise.all([
      client.getBlockNumber(),
      client.getGasPrice(),
    ]);
    const gwei = Number(gasPrice) / 1e9;
    return {
      blockNumber: Number(blockNumber),
      gasPriceGwei: Math.round(gwei * 100) / 100,
    };
  } catch (error) {
    throw new ChainReadError(
      `RPC read failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }
}
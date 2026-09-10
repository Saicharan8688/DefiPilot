import { NextRequest } from "next/server";
import { DEFAULT_CHAIN_ID, getChain } from "@/lib/chain/chains";
import { readChainState } from "@/lib/chain/client";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import type { ApiResponse, ChainInfoResponse } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Read-only chain state (block number, gas price) from a public RPC.
 * If the RPC is unreachable the route degrades to clearly-labelled
 * simulated values instead of failing — the UI never mistakes that.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "chain", RATE_LIMITS.read);
  if (rateLimited) return rateLimited;

  const sp = request.nextUrl.searchParams;
  const rawChainId = sp.get("chainId");

  let chainId = DEFAULT_CHAIN_ID;
  if (rawChainId !== null) {
    const raw = rawChainId.trim();
    if (/^\d{1,10}$/.test(raw)) {
      const parsed = Number(raw);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        const chain = getChain(parsed);
        if (chain) {
          chainId = parsed;
        } else {
          return Response.json(
            {
              success: false,
              error: {
                code: "INVALID_CHAIN_ID",
                message: `Chain ${parsed} is not supported. Supported: 1 (Ethereum), 11155111 (Sepolia).`,
              },
            },
            { status: 400 }
          );
        }
      }
    }
  }

  const descriptor = getChain(chainId)!;

  let blockNumber: number | null = null;
  let gasPriceGwei: number | null = null;
  let rpc: ChainInfoResponse["rpc"] = "simulated";
  let note: string | undefined;

  try {
    const state = await readChainState(descriptor.chainId);
    blockNumber = state.blockNumber;
    gasPriceGwei = state.gasPriceGwei;
    rpc = "live";
  } catch {
    note = "RPC read failed. Showing simulated network values — this is a sandbox.";
  }

  return Response.json({
    success: true,
    data: {
      network: descriptor.network,
      chainId: descriptor.chainId,
      isTestnet: descriptor.isTestnet,
      currency: descriptor.currency,
      blockNumber,
      gasPriceGwei,
      rpc,
      simulated: rpc === "simulated",
      note,
      updatedAt: new Date().toISOString(),
    },
  } satisfies ApiResponse<ChainInfoResponse>);
}
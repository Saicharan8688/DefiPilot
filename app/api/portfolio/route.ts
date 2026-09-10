import { NextRequest } from "next/server";
import { isAddress } from "viem";
import { getMockPortfolio } from "@/lib/mock/portfolio";
import { getLiveBalances } from "@/lib/chain/balances";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import type { Portfolio, ApiResponse } from "@/lib/types";

export async function GET(request: NextRequest): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "portfolio", RATE_LIMITS.read);
  if (rateLimited) return rateLimited;

  const addressParam = request.nextUrl.searchParams.get("address") ?? "";
  const mode = request.nextUrl.searchParams.get("mode") ?? "demo";
  const rawChainId = request.nextUrl.searchParams.get("chainId");
  const chainIdParam =
    rawChainId && rawChainId.trim() !== "" ? Number(rawChainId) : undefined;
  const chainId =
    chainIdParam !== undefined &&
    chainIdParam !== null &&
    Number.isInteger(chainIdParam) &&
    chainIdParam > 0
      ? chainIdParam
      : undefined;
  if (chainId === undefined) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_CHAIN_ID",
          message: "chainId must be a positive integer (e.g. 1 for Ethereum mainnet).",
        },
      } satisfies ApiResponse<Portfolio>,
      { status: 400 }
    );
  }

  if (!isAddress(addressParam)) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_ADDRESS",
          message: "A valid 0x address is required.",
        },
      } satisfies ApiResponse<Portfolio>,
      { status: 400 }
    );
  }

  const address = addressParam.toLowerCase() as `0x${string}`;

  try {
    const portfolio =
      mode === "live"
        ? await getLiveBalances(address, chainId)
        : getMockPortfolio(address);
    return Response.json(
      { success: true, data: portfolio } satisfies ApiResponse<Portfolio>
    );
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "PORTFOLIO_UNAVAILABLE",
          message: "Failed to load portfolio. Please try again.",
        },
      } satisfies ApiResponse<Portfolio>,
      { status: 502 }
    );
  }
}
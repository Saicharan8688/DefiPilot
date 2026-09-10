import { NextRequest } from "next/server";
import { DefiLlamaError, getOpportunities } from "@/lib/defi/defillama";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import type { ApiResponse, OpportunitiesResponse } from "@/lib/types";

type ParamError = { code: string; message: string };

function parseParams(request: NextRequest): {
  params: {
    chains?: string[];
    limit: number;
    minTvl: number;
    minApy: number;
  };
  error: ParamError | null;
} {
  const sp = request.nextUrl.searchParams;
  const rawChains = sp.get("chains");
  const rawLimit = sp.get("limit");
  const rawMinTvl = sp.get("minTvl");
  const rawMinApy = sp.get("minApy");

  const errors: string[] = [];

  let chains: string[] | undefined;
  if (rawChains !== null) {
    const parts = rawChains
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0 || parts.length > 12) {
      errors.push("chains must contain between 1 and 12 values");
    } else if (parts.some((c) => !/^[A-Za-z0-9 .&'-]+$/.test(c))) {
      errors.push("chains contains invalid characters");
    } else {
      chains = parts;
    }
  }

  let limit = 10;
  if (rawLimit !== null) {
    const n = Number(rawLimit);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      errors.push("limit must be an integer between 1 and 50");
    } else {
      limit = n;
    }
  }

  let minTvl = 1_000_000;
  if (rawMinTvl !== null) {
    const n = Number(rawMinTvl);
    if (!Number.isFinite(n) || n < 0) {
      errors.push("minTvl must be a non-negative number");
    } else {
      minTvl = n;
    }
  }

  let minApy = 0;
  if (rawMinApy !== null) {
    const n = Number(rawMinApy);
    if (!Number.isFinite(n) || n < 0) {
      errors.push("minApy must be a non-negative number");
    } else {
      minApy = n;
    }
  }

  if (errors.length) {
    return {
      params: { chains, limit, minTvl, minApy },
      error: {
        code: "INVALID_PARAMS",
        message: `Invalid query parameters: ${errors.join("; ")}`,
      },
    };
  }

  return {
    params: { chains, limit, minTvl, minApy },
    error: null,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "opportunities", RATE_LIMITS.read);
  if (rateLimited) return rateLimited;

  const { params, error } = parseParams(request);

  if (error) {
    return Response.json(
      { success: false, error } satisfies ApiResponse<OpportunitiesResponse>,
      { status: 400 }
    );
  }

  try {
    const opportunities = await getOpportunities(params);
    return Response.json(
      { success: true, data: opportunities } satisfies ApiResponse<OpportunitiesResponse>
    );
  } catch (err) {
    const message =
      err instanceof DefiLlamaError
        ? err.message
        : "Failed to fetch DeFi opportunities. Please try again.";

    return Response.json(
      {
        success: false,
        error: { code: "OPPORTUNITIES_UNAVAILABLE", message },
      } satisfies ApiResponse<OpportunitiesResponse>,
      { status: 502 }
    );
  }
}
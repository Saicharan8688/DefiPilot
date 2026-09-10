import { isAddress } from "viem";
import { getOpportunitiesByIds } from "@/lib/defi/defillama";
import { buildSimulation } from "@/lib/ai/simulation";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import type { ApiResponse, SimulationAllocationInput, SimulationResult } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_AMOUNT_USD = 1e12;

interface SimulateBody {
  address?: unknown;
  allocations?: unknown;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export async function POST(request: Request): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "simulate", RATE_LIMITS.write);
  if (rateLimited) return rateLimited;

  const cl = Number(request.headers.get("content-length") || 0);
  if (cl > MAX_BODY_BYTES) {
    return Response.json(
      { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large (max 64KB)." } } as ApiResponse<SimulationResult>,
      { status: 413 }
    );
  }

  const bad = (message: string, status = 400): Response =>
    Response.json(
      { success: false, error: { code: "INVALID_PARAMS", message } } as ApiResponse<SimulationResult>,
      { status }
    );

  let body: SimulateBody;
  try {
    body = (await request.json()) as SimulateBody;
  } catch {
    return bad("Request body must be valid JSON.");
  }

  if (typeof body.address !== "string" || !isAddress(body.address)) {
    return bad("address must be a valid 0x address.");
  }

  if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
    return bad("allocations must be a non-empty array.");
  }
  if (body.allocations.length > 20) {
    return bad("Too many allocations (max 20).");
  }

  const rows = body.allocations
    .map((a) => a as Partial<SimulationAllocationInput>)
    .filter(
      (a): a is SimulationAllocationInput =>
        typeof a.opportunityId === "string" &&
        isFiniteNumber(a.amountUsd) &&
        a.amountUsd > 0 &&
        a.amountUsd <= MAX_AMOUNT_USD
    );

  if (rows.length === 0) {
    return bad("Each allocation needs a valid opportunityId and an amountUsd > 0 (max $1T).");
  }

  try {
    const opportunities = await getOpportunitiesByIds(rows.map((r) => r.opportunityId));
    const byId = new Map(opportunities.map((o) => [o.id, o]));

    const unknown = rows.filter((r) => !byId.has(r.opportunityId));
    if (unknown.length > 0) {
      return bad(
        `Unknown opportunityId(s): ${unknown.map((r) => r.opportunityId).join(", ")}`
      );
    }

    const result = buildSimulation(
      rows.map((r) => ({
        opportunity: byId.get(r.opportunityId)!,
        amountUsd: r.amountUsd,
      }))
    );

    return Response.json({ success: true, data: result } satisfies ApiResponse<SimulationResult>);
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "SIMULATION_UNAVAILABLE",
          message: "Live pool data is unavailable, so the simulation could not run.",
        },
      } as ApiResponse<SimulationResult>,
      { status: 502 }
    );
  }
}
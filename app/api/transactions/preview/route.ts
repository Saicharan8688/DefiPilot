import { isAddress } from "viem";
import { getOpportunitiesByIds } from "@/lib/defi/defillama";
import { buildSimulation } from "@/lib/ai/simulation";
import { DEFAULT_CHAIN_ID, getChain } from "@/lib/chain/chains";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import type {
  Address,
  ApiResponse,
  TransactionPreview,
  TransactionPreviewStep,
} from "@/lib/types";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_AMOUNT_USD = 1e12;

/**
 * Prepares a deterministic, sandbox-only transaction preview.
 * It NEVER signs or broadcasts anything. Contract addresses are intentionally
 * not emitted (null) — they are resolved only at execution time, which the app
 * does not perform.
 */

interface PreviewBody {
  address?: unknown;
  chainId?: unknown;
  allocations?: unknown;
}

function fmt(n: number, digits = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export async function POST(request: Request): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "preview", RATE_LIMITS.write);
  if (rateLimited) return rateLimited;

  const cl = Number(request.headers.get("content-length") || 0);
  if (cl > MAX_BODY_BYTES) {
    return Response.json(
      { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large (max 64KB)." } } as ApiResponse<TransactionPreview>,
      { status: 413 }
    );
  }

  const bad = (message: string, status = 400): Response =>
    Response.json(
      { success: false, error: { code: "INVALID_PARAMS", message } } as ApiResponse<TransactionPreview>,
      { status }
    );

  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return bad("Request body must be valid JSON.");
  }

  if (typeof body.address !== "string" || !isAddress(body.address)) {
    return bad("address must be a valid 0x address.");
  }

  let chainId = DEFAULT_CHAIN_ID;
  if (body.chainId != null) {
    const raw = String(body.chainId).trim();
    if (/^\d{1,10}$/.test(raw)) {
      const n = Number(raw);
      if (Number.isSafeInteger(n) && n > 0) chainId = n;
    }
  }
  const descriptor = getChain(chainId) ?? getChain(DEFAULT_CHAIN_ID)!;

  if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
    return bad("allocations must be a non-empty array.");
  }
  if (body.allocations.length > 20) {
    return bad("Too many allocations (max 20).");
  }

  const rows = body.allocations
    .map((a) => a as Partial<{ opportunityId: unknown; amountUsd: unknown }>)
    .filter(
      (a): a is { opportunityId: string; amountUsd: number } =>
        typeof a.opportunityId === "string" &&
        typeof a.amountUsd === "number" &&
        Number.isFinite(a.amountUsd) &&
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

    const simulation = buildSimulation(
      rows.map((r) => ({
        opportunity: byId.get(r.opportunityId)!,
        amountUsd: r.amountUsd,
      }))
    );

    const steps: TransactionPreviewStep[] = simulation.steps.map((s, i) => ({
      sequence: i + 1,
      type: s.riskLevel === "High" ? "deposit" : "supply",
      protocol: s.protocol,
      asset: s.asset,
      chain: s.chain,
      amountUsd: s.amountUsd,
      apy: s.apy,
      riskScore: s.riskScore,
      riskLevel: s.riskLevel,
      estimatedResultUsd: `$${fmt(s.amountUsd)} ${s.asset} to ${s.protocol} on ${s.chain} — expected ≈$${fmt(s.expectedYieldUsd)}/year at ${s.apy.toFixed(2)}% APY.`,
      expectedYieldUsd: s.expectedYieldUsd,
      contractAddress: null,
    }));

    const warnings = [
      "Sandbox preview only — no transaction is signed or broadcast.",
      "Contract addresses are resolved at execution time; the app never executes.",
      "Yields are live APYs as of analysis time and can change before any real execution.",
    ];
    if (simulation.riskLevel === "High") {
      warnings.push("This plan carries HIGH weighted risk. Confirm you understand before proceeding.");
    }

    const data: TransactionPreview = {
      summary:
        `Prepared ${steps.length} step${steps.length > 1 ? "s" : ""} deploying $${
          fmt(simulation.totalCapitalUsd)
        } for an estimated ≈$${fmt(simulation.totalExpectedYieldUsd)}/year at ≈${
          simulation.blendedApy.toFixed(2)
        }% blended APY.`,
      transactionType: "approve-and-supply (simulated)",
      walletAddress: body.address as Address,
      network: {
        name: descriptor.network,
        chainId: descriptor.chainId,
        isTestnet: descriptor.isTestnet,
        simulated: true,
      },
      steps,
      totalAmountUsd: simulation.totalCapitalUsd,
      totalExpectedYieldUsd: simulation.totalExpectedYieldUsd,
      approved: false,
      executed: false,
      warnings,
      disclaimer:
        "An AI recommendation is a PROPOSAL, not an executed transaction. You remain in control: nothing is signed or broadcast by DeFiPilot.",
    };

    return Response.json(
      { success: true, data } satisfies ApiResponse<TransactionPreview>
    );
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "PREVIEW_UNAVAILABLE",
          message: "Live pool data is unavailable, so the transaction preview could not be prepared.",
        },
      } as ApiResponse<TransactionPreview>,
      { status: 502 }
    );
  }
}
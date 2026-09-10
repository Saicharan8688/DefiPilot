import { isAddress } from "viem";
import { runAnalysisAgent } from "@/lib/ai/agent";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { getSubscriberByWallet } from "@/lib/notifications/store";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { recommendationMessage } from "@/lib/notifications/templates";
import type { Address, ApiResponse, Recommendation } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

interface RecommendBody {
  address?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "recommend", RATE_LIMITS.llm);
  if (rateLimited) return rateLimited;

  const cl = Number(request.headers.get("content-length") || 0);
  if (cl > MAX_BODY_BYTES) {
    return Response.json(
      {
        success: false,
        error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large (max 64KB)." },
      } satisfies ApiResponse<Recommendation>,
      { status: 413 }
    );
  }

  let body: RecommendBody;
  try {
    body = (await request.json()) as RecommendBody;
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_PARAMS", message: "Request body must be valid JSON." },
      } satisfies ApiResponse<Recommendation>,
      { status: 400 }
    );
  }

  if (typeof body.address !== "string" || !isAddress(body.address)) {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_PARAMS", message: "address must be a valid 0x address." },
      } satisfies ApiResponse<Recommendation>,
      { status: 400 }
    );
  }

  try {
    const recommendation = await runAnalysisAgent(body.address as Address);
    void notifyRecommendation(body.address.toLowerCase() as Address, recommendation);
    return Response.json(
      { success: true, data: recommendation } satisfies ApiResponse<Recommendation>
    );
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "RECOMMENDATION_UNAVAILABLE",
          message: "The analysis could not be completed. Please try again.",
        },
      } satisfies ApiResponse<Recommendation>,
      { status: 502 }
    );
  }
}

/** Best-effort: push the recommendation to the wallet's Telegram subscriber. */
async function notifyRecommendation(
  address: Address,
  rec: Recommendation
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const sub = getSubscriberByWallet(address);
  if (!sub || !sub.triggers.includes("recommendation")) return;
  try {
    await sendTelegramMessage({
      chatId: sub.chatId,
      text: recommendationMessage({
        summary: rec.summary,
        riskLevel: rec.riskLevel,
        blendedApy: rec.expectedYield.blendedApy,
        totalYieldUsd: rec.expectedYield.totalUsd,
        allocations: rec.recommendedAllocation.map((a) => ({
          protocol: a.protocol,
          asset: a.asset,
          percentage: a.percentage,
          apy: a.apy,
        })),
      }),
    });
  } catch {
    // Notifications are best-effort — never fail the API response.
  }
}
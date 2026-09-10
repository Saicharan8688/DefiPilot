import { NextRequest } from "next/server";
import { isAddress } from "viem";
import { checkYieldAlerts, sendPortfolioSummary } from "@/lib/notifications/alerts";
import { getSubscriberByWallet, getSubscribersByTrigger } from "@/lib/notifications/store";
import { verifyBotToken } from "@/lib/notifications/telegram";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";

const CRON_SECRET = process.env.NOTIFICATION_CRON_SECRET ?? "";

/**
 * POST /api/notifications/alerts
 * Trigger endpoint — checks for yield changes and sends alerts.
 * Protected by NOTIFICATION_CRON_SECRET (shared secret for cron/trigger).
 *
 * Can also be called with ?type=portfolio&address=0x... to send a
 * portfolio summary to the subscriber of that wallet.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "notifications-alerts", RATE_LIMITS.write);
  if (rateLimited) return rateLimited;

  // Authenticate with shared secret (skip if no secret configured — dev mode).
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return Response.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization." } },
        { status: 401 }
      );
    }
  }

  const bot = await verifyBotToken();
  if (!bot.valid) {
    return Response.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "Telegram bot is not configured." } },
      { status: 503 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const type = sp.get("type");

  // Portfolio summary for a specific wallet.
  if (type === "portfolio") {
    const address = sp.get("address");
    if (!address || !isAddress(address)) {
      return Response.json(
        { success: false, error: { code: "INVALID_PARAMS", message: "address must be a valid 0x address." } },
        { status: 400 }
      );
    }

    const sub = getSubscriberByWallet(address);
    if (!sub) {
      return Response.json(
        { success: false, error: { code: "NO_SUBSCRIBER", message: "No Telegram subscriber linked to this wallet." } },
        { status: 404 }
      );
    }

    const result = await sendPortfolioSummary(sub.chatId, address);
    return Response.json({ success: result.sent, error: result.error });
  }

  // Yield alerts (default).
  const result = await checkYieldAlerts();
  return Response.json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/notifications/alerts
 * Check alert status — how many subscribers, how many pools tracked.
 */
export async function GET(): Promise<Response> {
  const yieldSubs = getSubscribersByTrigger("yield");
  const portfolioSubs = getSubscribersByTrigger("portfolio");
  const recSubs = getSubscribersByTrigger("recommendation");

  return Response.json({
    success: true,
    data: {
      yieldAlertSubscribers: yieldSubs.length,
      portfolioSubscribers: portfolioSubs.length,
      recommendationSubscribers: recSubs.length,
    },
  });
}

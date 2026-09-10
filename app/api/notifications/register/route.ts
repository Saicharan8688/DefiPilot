import { NextRequest } from "next/server";
import { isAddress } from "viem";
import {
  registerSubscriber,
  removeSubscriber,
  getSubscriber,
  getSubscriberCount,
} from "@/lib/notifications/store";
import { sendTelegramMessage, verifyBotToken } from "@/lib/notifications/telegram";
import { registeredMessage, stoppedMessage } from "@/lib/notifications/templates";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/notifications/register
 * Body: { action: "register" | "unregister" | "status", chatId: number, walletAddress?: string }
 *
 * Called by the Telegram webhook handler after parsing /start, /stop, /status.
 * Can also be called directly for programmatic registration.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "notifications-register", RATE_LIMITS.write);
  if (rateLimited) return rateLimited;

  let body: { action?: unknown; chatId?: unknown; walletAddress?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { success: false, error: { code: "INVALID_PARAMS", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const action = body.action;
  if (action !== "register" && action !== "unregister" && action !== "status") {
    return Response.json(
      { success: false, error: { code: "INVALID_PARAMS", message: 'action must be "register", "unregister", or "status".' } },
      { status: 400 }
    );
  }

  if (typeof body.chatId !== "number") {
    return Response.json(
      { success: false, error: { code: "INVALID_PARAMS", message: "chatId must be a number." } },
      { status: 400 }
    );
  }

  const chatId = body.chatId;

  // Check if Telegram is configured.
  const bot = await verifyBotToken();
  if (!bot.valid) {
    return Response.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "Telegram bot is not configured. Set TELEGRAM_BOT_TOKEN." } },
      { status: 503 }
    );
  }

  if (action === "unregister") {
    const removed = removeSubscriber(chatId);
    if (removed) {
      await sendTelegramMessage({ chatId, text: stoppedMessage() });
    }
    return Response.json({ success: true, data: { removed, subscriberCount: getSubscriberCount() } });
  }

  if (action === "status") {
    const sub = getSubscriber(chatId);
    if (!sub) {
      return Response.json(
        { success: false, error: { code: "NOT_REGISTERED", message: "No active notification subscription for this chat." } },
        { status: 404 }
      );
    }
    return Response.json({
      success: true,
      data: {
        walletAddress: sub.walletAddress,
        triggers: sub.triggers,
        registeredAt: sub.registeredAt,
      },
    });
  }

  // action === "register"
  if (typeof body.walletAddress !== "string" || !isAddress(body.walletAddress)) {
    return Response.json(
      { success: false, error: { code: "INVALID_PARAMS", message: "walletAddress must be a valid 0x address." } },
      { status: 400 }
    );
  }

  registerSubscriber(chatId, body.walletAddress);
  await sendTelegramMessage({ chatId, text: registeredMessage(body.walletAddress) });

  return Response.json({
    success: true,
    data: {
      walletAddress: body.walletAddress.toLowerCase(),
      chatId,
      subscriberCount: getSubscriberCount(),
    },
  });
}

/** GET: health check — is Telegram configured? */
export async function GET(): Promise<Response> {
  const bot = await verifyBotToken();
  return Response.json({
    success: true,
    data: {
      configured: bot.valid,
      botUsername: bot.botName ?? null,
      subscriberCount: getSubscriberCount(),
    },
  });
}

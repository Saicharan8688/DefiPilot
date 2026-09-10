import { NextRequest } from "next/server";
import { isAddress } from "viem";
import { registerSubscriber, removeSubscriber, getSubscriber } from "@/lib/notifications/store";
import { sendTelegramMessage, setBotCommands, verifyBotToken } from "@/lib/notifications/telegram";
import { registeredMessage, stoppedMessage, statusMessage, helpMessage } from "@/lib/notifications/templates";
import { sendPortfolioSummary } from "@/lib/notifications/alerts";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { parseTelegramCommand } from "@/lib/notifications/commands";

export const runtime = "nodejs";

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat?: { id: number };
    text?: string;
  };
}

/**
 * POST /api/notifications/webhook
 * Receives Telegram bot updates (messages).
 * Set this URL as the webhook in BotFather, or use it with getUpdates polling.
 *
 * Commands handled:
 *   /start [wallet_address] — register for notifications
 *   /stop — unregister
 *   /portfolio — get a portfolio snapshot now
 *   /status — check subscription status
 *   /help — show available commands
 */
export async function POST(request: NextRequest): Promise<Response> {
  const rateLimited = enforceRateLimit(request, "notifications-webhook", RATE_LIMITS.write);
  if (rateLimited) return rateLimited;

  const bot = await verifyBotToken();
  if (!bot.valid) {
    return Response.json({ ok: false, error: "Bot not configured" }, { status: 503 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const msg = update.message;
  if (!msg?.text || !msg?.chat) {
    return Response.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Set bot commands on first update (one-time setup).
  await setBotCommands().catch(() => {});

  // Parse command.
  const { cmd, args } = parseTelegramCommand(text);

  switch (cmd) {
    case "start": {
      const walletArg = args[0];
      if (!walletArg || !isAddress(walletArg)) {
        await sendTelegramMessage({
          chatId,
          text: `Please provide a valid wallet address:\n\n/start 0xYourWalletAddress`,
          parseMode: "MarkdownV2",
        });
        break;
      }
      registerSubscriber(chatId, walletArg);
      await sendTelegramMessage({ chatId, text: registeredMessage(walletArg) });
      break;
    }

    case "stop": {
      const removed = removeSubscriber(chatId);
      await sendTelegramMessage({
        chatId,
        text: removed ? stoppedMessage() : "You don't have an active subscription. Use /start to register.",
      });
      break;
    }

    case "portfolio": {
      const sub = getSubscriber(chatId);
      if (!sub) {
        await sendTelegramMessage({
          chatId,
          text: "You don't have a linked wallet. Use /start 0xYourAddress first.",
        });
        break;
      }
      const result = await sendPortfolioSummary(chatId, sub.walletAddress);
      if (!result.sent) {
        await sendTelegramMessage({
          chatId,
          text: `Failed to load portfolio: ${result.error ?? "unknown error"}. Please try again later.`,
        });
      }
      break;
    }

    case "status": {
      const sub = getSubscriber(chatId);
      if (!sub) {
        await sendTelegramMessage({
          chatId,
          text: "No active subscription. Use /start 0xYourAddress to register.",
        });
        break;
      }
      await sendTelegramMessage({
        chatId,
        text: statusMessage({ walletAddress: sub.walletAddress, triggers: sub.triggers }),
      });
      break;
    }

    case "help":
    default:
      await sendTelegramMessage({ chatId, text: helpMessage() });
      break;
  }

  return Response.json({ ok: true });
}

/**
 * GET /api/notifications/webhook
 * Health check — is the webhook endpoint alive?
 */
export async function GET(): Promise<Response> {
  const bot = await verifyBotToken();
  return Response.json({
    ok: true,
    configured: bot.valid,
    botUsername: bot.botName ?? null,
  });
}

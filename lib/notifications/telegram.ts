/**
 * Telegram Bot API client — zero-dependency (raw HTTP).
 * Uses the Telegram Bot HTTP API directly via fetch.
 */
const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.trim() === "") return null;
  return token.trim();
}

export interface SendMessageParams {
  chatId: number | string;
  text: string;
  parseMode?: "MarkdownV2" | "HTML" | "Markdown";
  disablePreview?: boolean;
}

export interface TgResult<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

/** Send a message via Telegram Bot API. */
export async function sendTelegramMessage(
  params: SendMessageParams
): Promise<TgResult> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN not configured" };
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      parse_mode: params.parseMode ?? "MarkdownV2",
      disable_web_page_preview: params.disablePreview ?? true,
    }),
  });

  return (await res.json()) as TgResult;
}

/** Set bot commands for the /start, /help, /status menu. */
export async function setBotCommands(): Promise<TgResult> {
  const token = getBotToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN not configured" };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Link your wallet and enable notifications" },
        { command: "stop", description: "Disable notifications" },
        { command: "status", description: "Check notification status" },
        { command: "portfolio", description: "Get a portfolio snapshot now" },
        { command: "help", description: "Show available commands" },
      ],
    }),
  });

  return (await res.json()) as TgResult;
}

/** Delete any existing webhook (required before getUpdates works). */
export async function deleteWebhook(): Promise<TgResult> {
  const token = getBotToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN not configured" };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return (await res.json()) as TgResult;
}

/** Check if the bot token is valid by calling getMe. */
export async function verifyBotToken(): Promise<{ valid: boolean; botName?: string }> {
  const token = getBotToken();
  if (!token) return { valid: false };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
    const data = (await res.json()) as TgResult<{ username?: string }>;
    return { valid: data.ok, botName: data.result?.username };
  } catch {
    return { valid: false };
  }
}

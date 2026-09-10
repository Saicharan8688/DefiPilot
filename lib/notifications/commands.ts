/**
 * Telegram command parsing for bot messages.
 * Pure functions so the parsing is unit-testable offline.
 */

export interface ParsedCommand {
  cmd: string;
  args: string[];
}

/**
 * Parse a message text into a command + args.
 * Accepts "/start 0x...", "/Start@BotName 0x...", bare text, etc.
 */
export function parseTelegramCommand(text: string): ParsedCommand {
  const trimmed = (text ?? "").trim();
  const parts = trimmed.split(/\s+/);
  const first = parts[0] ?? "";
  let cmd = "";
  let args: string[] = [];
  if (first.startsWith("/")) {
    cmd = first.toLowerCase().replace(/^\/+/, "").split("@")[0];
    args = parts.slice(1);
  } else {
    args = parts;
  }
  return { cmd, args };
}
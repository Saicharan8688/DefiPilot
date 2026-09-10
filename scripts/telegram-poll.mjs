#!/usr/bin/env node
/**
 * DeFiPilot Telegram long-polling runner (local dev).
 *
 * Polls the Telegram Bot API `getUpdates` and forwards each update to the
 * app's webhook endpoint (`POST /api/notifications/webhook`). This lets the
 * bot work on localhost without a public webhook URL.
 *
 * Usage:
 *   npm run telegram:watch            # assumes app on http://localhost:3000
 *   APP_BASE_URL=http://localhost:3142 npm run telegram:watch
 *
 * Requires TELEGRAM_BOT_TOKEN, loaded automatically from .env.local via the
 * `--env-file` flag in the npm script.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const BASE = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const WEBHOOK_URL = `${BASE}/api/notifications/webhook`;
const API = "https://api.telegram.org";
const POLL_DELAY_MS = 2000;
const UPDATE_DELAY_MS = 350; // stay under the write rate limit

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN not set. Copy .env.example to .env.local and add your token, then run again.");
  console.error('  cp .env.example .env.local   # then set TELEGRAM_BOT_TOKEN=<your token>');
  process.exit(1);
}

let offset = 0;

async function getUpdates() {
  const url = `${API}/bot${TOKEN}/getUpdates?timeout=25&limit=10${offset ? `&offset=${offset}` : ""}`;
  const res = await fetch(url);
  return await res.json();
}

async function forward(update) {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function poll() {
  if (!(await pingApp())) {
    console.error(`[telegram:watch] Cannot reach app at ${BASE} — is 'npm run dev' (or start) running?`);
    console.error(`[telegram:watch] Retrying in ${POLL_DELAY_MS / 1000}s...`);
    setTimeout(poll, POLL_DELAY_MS);
    return;
  }
  try {
    const data = await getUpdates();
    if (!data.ok || !data.result) {
      console.error("[telegram:watch] getUpdates failed:", data.ok ? "empty" : JSON.stringify(data).slice(0, 300));
    } else if (data.result.length > 0) {
      for (const update of data.result) {
        await new Promise((r) => setTimeout(r, UPDATE_DELAY_MS));
        try {
          const { status, body } = await forward(update);
          console.log(`[telegram:watch] update ${update.update_id} -> ${status} ${body.slice(0, 80).replaceAll("\n", " ")}`);
          if (status >= 200 && status < 500) offset = update.update_id + 1;
        } catch (e) {
          console.error(`[telegram:watch] forward failed for ${update.update_id}:`, e.message);
        }
      }
    }
  } catch (e) {
    console.error("[telegram:watch] poll error:", e.message);
  }
  setTimeout(poll, POLL_DELAY_MS);
}

async function pingApp() {
  try {
    const res = await fetch(`${WEBHOOK_URL}`, { method: "GET" });
    return res.status < 500;
  } catch {
    return false;
  }
}

console.log(`[telegram:watch] polling for @bot updates -> ${WEBHOOK_URL}`);
poll();
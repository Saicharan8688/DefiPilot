/**
 * In-memory subscriber store for Telegram notifications.
 * Resets on server restart — acceptable for a hackathon demo.
 * Production would use a database (Redis/Postgres).
 *
 * The maps live on `globalThis` (behind a Symbol) so that every Next.js
 * route-handler bundle shares the same instance under `next start` (which
 * runs a single Node process). Without this, each route module gets its own
 * copy of the store and subscribers registered via `/webhook` are invisible
 * to `/register`/`/alerts`. In multi-instance/serverless deploys each process
 * still has its own copy — a persistent store remains the production answer.
 */

import type { Address } from "@/lib/types";

export type NotificationType = "yield" | "portfolio" | "recommendation";

export interface Subscriber {
  chatId: number;
  walletAddress: Address;
  triggers: NotificationType[];
  registeredAt: string;
}

const STORE_KEY = Symbol.for("defipilot.notifications.store");

interface StoreState {
  subscribers: Map<number, Subscriber>;
  walletIndex: Map<string, number>; // wallet → chatId
}

function getStore(): StoreState {
  const g = globalThis as unknown as Record<symbol, StoreState>;
  let state = g[STORE_KEY];
  if (!state) {
    state = { subscribers: new Map(), walletIndex: new Map() };
    g[STORE_KEY] = state;
  }
  return state;
}

export function registerSubscriber(
  chatId: number,
  walletAddress: string,
  triggers: NotificationType[] = ["yield", "portfolio", "recommendation"]
): Subscriber {
  const { subscribers, walletIndex } = getStore();
  const sub: Subscriber = {
    chatId,
    walletAddress: walletAddress.toLowerCase() as Address,
    triggers,
    registeredAt: new Date().toISOString(),
  };
  subscribers.set(chatId, sub);
  walletIndex.set(sub.walletAddress, chatId);
  return sub;
}

export function removeSubscriber(chatId: number): boolean {
  const { subscribers, walletIndex } = getStore();
  const sub = subscribers.get(chatId);
  if (!sub) return false;
  walletIndex.delete(sub.walletAddress);
  subscribers.delete(chatId);
  return true;
}

export function getSubscriber(chatId: number): Subscriber | undefined {
  return getStore().subscribers.get(chatId);
}

export function getSubscriberByWallet(walletAddress: string): Subscriber | undefined {
  const { subscribers, walletIndex } = getStore();
  const chatId = walletIndex.get(walletAddress.toLowerCase());
  return chatId !== undefined ? subscribers.get(chatId) : undefined;
}

export function getAllSubscribers(): Subscriber[] {
  return [...getStore().subscribers.values()];
}

export function getSubscribersByTrigger(type: NotificationType): Subscriber[] {
  return getAllSubscribers().filter((s) => s.triggers.includes(type));
}

export function getSubscriberCount(): number {
  return getStore().subscribers.size;
}

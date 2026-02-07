import type { ClientEvents } from "oceanic.js";
import type Bot from "../bot";

type MessageReactionAddArgs = ClientEvents["messageReactionAdd"];

export interface ReactionSession {
    ownerID?: string;
    timeoutMs?: number;
    onReaction: (bot: Bot, ...args: MessageReactionAddArgs) => Promise<void>;
}

const sessions = new Map<string, ReactionSession>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

export function registerReactionSession(messageID: string, session: ReactionSession): void {
    clearReactionSession(messageID);
    sessions.set(messageID, session);

    const timeout = setTimeout(() => {
        clearReactionSession(messageID);
    }, session.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    timers.set(messageID, timeout);
}

export function getReactionSession(messageID: string): ReactionSession | undefined {
    return sessions.get(messageID);
}

export function clearReactionSession(messageID: string): void {
    sessions.delete(messageID);

    const timer = timers.get(messageID);
    if (timer) {
        clearTimeout(timer);
        timers.delete(messageID);
    }
}

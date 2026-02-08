import type Bot from "../bot";

const CARD_EMOJI_NAME = /^(A|[2-9]|10|J|Q|K)[SHDC]$/i;
const CACHE_TTL_MS = 5 * 60 * 60 * 24 * 1000; // 5 days

let cachedMentions = new Map<string, string>();
let lastRefresh = 0;

function toMention(emoji: { id: string; name: string; animated?: boolean }): string {
    const prefix = emoji.animated ? "a" : "";
    return `<${prefix}:${emoji.name}:${emoji.id}>`;
}

function isCardEmojiName(name: string): boolean {
    return CARD_EMOJI_NAME.test(name);
}

async function buildFromApplication(bot: Bot): Promise<Map<string, string>> {
    const mentions = new Map<string, string>();
    const emojis = await bot.client.application.getEmojis();

    for (const emoji of emojis.items) {
        if (!isCardEmojiName(emoji.name)) continue;
        const key = emoji.name.toUpperCase();
        if (!mentions.has(key)) {
            mentions.set(key, toMention(emoji));
        }
    }

    return mentions;
}

export async function getCardEmojiMentions(bot: Bot, forceRefresh = false): Promise<Map<string, string>> {
    const now = Date.now();
    if (!forceRefresh && cachedMentions.size > 0 && now - lastRefresh < CACHE_TTL_MS) {
        return cachedMentions;
    }

    cachedMentions = await buildFromApplication(bot);
    lastRefresh = now;
    return cachedMentions;
}

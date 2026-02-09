import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";
import { clearReactionSession, registerReactionSession } from "../util/reactionSessions";
import { clearActiveGame, removeUsersFromActiveGame, tryActivateGame, tryAddUsersToActiveGame } from "../util/activeGames";
import { Decimal } from "@prisma/client/runtime/client";
import { parseMoney } from "../util/money";

const JOIN_EMOJI = "✅";
const BAIL_EMOJI = "🖐️";
const JOIN_WINDOW_MS = 15_000;
const TICK_MS = 1_600;
const START_MULTIPLIER = 0.2;
const MULTIPLIER_FACTOR = 1.33;
const activeCrashChannels = new Set<string>();

type Phase = "join" | "running" | "ended";

interface ResultEntry {
    userID: string;
    status: "bailed" | "crashed";
    multiplier: number;
    net: Decimal;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeEmoji(name: string | null): string {
    if (!name) return "";
    return name.replace(/\uFE0F/g, "");
}

function reactionToken(reaction: { emoji: { name: string | null; id?: string | null; } }): string | null {
    const name = reaction.emoji.name;
    if (!name) return null;
    if (reaction.emoji.id) return `${name}:${reaction.emoji.id}`;
    return normalizeEmoji(name);
}

function formatMultiplier(multiplier: number): string {
    return `${multiplier.toFixed(1)}×`;
}

function formatMoney(value: Decimal): string {
    return value.formatMoney();
}

function formatSignedMoney(value: Decimal): string {
    if (value.greaterThanOrEqualTo(0)) {
        return `+$${formatMoney(value)}`;
    }
    return `-$${formatMoney(value.abs())}`;
}

export default {
    name: "crash",
    description: "Multiplayer crash game with reaction cashouts",
    category: "games",
    options: [
        {
            type: "string",
            name: "bet",
            description: "Base bet per player",
            optional: false
        }
    ],
    async execute(ctx: CommandContext<any>) {
        const bet = parseMoney(ctx.rawArgs[0]);
        if (!bet) {
            return "Invalid bet amount.";
        }
        if (bet.lessThanOrEqualTo(0)) {
            return "Bet must be a positive amount.";
        }
        const hostID = ctx.user.id;
        const channelID = ctx.message.channel?.id;
        if (!channelID) {
            return "Could not resolve the channel for this crash game.";
        }

        if (activeCrashChannels.has(channelID)) {
            return "A crash game is already running in this channel.";
        }
        activeCrashChannels.add(channelID);

        const gameID = `crash:${hostID}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

        if (!tryActivateGame(gameID, [hostID])) {
            return "You are already in an active game.";
        }

        let active = true;
        const releaseGame = () => {
            if (!active) return;
            active = false;
            clearActiveGame(gameID);
            activeCrashChannels.delete(channelID);
        };

        try {
            const hostEntry = await prisma.user.upsert({
                where: { id: hostID },
                update: {},
                create: {
                    id: hostID,
                    balance: 0
                }
            });

            if (hostEntry.balance.lessThan(bet)) {
                releaseGame();
                return "You do not have enough balance to start that crash game.";
            }

            let phase: Phase = "join";
            let processingReaction = false;
            let currentMultiplier = START_MULTIPLIER;
            let crashedAt: number | null = null;
            let joinClosesAt = Date.now() + JOIN_WINDOW_MS;

            const participants = new Map<string, true>();
            participants.set(hostID, true);

            const snapshotBalances = new Map<string, Decimal>();
            const activePlayers = new Set<string>();
            const results = new Map<string, ResultEntry>();

            const buildLeaderboardLines = () => {
                const sorted = Array.from(results.values()).sort((a, b) => b.net.comparedTo(a.net));
                if (sorted.length === 0) return "None yet.";

                return sorted.map((entry, i) => {
                    if (entry.status === "bailed") {
                        return `${i + 1}. <@${entry.userID}> — bailed at **${formatMultiplier(entry.multiplier)}** (${formatSignedMoney(entry.net)})`;
                    }
                    return `${i + 1}. <@${entry.userID}> — crashed (didn't bail) (${formatSignedMoney(entry.net)})`;
                }).join("\n");
            };

            const buildEmbed = () => {
                const embed = new EmbedBuilder().setTitle("Crash");

                if (phase === "join") {
                    const joiners = Array.from(participants.keys()).map(id => `<@${id}>`).join(", ") || "None";
                    const joinEpoch = Math.floor(joinClosesAt / 1000);

                    return embed
                        .setColor(0xFEE75C)
                        .setDescription(
                            `Current multiplier: **${formatMultiplier(currentMultiplier)}**\n\n` +
                            `Base bet: **$${formatMoney(bet)}**\n` +
                            `Join with ${JOIN_EMOJI}. Closing <t:${joinEpoch}:R>.\n` +
                            `Cash out during the run with ${BAIL_EMOJI}.\n\n` +
                            `Players joined (${participants.size}): ${joiners}`
                        );
                }

                if (phase === "running") {
                    const bailedOnly = Array.from(results.values()).filter(r => r.status === "bailed");
                    const bailedBlock = bailedOnly.length === 0
                        ? "None yet."
                        : bailedOnly
                            .sort((a, b) => b.net.comparedTo(a.net))
                            .map(entry => `• <@${entry.userID}> — ${formatMultiplier(entry.multiplier)} (${formatSignedMoney(entry.net)})`)
                            .join("\n");

                    return embed
                        .setColor(0x5865F2)
                        .setDescription(
                            `Current multiplier: **${formatMultiplier(currentMultiplier)}**\n\n` +
                            `Bailed:\n${bailedBlock}\n\n` +
                            `Players remaining: **${activePlayers.size}**`
                        );
                }

                const crashLine = crashedAt == null
                    ? `All players bailed out by **${formatMultiplier(currentMultiplier)}**.`
                    : `**💥 CRASHED at ${formatMultiplier(crashedAt)}**`;

                return embed
                    .setColor(0xED4245)
                    .setDescription(
                        `${crashLine}\n\n` +
                        `Results:\n${buildLeaderboardLines()}`
                    );
            };

            const gameMessage = await ctx.reply(buildEmbed().toJSON(), true);
            let editQueue: Promise<void> = Promise.resolve();

            const queueStateEdit = async () => {
                editQueue = editQueue
                    .then(async () => {
                        await gameMessage.edit({ embeds: [buildEmbed().toJSON()] });
                    })
                    .catch(() => {});
                await editQueue;
            };

            const queueEmbedEdit = async (embed: EmbedBuilder) => {
                editQueue = editQueue
                    .then(async () => {
                        await gameMessage.edit({ embeds: [embed.toJSON()] });
                    })
                    .catch(() => {});
                await editQueue;
            };

            let finalized = false;
            const finalize = async () => {
                if (finalized) return;
                finalized = true;
                phase = "ended";
                clearReactionSession(gameMessage.id);
                await queueStateEdit();
                await gameMessage.deleteReactions().catch(async () => {
                    await gameMessage.deleteReaction(JOIN_EMOJI).catch(() => {});
                    await gameMessage.deleteReaction(BAIL_EMOJI).catch(() => {});
                });
            };

            registerReactionSession(gameMessage.id, {
                timeoutMs: 15 * 60 * 1000,
                onClear: () => {
                    releaseGame();
                },
                onReaction: async (_bot, message, reactor, reaction) => {
                    if (message.id !== gameMessage.id) return;
                    if (phase === "ended" || processingReaction) return;
                    processingReaction = true;

                    try {
                        const token = reactionToken(reaction);
                        if (token) {
                            await gameMessage.deleteReaction(token, reactor.id).catch(() => {});
                        }

                        const emoji = normalizeEmoji(reaction.emoji.name);
                        const userID = reactor.id;
                        if ("bot" in reactor && reactor.bot) return;
                        if ("user" in reactor && reactor.user.bot) return;

                        if (phase === "join") {
                            if (emoji !== normalizeEmoji(JOIN_EMOJI)) return;
                            if (participants.has(userID)) return;

                            if (!tryAddUsersToActiveGame(gameID, [userID])) return;

                            const userEntry = await prisma.user.upsert({
                                where: { id: userID },
                                update: {},
                                create: {
                                    id: userID,
                                    balance: 0
                                }
                            });

                            if (userEntry.balance.lessThan(bet)) {
                                removeUsersFromActiveGame(gameID, [userID]);
                                return;
                            }

                            participants.set(userID, true);
                            await queueStateEdit();
                            return;
                        }

                        if (phase !== "running") return;
                        if (emoji !== normalizeEmoji(BAIL_EMOJI)) return;
                        if (!activePlayers.has(userID) || results.has(userID)) return;

                        const snapshot = snapshotBalances.get(userID);
                        if (!snapshot) return;

                        const cashoutMultiplier = currentMultiplier;
                        const gross = bet.mul(cashoutMultiplier);
                        const net = gross.minus(bet);
                        const newBalance = snapshot.plus(net);

                        await prisma.user.update({
                            where: { id: userID },
                            data: { balance: newBalance }
                        });

                        activePlayers.delete(userID);
                        results.set(userID, {
                            userID,
                            status: "bailed",
                            multiplier: cashoutMultiplier,
                            net
                        });

                        await queueStateEdit();
                    } finally {
                        processingReaction = false;
                    }
                }
            });

            try {
                await gameMessage.createReaction(JOIN_EMOJI);
                await gameMessage.createReaction(BAIL_EMOJI);
            } catch {
                await finalize();
                return "I couldn't add crash reactions. Check channel permissions for Add Reactions.";
            }

            const joinWaitMs = Math.max(0, joinClosesAt - Date.now());
            if (phase === "join" && joinWaitMs > 0) {
                await sleep(joinWaitMs);
            }

            if (phase !== "join") {
                await finalize();
                return;
            }

            const participantIDs = Array.from(participants.keys());
            const participantRows = await Promise.all(
                participantIDs.map(id => prisma.user.upsert({
                    where: { id },
                    update: {},
                    create: {
                        id,
                        balance: 0
                    }
                }))
            );

            const insufficientAtStart: string[] = [];
            participantRows.forEach(row => {
                if (row.balance.lessThan(bet)) {
                    insufficientAtStart.push(row.id);
                    return;
                }
                snapshotBalances.set(row.id, row.balance);
                activePlayers.add(row.id);
            });

            if (insufficientAtStart.length > 0) {
                insufficientAtStart.forEach(id => participants.delete(id));
                removeUsersFromActiveGame(gameID, insufficientAtStart);
            }

            if (activePlayers.size === 0) {
                phase = "ended";
                await queueEmbedEdit(
                    new EmbedBuilder()
                        .setTitle("Crash")
                        .setColor(0xED4245)
                        .setDescription("No eligible players remained at game start.")
                );
                clearReactionSession(gameMessage.id);
                return;
            }

            phase = "running";
            await queueStateEdit();

            while (phase === "running") {
                await sleep(TICK_MS);

                const nextMultiplier = currentMultiplier * MULTIPLIER_FACTOR;
                const base = 4;
                const curve = Math.log2(nextMultiplier / 2 + 1) * 20;
                const noise = Math.random() * 1.5;
                const pCrash = Math.min(base + curve + noise, 97);
                const roll = Math.random() * 100;

                currentMultiplier = nextMultiplier;

                if (roll < pCrash) {
                    crashedAt = currentMultiplier;
                    const losers = Array.from(activePlayers.values());

                    await Promise.all(losers.map(async userID => {
                        const snapshot = snapshotBalances.get(userID);
                        if (!snapshot) return;

                        const net = bet.negated();
                        const newBalance = snapshot.plus(net);

                        await prisma.user.update({
                            where: { id: userID },
                            data: { balance: newBalance }
                        });

                        results.set(userID, {
                            userID,
                            status: "crashed",
                            multiplier: crashedAt ?? currentMultiplier,
                            net
                        });
                    }));

                    activePlayers.clear();
                    await finalize();
                    return;
                }

                await queueStateEdit();
            }

            await finalize();
        } catch (err) {
            releaseGame();
            throw err;
        }
    }
} as BotCommand;

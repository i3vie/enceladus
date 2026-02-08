import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";
import { clearReactionSession, registerReactionSession } from "../util/reactionSessions";
import type Bot from "../bot";
import type { User } from "oceanic.js";
import { clearActiveGame, isUserInActiveGame, tryActivateGame } from "../util/activeGames";

type CoinSide = "heads" | "tails";

const ACCEPT_EMOJI = "✅";
const DECLINE_EMOJI = "❌";
const RESPONSE_TIMEOUT_MS = 45_000;

function titleName(user: User): string {
    return user.globalName ?? user.username;
}

function normalizeEmoji(name: string | null | undefined): string {
    if (!name) return "";
    return name.replace(/\uFE0F/g, "");
}

function reactionToken(reaction: { emoji: { name: string | null; id?: string | null; } }): string | null {
    const name = reaction.emoji.name;
    if (!name) return null;
    if (reaction.emoji.id) return `${name}:${reaction.emoji.id}`;
    return normalizeEmoji(name);
}

async function getCoinFlipEmojis(bot: Bot) {
    const emojis = await bot.client.application.getEmojis();

    const heads = emojis.items.find(emoji => emoji.name === "coin_heads");
    const tails = emojis.items.find(emoji => emoji.name === "coin_tails");

    if (!heads || !tails) return null;

    const toMention = (emoji: { id: string; name: string; animated?: boolean }) => {
        const prefix = emoji.animated ? "a" : "";
        return `<${prefix}:${emoji.name}:${emoji.id}>`;
    };

    return {
        headsID: heads.id,
        tailsID: tails.id,
        headsToken: `${heads.name}:${heads.id}`,
        tailsToken: `${tails.name}:${tails.id}`,
        headsMention: toMention(heads),
        tailsMention: toMention(tails)
    };
}

export default {
    name: "coinflip",
    description: "Challenge another user to a coinflip wager",
    category: "games",
    options: [

        {
            type: "user",
            name: "user",
            description: "User to challenge",
            optional: false
        },
        {
            type: "number",
            name: "bet",
            description: "Amount to bet",
            optional: false
        }
    ],
    aliases: ["cf"],
    async execute(ctx: CommandContext<any>) {
        const bet = ctx.getArgument("bet") as number;
        const challengee = ctx.getArgument("user") as User | undefined;
        const challengerMention = `<@${ctx.user.id}>`;
        const challengeeMention = challengee ? `<@${challengee.id}>` : "";

        if (typeof bet !== "number" || Number.isNaN(bet)) {
            return "Invalid bet amount.";
        }

        if (!challengee) {
            return "You need to challenge a valid user.";
        }

        if (challengee.id === ctx.user.id) {
            return "You cannot challenge yourself.";
        }

        if ("bot" in challengee && challengee.bot) {
            return "You cannot challenge a bot.";
        }

        if (isUserInActiveGame(ctx.user.id)) {
            return "You are already in an active game.";
        }

        if (isUserInActiveGame(challengee.id)) {
            return `${challengeeMention} is already in an active game.`;
        }

        if (bet <= 0) {
            return "Bet must be a positive amount.";
        }

        const challengerEntry = await prisma.user.upsert({
            where: { id: ctx.user.id },
            update: {},
            create: {
                id: ctx.user.id,
                balance: 0
            }
        });

        const challengeeEntry = await prisma.user.upsert({
            where: { id: challengee.id },
            update: {},
            create: {
                id: challengee.id,
                balance: 0
            }
        });

        if (challengerEntry.balance.lessThan(bet)) {
            return "You do not have enough balance to make that bet.";
        }

        if (challengeeEntry.balance.lessThan(bet)) {
            return `${challengeeMention} does not have enough balance to accept that bet.`;
        }

        const coinEmojis = await getCoinFlipEmojis(ctx.bot);
        if (!coinEmojis) {
            return "Coinflip emojis are missing. Add application emojis named `coin_heads` and `coin_tails`.";
        }

        const gameID = `coinflip:${ctx.user.id}:${challengee.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        if (!tryActivateGame(gameID, [ctx.user.id, challengee.id])) {
            return "One of the players is already in an active game.";
        }

        let gameActive = true;
        const releaseGame = () => {
            if (!gameActive) return;
            gameActive = false;
            clearActiveGame(gameID);
        };

        try {

        const challengeEmbed = new EmbedBuilder()
            .setTitle("Coinflip")
            .setDescription(
                `${challengerMention} challenged ${challengeeMention} for **${bet}** coins each (pot: **${bet * 2}**).\n` +
                `React with ${ACCEPT_EMOJI} to accept or ${DECLINE_EMOJI} to decline.\n` +
                `You have 45 seconds.`
            )
            .setColor(0xFEE75C);

        const challengeMessage = await ctx.reply(challengeEmbed.toJSON(), true);

        try {
            await challengeMessage.createReaction(ACCEPT_EMOJI);
            await challengeMessage.createReaction(DECLINE_EMOJI);
        } catch {
            releaseGame();
            return "I couldn't add reaction controls! Check permissions for Add Reactions.";
        }

        let stage: "accept" | "call" | "done" = "accept";
        let processing = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const finishWithEmbed = async (embed: EmbedBuilder) => {
            if (stage === "done") return;
            stage = "done";
            clearReactionSession(challengeMessage.id);
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }

            await challengeMessage.edit({
                content: "",
                embeds: [embed.toJSON()]
            });

            await challengeMessage.deleteReactions().catch(async () => {
                await challengeMessage.deleteReaction(ACCEPT_EMOJI).catch(() => {});
                await challengeMessage.deleteReaction(DECLINE_EMOJI).catch(() => {});
                await challengeMessage.deleteReaction(coinEmojis.headsToken).catch(() => {});
                await challengeMessage.deleteReaction(coinEmojis.tailsToken).catch(() => {});
            });
        };

        const finish = async (description: string, color = 0x5865F2) => {
            await finishWithEmbed(
                new EmbedBuilder()
                    .setTitle("Coinflip")
                    .setDescription(description)
                    .setColor(color)
            );
        };

        const armTimeout = (callback: () => Promise<void>) => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }

            timeoutHandle = setTimeout(() => {
                callback().catch(() => {});
            }, RESPONSE_TIMEOUT_MS);
        };

        armTimeout(async () => {
            await finish(`${challengeeMention} did not respond in time.`, 0xED4245);
        });

        registerReactionSession(challengeMessage.id, {
            ownerID: challengee.id,
            timeoutMs: RESPONSE_TIMEOUT_MS * 2,
            onClear: () => {
                releaseGame();
            },
            onReaction: async (_bot, message, reactor, reaction) => {
                if (message.id !== challengeMessage.id || stage === "done" || processing) return;
                processing = true;

                try {
                    const token = reactionToken(reaction);
                    if (token) {
                        await challengeMessage.deleteReaction(token, reactor.id).catch(() => {});
                    }

                    if (stage === "accept") {
                        const emoji = normalizeEmoji(reaction.emoji.name);

                        if (emoji === normalizeEmoji(DECLINE_EMOJI)) {
                            await finish(`${challengeeMention} declined the coinflip challenge.`, 0xED4245);
                            return;
                        }

                        if (emoji !== normalizeEmoji(ACCEPT_EMOJI)) return;

                        stage = "call";
                        armTimeout(async () => {
                            await finish(`${challengeeMention} did not respond in time.`, 0xED4245);
                        });

                        const callEmbed = new EmbedBuilder()
                            .setTitle("Coinflip")
                            .setDescription(
                                `${challengeeMention}, call the flip.\n` +
                                `React with ${coinEmojis.headsMention} for heads or ${coinEmojis.tailsMention} for tails.\n` +
                                `You have 45 seconds.`
                            )
                            .setColor(0x5865F2);

                        await challengeMessage.edit({
                            content: "",
                            embeds: [callEmbed.toJSON()]
                        });

                        await challengeMessage.deleteReactions().catch(async () => {
                            await challengeMessage.deleteReaction(ACCEPT_EMOJI).catch(() => {});
                            await challengeMessage.deleteReaction(DECLINE_EMOJI).catch(() => {});
                        });

                        try {
                            await challengeMessage.createReaction(coinEmojis.headsToken);
                            await challengeMessage.createReaction(coinEmojis.tailsToken);
                        } catch {
                            await finish("I couldn't add coin reaction controls. Check channel permissions for Add Reactions.");
                        }

                        return;
                    }

                    if (stage !== "call") return;

                    let calledSide: CoinSide | null = null;
                    if (reaction.emoji.id === coinEmojis.headsID) calledSide = "heads";
                    if (reaction.emoji.id === coinEmojis.tailsID) calledSide = "tails";
                    if (!calledSide) return;

                    const result = await prisma.$transaction(async tx => {
                        const [freshChallenger, freshChallengee] = await Promise.all([
                            tx.user.findUnique({ where: { id: ctx.user.id } }),
                            tx.user.findUnique({ where: { id: challengee.id } })
                        ]);

                        if (!freshChallenger || !freshChallengee) {
                            return { ok: false as const, error: "One of the players no longer has an account?" };
                        }

                        if (freshChallenger.balance.lessThan(bet)) {
                            return { ok: false as const, error: `${challengerMention} no longer has enough balance for this bet.` };
                        }

                        if (freshChallengee.balance.lessThan(bet)) {
                            return { ok: false as const, error: `${challengeeMention} no longer has enough balance for this bet.` };
                        }

                        const flip: CoinSide = Math.random() < 0.5 ? "heads" : "tails";
                        const challengeeWins = calledSide === flip;

                        const challengerNewBalance = challengeeWins
                            ? freshChallenger.balance.minus(bet)
                            : freshChallenger.balance.plus(bet);

                        const challengeeNewBalance = challengeeWins
                            ? freshChallengee.balance.plus(bet)
                            : freshChallengee.balance.minus(bet);

                        await tx.user.update({
                            where: { id: ctx.user.id },
                            data: { balance: challengerNewBalance }
                        });

                        await tx.user.update({
                            where: { id: challengee.id },
                            data: { balance: challengeeNewBalance }
                        });

                        return {
                            ok: true as const,
                            flip,
                            challengeeWins,
                            challengerNewBalance,
                            challengeeNewBalance
                        };
                    });

                    if (!result.ok) {
                        await finish(result.error);
                        return;
                    }

                    const winnerMention = result.challengeeWins ? challengeeMention : challengerMention;
                    const loserMention = result.challengeeWins ? challengerMention : challengeeMention;
                    const winnerTitle = result.challengeeWins ? titleName(challengee) : titleName(ctx.user);
                    const challengeeTitle = titleName(challengee);
                    const loserTitle = result.challengeeWins ? titleName(ctx.user) : titleName(challengee);
                    const calledSideLabel = calledSide.charAt(0).toUpperCase() + calledSide.slice(1);

                    await finishWithEmbed(
                        new EmbedBuilder()
                            .setTitle("Coinflip")
                            .setDescription(
                                `The coin landed on **${result.flip}**.\n` +
                                `${winnerMention} won **${bet}** coins.\n` +
                                `${loserMention} lost **${bet}** coins.`
                            )
                            .setColor(0x57F287)
                            .addField(
                                `${winnerTitle}'s winnings`,
                                `**$${bet}**`,
                                true
                            )
                            .addField(
                                `${challengeeTitle}'s call`,
                                calledSideLabel,
                                true
                            )
                            .addField(
                                `${loserTitle}'s losses`,
                                `**$${bet}**`,
                                true
                            )
                    );
                } finally {
                    processing = false;
                }
            }
        });
        } catch (err) {
            releaseGame();
            throw err;
        }
    }
} as BotCommand

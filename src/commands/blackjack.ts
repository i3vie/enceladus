import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";
import { clearReactionSession, registerReactionSession } from "../util/reactionSessions";
import { getCardEmojiMentions } from "../util/cardEmojiCache";
import { clearActiveGame, isUserInActiveGame, tryActivateGame } from "../util/activeGames";
import { parseMoney } from "../util/money";

type Suit = "S" | "H" | "D" | "C";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface Card {
    suit: Suit;
    rank: Rank;
}

interface HandInfo {
    total: number;
    soft: boolean;
}

type Outcome = "win" | "lose" | "push";

const HIT_EMOJI = "🫳";
const STAND_EMOJI = "🖐️";
const DOUBLE_EMOJI = "🤌";

const SUITS: Suit[] = ["S", "H", "D", "C"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const FACE_DOWN_CARD = "\u{1F0A0}";

function drawCard(): Card {
    return {
        suit: SUITS[Math.floor(Math.random() * SUITS.length)],
        rank: RANKS[Math.floor(Math.random() * RANKS.length)]
    };
}

function cardValue(card: Card): number {
    if (card.rank === "A") return 11;
    if (card.rank === "K" || card.rank === "Q" || card.rank === "J") return 10;
    return Number(card.rank);
}

function handInfo(cards: Card[]): HandInfo {
    let total = cards.reduce((sum, card) => sum + cardValue(card), 0);
    let aces = cards.filter(card => card.rank === "A").length;
    const initialAces = aces;

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return {
        total,
        soft: total <= 21 && initialAces - aces > 0
    };
}

function handValue(cards: Card[]): number {
    return handInfo(cards).total;
}

function cardCode(card: Card): string {
    return `${card.rank}${card.suit}`;
}

function formatCards(cards: Card[], renderCard: (card: Card) => string, hideFirst = false): string {
    if (!hideFirst) {
        return cards.map(renderCard).join(" ");
    }

    if (cards.length === 0) return "";
    const rest = cards.slice(1).map(renderCard).join(" ");
    return `${FACE_DOWN_CARD} ${rest}`.trim();
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

export default {
    name: "blackjack",
    description: "Play blackjack using reactions",
    category: "games",
    aliases: ["bj"],
    options: [
        {
            type: "string",
            name: "bet",
            description: "Amount to bet",
            optional: false
        }
    ],
    async execute(ctx: CommandContext<any>) {
        const bet = parseMoney(ctx.rawArgs[0]);
        if (!bet) {
            return "Invalid bet amount.";
        }

        if (bet.lessThanOrEqualTo(0)) {
            return "Bet must be a positive number.";
        }

        if (isUserInActiveGame(ctx.user.id)) {
            return "You are already in an active game.";
        }

        const user = await prisma.user.upsert({
            where: { id: ctx.user.id },
            update: {},
            create: {
                id: ctx.user.id,
                balance: 0
            }
        })

        const player = user; // for some reason this has to be separate to satisfy typescript

        if (player.balance.lessThan(bet)) {
            return "You do not have enough balance to make that bet.";
        }

        const gameID = `blackjack:${ctx.user.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        if (!tryActivateGame(gameID, [ctx.user.id])) {
            return "You are already in an active game.";
        }

        let gameActive = true;
        const releaseGame = () => {
            if (!gameActive) return;
            gameActive = false;
            clearActiveGame(gameID);
        };

        try {
        const cardEmojiMentions = await getCardEmojiMentions(ctx.bot);
        const renderCard = (card: Card): string => {
            const code = cardCode(card);
            return cardEmojiMentions.get(code) ?? `\`${code}\``;
        };

        const playerCards: Card[] = [drawCard(), drawCard()];
        const dealerCards: Card[] = [drawCard(), drawCard()];

        let done = false;
        let settled = false;
        let processing = false;
        let summary = "";
        let outcome: Outcome | null = null;
        let currentBet = bet;

        async function settle(result: Outcome): Promise<void> {
            if (settled) return;
            settled = true;
            outcome = result;
            const gameOutcome = result;

            if (gameOutcome === "win") {
                const updatedUser = await prisma.user.update({
                    where: { id: ctx.user.id },
                    data: { balance: { increment: currentBet } }
                });
                summary = `You won $${currentBet.formatMoney()}. New balance: **$${updatedUser.balance.formatMoney()}**.`;
                return;
            }

            if (gameOutcome === "lose") {
                const updatedUser = await prisma.user.update({
                    where: { id: ctx.user.id },
                    data: { balance: { decrement: currentBet } }
                });
                summary = `You lost $${currentBet.formatMoney()}. New balance: **$${updatedUser.balance.formatMoney()}**.`;
                return;
            }

            const latestUser = await prisma.user.findUnique({
                where: { id: ctx.user.id },
                select: { balance: true }
            });
            const currentBalance = latestUser?.balance ?? player.balance;
            summary = `Push. Your balance stays at $${currentBalance.formatMoney()}.`;
        }

        function renderEmbed(revealDealer: boolean): EmbedBuilder {
            const player = handInfo(playerCards);
            const dealer = handInfo(dealerCards);
            const dealerDisplayValue = revealDealer ? `${dealer.total}${dealer.soft ? " (aces high)" : ""}` : "?";
            const dealerField = `${formatCards(dealerCards, renderCard, !revealDealer)}\nTotal: ${dealerDisplayValue}`;
            const playerField = `${formatCards(playerCards, renderCard)}\nTotal: ${player.total}${player.soft ? " (aces high)" : ""}`;
            const status = done
                ? summary
                : (summary || `React with ${HIT_EMOJI} to hit, ${STAND_EMOJI} to stand, or ${DOUBLE_EMOJI} to double down.`);

            const embed = new EmbedBuilder()
                .setTitle(`Blackjack (bet: $${currentBet.formatMoney()})`)
                .setDescription(status)
                .addField("**Dealer**", dealerField, true)
                .addField("**You**", playerField, true);

            if (outcome === "win") embed.setColor(0x57F287);
            if (outcome === "lose") embed.setColor(0xED4245);
            if (outcome === "push") embed.setColor(0xFEE75C);

            return embed;
        }

        async function finalizeGame(messageID: string): Promise<void> {
            done = true;
            clearReactionSession(messageID);
        }

        async function clearControls(): Promise<void> {
            await gameMessage.deleteReactions().catch(async () => {
                await gameMessage.deleteReaction(HIT_EMOJI).catch(() => {});
                await gameMessage.deleteReaction(STAND_EMOJI).catch(() => {});
                await gameMessage.deleteReaction(DOUBLE_EMOJI).catch(() => {});
            });
        }

        async function resolveDealerTurn(): Promise<Outcome> {
            while (handValue(dealerCards) < 17) {
                dealerCards.push(drawCard());
            }

            const dealerTotal = handValue(dealerCards);
            const playerTotal = handValue(playerCards);

            if (dealerTotal > 21) return "win";
            if (playerTotal > dealerTotal) return "win";
            if (playerTotal < dealerTotal) return "lose";
            return "push";
        }

        const gameMessage = await ctx.reply(renderEmbed(false).toJSON(), true);

        try {
            await gameMessage.createReaction(HIT_EMOJI);
            await gameMessage.createReaction(STAND_EMOJI);
            await gameMessage.createReaction(DOUBLE_EMOJI);
        } catch {
            releaseGame();
            return "I couldn't add reaction controls. Check channel permissions for Add Reactions.";
        }

        const playerStartTotal = handValue(playerCards);
        const dealerStartTotal = handValue(dealerCards);
        if (playerStartTotal === 21 || dealerStartTotal === 21) {
            if (playerStartTotal === 21 && dealerStartTotal === 21) {
                await settle("push");
            } else if (playerStartTotal === 21) {
                await settle("win");
            } else {
                await settle("lose");
            }

            done = true;
            await gameMessage.edit({ embeds: [renderEmbed(true).toJSON()] });
            await clearControls();
            releaseGame();
            return;
        }

        registerReactionSession(gameMessage.id, {
            ownerID: ctx.user.id,
            timeoutMs: 2 * 60 * 1000,
            onClear: () => {
                releaseGame();
            },
            onReaction: async (_bot, message, reactor, reaction) => {
                if (message.id !== gameMessage.id || done || processing) return;
                processing = true;

                try {
                    const emoji = normalizeEmoji(reaction.emoji.name);
                    const reactorID = reactor.id;
                    const token = reactionToken(reaction);

                    if (token) {
                        await gameMessage.deleteReaction(token, reactorID).catch(() => {});
                    }

                    if (emoji === normalizeEmoji(HIT_EMOJI)) {
                        playerCards.push(drawCard());
                        const total = handValue(playerCards);

                        if (total > 21) {
                            await settle("lose");
                            await finalizeGame(gameMessage.id);
                            await gameMessage.edit({ embeds: [renderEmbed(true).toJSON()] });
                            await clearControls();
                            return;
                        }

                        if (total === 21) {
                            const outcome = await resolveDealerTurn();
                            await settle(outcome);
                            await finalizeGame(gameMessage.id);
                            await gameMessage.edit({ embeds: [renderEmbed(true).toJSON()] });
                            await clearControls();
                            return;
                        }

                        await gameMessage.edit({ embeds: [renderEmbed(false).toJSON()] });
                        return;
                    }

                    if (emoji === normalizeEmoji(STAND_EMOJI)) {
                        const outcome = await resolveDealerTurn();
                        await settle(outcome);
                        await finalizeGame(gameMessage.id);
                        await gameMessage.edit({ embeds: [renderEmbed(true).toJSON()] });
                        await clearControls();
                        return;
                    }

                    if (emoji === normalizeEmoji(DOUBLE_EMOJI)) {
                        const doubledBet = currentBet.mul(2);
                        if (player.balance.lessThan(doubledBet)) {
                            summary = `You cannot afford to double down to $${doubledBet.formatMoney()}.`;
                            await gameMessage.edit({ embeds: [renderEmbed(false).toJSON()] });
                            return;
                        }

                        currentBet = doubledBet;
                        playerCards.push(drawCard());

                        if (handValue(playerCards) > 21) {
                            await settle("lose");
                        } else {
                            const outcome = await resolveDealerTurn();
                            await settle(outcome);
                        }

                        await finalizeGame(gameMessage.id);
                        await gameMessage.edit({ embeds: [renderEmbed(true).toJSON()] });
                        await clearControls();
                    }
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
} as BotCommand;

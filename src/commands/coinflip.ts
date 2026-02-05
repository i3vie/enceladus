import { Message, Client } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";

export default {
    name: "coinflip",
    description: "Flip a coin and win or lose money",
    category: "games",
    options: [
        {
            type: "number",
            name: "bet",
            description: "Amount to bet",
            optional: false
        },
    ],
    async execute(ctx: CommandContext<any>) {
        /* SAFETY: This is effectively guaranteed, as the message handler
         * already upserts on every invocation */
        const user = await prisma.user.findUnique({
            where: {
                id: ctx.user.id
            }
        })
        const bet = ctx.getArgument("bet");

        if (!(typeof bet == 'number') || !user) return false;

        if (bet <= 0) {
            return "Bet must be a positive amount.";
        } else if (user.balance.lessThan(bet)) {
            return "You do not have enough balance to make that bet.";
        }

        const flip = Math.random() < 0.5 ? "heads" : "tails";

        let resultMessage = `You flipped **${flip}**!\n`;

        if (flip === "heads") {
            const newBalance = user.balance.plus(bet);
            await prisma.user.update({
                where: { id: ctx.user.id },
                data: { balance: newBalance }
            });
            resultMessage += `You won **${bet}** coins! Your new balance is **${newBalance}** coins.`;
        } else {
            const newBalance = user.balance.minus(bet);
            await prisma.user.update({
                where: { id: ctx.user.id },
                data: { balance: newBalance }
            });
            resultMessage += `You lost **${bet}** coins. Your new balance is **${newBalance}** coins.`;
        }

        return resultMessage
        
    }
} as BotCommand
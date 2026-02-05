import { Message, Client } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";

export default {
    name: "coinflip",
    description: "Flip a coin and win or lose money",
    category: "general",
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

        return true;
    }
} as BotCommand
import { Message, Client } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";

export default {
    name: "balance",
    description: "Check your balance.",
    category: "general",
    options: [],
    async execute(ctx: CommandContext<any>) {

        const user = await prisma.user.findUnique({
            where: {
                id: ctx.user.id
            }
        })

        if (!user) {
            console.error("User somehow doesn't exist (wtf?)");
            return false;
        }

        const embed = new EmbedBuilder();
        embed.setColor(0x32A852);
        embed.setTitle("Balance: $" + user.balance.toFixed(2));

        ctx.reply(embed.toJSON(), true)

        return true;
    }
} as BotCommand
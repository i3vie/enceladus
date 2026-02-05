import { Message, Client, User } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";

export default {
    name: "balance",
    description: "Check your balance.",
    category: "general",
    aliases: ["bal"],
    options: [
        {
            type: "user",
            name: "user",
            description: "User to check balance of (defaults to yourself)",
            optional: true
        }
    ],
    async execute(ctx: CommandContext<any>) {

        let userToCheck = ctx.getArgument("user") as User | undefined;
        if (!userToCheck) {
            userToCheck = ctx.user;
        }

        const user = await prisma.user.upsert({
            where: { id: userToCheck.id },
            update: {},
            create: {
                id: userToCheck.id,
                balance: 0
            }
        })

        if (!user) {
            console.error("User somehow doesn't exist (wtf?)");
            return "Why don't you exist...? You should explode.";
        }

        const embed = new EmbedBuilder();
        embed.setColor(0x32A852);
        embed.setTitle("Balance: $" + user.balance.toFixed(2));

        return embed;
    }
} as BotCommand
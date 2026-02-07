import { Message, Client, User } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";

export default {
    name: "addmoney",
    description: "admin command to add money to a user's balance",
    category: "general",
    aliases: ["am"],
    options: [
        {
            type: "user",
            name: "user",
            description: "User to add money to",
            optional: true
        },
        {
            type: "number",
            name: "amount",
            description: "Amount of money to add",
            optional: false
        }
    ],
    adminOnly: true,
    async execute(ctx: CommandContext<any>) {
        let userToAdd = ctx.getArgument("user") as User | undefined;
        if (!userToAdd) {
            userToAdd = ctx.user;
        }

        const amount = ctx.getArgument("amount") as number;

        const user = await prisma.user.upsert({
            where: { id: userToAdd.id },
            update: { balance: { increment: amount } },
            create: {
                id: userToAdd.id,
                balance: amount
            }
        })
        
        return `Added $${amount.toFixed(2)} to ${userToAdd.username}'s balance. New balance: $${user.balance.toFixed(2)}`;
    }
} as BotCommand
import { User } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import prisma from "../util/prisma";
import { parseMoney } from "../util/money";

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
            type: "string",
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

        const amount = parseMoney(ctx.rawArgs[ctx.rawArgs.length - 1]);
        if (!amount) {
            return "Invalid amount.";
        }

        const user = await prisma.user.upsert({
            where: { id: userToAdd.id },
            update: { balance: { increment: amount } },
            create: {
                id: userToAdd.id,
                balance: amount
            }
        })
        
        return `Added $${amount.formatMoney()} to ${userToAdd.username}'s balance. New balance: $${user.balance.formatMoney()}`;
    }
} as BotCommand

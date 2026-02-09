import { User } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";
import { Decimal } from "@prisma/client/runtime/client";
import { parseMoney } from "../util/money";

export default {
    name: "pay",
    description: "Send money to another user",
    category: "general",
    options: [
        {
            type: "user",
            name: "user",
            description: "User to pay",
        },
        {
            type: "string",
            name: "amount",
            description: "Amount to pay",
        }
    ],
    async execute(ctx: CommandContext<any>) {
        const payerEntry = await prisma.user.findUnique({
            where: {
                id: ctx.user.id
            }
        }) as { id: string, balance: Decimal}
        const payee = (ctx.getArgument("user") as User)
        const payeeEntry = await prisma.user.upsert({
            where: { id: payee.id },
            update: {},
            create: {
                id: payee.id,
                balance: new Decimal(0)
            }
        }) as { id: string, balance: Decimal}
        const amount = parseMoney(ctx.rawArgs[1]);

        // Validation
        if (!amount) {
            return "Invalid amount.";
        }
        if (amount.lessThanOrEqualTo(0)) {
            return "Amount must be positive.";
        } else if (payerEntry.balance.lessThan(amount)) {
            return "You do not have enough balance to make that payment.";
        }

        // Perform transaction
        const newPayerBalance = payerEntry.balance.minus(amount);
        const newPayeeBalance = payeeEntry.balance.plus(amount);

        await prisma.user.update({
            where: { id: payerEntry.id },
            data: { balance: newPayerBalance }
        });

        await prisma.user.update({
            where: { id: payeeEntry.id },
            data: { balance: newPayeeBalance }
        });

        const payerMention = `<@${ctx.user.id}>`;
        const payeeMention = `<@${payee.id}>`;
        const payerTitleName = ctx.user.globalName ?? ctx.user.username;
        const payeeTitleName = payee.globalName ?? payee.username;

        return new EmbedBuilder()
            .setTitle("Payment")
            .setDescription(`${payerMention} sent $${amount.formatMoney()} to ${payeeMention}`)
            .addField(`${payerTitleName}'s new balance`, `$${newPayerBalance.formatMoney()}`, true)
            .addField(`${payeeTitleName}'s new balance`, `$${newPayeeBalance.formatMoney()}`, true);

    }
} as BotCommand

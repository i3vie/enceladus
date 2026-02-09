import { User } from "oceanic.js";
import bot from "../index";
import { Decimal } from "@prisma/client/runtime/client";

String.prototype.trimIndent = function (): string {
    const lines = this.replace(/^\n/, "").split("\n");
    const indent = lines.filter(line => line.trim()).reduce((minIndent, line) => {
        const match = line.match(/^(\s*)/);
        const currIndent = match ? match[1].length : 0;
        return minIndent === null ? currIndent : Math.min(minIndent, currIndent);
    }, null as number | null) || 0;
    return lines.map(line => line.slice(indent)).join("\n").trim();
};

String.prototype.mentionID = function (): string {
    const idMatch = this.match(/^<@!?(\d+)>$/);
    if (idMatch) {
        return idMatch[1];
    }
    return this.toString();
}
// FEAR NOT THE DARKNESS OF TYPESCRIPT LOOP HOLES 
String.prototype.asDiscordUser = async function (): Promise<User> {
    const id = this.mentionID();
    return await bot.client.rest.users.get(id);
}

Decimal.prototype.formatMoney = function (fractionDigits: number = 2): string {
    const fixed = this.toFixed(fractionDigits);
    const negative = fixed.startsWith("-");
    const abs = negative ? fixed.slice(1) : fixed;
    const [intPart, fracPart = ""] = abs.split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    const formatted = fractionDigits > 0
        ? `${withCommas}.${fracPart}`
        : withCommas;

    return negative ? `-${formatted}` : formatted;
};

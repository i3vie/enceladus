import { Client, User } from "oceanic.js";
import bot from "../index";

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
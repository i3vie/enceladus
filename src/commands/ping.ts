import { Message, Client } from "oceanic.js";
import { BotCommand, CommandContext } from "../types/botCommand";

export default {
    name: "ping",
    description: "Ping the bot to check if it's alive.",
    category: "General",
    options: [
        {
            type: "string",
            name: "message",
        },
    ],
    action: async function (ctx: CommandContext<any>) {
        const reply = ctx.args.message ? `Pong! ${ctx.args.message}` : "Pong!";
        return reply;
    }
} as BotCommand
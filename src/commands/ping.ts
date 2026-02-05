import { Message, Client } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";

export default {
    name: "ping",
    description: "Ping the bot to check if it's alive.",
    category: "general",
    options: [
        {
            type: "string",
            name: "message",
        },
    ],
    async execute(ctx: CommandContext<any>) {
        const firstMessage = await ctx.message.channel?.createMessage({
            content: "Pinging..."
        })
        const timestamp = firstMessage?.timestamp.getTime();
        const now = new Date().getTime();

        if (!timestamp) {
            console.error("Timestamp is undefined");
            return false;
        }

        const ping = now - timestamp;

        const embed = new EmbedBuilder();
        embed.setColor(0x32A852);
        embed.setTitle(`Latency: ${ping}ms`);

        firstMessage!.edit({
            content: null,
            embeds: [embed.toJSON()]
        })
    }
} as BotCommand
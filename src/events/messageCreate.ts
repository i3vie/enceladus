import BotEvent from "../types/botEvent";
import { Message, Client, ChannelTypes, Embed, CreateMessageOptions } from "oceanic.js";
import { prefix } from "../../botconfig.json";
import prisma from "../util/prisma"
import { CommandContext } from "../types/botCommand";
import Bot from "../bot";
import { Decimal } from "@prisma/client/runtime/client";

export default {
    eventName: "messageCreate",
    async trigger(bot: Bot, msg: Message) {
        if (msg.author.bot || !msg.content.startsWith(prefix)) return;

        const [commandName, ...args] = msg.content.slice(prefix.length).trim().split(/ +/);

        if (commandName.match(/^[a-zA-Z0-9]+$/) == null) return;

        const channelName = msg.channel?.type === ChannelTypes.GUILD_TEXT ? "#"+msg.channel.name : msg.channel?.toString();

        console.debug(`${channelName} ${msg.author.username} ${commandName} ${args.join(" ")}`);

        const user = await prisma.user.upsert({
            where: { id: msg.author.id },
            update: {},
            create: {
                id: msg.author.id,
                balance: Decimal(0)
            }
        })

        const ctx = new CommandContext(msg, args, msg.author)

        bot.commands.get(commandName)?.execute(ctx).then((succeeded: boolean) => {
            console.log(`Command ${commandName} executed with result: ${succeeded}`);
        }).catch((err: Error) => {
            console.error(`Error executing command ${commandName}:`, err);
        });
    }
} as BotEvent<"messageCreate">
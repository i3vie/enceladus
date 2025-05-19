import BotEvent from "../types/botEvent";
import { Message, Client, ChannelTypes } from "oceanic.js";
import { prefix } from "../../botconfig.json";
import prisma from "../util/prisma"
import { Decimal } from "@prisma/client/runtime/library";

const messageCreateEvent: BotEvent<"messageCreate"> = {
    eventName: "messageCreate",
    trigger: async (msg: Message) => {
        if (msg.author.bot) return;

        const channelName = msg.channel?.type === ChannelTypes.GUILD_TEXT ? "#"+msg.channel.name : msg.channel?.toString();
        console.debug(`${msg.author.username} in ${channelName}: ${msg.content}`);

        if (!msg.content.startsWith(prefix)) return;

        const user = await prisma.user.upsert({
            where: { id: msg.author.id },
            update: {},
            create: {
                id: msg.author.id,
                balance: Decimal(0)
            }
        })

        const args = msg.content.slice(prefix.length).trim().split(/ +/);

        console.debug(`Command: ${args[0]}, Args: ${args.slice(1).join(", ")}`);
    }
}

export default messageCreateEvent;


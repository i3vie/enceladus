import BotEvent from "../types/botEvent";
import { Message, Client, ChannelTypes, Embed, CreateMessageOptions } from "oceanic.js";
import { prefix } from "../../botconfig.json";
import prisma from "../util/prisma"
import { CommandContext } from "../types/botCommand";
import Bot from "../bot";
import { Decimal } from "@prisma/client/runtime/client";
import chalk from "chalk";

export default {
    eventName: "messageCreate",
    async trigger(bot: Bot, msg: Message) {
        if (msg.author.bot || !msg.content.startsWith(prefix)) return;

        const [commandName, ...args] = msg.content.slice(prefix.length).trim().split(/ +/);

        if (commandName.match(/^[a-zA-Z0-9]+$/) == null) return;

        const channelName = msg.channel?.type === ChannelTypes.GUILD_TEXT ? "#"+msg.channel.name : msg.channel?.toString();

        const user = await prisma.user.upsert({
            where: { id: msg.author.id },
            update: {},
            create: {
                id: msg.author.id,
                balance: Decimal(0)
            }
        })

        const command = bot.commands.get(commandName);

        let ctx: CommandContext<any>;

        try {
            ctx = new CommandContext(bot, msg, args, msg.author, msg.member ?? undefined, command?.options ?? undefined);
        } catch (err) {
            const user = msg.author.username;
            const char = chalk.red("✗");
            const color = chalk.red;
            const guildName = msg.guild ? `${msg.guild.name}` : "DM";
            console.debug(color(`${char} [${guildName} » ${channelName}] ${user} ran command ${commandName} ${args}`));
            return;
        }

        command?.execute(ctx).then((succeeded: boolean) => { // This way lies madness
            const user = msg.author.username;
            const char = succeeded ? chalk.green("✓") : chalk.red("✗");
            const color = succeeded ? chalk.green : chalk.red;
            const channelName = msg.channel?.type === ChannelTypes.GUILD_TEXT ? "#"+msg.channel.name : msg.channel?.toString();
            const guildName = msg.guild ? `${msg.guild.name}` : "DM";

            console.debug(color(`${char} [${guildName} » ${channelName}] ${user} ran command ${commandName} ${args}`));
        }).catch((err: Error) => {
            console.error(`Error executing command ${commandName}:`, err);
        });
    }
} as BotEvent<"messageCreate">
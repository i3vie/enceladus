import BotEvent from "../types/botEvent";
import { Message, Client, ChannelTypes, Embed, CreateMessageOptions } from "oceanic.js";
import { prefix } from "../../botconfig.json";
import prisma from "../util/prisma"
import { CommandContext, CommandResult } from "../types/botCommand";
import Bot from "../bot";
import { Decimal } from "@prisma/client/runtime/client";
import chalk from "chalk";
import { EmbedBuilder } from "@oceanicjs/builders";

export default {
    eventName: "messageCreate",
    async trigger(bot: Bot, msg: Message) {
        if (msg.author.bot || !msg.content.startsWith(prefix)) return;

        const [commandName, ...args] = msg.content.slice(prefix.length).trim().split(/ +/);

        if (commandName.match(/^[a-zA-Z0-9]+$/) == null) return;

        const channelName = msg.channel?.type === ChannelTypes.GUILD_TEXT ? "#"+msg.channel.name : msg.channel?.toString();
        const command = bot.commands.get(commandName) ?? Array.from(bot.commands.values()).find(cmd => {
            if (cmd.aliases?.includes(commandName)) return cmd;
        });

        let ctx: CommandContext<any>;

        try {
            ctx = await CommandContext.create(bot, msg, args, msg.author, msg.member ?? undefined, command?.options ?? undefined)
        } catch (err) {
            const user = msg.author.username;
            const char = chalk.red("✗");
            const color = chalk.red;
            const guildName = msg.guild ? `${msg.guild.name}` : "DM";
            console.debug(color(`${char} [${guildName} » ${channelName}] ${user} ran command ${commandName} ${args}`));
            const errorEmbed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(err instanceof Error ? err.message : "Could not create command context.")
                .setColor(0xFF0000)
                .toJSON();
            await msg.channel?.createMessage({ embeds: [errorEmbed] });
            return;
        }

        command?.execute(ctx).then((res: CommandResult) => { // This way lies madness
            const succeeded = res != null;

            switch (typeof res) {
                case "string": ctx.reply(res, true); break;
                case "object":
                    if (res instanceof EmbedBuilder) {
                        ctx.reply(res.toJSON(), true);
                    }
                default: break;
            }

            const user = msg.author.username;
            const char = succeeded ? chalk.green("✓") : chalk.red("✗");
            const color = succeeded ? chalk.green : chalk.red;
            const channelName = msg.channel?.type === ChannelTypes.GUILD_TEXT ? "#"+msg.channel.name : msg.channel?.toString();
            const guildName = msg.guild ? `${msg.guild.name}` : "DM";

            console.debug(color(`${char} [${guildName} » ${channelName}] ${user} ran command ${command.name} ${args}`));
        }).catch((err: Error) => {
            console.error(`Error executing command ${commandName}:`, err);
        });
    }
} as BotEvent<"messageCreate">
import { Message, Client } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";
import { exec } from "child_process";

export default {
    name: "exec",
    description: "Executes a command on the system",
    category: "general",
    options: [
        {
            type: "string",
            name: "command",
            description: "The command to execute",
        },
    ],
    async execute(ctx: CommandContext<any>) {
        const command = ctx.rawArgs.join(" ");
        
        const process = exec(command, (error, stdout, stderr) => {
            const embed = new EmbedBuilder()
                .setTitle("Command Execution Result")
                .setColor(error ? 0xFF0000 : 0x00FF00)
                .addField("Command", `\`${command}\``)
                .addField("Output", `\`\`\`${stdout || "No output"}\`\`\``)
                .addField("Error", `\`\`\`${stderr || "No error"}\`\`\``);

            if (error) {
                embed.addField("Execution Error", `\`\`\`${error.message}\`\`\``);
            }
            
            ctx.reply(embed.toJSON());
        }
        );
    }
} as BotCommand
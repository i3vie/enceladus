import BotCommand, { CommandContext } from "../types/botCommand";

export default {
    name: "echo",
    description: "Repeat the provided text",
    category: "admin",
    adminOnly: true,
    async execute(ctx: CommandContext<any>) {
        return ctx.rawArgs.join(" ");
    }
} as BotCommand;

import BotCommand, { CommandContext } from "../types/botCommand";

export default {
    name: "help",
    description: "Get help on how to use the bot",
    category: "general",
    options: [
        {
            name: "command",
            description: "Command to get help on",
            type: "string",
            optional: true
        }
    ],
    async execute(ctx: CommandContext<any>) {
        console.log(`args: ${JSON.stringify(ctx.args)}`);

        const command = null // TODO: get command from ctx.args

        if (command) {
            // goober
        } else {
            const commands = [...ctx.bot.commands.values()].map(cmd => `\`${ctx.bot.prefix}${cmd.name}\`: ${cmd.description}`).join("\n");
            const helpMessage = `
                **Help**
                This bot provides various commands to interact with the server.
                
                ** Available Commands:
                ${commands}

                To use a command, simply type it in the chat. For example, \`${ctx.bot.prefix}help\`.
            `.trimIndent()

            await ctx.reply(helpMessage);
        }

        return true;
    }
} as BotCommand;

class Option<T> {
    required: boolean = false;
    default?: T = undefined;
    description?: string = undefined;

    constructor(options: { required?: boolean, default?: T } = {}) {
        this.required = options.required || false;
        this.default = options.default;
    }
}
const testOptions: Record<string, Option<any>> = {
    "test": new Option<string>({ required: true }),
    "test2": new Option<number>({ required: false })
};
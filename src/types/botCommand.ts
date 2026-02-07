import { User, Member, Message, Client, Embed } from "oceanic.js";
import Bot from "../bot";
import { raw } from "@prisma/client/runtime/client";
import { EmbedBuilder } from "@oceanicjs/builders";

type StringType = "string";
type NumberType = "number";
type BooleanType = "boolean";
type UserType = "user";

export type CommandResult = string | EmbedBuilder | null | void;

type CommandOptionType = StringType | NumberType | BooleanType | UserType;

interface CommandOption {
    type: CommandOptionType;
    name: string;
    description?: string;
    optional?: boolean;
    defaultValue?: ArgValue;
}

type ArgValue = string | number | boolean | User;

type OptionToType<O extends CommandOption> =
    O["type"] extends "string" ? string :
    O["type"] extends "number" ? number :
    O["type"] extends "boolean" ? boolean :
    O["type"] extends "user" ? User :
    never;

type ArgsFromOptions<T extends readonly CommandOption[]> = {
    [O in T[number]as O["name"]]: OptionToType<O>
};

export type CommandCategory = "general" | "admin" | "fun" | "utility" | "music" | "games";

export class CommandContext<T extends readonly CommandOption[]> {
    message: Message;
    args: Partial<Record<string, ArgValue>>;
    user: User;
    member?: Member;
    bot: Bot;
    rawArgs: string[];
    adminOnly: boolean;

    constructor(
        bot: Bot,
        message: Message,
        rawArgs: string[],
        user: User,
        member?: Member,
        options?: T,
        adminOnly: boolean = false,
    ) {
        this.args = {};
        this.message = message;
        this.user = user;
        this.rawArgs = rawArgs;
        this.member = member;
        this.bot = bot;
        this.adminOnly = adminOnly;
    }

    static async create<T extends readonly CommandOption[]>(
        bot: Bot,
        message: Message,
        rawArgs: string[],
        user: User,
        member?: Member,
        options?: T,
        adminOnly: boolean = false,
    ): Promise<CommandContext<T>> {
        const ctx = new CommandContext<T>(bot, message, rawArgs, user, member);
        // If the command is adminOnly, we need to check if the user is an application admin before anything else
        if (adminOnly) {
            const admins = await bot.getAdminUsers();
            if (!admins.some(admin => admin.id === user.id)) {
                throw new Error("You do not have permission to use this command.");
            }
        }

        if (options) {
            for (let i = 0; i < options.length; i++) {
                const option = options[i];
                const rawArg = rawArgs[i];

                if (rawArg === undefined) {
                    if (option.optional) continue;
                    throw new Error(`Missing required argument: ${option.name}`);
                }

                let parsed: ArgValue;

                switch (option.type) {
                    case "string":
                        parsed = rawArg;
                        break;

                    case "number": {
                        const num = Number(rawArg);
                        if (isNaN(num)) {
                            throw new Error(`Invalid number for argument: ${option.name}`);
                        }
                        parsed = num;
                        break;
                    }

                    case "boolean":
                        parsed = rawArg.toLowerCase() === "true";
                        break;

                    case "user": {
                        const u = await rawArg.asDiscordUser();
                        if (!u) {
                            throw new Error(`Invalid user for argument: ${option.name}`);
                        }
                        parsed = u;
                        break;
                    }
                }

                ctx.args[option.name] = parsed;
            }
        } else {
            rawArgs.forEach((arg, i) => {
                ctx.args[i.toString()] = arg;
            });
        }

        return ctx;
    }


    /**
     * Reply to the command message.
     * @param content The content to send. Can be a string or an Embed.
     * @param trueReply If true, the message will be a reply to the command message.
     */
    reply(content: string | Embed, trueReply: boolean = false): Promise<Message> {
        let options: {
            content?: string;
            embeds?: Embed[];
            messageReference?: { messageID: string };
        } = {
            content: typeof content === "string" ? content : undefined,
            embeds: typeof content === "object" ? [content] : undefined
        };

        if (trueReply) {
            options.messageReference = { messageID: this.message.id };
        }

        return this.message.channel!.createMessage(options);
    }

    getArgument<K extends keyof ArgsFromOptions<T>>(
        name: K
    ): ArgsFromOptions<T>[K] | undefined {
        return this.args[name] as ArgsFromOptions<T>[K];
    }
}

export default interface BotCommand<Options extends readonly CommandOption[] = CommandOption[]> {
    /**
     * The name of the command.
     */
    name: string;

    /**
     * A brief description of the command.
     */
    description: string;

    /**
     * The category of the command.
     */
    category: CommandCategory;

    /**
     * The options/arguments for the command.
     */
    options?: Options;

    /**
     * Aliases for the command.
     */
    aliases?: string[]

    adminOnly?: boolean;

    /**
     * Executes the command.
     * @returns The result of the command execution.
     */
    execute(ctx: CommandContext<NonNullable<Options>>): Promise<CommandResult>;
}
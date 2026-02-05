import { User, Member, Message, Client, Embed } from "oceanic.js";
import Bot from "../bot";
import { raw } from "@prisma/client/runtime/client";

type StringType = "string";
type NumberType = "number";
type BooleanType = "boolean";

type CommandOptionType = StringType | NumberType | BooleanType;

type TypeMap = {
    "string": string;
    "number": number;
    "boolean": boolean;
}

interface CommandOption {
    type: CommandOptionType;
    name: string;
    description?: string;
    optional?: boolean;
}

type ArgPrimitive = string | number | boolean;

type Argument<T extends ArgPrimitive> = {
    value: T;
}

type OptionToType<O extends CommandOption> =
    O["type"] extends "string" ? string :
    O["type"] extends "number" ? number :
    O["type"] extends "boolean" ? boolean :
    never;

type ArgsFromOptions<T extends readonly CommandOption[]> = {
    [O in T[number] as O["name"]]: OptionToType<O>
};

export type CommandCategory = "general" | "admin" | "fun" | "utility" | "music" | "games";

export class CommandContext<T extends readonly CommandOption[]> {
    message: Message;
    args: Partial<Record<string, ArgPrimitive>>;
    user: User;
    member?: Member;
    bot: Bot;

    constructor(
        bot: Bot,
        message: Message,
        rawArgs: string[],
        user: User,
        member?: Member,
        options?: T
    ) {
        this.args = {};

        if (options) {
            for (let i = 0; i < options.length; i++) {
                const option = options[i];
                const rawArg = rawArgs[i];

                if (rawArg === undefined) {
                    if (option.optional) {
                        continue;
                    } else {
                        throw new Error(`Missing required argument: ${option.name}`);
                    }
                }

                let parsedValue: ArgPrimitive;

                switch (option.type) {
                    case "string":
                        parsedValue = rawArg;
                        break;
                    case "number":
                        const num = Number(rawArg);
                        if (isNaN(num)) {
                            throw new Error(`Invalid number for argument: ${option.name}`);
                        }
                        parsedValue = num;
                        break;
                    case "boolean":
                        parsedValue = rawArg.toLowerCase() === "true";
                        break;
                }

                this.args[option.name] = parsedValue;
            }
        } else {
            rawArgs.forEach((arg, i) => {
                this.args[i.toString()] = arg;
            });
        }


        this.message = message;
        this.user = user;
        this.member = member;
        this.bot = bot;
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
    name: string;
    description: string;
    category: CommandCategory;
    options?: Options;
    aliases?: string[]

    /**
     * Executes the command.
     * @returns String, which will be sent as a reply to the command message. or null if no reply is needed.
     */
    execute(ctx: CommandContext<NonNullable<Options>>): Promise<boolean>;
}
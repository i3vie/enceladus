import { User, Member, Message, Client, Embed } from "oceanic.js";

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
    name: string; // bongaloids 
    description?: string;
    optional?: boolean;
}
 
type OptionsToArgs<T extends readonly CommandOption[]> = {
    [Option in T[number] as Option['name']]: TypeMap[Option['type']]
}

export type CommandCategory = "general" | "admin" | "fun" | "utility" | "music" | "games";

export class CommandContext<T extends readonly CommandOption[]> {
    message: Message;
    args: OptionsToArgs<T>;
    user: User;
    member?: Member;

    constructor(
        message: Message,
        rawArgs: string[],
        user: User,
        member?: Member,
        options?: T
    ) {
        // Build the typed args object
        const args = {} as OptionsToArgs<T>;
        
        if (options) {
            options.forEach((option, index) => {
                const rawValue = rawArgs[index];
                
                // Skip if value is undefined and option is optional
                if (rawValue === undefined) {
                    if (!option.optional) {
                        console.warn(`Missing required argument: ${option.name}`);
                    }
                    return;
                }
                
                // Parse based on the expected type
                switch (option.type) {
                    case "string":
                        args[option.name as keyof OptionsToArgs<T>] = rawValue as any;
                        break;
                    case "number":
                        const numValue = Number(rawValue);
                        if (!isNaN(numValue)) {
                            args[option.name as keyof OptionsToArgs<T>] = numValue as any;
                        }
                        break;
                    case "boolean":
                        args[option.name as keyof OptionsToArgs<T>] = (rawValue.toLowerCase() === "true" || rawValue === "1") as any;
                        break;
                }
            });
        }

        this.message = message;
        this.args = args;
        this.user = user;
        this.member = member;
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
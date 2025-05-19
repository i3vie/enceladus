import { User, Member } from "oceanic.js";

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
 
type OptionsToArgs<T extends readonly CommandOption[]> = {
    [Option in T[number] as Option['name']]: TypeMap[Option['type']]
}

export type CommandContext<T extends readonly CommandOption[]> = {
    args: OptionsToArgs<T>;
    user: User;
    member?: Member;
}

export interface BotCommand<Options extends readonly CommandOption[] = CommandOption[]> {
    name: string;
    description: string;
    category: string;
    options?: Options;
    action: (ctx: CommandContext<NonNullable<Options>>) => Promise<string | null>;
}
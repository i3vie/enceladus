import { User } from "oceanic.js";

declare global {
    interface String {
        trimIndent(): string;
        mentionID(): string;
        asDiscordUser(): Promise<User>;
    }
}

export {};
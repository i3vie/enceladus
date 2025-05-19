import fs from "fs";
import path from "path";
import { ClientEvents } from "oceanic.js";
import BotEvent from "../types/botEvent";

export async function loadCommands(): Promise<void> {

    // todo
    
}

export async function loadEvents(): Promise<Map<keyof ClientEvents, BotEvent<any>>> {
    const eventsDir = path.resolve(__dirname, "../events");
    const files = fs.readdirSync(eventsDir)

    const events = new Map<keyof ClientEvents, BotEvent<any>>();

    for (const file of files) {
        if (file.endsWith(".ts") || file.endsWith(".js")) {
            const filePath = path.join(eventsDir, file);
            const mod = await import(filePath);
            const event: BotEvent<any> = mod.default;

            events.set(event.eventName, event);
        }
    }

    return events
}
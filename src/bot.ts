import { Client, ClientEvents, Intents } from "oceanic.js";
import fs from 'fs';
import path from "path";
import BotCommand from './types/botCommand';
import BotEvent from './types/botEvent';

export default class Bot {
    client: Client;
    events: Map<keyof ClientEvents, BotEvent<any>>;
    commands: Map<string, BotCommand<any>>;
    prefix: string = "!";

    constructor(token: string) {
        this.events = new Map<keyof ClientEvents, BotEvent<any>>();
        this.commands = new Map<string, BotCommand<any>>();

        this.client = new Client({
            auth: `Bot ${token}`, 
            gateway: { intents: [Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT, Intents.GUILDS]}
        });
    }

    start() {
        this.client.on("ready", async() => {
            console.log(`Logged in as ${this.client.user.username}#${this.client.user.discriminator}`);

            this.events = await this.loadEvents();
            this.commands = await this.loadCommands();

            for (const [name, event] of this.events) {
                this.client.on(name as keyof ClientEvents, (...args) => {
                    event.trigger(this, ...args).catch(err => {
                        console.error(`Error in event ${name}:`, err);
                    })
                });
            }

            console.log("Ready as", this.client.user.tag);
        });
        
        this.client.connect();
    }

    stop() {
        this.client.disconnect();
    }

    private async loadEvents(): Promise<Map<keyof ClientEvents, BotEvent<any>>> {
        const eventsDir = path.resolve(__dirname, "./events");
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

    private async loadCommands(): Promise<Map<string, BotCommand<any>>> {
        const commandsDir = path.resolve(__dirname, "./commands");
        const files = fs.readdirSync(commandsDir)

        const commands = new Map<string, BotCommand<any>>();

        for (const file of files) {
            if (file.endsWith(".ts") || file.endsWith(".js")) {
                const filePath = path.join(commandsDir, file);
                const mod = await import(filePath);
                const command: BotCommand<any> = mod.default;

                commands.set(command.name, command);
            }
        }

        return commands
    }
}
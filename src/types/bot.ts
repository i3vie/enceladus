import { Client, Intents} from "oceanic.js";
import { BotCommand } from './botCommand';
import BotEvent from './botEvent';

class Bot {
    private client: Client;
    events: BotEvent<any>[];
    commands: BotCommand[];

    constructor(token: string) {
        this.events = [];
        this.commands = [];

        this.client = new Client({
            auth: `Bot ${token}`, 
            gateway: { intents: [Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT, Intents.GUILDS]}
        });
    }
}
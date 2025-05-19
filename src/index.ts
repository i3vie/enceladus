import { Client, Intents} from "oceanic.js";

import { loadEvents } from "./util/loaders";

import * as config from "../botconfig.json";

const client = new Client({ auth: `Bot ${config.token}`, gateway: { intents: [Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT, Intents.GUILDS]} });

client.on("ready", async() => {
    const events = await loadEvents();
    console.log(events);
    for (const [name, event] of events) {
        client.on(name, (...args) => {
            event.trigger(...args).catch(err => {
                console.error(`Error in event ${name}:`, err);
            })
        });
    }
    console.log("Ready as", client.user.tag);
});

client.on("error", (err) => {
    console.error("Something Broke!", err);
});

client.connect();
import { Client, ClientEvents, Intents, TeamMembershipState, User } from "oceanic.js";
import fs from 'fs';
import path from "path";
import BotCommand from './types/botCommand';
import BotEvent from './types/botEvent';
import prisma from "./util/prisma";
import { UserRole } from "@prisma/client";

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

    /**
     * Get an array of Users who are considered "owners" of the bot application. This includes the application owner and team members with admin or developer roles.
     * @returns Array<User>
     */
    async getApplicationOwners() {
        const app = await this.client.rest.applications.getCurrent();
        let owners: Array<User> = [];
        if (app.team) {
            owners = app.team.members
                .filter(member =>
                    (member.role == "admin" || member.role == "developer") &&
                    member.membershipState == TeamMembershipState.ACCEPTED
                )
                .map(member => member.user);
        } else if (app.owner) {
            owners = [app.owner];
        } else {
            console.error("No application owners found during appOwners call?");
        }

        return owners;
    }

    /**
     * Get an array of Users who are considered "bot admins". This is determined by the bot's internal
     * database, not by Discord permissions. These users have elevated permissions within the bot's
     * functionality, as defined by the bot's commands and features.
     * @returns Array<User>
     */
    async getBotAdmins() {
        const botAdmins = await prisma.user.findMany({
            where: {
                role: UserRole.ADMIN
            }
        })
        const adminUsers = await Promise.all(
            botAdmins.map(async (admin) => {
                console.log(`Bot admin: ${admin.id}`);
                const user = await this.client.rest.users.get(admin.id);
                console.log(`Bot admin user: ${user.tag}`);
                return user;
            })
        );
        return adminUsers;
    }

    /**
     * Get a combined list of unique Users who are either application owners or bot admins. This
     * method is useful for commands or features that need to check if a user has any elevated
     * permissions related to the bot, regardless of whether those permissions come from being an
     * application owner or being designated as a bot admin in the database. If you want to know
     * which specific role(s) a user has, you should call getApplicationOwners and getBotAdmins
     * separately and compare the results instead of using this method.
     *
     * @returns Array<User>
     */
    async combinedBotAdmins(allowCached = true) {
        const appOwners = await this.getApplicationOwners();
        const admins = await this.getBotAdmins();

        const uniqueUsersMap: Map<string, User> = new Map();

        appOwners.forEach(owner => {
            uniqueUsersMap.set(owner.id, owner);
        });

        admins.forEach(admin => {
            uniqueUsersMap.set(admin.id, admin);
        });

        return Array.from(uniqueUsersMap.values());
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

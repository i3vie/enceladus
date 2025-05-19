import { ClientEvents, Client, Message } from "oceanic.js";

/**
 * Type for a bot event handler.
 * YOU MUST EXPORT THE EVENT HANDLER AS DEFAULT!
 */
type BotEvent<K extends keyof ClientEvents> = {
    eventName: K;
    trigger: (...args: ClientEvents[K]) => Promise<void>;
}

export default BotEvent;
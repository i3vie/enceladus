import BotEvent from "../types/botEvent";
import { clearReactionSession, getReactionSession } from "../util/reactionSessions";

export default {
    eventName: "messageReactionAdd",
    async trigger(bot, ...args) {
        const [message, reactor] = args;
        const session = getReactionSession(message.id);

        if (!session) return;
        if (session.ownerID && reactor.id !== session.ownerID) return;

        if ("bot" in reactor && reactor.bot) return;
        if ("user" in reactor && reactor.user.bot) return;
        if (reactor.id === bot.client.user.id) return;

        try {
            await session.onReaction(bot, ...args);
        } catch (err) {
            clearReactionSession(message.id);
            throw err;
        }
    }
} as BotEvent<"messageReactionAdd">;

import Bot from "../bot";
import BotEvent from "../types/botEvent";

export default {
    eventName: "error",
    async trigger(_bot: Bot, err: string | Error) {
        console.error("Something unholy happened", err);
    }
} as BotEvent<"error">;
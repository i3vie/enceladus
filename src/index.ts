import "./util/util"
import Bot from "./bot";
import * as config from "../botconfig.json";

const bot = new Bot(config.token);

bot.start();
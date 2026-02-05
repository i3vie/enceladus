import "./util/util"
import Bot from "./bot";
import * as config from "../botconfig.json";
import 'dotenv/config';

const bot = new Bot(config.token);

bot.start();

// this exports
export default bot;
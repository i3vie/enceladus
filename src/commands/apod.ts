import { Message, Client } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";

export default {
    name: "apod",
    description: "Fetch todays Astronomy Picture of the Day from NASA",
    category: "general",
    options: [],
    async execute(ctx: CommandContext<any>) {
        const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`)
        const json = await res.json()

        const embed = new EmbedBuilder();
        embed.setDescription(`-# ${json.explanation}`)
        embed.setTitle(json.title)
        embed.setImage(json.hdImageUrl || json.url)
        embed.setFooter("Image credit: " + (json.copyright || "Public Domain"))
        embed.setTimestamp(new Date(json.date))

        return embed
    }
} as BotCommand
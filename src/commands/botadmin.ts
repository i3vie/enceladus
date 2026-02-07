import { Message, Client, User } from "oceanic.js";
import BotCommand, { CommandContext } from "../types/botCommand";
import { EmbedBuilder } from "@oceanicjs/builders";
import prisma from "../util/prisma";
import { UserRole } from "@prisma/client";

export default {
    name: "botadmin",
    description: "Add/remove bot admins",
    category: "general",
    options: [
        {
            type: "string",
            name: "action",
            description: "Literal 'add' or 'remove' or 'list' to add or remove a bot admin",
            optional: false
        },
        {
            type: "user",
            name: "user",
            description: "User to do bot admin stuff to",
            optional: true, // TODO: Allow functional optional and provide a partial context
        }
    ],
    adminOnly: true,
    async execute(ctx: CommandContext<any>) {
        if (ctx.getArgument("action") === "list") {
            const appOwners = await ctx.bot.getApplicationOwners();
            const admins = await ctx.bot.getBotAdmins();

            // Combine appOwners and admins, ensuring uniqueness
            // Tag each user with (Owner) or (Admin) accordingly
            const uniqueUsersMap: Map<string, { user: User, roles: string[] }> = new Map();

            appOwners.forEach(owner => {
                if (!uniqueUsersMap.has(owner.id)) {
                    uniqueUsersMap.set(owner.id, { user: owner, roles: [] });
                }
                uniqueUsersMap.get(owner.id)?.roles.push("Owner");
            });

            admins.forEach(admin => {
                if (!uniqueUsersMap.has(admin.id)) {
                    uniqueUsersMap.set(admin.id, { user: admin, roles: [] });
                }
                uniqueUsersMap.get(admin.id)?.roles.push("Admin");
            });

            const uniqueUsers = Array.from(uniqueUsersMap.values());

            const embed = new EmbedBuilder()
                .setTitle("Bot admins")
                .setColor(0x00AE86);
            
            uniqueUsers.forEach(({ user, roles }) => {
                embed.addField(user.tag, roles.join(", "), true);
            })

            await ctx.reply(embed.toJSON());
            return true;
        }

        let victim = ctx.getArgument("user") as User | undefined;
        if (!victim) {
            victim = ctx.user;
        }

        const user = await prisma.user.upsert({
            where: { id: victim.id },
            update: {},
            create: {
                id: victim.id,
                balance: 0
            }
        })

        let argument = ctx.getArgument("action") as string | "remove";
        if (argument === "add") {
            user.role = UserRole.ADMIN;
            await prisma.user.update({
                where: { id: victim.id },
                data: { role: UserRole.ADMIN }
            })
            return `Added ${victim.tag} as a bot admin.`;
        } else if (argument === "remove") {
            user.role = UserRole.USER;
            await prisma.user.update({
                where: { id: victim.id },
                data: { role: UserRole.USER }
            })
            return `Removed ${victim.tag} from bot admins.`;
        } else {
            return "Invalid argument. Use 'add' or 'remove'.";
        }
    }
} as BotCommand

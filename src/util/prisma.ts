import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`

export default new PrismaClient({
    adapter: new PrismaPg({ connectionString })
});
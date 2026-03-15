import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pool } from './db';

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;

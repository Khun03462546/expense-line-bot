import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as PrismaClientType } from '../app/generated/prisma/client';

// Singleton Prisma client สำหรับใช้ร่วมกันในแอป
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const PrismaClient = PrismaClientType as unknown as new (options: { adapter: PrismaPg }) => PrismaClientType;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

import { PrismaClient } from '@prisma/client';

// PrismaClientのグローバルインスタンスを作成
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 開発環境で複数のインスタンスが作成されるのを防ぐ
const prismaClient = globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient;

// 名前付きエクスポート
export const prisma = prismaClient;

// デフォルトエクスポート
export default prismaClient; 
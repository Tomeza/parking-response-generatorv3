"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
var client_1 = require("@prisma/client");
// PrismaClientのグローバルインスタンスを作成
var globalForPrisma = global;
// 開発環境で複数のインスタンスが作成されるのを防ぐ
exports.prisma = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        datasources: {
            db: {
                url: process.env.DATABASE_URL
            }
        }
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prisma;
exports.default = exports.prisma;

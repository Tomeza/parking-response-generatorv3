// Jestのセットアップファイル
// テスト環境で必要な設定をここに記述します

// テスト用の環境変数を設定
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/parking_response_test';

// テストのタイムアウトを設定
jest.setTimeout(10000);

// テストの前後で実行する処理を設定
beforeAll(async () => {
  // テストデータベースのセットアップ
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  // テストデータベースのクリーンアップ
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$disconnect();
}); 
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetKnowledgeSequence() {
  try {
    console.log('Knowledge テーブルの ID シーケンスをリセットします...');

    // Knowledge テーブルが空であることを確認 (念のため)
    const count = await prisma.knowledge.count();
    if (count > 0) {
      console.warn(`警告: Knowledge テーブルにはまだ ${count} 件のデータが存在します。`);
      console.warn('シーケンスのリセットはテーブルが空の場合にのみ安全です。');
      // 必要に応じてエラーにするか、ユーザーに確認を促す
      // return;
    }

    // PostgreSQL のシーケンス名を指定してリセットする SQL を実行
    // Prisma のデフォルトのシーケンス名は "TableName_ColumnName_seq"
    const sequenceName = '"Knowledge_id_seq"'; // ダブルクォートで囲む
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1;`);

    console.log(`シーケンス ${sequenceName} が正常に 1 にリセットされました。`);

  } catch (error) {
    console.error('シーケンスのリセット中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetKnowledgeSequence(); 
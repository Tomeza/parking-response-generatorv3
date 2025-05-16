import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_ID = 111;
const CURRENT_KEYWORDS = '台風 天候 災害 欠航'; // optimize-cancel-knowledge.ts で設定されたもの
const PHRASES_TO_ADD = [
  '天候不良でキャンセル', 
  '悪天候', 
  '天候理由'
];

// 新しい question 文字列を生成 (重複を避け、スペースで結合)
const newKeywords = [
    ...CURRENT_KEYWORDS.split(' ').filter(k => k.length > 0), 
    ...PHRASES_TO_ADD
];
const OPTIMIZED_QUESTION = [...new Set(newKeywords)].join(' ');

async function updateSingleQuestion() {
  console.log(`ID ${TARGET_ID} の question フィールドを更新します...`);
  console.log(`新しい question: "${OPTIMIZED_QUESTION}"`);

  try {
    const knowledge = await prisma.knowledge.findUnique({
      where: { id: TARGET_ID }
    });

    if (!knowledge) {
      console.error(`エラー: ID ${TARGET_ID} のナレッジが見つかりません。`);
      return;
    }

    // Noteフィールドは変更せず、questionフィールドのみ更新
    await prisma.knowledge.update({
      where: { id: TARGET_ID },
      data: {
        question: OPTIMIZED_QUESTION
        // note: knowledge.note // noteは変更しない
      }
    });

    console.log(`ID ${TARGET_ID} の更新が完了しました。`);

  } catch (e) {
    console.error('更新中にエラーが発生しました:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateSingleQuestion(); 
import { PrismaClient } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { backupFaqData } from './backup-faq-data.mjs';

const prisma = new PrismaClient();
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.3
});

const outputParser = new StringOutputParser();

const promptTemplate = PromptTemplate.fromTemplate(`
以下の回答を、以下の基準で改善してください：
- 簡潔で明確な表現を使用
- 重要な情報を漏らさない
- 丁寧な言葉遣いを維持
- 一般化された表現に変換

元の回答：
{input}

改善された回答：`);

async function refineAnswer(rawAnswer: string): Promise<string> {
  const chain = promptTemplate.pipe(llm).pipe(outputParser);
  return await chain.invoke({ input: rawAnswer });
}

async function migrateAndRefineFAQData() {
  try {
    // 最初にバックアップを実行
    console.log('Starting FAQ data backup...');
    const backupPath = await backupFaqData();
    console.log(`Backup completed: ${backupPath}`);

    // 既存のrawデータを取得
    const rawFaqs = await prisma.faqRaw.findMany();
    console.log(`Found ${rawFaqs.length} raw FAQ entries`);

    // 各エントリーを処理
    for (const rawFaq of rawFaqs) {
      console.log(`Processing FAQ ID: ${rawFaq.id}`);
      
      // 回答を改善
      const refinedAnswer = await refineAnswer(rawFaq.answer);
      
      // refined テーブルに保存
      await prisma.faqRefined.create({
        data: {
          id: rawFaq.id, // IDを維持
          question: rawFaq.question,
          answer: refinedAnswer,
          // embedding は後で別途更新
        }
      });
      
      console.log(`Processed FAQ ID: ${rawFaq.id}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// スクリプト実行
migrateAndRefineFAQData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  }); 
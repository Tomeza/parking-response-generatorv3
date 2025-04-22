import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('国際線関連の知識エントリを検索中...');
    
    // 国際線関連のキーワードで検索
    const results = await prisma.$queryRaw<any[]>`
      SELECT id, main_category, sub_category, question, answer 
      FROM "Knowledge" 
      WHERE question ILIKE '%国際線%' 
      OR question ILIKE '%インターナショナル%'
      OR answer ILIKE '%国際線%'
      OR answer ILIKE '%インターナショナル%'
      LIMIT 10
    `;
    
    if (results.length > 0) {
      console.log(`${results.length}件の国際線関連エントリが見つかりました：`);
      results.forEach((entry, index) => {
        console.log(`\n[${index + 1}] ID=${entry.id}, カテゴリ=${entry.main_category}/${entry.sub_category}`);
        console.log(`質問: ${entry.question ? (entry.question.substring(0, 100) + (entry.question.length > 100 ? '...' : '')) : 'なし'}`);
        console.log(`回答: ${entry.answer ? (entry.answer.substring(0, 100) + (entry.answer.length > 100 ? '...' : '')) : 'なし'}`);
      });
    } else {
      console.log('国際線に関連するエントリは見つかりませんでした。');
    }
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 
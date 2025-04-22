// 特定のクエリをテストするスクリプト
import { searchKnowledge } from '../lib/search';
import { prisma } from '../lib/db';

async function main() {
  console.log('特定クエリのテスト実行:');
  
  // テストクエリ
  const query = '定員を超える人数で利用したい場合はどうすればよいですか？';
  console.log('クエリ:', query);
  
  try {
    // 検索実行
    const results = await searchKnowledge(query);
    console.log('結果件数:', results.length);
    
    // 上位5件の結果を表示
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const r = results[i];
      console.log(`[${i+1}] ID: ${r.id}, スコア: ${r.score?.toFixed(2) || '?'}`);
      console.log(`質問: ${r.question?.substring(0, 50)}${r.question?.length && r.question.length > 50 ? '...' : ''}`);
      console.log(`カテゴリ: ${r.main_category || '?'} > ${r.sub_category || '?'} > ${r.detail_category || '?'}`);
      console.log(`回答: ${r.answer?.substring(0, 100)}${r.answer?.length && r.answer.length > 100 ? '...' : ''}`);
      console.log('');
    }

    // 特定のIDをチェック
    const targetIds = [63, 62]; // 定員に関連するナレッジ
    console.log('定員関連ナレッジのランキング:');
    targetIds.forEach(id => {
      const index = results.findIndex(r => r.id === id);
      if (index >= 0) {
        console.log(`ID ${id} は検索結果の ${index + 1} 番目 (スコア: ${results[index].score?.toFixed(2) || '?'})`);
      } else {
        console.log(`ID ${id} は検索結果に含まれていません`);
      }
    });
  } catch (error) {
    console.error('検索中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
main().catch(e => {
  console.error(e);
  process.exit(1);
}); 
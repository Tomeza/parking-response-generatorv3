/**
 * 最適化された検索機能をテストするスクリプト
 */

import { PrismaClient } from '@prisma/client';
import { optimizedSearch, OptimizedSearchResult } from '../lib/optimize-search';

const prisma = new PrismaClient();

// テスト用のクエリ一覧
const TEST_QUERIES = [
  '予約はどのように行えますか？',
  '予約を変更したい',
  '予約の変更方法を教えてください',
  '営業時間を教えてください',
  'キャンセルの方法',
  '料金について教えてください',
  '国際線を利用する場合の予約方法',
  '外車を駐車できますか',
  '予約確認はどうすればよいですか',
  '送迎バスの時間'
];

/**
 * 検索結果を整形して表示する関数
 */
function formatResults(results: OptimizedSearchResult[], query: string) {
  console.log(`\n----- クエリ: "${query}" -----`);
  
  if (results.length === 0) {
    console.log('検索結果が見つかりませんでした');
    return;
  }
  
  console.log(`${results.length}件の結果が見つかりました：`);
  
  results.forEach((result, index) => {
    console.log(`\n[${index + 1}] ID: ${result.id}`);
    console.log(`カテゴリ: ${[
      result.main_category,
      result.sub_category,
      result.detail_category
    ].filter(Boolean).join(' > ')}`);
    
    if (result.question) {
      console.log(`質問: ${result.question}`);
    }
    
    console.log(`回答: ${result.answer.substring(0, 100)}${result.answer.length > 100 ? '...' : ''}`);
    console.log(`スコア: ${result.score.toFixed(3)}`);
    
    if (result.search_method) {
      console.log(`検索方法: ${result.search_method}`);
    }
    
    if (result.search_notes) {
      console.log(`検索注記: ${result.search_notes}`);
    }
  });
}

/**
 * メイン処理
 */
async function main() {
  console.log('=== 最適化された検索機能のテスト開始 ===');
  
  try {
    // 各テストクエリで検索を実行
    for (const query of TEST_QUERIES) {
      const results = await optimizedSearch(query);
      formatResults(results, query);
    }
    
    // "予約"を含む全レコード数を取得（参考情報）
    const reservationCount = await prisma.knowledge.count({
      where: {
        OR: [
          { question: { contains: '予約' } },
          { answer: { contains: '予約' } },
          { main_category: { contains: '予約' } },
          { sub_category: { contains: '予約' } }
        ]
      }
    });
    
    console.log(`\n\nデータベース内の"予約"を含むエントリ数: ${reservationCount}`);
    
    // 標準検索と改善後検索の比較レポート
    console.log('\n=== 検索機能改善レポート ===');
    console.log('1. 階層的検索ロジック: 専用検索 → PGroonga全文検索 → カテゴリ検索 → 部分一致検索');
    console.log('2. キーワード抽出の強化: 日本語の特性を考慮した前処理とストップワード除去');
    console.log('3. 検索メソッドによるスコアリング: 検索方法ごとにスコアを差別化');
    console.log('4. 結果表示の改善: 検索方法と関連カテゴリの表示');
    console.log('5. エラーハンドリングの強化: 各検索ステップでのエラーを適切に処理');
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
main()
  .then(() => console.log('\n=== 検索機能テスト完了 ==='))
  .catch(e => {
    console.error('致命的なエラーが発生しました:', e);
    process.exit(1);
  }); 
import { searchSimilarKnowledge } from '../src/lib/embeddings';

async function main() {
  try {
    console.log('ベクトル検索テストを開始します...');
    
    // テスト用の検索クエリ
    const testQuery = '営業時間を教えてください';
    
    // ベクトル検索を実行
    const results = await searchSimilarKnowledge(testQuery, 5);
    
    console.log('検索結果:');
    console.log(results);
    
    console.log('ベクトル検索テストが完了しました。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  }); 
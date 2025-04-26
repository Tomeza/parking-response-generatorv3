import { searchKnowledge, SearchResult as ActualSearchResult } from '../src/lib/search';

async function testSearch() {
  try {
    const queries = [
      '駐車場の予約方法について教えてください',
      '料金について知りたい',
      '営業時間はいつですか',
      'キャンセル方法を教えてください',
      '支払い方法は何がありますか'
    ];

    for (const query of queries) {
      console.log('\n===================================');
      console.log(`クエリ: "${query}" の検索結果`);
      console.log('===================================');
      
      const searchResults: ActualSearchResult[] = await searchKnowledge(query);

      console.log('検索結果数:', searchResults.length);
      console.log('検索結果 (上位2件の抜粋):', JSON.stringify(
        searchResults.slice(0, 2).map(r => ({ id: r.id, question: r.question?.substring(0, 50) + '...', score: r.score })),
        null,
        2
      ));
    }
  } catch (e) {
    console.error('エラー:', e);
  }
}

testSearch(); 
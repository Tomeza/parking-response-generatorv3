import { searchKnowledge } from './src/lib/search.js';

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
      
      const result = await searchKnowledge(query);
      console.log('検索結果数:', result?.results?.length);
      console.log('検索結果:', JSON.stringify(result?.results?.slice(0, 2), null, 2));
      console.log('キーワード:', result?.keyTerms);
      console.log('同義語展開:', result?.synonymExpanded);
      console.log('日付検出:', result?.dates?.map(d => d.toISOString() || ''));
      console.log('繁忙期:', result?.busyPeriods || []);
    }
  } catch (e) {
    console.error('エラー:', e);
  }
}

testSearch(); 
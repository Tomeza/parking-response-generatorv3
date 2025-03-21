import { searchKnowledge } from './lib/search.js';

async function testSearch() {
  try {
    const queries = [
      // 予約関連
      '予約方法を教えてください',
      '予約のキャンセル方法を教えてください',
      '予約の変更はできますか？',
      '予約の確認方法を教えてください',
      
      // 料金関連
      '料金はいくらですか？',
      '料金の支払い方法を教えてください',
      '料金の割引制度はありますか？',
      '料金の領収書はもらえますか？',
      
      // 支払い関連
      '支払い方法は何がありますか？',
      'クレジットカードでの支払いはできますか？',
      '現金での支払いは可能ですか？',
      '電子マネーでの支払いはできますか？',
      
      // 営業時間関連
      '営業時間を教えてください',
      '営業日はいつですか？',
      '休業日はありますか？',
      '深夜の利用は可能ですか？',
      
      // キャンセル関連
      '予約のキャンセル方法を教えてください',
      'キャンセル料はかかりますか？',
      'キャンセルした場合の返金について教えてください',
      'キャンセルの期限はありますか？',
      
      // 領収書関連
      '領収書はもらえますか？',
      '領収書の発行方法を教えてください',
      '領収書の再発行は可能ですか？',
      '領収書の形式を教えてください',
      
      // 割引関連
      '割引制度はありますか？',
      'クーポンの利用方法を教えてください',
      '会員割引はありますか？',
      '長期利用の割引はありますか？'
    ];

    for (const query of queries) {
      console.log('\n===================================');
      console.log(`クエリ: "${query}" の検索結果`);
      console.log('===================================');
      
      const result = await searchKnowledge(query);
      
      if (!result) {
        console.log('検索結果なし');
        continue;
      }
      
      console.log('検索結果数:', result.results.length);
      console.log('検索結果:', JSON.stringify(result.results.slice(0, 2), null, 2));
      console.log('キーワード:', result.keyTerms);
      console.log('同義語展開:', result.synonymExpanded);
      console.log('日付検出:', result.dates?.map(d => d.toISOString() || ''));
      console.log('繁忙期:', result.busyPeriods || []);
      
      // 検索結果が0件または1件の場合、不足している可能性がある
      if (result.results.length <= 1) {
        console.log('⚠️ 注意: このクエリに対する検索結果が少ないため、ナレッジの追加を検討してください');
      }
    }
  } catch (e) {
    console.error('エラー:', e);
  }
}

testSearch(); 
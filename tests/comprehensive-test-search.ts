import { searchKnowledge, SearchResult } from '../src/lib/search';

// 網羅的なテストクエリセット
const TEST_QUERIES = [
  "予約はどのように行えますか？",
  "予約キャンセルのルールを教えてください。",
  "予約日程を変更できますか？",
  "利用開始後に予約を変更する場合の手続きは？",
  "国際線利用者は駐車場を利用できますか？",
  "国際線利用に関する制限を教えてください。",
  "外車の駐車は可能ですか？",
  "大型車を停める際の条件はありますか？",
  "駐車場の利用手順を教えてください。",
  "駐車場に到着してからの流れは？",
  "駐車場の営業時間は？",
  "利用規約の主要なポイントを教えてください。",
  "荷物の送迎サービスはありますか？",
  "大きな荷物を運ぶ場合のルールは？",
  "定員を超える人数で利用したい場合はどうすればよいですか？",
  "ひとり送迎プランについて詳しく教えてください。",
  "送迎サービスのプランはどのようなものがありますか？",
  "送迎が必要ない場合の利用プランは？",
  "団体利用時のルールは？",
  "複数台で利用する場合の手続きは？",
  "駐車料金はどのように計算されますか？",
  "繁忙期の利用制限について教えてください。",
  "繁忙期の予約のコツはありますか？",
  "満車の場合の対応策は？",
  "空きが出た場合の通知を受け取ることはできますか？",
  "駐車場へのアクセス方法は？",
  "最寄り駅からの移動手段を教えてください。",
  "幼児を抱っこすれば、定員を超えても利用できますか？",
  "幼児を含めて定員を超える人数で利用したいのですが、可能でしょうか？",
  "4台16名で利用希望です。社員旅行で利用します。領収書を発行していただきたい",
  "予約したい期間の一部に空きがない場合でも、予約は可能でしょうか？また、外車や大型高級車でも駐車場を利用できますか？",
  "国際線を利用する予定ですが、駐車場を利用できますか？",
  "11月1日から11月6日朝帰国なのですが、11月3日の空きがないと利用できないでしょうか。もし可能であれば利用したいと思います",
  "駐車を希望しているのですが、ネット予約は満車になっておりできません。もし空いているようならば、お願いしたいです",
  "予約内容の確認と変更についてお問い合わせです。1.一歳の子供が同乗しますが、送迎に問題はありませんか？2.予約内容を変更して、運転手のみの「ひとり送迎」にすることは可能でしょうか？荷物と子供を先に空港で降ろし、その後に運転手だけが送迎を受ける形にできますか？",
  "駐車場の予約開始日と送迎サービスについて教えてください。1.予約はいつから可能ですか？2.送迎について質問です。早朝出発のフライトに合わせた送迎は何時から利用できますか？夜遅い便で帰着する場合、空港へのお迎えは何時まで対応していますか？",
  "送迎人数が変更になる場合はご連絡した方がよろしいでしょうか？",
  "希望日の駐車場を利用したいのですが、満車のようでサイトから予約できません。やはり無理でしょうか？また、キャンセル待ちはできますか？軽自動車なら予約可能でしょうか？お返事よろしくお願いします。",
  "駐車場の予約開始時期について質問があります。希望月の予約は、何月何日の何時から可能になりますでしょうか？",
  "いつも国内線で利用させていただいておりますが、次回は国際線を利用する予定です。国際線のフライトで送迎をお願いすることは可能でしょうか？また、国際線ターミナルまでの送迎時間はどれくらいかかりますか？国内線よりも時間がかかりますか？よろしくお願いいたします。",
  "予約内容の変更をお知らせしたいのですが、どのように連絡すればよいでしょうか？",
  "はじめまして。駐車場の予約はいつから可能になりますか？また、二週間ほど利用したいのですが、可能でしょうか？",
  "予約した日付を変更したいのですが、可能でしょうか？",
  "予約完了通知が複数届きました。ご確認をお願いできますか？",
  "19日の駐車場への到着時間を5時にしていますが、5時前に着いた場合、駐車場に入れますか？"
];

// 検索結果をフォーマットして表示する関数
function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "検索結果なし";
  }
  
  return results.slice(0, 3).map((result, index) => {
    const score = result.score !== undefined ? result.score.toFixed(1) : 'N/A';
    const question = result.question || '質問文なし';
    return `${index + 1}. [ID:${result.id}][Score:${score}] ${question.substring(0, 50)}${question.length > 50 ? '...' : ''}`;
  }).join('\n');
}

// パフォーマンス統計データ用の型定義
type SearchStats = {
  totalQueries: number;
  queriesWithResults: number;
  totalTime: number;
  averageResultsPerQuery: number;
  averageTopScore: number;
  resultsByScoreRange: {
    [key: string]: number;
  };
};

// メイン処理関数
async function runTestQueries() {
  console.log("\n=== 網羅的検索テスト - 開始 ===\n");
  
  const stats: SearchStats = {
    totalQueries: TEST_QUERIES.length,
    queriesWithResults: 0,
    totalTime: 0,
    averageResultsPerQuery: 0,
    averageTopScore: 0,
    resultsByScoreRange: {
      '15+': 0,
      '10-15': 0,
      '5-10': 0,
      '1-5': 0,
      '0-1': 0,
    }
  };
  
  let totalResults = 0;
  let totalTopScore = 0;
  let totalHitQueries = 0;
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    console.log(`\n=== クエリ ${i + 1}/${TEST_QUERIES.length}: "${query}" ===`);
    
    const startTime = Date.now();
    const results = await searchKnowledge(query);
    const endTime = Date.now();
    const queryTime = endTime - startTime;
    
    stats.totalTime += queryTime;
    
    console.log(`検索時間: ${queryTime}ms`);
    console.log(`検索結果数: ${results.length}`);
    
    if (results.length > 0) {
      totalHitQueries++;
      stats.queriesWithResults++;
      totalResults += results.length;
      
      const topScore = results[0]?.score || 0;
      totalTopScore += topScore;
      
      // スコア範囲別のカウント
      if (topScore >= 15) stats.resultsByScoreRange['15+']++;
      else if (topScore >= 10) stats.resultsByScoreRange['10-15']++;
      else if (topScore >= 5) stats.resultsByScoreRange['5-10']++;
      else if (topScore >= 1) stats.resultsByScoreRange['1-5']++;
      else stats.resultsByScoreRange['0-1']++;
      
      console.log("\n上位3件の検索結果:");
      console.log(formatResults(results));
    } else {
      console.log("検索結果はありません");
    }
  }
  
  // 統計情報の計算と表示
  stats.averageResultsPerQuery = totalResults / TEST_QUERIES.length;
  stats.averageTopScore = totalTopScore / totalHitQueries;
  
  console.log("\n=== 検索テスト結果サマリー ===");
  console.log(`・テスト総数: ${stats.totalQueries}件`);
  console.log(`・ヒット件数: ${stats.queriesWithResults}件`);
  console.log(`・ヒット率: ${(stats.queriesWithResults / stats.totalQueries * 100).toFixed(1)}%`);
  console.log(`・平均検索時間: ${(stats.totalTime / stats.totalQueries).toFixed(0)}ms`);
  console.log(`・クエリあたり平均結果数: ${stats.averageResultsPerQuery.toFixed(1)}件`);
  console.log(`・トップヒット平均スコア: ${stats.averageTopScore.toFixed(1)}`);
  console.log("\n・スコア分布:");
  console.log(`  - 15以上: ${stats.resultsByScoreRange['15+']}件 (${(stats.resultsByScoreRange['15+'] / totalHitQueries * 100).toFixed(1)}%)`);
  console.log(`  - 10-15: ${stats.resultsByScoreRange['10-15']}件 (${(stats.resultsByScoreRange['10-15'] / totalHitQueries * 100).toFixed(1)}%)`);
  console.log(`  - 5-10: ${stats.resultsByScoreRange['5-10']}件 (${(stats.resultsByScoreRange['5-10'] / totalHitQueries * 100).toFixed(1)}%)`);
  console.log(`  - 1-5: ${stats.resultsByScoreRange['1-5']}件 (${(stats.resultsByScoreRange['1-5'] / totalHitQueries * 100).toFixed(1)}%)`);
  console.log(`  - 0-1: ${stats.resultsByScoreRange['0-1']}件 (${(stats.resultsByScoreRange['0-1'] / totalHitQueries * 100).toFixed(1)}%)`);
  
  console.log("\n=== 網羅的検索テスト - 完了 ===");
}

// テスト実行
runTestQueries()
  .catch(err => {
    console.error("テスト実行中にエラーが発生しました:", err);
    process.exit(1);
  }); 
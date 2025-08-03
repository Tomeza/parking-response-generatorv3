const testQueries = [
  // 予約関連
  "駐車場の予約方法を教えてください",
  "軽自動車の予約はできますか？",
  "予約時の確認事項を教えてください",
  
  // 送迎関連
  "送迎の時間は何時までですか？",
  "車椅子での送迎は可能ですか？",
  "到着便が遅延した場合はどうなりますか？",
  
  // 料金関連
  "料金はいくらですか？",
  "割引プランはありますか？",
  "領収書は発行できますか？",
  
  // 車両関連
  "大型車は利用できますか？",
  "車の鍵はどうなりますか？",
  "ルーフキャリアは装着したままでも大丈夫ですか？",
  
  // 記入情報
  "個人情報の入力方法を教えてください",
  "備考欄には何を記入すればいいですか？",
  
  // 免責約款
  "車両引渡し後の責任について教えてください",
  "ガラスの傷は補償されますか？",
  
  // アクセス
  "駐車場へのアクセス方法を教えてください",
  "首都高湾岸線からのアクセスを教えてください"
];

async function testNewTemplates() {
  console.log('=== 新テンプレートテスト開始 ===');
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n[${i + 1}/${testQueries.length}] テスト: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('結果:');
      console.log('- カテゴリ:', result.analysis?.category);
      console.log('- 意図:', result.analysis?.intent);
      console.log('- トーン:', result.analysis?.tone);
      console.log('- テンプレート:', result.routing?.template?.title);
      console.log('- 信頼度:', result.analysis?.confidence);
      console.log('- 処理時間:', result.routing?.processingTimeMs, 'ms');
      
    } catch (error) {
      console.error('エラー:', error.message);
    }
    
    // 1秒間隔でテスト
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== テスト完了 ===');
}

testNewTemplates(); 
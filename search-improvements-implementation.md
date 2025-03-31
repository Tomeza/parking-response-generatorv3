# 駐車場応答生成システム - 検索機能改善実装計画

## 概要
現在の検索機能に対して、より正確で関連性の高い結果を返すための改善計画を策定します。特に「外車の駐車」に関する問い合わせなど、特定のトピックに対する精度向上を目指します。

## 1. 段階的な検索戦略の実装

### 1.1 専用トピック検索（最優先）
特定の重要なトピック（「外車駐車」など）に対しては、専用の検索ロジックを実装します。

```javascript
// 外車駐車などの特定トピック検索の実装例
async function searchSpecialTopics(query) {
  // 外車関連の検索
  if (isCarRelatedQuery(query)) {
    const results = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: '外車', mode: 'insensitive' } },
          { question: { contains: '高級車', mode: 'insensitive' } },
          { answer: { contains: '外車や大型高級車', mode: 'insensitive' } }
        ],
        AND: [
          { 
            OR: [
              { question: { contains: '駐車', mode: 'insensitive' } },
              { answer: { contains: '駐車', mode: 'insensitive' } }
            ]
          }
        ]
      },
      orderBy: { created_at: 'desc' }
    });
    
    if (results.length > 0) {
      return results.map(result => ({
        ...result,
        score: 1.0,
        note: '専用トピック検索で見つかりました'
      }));
    }
  }
  
  return null; // 結果がない場合は次の検索方法にフォールバック
}

// 外車関連のクエリかどうかを判定する関数
function isCarRelatedQuery(query) {
  const carKeywords = ['外車', '輸入車', '高級車', 'レクサス', 'BMW', 'ベンツ', 'アウディ'];
  return carKeywords.some(keyword => query.includes(keyword));
}
```

### 1.2 PGroonga全文検索（第2優先）
複雑な演算子を活用した全文検索を実装します。

```javascript
async function searchWithPGroonga(query, preprocessedQuery) {
  const results = await prisma.$queryRaw`
    SELECT 
      k.*,
      pgroonga_score(k.tableoid, k.ctid) AS pgroonga_score,
      similarity(COALESCE(k.question, ''), ${query}) as question_sim,
      similarity(COALESCE(k.answer, ''), ${query}) as answer_sim
    FROM "Knowledge" k
    WHERE 
      k.question &@~ ${preprocessedQuery}
      OR k.answer &@~ ${preprocessedQuery}
      OR k.main_category &@~ ${preprocessedQuery}
      OR k.sub_category &@~ ${preprocessedQuery}
    ORDER BY
      question_sim DESC,
      pgroonga_score DESC,
      answer_sim DESC
    LIMIT 10
  `;
  
  if (results.length > 0) {
    return results.map(result => ({
      ...result,
      score: calculateScore(result, query),
      note: 'PGroonga全文検索で見つかりました'
    }));
  }
  
  return null; // 結果がない場合は次の検索方法にフォールバック
}
```

### 1.3 単語マッチング検索（第3優先）
単純な単語マッチングを行う検索方法です。

```javascript
async function searchWithWordMatching(query, keywords) {
  const results = await prisma.$queryRaw`
    SELECT 
      k.*,
      pgroonga_score(k.tableoid, k.ctid) AS pgroonga_score,
      similarity(COALESCE(k.question, ''), ${query}) as question_sim,
      similarity(COALESCE(k.answer, ''), ${query}) as answer_sim
    FROM "Knowledge" k
    WHERE 
      k.question &@ ${keywords.join(' | ')}
      OR k.answer &@ ${keywords.join(' | ')}
    ORDER BY
      question_sim DESC,
      answer_sim DESC
    LIMIT 10
  `;
  
  if (results.length > 0) {
    return results.map(result => ({
      ...result,
      score: calculateScore(result, query) * 0.8, // スコアを少し下げる
      note: '単語マッチング検索で見つかりました'
    }));
  }
  
  return null;
}
```

### 1.4 ILIKE検索（第4優先）
単純な部分一致検索を行う方法です。

```javascript
async function searchWithILIKE(query, keywords) {
  const orConditions = [];
  
  for (const keyword of keywords) {
    if (keyword.length >= 2) {
      orConditions.push(
        { question: { contains: keyword, mode: 'insensitive' } },
        { answer: { contains: keyword, mode: 'insensitive' } },
        { main_category: { contains: keyword, mode: 'insensitive' } },
        { sub_category: { contains: keyword, mode: 'insensitive' } }
      );
    }
  }
  
  // キーワードが少なくとも1つある場合のみ検索
  if (orConditions.length > 0) {
    const results = await prisma.knowledge.findMany({
      where: { OR: orConditions },
      orderBy: { created_at: 'desc' },
      take: 10
    });
    
    if (results.length > 0) {
      return results.map(result => ({
        ...result,
        score: calculateScore(result, query) * 0.6, // スコアをさらに下げる
        note: 'ILIKE検索で見つかりました'
      }));
    }
  }
  
  return null;
}
```

### 1.5 最新エントリのフォールバック（最終手段）
他の検索方法で結果が見つからない場合の最終手段です。

```javascript
async function fallbackToLatestEntries(query) {
  const results = await prisma.knowledge.findMany({
    orderBy: { created_at: 'desc' },
    take: 5
  });
  
  return results.map(result => ({
    ...result,
    score: 0.1, // 低いスコアを設定
    note: '関連する結果が見つからなかったため、最新のエントリを表示しています'
  }));
}
```

## 2. クエリの前処理の強化

### 2.1 日本語クエリの前処理
日本語の自然言語クエリから重要なキーワードを抽出します。

```javascript
function enhancedPreprocessQuery(query) {
  // 不要な助詞や記号を削除
  const normalized = query.replace(/[はがのにへでとやもをのような、。．！？!?.\s]+/g, ' ').trim();
  
  // 単語に分割して重要なキーワードを抽出
  const words = normalized.split(' ').filter(w => w.length > 1);
  
  // 「予約」「営業時間」などの重要キーワードを抽出
  const keywords = [];
  
  // 特定の組み合わせパターンの検出
  if (detectSpecialPattern(normalized, ['外車', '駐車'])) {
    keywords.push('外車駐車');
    keywords.push('外車 駐車');
    keywords.push('外車や大型高級車でも駐車場を利用');
    keywords.push('外車や大型高級車の駐車');
    keywords.push('補償の都合上');
  }
  
  if (detectSpecialPattern(normalized, ['予約', '変更'])) {
    keywords.push('予約変更');
    keywords.push('予約を変更');
    keywords.push('予約の変更方法');
    keywords.push('予約内容の変更');
  }
  
  // 一般的なキーワード処理
  for (const word of words) {
    processKeyword(word, keywords);
  }
  
  // クエリをそのまま含める
  keywords.push(normalized);
  
  // 重複を除去して空白で結合
  return [...new Set(keywords)].join(' ');
}

// 特定のパターンを検出する関数
function detectSpecialPattern(text, patterns) {
  return patterns.every(pattern => text.includes(pattern));
}

// キーワードを処理する関数
function processKeyword(word, keywords) {
  // 外車関連
  if (word.includes('外車') || word === '外車' || word.includes('輸入車')) {
    keywords.push('外車');
    keywords.push('高級車');
    keywords.push('大型車');
    keywords.push('レクサス');
    keywords.push('BMW');
    keywords.push('ベンツ');
    keywords.push('アウディ');
  }
  
  // 駐車関連
  if (word.includes('駐車') || word.includes('停め') || word.includes('パーキング')) {
    keywords.push('駐車');
    keywords.push('駐車場');
    keywords.push('パーキング');
  }
  
  // 予約関連
  if (word.includes('予約') || word.includes('申込') || word.includes('申し込み')) {
    keywords.push('予約');
    keywords.push('申込');
    keywords.push('ご予約');
  }
  
  // その他のキーワード処理...
}
```

### 2.2 同義語展開
キーワードの同義語を展開して検索の幅を広げます。

```javascript
async function expandSynonyms(keywords) {
  const expandedKeywords = [...keywords];
  
  // 同義語マッピング（データベースから動的に取得することも可能）
  const synonymMap = {
    '外車': ['輸入車', '海外車', '外国車', '高級車'],
    '駐車': ['停める', 'パーキング', '駐める', '駐車場'],
    '予約': ['申込', '予め取る', '事前確保', 'リザーブ'],
    '営業時間': ['開いている時間', '営業している時間', 'オープン時間', '利用可能時間'],
    'キャンセル': ['取消', '取り消し', '解約', 'キャンセレーション'],
    '料金': ['価格', '費用', '代金', 'コスト', '値段'],
    '変更': ['修正', '変える', '更新', '訂正']
  };
  
  // 同義語の展開
  for (const keyword of keywords) {
    if (synonymMap[keyword]) {
      expandedKeywords.push(...synonymMap[keyword]);
    }
  }
  
  return [...new Set(expandedKeywords)];
}
```

## 3. スコアリングの改善

### 3.1 複合スコア計算
PGroongaスコア、類似度スコア、カテゴリスコアを組み合わせた総合スコアを計算します。

```javascript
function calculateScore(result, query) {
  // 各スコアを実効値に変換（0の場合は小さな値を代入）
  const pgrScore = result.pgroonga_score || 0.01; 
  const questionSim = result.question_sim || 0;
  const answerSim = result.answer_sim || 0;
  
  // 完全一致の場合は最大スコア
  if (result.question.trim() === query.trim()) {
    return 1.0;
  }
  
  // カテゴリによるボーナススコア
  let categoryBonus = 0;
  if (
    (query.includes('予約') && result.main_category?.includes('予約')) ||
    (query.includes('営業') && result.main_category?.includes('営業')) ||
    (query.includes('料金') && result.main_category?.includes('料金'))
  ) {
    categoryBonus = 0.2;
  }
  
  // 外車関連のスペシャルケース
  let specialBonus = 0;
  if (
    (query.includes('外車') || query.includes('高級車') || 
     query.includes('レクサス') || query.includes('BMW') || query.includes('ベンツ')) &&
    (result.question.includes('外車') || result.answer.includes('外車') || 
     result.question.includes('高級車') || result.answer.includes('高級車'))
  ) {
    specialBonus = 0.3;
  }
  
  // 最終スコアの計算（重み付け）
  // 質問の類似度を最も重視、次に回答の類似度、最後にPGroongaスコア
  const weightedScore = (questionSim * 0.65) + (answerSim * 0.25) + (pgrScore * 0.1) + categoryBonus + specialBonus;
  
  // 0〜1の範囲に正規化
  return Math.min(1.0, weightedScore);
}
```

### 3.2 カテゴリに基づくボーナススコア
質問と回答のカテゴリに基づいてボーナススコアを計算します。

```javascript
function calculateCategoryScore(knowledge, query) {
  let score = 0;
  
  // メインカテゴリとサブカテゴリの一致度
  if (knowledge.main_category) {
    // メインカテゴリの重要キーワードと検索クエリの一致を検出
    const mainCategoryKeywords = knowledge.main_category.split(/[\s_>]+/);
    for (const keyword of mainCategoryKeywords) {
      if (keyword.length >= 2 && query.includes(keyword)) {
        score += 0.3; // メインカテゴリ一致のボーナス
        break;
      }
    }
  }
  
  if (knowledge.sub_category) {
    // サブカテゴリの重要キーワードと検索クエリの一致を検出
    const subCategoryKeywords = knowledge.sub_category.split(/[\s_>]+/);
    for (const keyword of subCategoryKeywords) {
      if (keyword.length >= 2 && query.includes(keyword)) {
        score += 0.2; // サブカテゴリ一致のボーナス
        break;
      }
    }
  }
  
  return score;
}
```

### 3.3 特定の質問に対する特別なボーナス
特定の重要な質問に対して特別なボーナススコアを付与します。

```javascript
function applySpecialBonus(result, query) {
  let bonus = 0;
  
  // 外車駐車の特別ケース
  if (
    (query.includes('外車') && query.includes('駐車')) &&
    (result.question.includes('外車') || result.answer.includes('外車')) &&
    (result.question.includes('駐車') || result.answer.includes('駐車'))
  ) {
    bonus += 0.4;
  }
  
  // 国際線の特別ケース
  if (
    (query.includes('国際線') || query.includes('国際')) &&
    (result.question.includes('国際線') || result.answer.includes('国際線'))
  ) {
    bonus += 0.3;
  }
  
  // 予約変更の特別ケース
  if (
    (query.includes('予約') && query.includes('変更')) &&
    (result.question.includes('予約変更') || result.answer.includes('予約変更') ||
     (result.question.includes('予約') && result.question.includes('変更')) ||
     (result.answer.includes('予約') && result.answer.includes('変更')))
  ) {
    bonus += 0.35;
  }
  
  return bonus;
}
```

## 4. ログと分析

### 4.1 検索クエリと結果のログ記録
検索クエリとその結果を記録して、検索精度の改善に活用します。

```javascript
async function logSearchQuery(query, results, selectedResultId = null) {
  try {
    // 検索ログをデータベースに記録
    await prisma.searchLog.create({
      data: {
        query: query,
        result_count: results.length,
        selected_result_id: selectedResultId,
        processed_query: preprocessQuery(query),
        timestamp: new Date(),
        top_result_id: results.length > 0 ? results[0].id : null,
        top_result_score: results.length > 0 ? results[0].score : null
      }
    });
    
    console.log(`検索ログを記録しました: "${query}" (${results.length}件の結果)`);
  } catch (error) {
    console.error('検索ログの記録中にエラーが発生しました:', error);
  }
}
```

### 4.2 ユーザーアクションのログ記録
ユーザーのアクション（クリック、スクロールなど）を記録して、UXの改善に活用します。

```javascript
async function logUserAction(userId, action, searchId, knowledgeId = null) {
  try {
    // ユーザーアクションをデータベースに記録
    await prisma.userActionLog.create({
      data: {
        user_id: userId,
        action_type: action,
        search_id: searchId,
        knowledge_id: knowledgeId,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('ユーザーアクションログの記録中にエラーが発生しました:', error);
  }
}
```

### 4.3 ログ分析と改善提案
ログを分析して検索精度の改善提案を行います。

```javascript
async function analyzeSearchLogs(days = 7) {
  try {
    // 直近n日間の検索ログを取得
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - days);
    
    const logs = await prisma.searchLog.findMany({
      where: {
        timestamp: {
          gte: recentDate
        }
      },
      include: {
        selected_result: true
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    // 頻出クエリの分析
    const queryFrequency = {};
    logs.forEach(log => {
      const query = log.query.toLowerCase().trim();
      queryFrequency[query] = (queryFrequency[query] || 0) + 1;
    });
    
    // 結果が選択されなかったクエリ
    const noSelectionQueries = logs.filter(log => !log.selected_result_id);
    
    // 改善提案の生成
    const suggestions = [];
    
    // 頻出クエリの改善提案
    const topQueries = Object.entries(queryFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    suggestions.push({
      type: 'frequent_queries',
      queries: topQueries,
      suggestion: '頻出クエリに対する専用のナレッジエントリの作成を検討してください。'
    });
    
    // 結果選択がないクエリの改善提案
    const topNoSelectionQueries = noSelectionQueries
      .map(log => log.query.toLowerCase().trim())
      .reduce((acc, query) => {
        acc[query] = (acc[query] || 0) + 1;
        return acc;
      }, {});
    
    const problematicQueries = Object.entries(topNoSelectionQueries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    suggestions.push({
      type: 'problematic_queries',
      queries: problematicQueries,
      suggestion: 'これらのクエリは検索結果が選択されていません。関連するナレッジの追加や検索アルゴリズムの調整を検討してください。'
    });
    
    return {
      total_searches: logs.length,
      frequency: topQueries,
      problematic_queries: problematicQueries,
      suggestions: suggestions
    };
  } catch (error) {
    console.error('検索ログの分析中にエラーが発生しました:', error);
    return { error: error.message };
  }
}
```

## 5. 実装計画

### フェーズ1: 基本改善（1-2日）
1. クエリ前処理の強化
2. 段階的な検索戦略の実装
3. スコアリングの基本改善

### フェーズ2: 高度な改善（3-5日）
1. 外車駐車など特定トピックの専用検索ロジック
2. 同義語展開の強化
3. 複合スコアリングの実装
4. カテゴリボーナスの実装

### フェーズ3: ログ機能実装（2-3日）
1. 検索クエリと結果のログ機能
2. ユーザーアクションのログ機能
3. ログ分析機能

### フェーズ4: テストと調整（1-2日）
1. テストスクリプトの拡充
2. 実際のクエリでのテスト
3. パラメータの最適化

## 6. 期待される成果

1. 「外車の駐車は可能ですか？」などの特定クエリに対する適切な回答率の向上
2. 検索結果の関連性スコアの正確性向上
3. ユーザー体験の向上（関連性の高い結果を上位に表示）
4. データ駆動型の継続的改善サイクルの確立

## 7. リスクと対策

1. **リスク**: PGroongaスコアが常に0.0000と表示される問題
   **対策**: PGroongaの設定確認とインデックスの再構築

2. **リスク**: 複雑なクエリ前処理による処理時間の増加
   **対策**: クエリキャッシュの導入とパフォーマンス最適化

3. **リスク**: データベースのインデックスサイズの増大
   **対策**: 定期的なインデックスのメンテナンスと最適化 
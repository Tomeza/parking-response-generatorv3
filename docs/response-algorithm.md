# 回答生成アルゴリズム仕様書

## 現行アルゴリズム（バージョン1.0）

### 1. 入力処理
1. **クエリの前処理**
   - 全角・半角の正規化
   - 不要な空白の削除
   - 特殊文字のエスケープ

2. **キーワード抽出**
   - 重要語の抽出
   - ストップワードの除去
   - 同義語の展開

### 2. アラート検出
1. **アラートワードのマッチング**
   ```sql
   SELECT * FROM alert_words 
   WHERE query LIKE '%' || word || '%'
   ORDER BY priority DESC;
   ```

2. **優先度判定**
   - 重要度1（国際線、帰国等）: 即時対応必要
   - 重要度2（満車、予約等）: 注意喚起
   - 重要度3（一般情報）: 参考情報

### 3. ナレッジ検索
1. **基本検索**
   ```sql
   SELECT * FROM knowledge 
   WHERE question ILIKE '%query%' 
      OR answer ILIKE '%query%'
   ORDER BY relevance DESC;
   ```

2. **カテゴリマッチング**
   - メインカテゴリの一致確認
   - サブカテゴリの一致確認
   - 詳細カテゴリの一致確認

3. **タグベース検索**
   ```sql
   SELECT k.* FROM knowledge k
   JOIN knowledge_tags kt ON k.id = kt.knowledge_id
   JOIN tags t ON kt.tag_id = t.id
   WHERE t.name = ANY($tags);
   ```

### 4. 回答生成
1. **テンプレート選択**
   - アラートレベルに応じたテンプレート
   - カテゴリに応じたテンプレート
   - デフォルトテンプレート

2. **回答構築**
   ```typescript
   const response = {
     alert: alertTemplate || '',
     mainAnswer: selectedKnowledge.answer,
     additionalInfo: relatedKnowledge.map(k => k.answer),
     suggestion: suggestionTemplate || ''
   };
   ```

3. **フォーマット調整**
   - 箇条書き変換
   - 改行位置の最適化
   - 文末表現の統一

## 改善計画（バージョン2.0）

### 1. 高度な検索アルゴリズム
1. **PostgreSQL全文検索**
   ```sql
   SELECT *, ts_rank(search_vector, query) as rank
   FROM knowledge
   WHERE search_vector @@ to_tsquery('japanese', $query)
   ORDER BY rank DESC;
   ```

2. **複合タグ処理**
   ```sql
   WITH tag_matches AS (
     SELECT knowledge_id, COUNT(*) as match_count
     FROM knowledge_tags
     WHERE tag_id = ANY($tags)
     GROUP BY knowledge_id
   )
   SELECT k.*, tm.match_count
   FROM knowledge k
   JOIN tag_matches tm ON k.id = tm.knowledge_id
   ORDER BY tm.match_count DESC;
   ```

3. **スコアリングアルゴリズム**
   ```typescript
   const score = {
     textMatch: 0.4,    // テキストマッチングのスコア
     tagMatch: 0.3,     // タグマッチングのスコア
     category: 0.2,     // カテゴリ一致のスコア
     recency: 0.1       // 最近の更新のスコア
   };
   ```

### 2. コンテキスト考慮
1. **日付・時期の検出**
   - 繁忙期判定
   - 営業時間考慮
   - 予約可能期間チェック

2. **ユーザーコンテキスト**
   - 過去の問い合わせ履歴
   - よくある質問パターン
   - 時間帯による回答調整

### 3. 回答最適化
1. **複数ナレッジの結合**
   ```typescript
   const optimizedAnswer = {
     mainPoint: primaryKnowledge.answer,
     details: relatedKnowledge.filter(k => !isRedundant(k)),
     examples: getRelevantExamples(),
     notes: getImportantNotes()
   };
   ```

2. **回答スタイル調整**
   - フォーマルレベルの調整
   - 文章の長さ最適化
   - 説明の詳細度調整

3. **品質チェック**
   - 矛盾した情報の検出
   - 必須情報の欠落チェック
   - 表現の一貫性確認

## 検証方法

### 1. 精度評価
```typescript
const metrics = {
  precision: matchedAnswers / totalAnswers,
  recall: correctAnswers / expectedAnswers,
  f1Score: 2 * (precision * recall) / (precision + recall)
};
```

### 2. 応答時間測定
```typescript
const performance = {
  queryProcessing: 'max 100ms',
  knowledgeSearch: 'max 200ms',
  responseGeneration: 'max 200ms',
  totalTime: 'max 500ms'
};
```

### 3. 品質評価
- 回答の正確性スコア（0-100）
- 文章の自然さスコア（0-100）
- ユーザー満足度評価（1-5）

## 今後の展望

### 1. AI統合
- Claude APIによる回答の洗練化
- 文脈理解の強化
- 自然な日本語生成

### 2. 学習システム
- フィードバックに基づく重み付け調整
- 回答パターンの自動学習
- 効果的な回答順序の最適化

### 3. パフォーマンス最適化
- キャッシュ戦略の実装
- インデックス最適化
- クエリの効率化 
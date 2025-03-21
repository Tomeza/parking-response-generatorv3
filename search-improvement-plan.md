# 検索機能改善計画

## 目的
データベースに存在する情報が、関連するクエリに対して適切に検索結果として表示されるようにする。

## 現状分析

### データベースの状況
- **Knowledgeテーブル**: 107件のレコード
  - アクセス (8件)
  - 予約関連 (24件)
  - 免責約款 (10件)
  - 利用の流れ (8件)
  - 利用制限 (3件)
  - 料金関連 (14件)
  - 記入情報 (6件)
  - 車両関連 (13件)
  - 送迎関連 (21件)

- **タグ**: 10個のタグが定義
  - 予約、料金、駐車場、送迎、支払い、車種、繁忙期、国際線、国内線、キャンセル
  - 各タグには同義語が設定されている（例：「駐車場」→「パーキング」）

### 問題点
- 「駐車場の予約方法について教えてください」というクエリには結果が得られるが、他のクエリ（「料金について知りたい」「営業時間はいつですか」など）では結果が得られない
- データベースには料金関連の情報（「支払い方法は何が使えますか？」など）やキャンセル関連の情報が存在するにもかかわらず、検索結果に表示されない
- 検索クエリと実際のデータの表現の違いがある
- 全文検索のマッチング精度が不十分
- 同義語展開が限定的

## 改善計画

### フェーズ1: 現状分析と問題特定

1. **検索ロジックの問題点特定**
   - 現在の検索ロジックでは、「料金について知りたい」というクエリが「支払い方法は何が使えますか？」などの関連エントリとマッチしていない
   - 同義語展開は機能しているが、クエリと実際のデータベースエントリの間のギャップを埋められていない
   - 全文検索のスコアリングが最適化されていない可能性がある

2. **テストクエリの作成**
   - データベースに存在する実際のエントリに基づいたテストクエリのセットを作成
   - 各カテゴリ（予約、料金、キャンセルなど）に対して複数のクエリバリエーションを用意

### フェーズ2: 同義語辞書の拡充

1. **同義語辞書の拡充**
   ```typescript
   // import-tags.tsの修正
   const synonyms = [
     // 既存の同義語
     { tag_name: '予約', synonym: '予約方法' },
     { tag_name: '予約', synonym: '予約手続き' },
     { tag_name: '予約', synonym: 'リザーブ' },
     // 追加する同義語
     { tag_name: '予約', synonym: '申し込み' },
     { tag_name: '予約', synonym: '申込' },
     { tag_name: '予約', synonym: '予約する' },
     
     // 既存の同義語
     { tag_name: '料金', synonym: '価格' },
     { tag_name: '料金', synonym: '費用' },
     { tag_name: '料金', synonym: 'コスト' },
     // 追加する同義語
     { tag_name: '料金', synonym: '値段' },
     { tag_name: '料金', synonym: '代金' },
     { tag_name: '料金', synonym: '金額' },
     
     // 既存の同義語
     { tag_name: '支払い', synonym: '精算' },
     { tag_name: '支払い', synonym: '会計' },
     // 追加する同義語
     { tag_name: '支払い', synonym: '支払方法' },
     { tag_name: '支払い', synonym: '決済' },
     { tag_name: '支払い', synonym: '支払う' },
     
     // キャンセル関連の同義語を追加
     { tag_name: 'キャンセル', synonym: '解約' },
     { tag_name: 'キャンセル', synonym: '取り消し' },
     { tag_name: 'キャンセル', synonym: 'キャンセルする' },
     
     // 営業時間関連のタグと同義語を追加
     { tag_name: '営業時間', synonym: '営業' },
     { tag_name: '営業時間', synonym: '開店時間' },
     { tag_name: '営業時間', synonym: '閉店時間' },
     { tag_name: '営業時間', synonym: '営業日' },
     
     // 既存の同義語（その他）
     { tag_name: '駐車場', synonym: 'パーキング' },
     { tag_name: '車種', synonym: '自動車' },
     { tag_name: '車種', synonym: '車' },
     { tag_name: '国際線', synonym: 'インターナショナル' },
     { tag_name: '国内線', synonym: 'ドメスティック' }
   ];
   ```

2. **新しいタグの追加**
   ```typescript
   // import-tags.tsの修正
   const tags = [
     // 既存のタグ
     { tag_name: '予約', description: '予約に関する情報' },
     { tag_name: '料金', description: '料金に関する情報' },
     { tag_name: '駐車場', description: '駐車場に関する情報' },
     { tag_name: '送迎', description: '送迎に関する情報' },
     { tag_name: '支払い', description: '支払いに関する情報' },
     { tag_name: '車種', description: '車種に関する情報' },
     { tag_name: '繁忙期', description: '繁忙期に関する情報' },
     { tag_name: '国際線', description: '国際線に関する情報' },
     { tag_name: '国内線', description: '国内線に関する情報' },
     { tag_name: 'キャンセル', description: 'キャンセルに関する情報' },
     // 追加するタグ
     { tag_name: '営業時間', description: '営業時間に関する情報' },
     { tag_name: '領収書', description: '領収書に関する情報' },
     { tag_name: '割引', description: '割引に関する情報' }
   ];
   ```

### フェーズ3: 検索アルゴリズムの調整

1. **キーワード抽出の改善**
   ```typescript
   // src/lib/search.tsの修正
   function extractKeyTerms(text: string): string[] {
     // 日本語の一般的なストップワード（既存のコード）
     const commonStopwords = [
       'です', 'ます', 'した', 'して', 'ください', 'お願い', 'いる', 'ある', 'れる', 'られる', 
       // ... 既存のストップワード
     ];
     
     // 文字列を分割（句読点、空白などで区切る）
     const segments = text.split(/[\s,、。．！？!?.]+/).filter(Boolean);
     
     // 重要な用語を抽出
     const terms = segments
       // 1文字以上の単語を抽出（2文字以上から変更）
       .filter(term => term.length >= 1)
       // ストップワードを除外
       .filter(term => !commonStopwords.includes(term))
       // 数字のみの単語を除外（ただし日付や時間の可能性があるものは保持）
       .filter(term => !/^\d+$/.test(term) || /\d+[月日時分]|\d+:\d+/.test(term))
       // 上位20語に制限（15語から増やす）
       .slice(0, 20);
     
     // 複合語の処理（既存のコード）
     if (segments.length >= 2) {
       for (let i = 0; i < segments.length - 1; i++) {
         const compound = segments[i] + segments[i + 1];
         if (compound.length >= 3 && compound.length <= 10) {
           terms.push(compound);
         }
       }
     }
     
     return terms;
   }
   ```

2. **特別な重要キーワードの拡充**
   ```typescript
   // src/lib/search.tsの修正
   function extractSpecialTerms(text: string): string[] {
     const specialKeywords = [
       // 既存のキーワード
       'オンライン', '駐車場', '予約', 'キャンセル', '料金', '支払い', '送迎', '車種', 'サイズ',
       '国際線', 'インターナショナル', '朝帰国', 'レクサス', '外車', 'BMW', 'ベンツ', 'アウディ',
       '満車', '空き', '定員', '人数', '繁忙期', '混雑', 'ピーク',
       // 追加するキーワード
       '営業時間', '営業', '開店', '閉店', '営業日', '休業日',
       '領収書', 'レシート', '明細', '証明書',
       '割引', 'クーポン', 'ディスカウント', '特典',
       '精算', '会計', '決済', 'カード', '現金', '電子マネー',
       '解約', '取り消し', '返金'
     ];
     
     // 以下は既存のコード
     const foundTerms: string[] = [];
     
     // 特別キーワードの検出
     specialKeywords.forEach(keyword => {
       if (text.includes(keyword)) {
         foundTerms.push(keyword);
       }
     });
     
     // 日付パターンの検出
     const datePatterns = [
       /\d+月\d+日/,
       /\d+\/\d+/,
       /\d+\-\d+/,
       /\d+年\d+月/
     ];
     
     datePatterns.forEach(pattern => {
       const match = text.match(pattern);
       if (match) {
         foundTerms.push(match[0]);
       }
     });
     
     return foundTerms;
   }
   ```

3. **カテゴリ情報を活用した検索強化**
   ```typescript
   // src/lib/search.tsの修正
   function boostWithCategories(terms: string[]): string[] {
     const boostedTerms = [...terms];
     
     // 予約に関する単語があれば「予約」カテゴリを追加
     if (terms.some(term => /予約|申込|申し込み|キャンセル|リザーブ/.test(term))) {
       boostedTerms.push('予約');
     }
     
     // 料金に関する単語があれば「料金」カテゴリを追加
     if (terms.some(term => /料金|価格|費用|支払い|決済|コスト|値段|代金|金額/.test(term))) {
       boostedTerms.push('料金');
     }
     
     // 駐車場に関する単語があれば「駐車場」カテゴリを追加
     if (terms.some(term => /駐車|車|パーキング/.test(term))) {
       boostedTerms.push('駐車場');
     }
     
     // 営業時間に関する単語があれば「営業時間」カテゴリを追加
     if (terms.some(term => /営業時間|営業|開店|閉店|営業日/.test(term))) {
       boostedTerms.push('営業時間');
     }
     
     // キャンセルに関する単語があれば「キャンセル」カテゴリを追加
     if (terms.some(term => /キャンセル|解約|取り消し|返金/.test(term))) {
       boostedTerms.push('キャンセル');
     }
     
     // 支払いに関する単語があれば「支払い」カテゴリを追加
     if (terms.some(term => /支払い|精算|会計|決済|カード|現金|電子マネー/.test(term))) {
       boostedTerms.push('支払い');
     }
     
     return boostedTerms;
   }
   ```

4. **検索スコアリングの調整**
   ```typescript
   // src/lib/search.tsの修正
   function calculateSearchScore(
     tsScore: number,
     simScore: number,
     tagScore: number,
     categoryScore: number
   ): number {
     // 重み付けを調整
     return (
       (tsScore * 0.3) +      // 全文検索スコア（30%）
       (simScore * 0.2) +     // 類似度スコア（20%）
       (tagScore * 0.3) +     // タグスコア（30%）
       (categoryScore * 0.2)  // カテゴリスコア（20%）
     );
   }
   ```

5. **基本検索の強化**
   ```typescript
   // src/lib/search.tsの修正 - searchKnowledge関数内
   // 方法1: Prismaクエリビルダーを使用した基本検索
   console.log('方法1: 基本検索');
   
   // 検索パターンを各キーワードに対して作成
   const searchPatterns = keyTerms.map(term => `%${term}%`);
   
   // 各キーワードに対してOR条件を作成
   const orConditions = [];
   for (const pattern of searchPatterns) {
     orConditions.push(
       { question: { contains: pattern, mode: 'insensitive' } },
       { answer: { contains: pattern, mode: 'insensitive' } },
       { main_category: { contains: pattern, mode: 'insensitive' } },
       { sub_category: { contains: pattern, mode: 'insensitive' } },
       { detail_category: { contains: pattern, mode: 'insensitive' } }
     );
   }
   
   const results1 = await prisma.knowledge.findMany({
     where: {
       OR: orConditions.flat()
     }
   });
   console.log('方法1の結果:', results1);
   ```

### フェーズ4: タグと知識エントリの関連付け強化

1. **タグと知識エントリの関連付けを強化**
   ```typescript
   // import-tags.tsの修正 - ナレッジとタグの関連付け部分
   // ナレッジとタグの関連付け
   const knowledgeEntries = await prisma.knowledge.findMany();
   
   for (const knowledge of knowledgeEntries) {
     // カテゴリに基づいてタグを関連付け
     const tagsToLink = [];
     
     // メインカテゴリに基づくタグ付け
     if (knowledge.main_category?.includes('予約')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: '予約' } });
       if (tag) tagsToLink.push(tag.id);
     }
     
     if (knowledge.main_category?.includes('料金')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: '料金' } });
       if (tag) tagsToLink.push(tag.id);
     }
     
     // サブカテゴリに基づくタグ付け
     if (knowledge.sub_category?.includes('支払')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: '支払い' } });
       if (tag) tagsToLink.push(tag.id);
     }
     
     if (knowledge.sub_category?.includes('キャンセル')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: 'キャンセル' } });
       if (tag) tagsToLink.push(tag.id);
     }
     
     if (knowledge.sub_category?.includes('領収書')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: '領収書' } });
       if (tag) tagsToLink.push(tag.id);
     }
     
     // 質問内容に基づくタグ付け（既存のコードに追加）
     const contentText = `${knowledge.question} ${knowledge.answer} ${knowledge.main_category} ${knowledge.sub_category} ${knowledge.detail_category}`.toLowerCase();
     
     // 支払い関連
     if (contentText.includes('支払') || contentText.includes('精算') || contentText.includes('会計') || 
         contentText.includes('決済') || contentText.includes('カード') || contentText.includes('現金')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: '支払い' } });
       if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
     }
     
     // 料金関連
     if (contentText.includes('料金') || contentText.includes('価格') || contentText.includes('費用') || 
         contentText.includes('コスト') || contentText.includes('値段') || contentText.includes('代金')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: '料金' } });
       if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
     }
     
     // キャンセル関連
     if (contentText.includes('キャンセル') || contentText.includes('解約') || contentText.includes('取り消し') || 
         contentText.includes('返金')) {
       const tag = await prisma.tag.findFirst({ where: { tag_name: 'キャンセル' } });
       if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
     }
     
     // タグを関連付け
     for (const tagId of tagsToLink) {
       await prisma.knowledgeTag.create({
         data: {
           knowledge_id: knowledge.id,
           tag_id: tagId
         }
       });
     }
   }
   ```

### フェーズ5: テストと評価

1. **テストスクリプトの拡充**
   ```typescript
   // test-search.tsの修正
   import { searchKnowledge } from './src/lib/search.js';

   async function testSearch() {
     try {
       const queries = [
         '駐車場の予約方法について教えてください',
         '料金について知りたい',
         '料金はいくらですか',
         '支払い方法は何がありますか',
         '支払いはどうすればいいですか',
         '営業時間はいつですか',
         '営業時間を教えてください',
         'キャンセル方法を教えてください',
         'キャンセルしたい場合はどうすればいいですか',
         '領収書はもらえますか',
         '領収書発行について教えてください'
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
   ```

2. **検索結果の評価**
   - 各テストクエリに対する検索結果を評価
   - 期待される結果が得られているかを確認
   - 必要に応じてさらに調整

### フェーズ6: 実装と検証

1. **変更の実装**
   - 上記の修正をコードに適用
   - タグデータを再インポート
   - 検索ベクトルを更新

2. **最終検証**
   - テストスクリプトを実行して結果を確認
   - 実際のユースケースに基づいたクエリでテスト
   - 必要に応じて微調整

## 実装計画

1. まず、同義語辞書とタグの拡充から始める（フェーズ2）
2. 次に、検索アルゴリズムの調整を行う（フェーズ3）
3. タグと知識エントリの関連付けを強化する（フェーズ4）
4. テストスクリプトを拡充して評価を行う（フェーズ5）
5. 最終的な検証と微調整を行う（フェーズ6）

## 期待される効果

- より多くのクエリに対して適切な検索結果が表示されるようになる
- 「料金について知りたい」などの一般的なクエリでも関連情報が検索できるようになる
- 同義語展開により、ユーザーが異なる表現を使っても関連情報を検索できるようになる
- タグベースの検索精度が向上し、より関連性の高い結果が表示されるようになる

## まとめ

検索機能の改善は、同義語辞書の拡充、検索アルゴリズムの調整、タグと知識エントリの関連付け強化の3つの主要な側面から行います。これらの改善により、ユーザーのクエリに対してより適切な検索結果を提供できるようになり、ユーザー体験の向上につながります。 
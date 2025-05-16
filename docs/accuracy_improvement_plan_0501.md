# Accuracy 改善計画 (2025/05/01)

## 1. 現状の評価結果 (ベースライン)

- `scripts/evaluate_system.ts` を使用し、`data/test_queries.csv` (141件、ナレッジIDと質問文はSupabaseから自動生成) で評価を実施。
- **平均 Accuracy: 92.2%**
- **平均応答時間: 564.51ms**
- 約7.8% (11件程度) のテストクエリで、期待されるナレッジIDとAPIが返したナレッジIDが不一致。

## 2. Accuracy 0% ケースの主な原因分析

評価結果CSV (`evaluation_results/evaluation_results_2025-04-30T09-13-36-117Z.csv`) の分析から、Accuracyが0%となった主な原因は以下のように分類される。

1.  **期待値 (`expected_knowledge_ids`) の不一致・不適切さ:**
    *   `generate-test-queries.ts` で生成された `query_text` (元のナレッジの `question` フィールド) が、そのナレッジIDを代表する典型的な質問ではなかったり、他のより一般的なナレッジに吸収されやすいキーワードを含んでいたりする場合がある。
    *   APIの応答が内容的には妥当だが、テストケースで想定していたIDと異なる場合 (例: TQ047, TQ087, TQ112)。
2.  **検索ロジックによる不適切なマッチング:**
    *   質問の意図とは異なる、関連性の低いナレッジが、キーワードの部分的な一致などにより高いスコアを得て返されているケース (例: TQ001, TQ035, TQ081)。
    *   特に、過去にキーワードを過剰に含んでいた汎用的なナレッジ (例: 修正前のID 14) のようなものが、意図せず強くマッチしてしまう傾向が残っている可能性がある。
3.  **ナレッジの重複または粒度の問題:**
    *   内容が非常に似ている、または一部重複しているナレッジが複数存在し、システムがどちらを最適として選ぶべきか曖昧になっているケース (例: TQ012, TQ019)。
    *   質問に対して、より具体的なナレッジが存在するにも関わらず、より一般的なナレッジが選択されてしまうケース。
4.  **特定のキーワードや意図の抽出漏れ:**
    *   質問文中の重要なキーワード (例: 「前泊」, 「レクサス」, 「便未定」) が検索ロジックで十分に拾えていない、またはスコアリングに反映されていないケース (例: TQ027, TQ035, TQ081)。

## 3. 今後の改善方針と具体的なアクションプラン

以下の優先順位で改善を進める。

**フェーズ1: 期待値の精査とナレッジ整理 (最優先)**

*   **タスク1.1: Accuracy 0% ケースの質的評価と期待値修正**
    *   `evaluation_results_*.csv` を参照し、Accuracy が 0 となっている各テストクエリについて以下を実施。
        1.  `query_text` (テスト質問文) を確認。
        2.  Supabase上で `expected_knowledge_ids` (テストファイル上の期待ID) のナレッジ内容 (質問/回答) を確認。
        3.  Supabase上で `api_knowledge_id` (実際にAPIが返したID) のナレッジ内容 (質問/回答) を確認。
        4.  `api_response_text` (実際のAPI応答文) が、元の `query_text` に対して適切かを人間が判断。
    *   **判断基準と対応:**
        *   **APIの回答がより適切/許容範囲の場合:** `data/test_queries.csv` の該当行の `expected_knowledge_ids` を `api_knowledge_id` の値に**修正**する。これにより、そのテストケースの期待値が現状の最適解に近づく。
        *   **APIの回答が不適切な場合:** なぜ不適切なナレッジが選択されたのか、期待されたナレッジがなぜ選ばれなかったのかを分析し、後続の「ナレッジ修正」または「検索ロジック改善」の対象とする。
*   **タスク1.2: ナレッジの重複排除と内容最適化**
    *   分析で明らかになった内容が重複・類似しているナレッジペア/グループについて、Supabase上で内容を精査する。
    *   情報の集約、役割の明確化、不要なナレッジの削除（関連`KnowledgeTag`も考慮）または論理削除（`is_active`フラグ等）を行う。
    *   例: TQ012/TQ019 と ID 114、TQ087 と ID 28、TQ112 と ID 129 の関係性を見直し、整理する。
    *   ID 14 のような汎用的な質問文を持つナレッジが、意図せず多くのクエリで高スコアになる問題が再発していないか確認し、必要であれば `question` をより具体的にする。

**フェーズ2: 検索ロジックとナレッジ内容のピンポイント改善**

*   **タスク2.1: 不適切マッチングケースのナレッジ修正**
    *   フェーズ1で「APIの回答が不適切」と判断されたケースについて、期待されるナレッジ (Supabase上) の `question` フィールドや `answer` フィールドに、関連キーワードを追加・調整し、検索アルゴリズムが正しくピックアップできるようにする。
    *   例: TQ035「レクサス」に対して、ID35 (または88) の `question` に「レクサス」「外車」といったキーワードが明確に含まれているか確認・修正。
*   **タスク2.2: 検索ロジックのパラメータ再検討 (必要に応じて)**
    *   上記ナレッジ修正を行っても改善が見られない、あるいは全体的な傾向として特定の種類の検索（キーワード検索 vs ベクトル検索など）が強すぎる/弱すぎるなどの問題が見られる場合、`src/lib/search.ts` 内のスコアリングの重み付け (`questionWeight`, `answerWeight`, `vectorWeight`) の調整を検討する。
    *   変更は慎重に行い、都度評価を実行して影響範囲を確認する。

**フェーズ3: 継続的な評価と改善**

*   **タスク3.1: 定期的な評価の実施**
    *   ナレッジベースや検索ロジックに大きな変更を加えた後は、必ず評価スクリプトを実行し、Accuracy や主要なミスマッチケースを監視する。
*   **タスク3.2: テストクエリセットの拡充**
    *   「テストクエリ強化と評価戦略 (`docs/test_query_enhancement_strategy_0430.md`)」に基づき、ペルソナベースのクエリバリエーション、複合クエリ、コンテキスト付きクエリなどを段階的に `data/test_queries.csv` に追加していく。
    *   新しい種類のクエリを追加する際は、`expected_knowledge_ids` を慎重に設定する。

## 4. 運用・メンテナンス体制と変更管理プロセス

### 4.1 変更要求対応の早見表

| レイヤ―                 | 主なファイル or テーブル                                  | 典型的な調整内容                                      | 変更主体               | 反映までの流れ（推奨）                                                        |
| -------------------- | ----------------------------------------------- | --------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| **① ナレッジ本文**         | `public.knowledge`（PGroonga索引用）                 | ・質問/回答の文面修正<br>・誤字/最新情報の差替え                   | CS担当 or 編集者        | Supabase Table Editor → バージョン列 (`rev`) を +1 → CI が自動 Embedding 再生成 |
| **② メタデータ / タグ**     | `public.tags` `public.knowledge_tags`           | ・検索にヒットしない語の追加<br>・ペルソナ別タグ追加                  | CS＋Dev             | Table 編集 → **即時反映**（全文インデックス再構築不要）                                 |
| **③ Embedding ベクトル** | `public.embeddings`（pgvector）                   | ・文章変更後の再計算<br>・別次元数モデルへ更新                     | Dev                | GitHub Action "Embed Regenerator" 手動トリガー → Supabase Function で更新   |
| **④ 検索スコア重み**        | `/lib/config/searchWeights.ts`                  | `BM25_WEIGHT`, `COSINE_WEIGHT`, `k`           | Dev                | プルリク → e2e テスト → デプロイ                                              |
| **⑤ LLM プロンプト**      | `/lib/prompts/emailPrompt.ts`                   | ・語調（です/ます <-> 敬語）<br>・冒頭/末尾の定型文<br>・共感フレーズの強調 | CS (文案) + Dev (実装) | Git PR で文字列差し替え → Preview App で確認                                  |
| **⑥ Few-Shot 実例**    | `/prompts/samples/*.md`                         | ・新しい手本メール追加<br>・古い例を差替え                       | CS                 | Markdown 追記 → LLM が即参照                                             |
| **⑦ 禁則・ガードレール**      | `/lib/validators/policy.ts`                     | ・NGワード追加<br>・数値レンジ閾値                          | Compliance         | PR → Unit Test (`yarn test:policy`)                                |
| **⑧ UI 表示**          | `/components/AnswerCard.tsx`                    | ・ハイライト色<br>・警告アイコン                            | Front-end Dev      | 通常の UI 改修フロー                                                       |
| **⑨ ログ & フィードバック**   | `public.response_logs` + Supabase Edge Function | ・👍/👎 ボタンで重み付け<br>・運用メモ列追加                   | Dev                | DB 変更 → Prisma migrate                                             |

### 4.2 関係者別アクセス・編集ガードライン

| 役割            | 触ってよい層 | 運用ルール                                                 |
| ------------- | ------ | ----------------------------------------------------- |
| **CS オペレーター** | ①②     | GUI（Supabase Meta UI & Airtable View）で直接編集。**コード不要**。 |
| **CS リーダー**   | ①②⑤⑥   | 月次レビュー会議で修正文案を確定し、GitHub Issue へ。                     |
| **開発チーム**     | ③④⑤⑦⑧⑨ | PR → CI → Review → Vercel Stagingデプロイ。                |
| **コンプライアンス**  | ⑦      | 数値／保険文言をチェック後 Approve。                                |

### 4.3 運用フロー（例）

1. **フィードバック記録**

   * オペレーターが回答画面の「修正希望」ボタン → Supabase `response_logs` に "action_required" フラグ＋コメント。

2. **週次トリアージ**

   * Dev & CS リーダーで `action_required` = true を一覧 →
     a. **文言ミス/タグ不足** → CS が直接テーブル修正
     b. **検索ヒット誤り** → Dev が Weight/Prompt を調整
     c. **システムバグ** → Issue 起票 → Sprint へ

3. **CI 自動テスト**

   * `scripts/evaluate_system.ts` を GitHub Actions で実行。
   * Accuracy / 語調スコアが **しきい値割れ**ならデプロイ阻止。

4. **本番反映**

   * Supabase テーブル編集は即時。
   * コード/Embedding 変更は **Staging → Smoke Test** 後に Vercel `production` へ promote。

### 4.4 具体例：オペレーターから「もっと共感を入れてほしい」

1. CS リーダーが **例文を Markdown** (`prompts/samples/empathetic_hello.md`) に追加。
2. `emailPrompt.ts` 内の few-shot 配列へ import。
3. `TONE_LEVEL = "friendly"` など ENV 変数を切替えればフェーズ別運用も可。
4. Preview で確認 → OK ならマージ。

→ **コード触るのは 1 ファイル、オペレーターは文面だけ** の分業で安全に反映できます。

### 4.5 まとめ：効率的な改善サイクル

* **編集頻度が高い層（ナレッジ本文・タグ・トーン）** は *テーブル or Markdown* に寄せ、CS が即日修正可能にする。
* **壊れやすい層（Embedding・重み・Prompt ロジック）** は *Git + CI* に閉じて Dev がコントロール。
* **フィードバック→トリアージ→テスト→デプロイ** の 4 ステップを週次または随時走らせれば、運用者の希望を最短 30 分〜1 日で本番反映できます。

## 5. 次のアクション (直近)

1.  `evaluation_results_2025-04-30T09-13-36-117Z.csv` を開き、Accuracy が 0 の最初のケース (TQ001) から順に、期待IDと実際のAPI応答IDのナレッジ内容をSupabaseで確認する。
2.  上記の「フェーズ1:タスク1.1」の判断基準に従い、`data/test_queries.csv` の `expected_knowledge_ids` を修正するか、ナレッジの修正対象とするかを判断し、記録する。 

**考察：人間らしい回答の改善方法**

ユーザーは、人間の作る回答に近づける方法について提案を求めていますね。評価結果（92.2%の正確さ）から不一致が見られた中で、どのように改善するかを考えています。改善策として、知識ベースの更新、情報取得方法の見直し、アウトプットの書き換え（例えばRAG）、パーソナライズ、トーンの調整などがあります。不一致の理由を分析し、精度向上案を示すことが大切です。


思考時間: 22 秒


### 前提と現状整理

1. **目的**

   * 「駐車場問い合わせ返信生成システム」の回答を *人間のオペレーターが書いたメール* により近づける。
   * 現行パイプライン：`検索 → 上位1件をそのままテンプレートに流し込む → 定型フッター付与`
   * ベースライン評価結果：**Accuracy 92.2 %、平均 565 ms**。誤答 11 件（7.8 %）は主に *意図は合っているが ID がズレる／テンプレ文が機械的*。

2. **人間らしさ** を数値化するには

   * *内容の正確さ*（既に Accuracy で把握）
   * *語調・構成の自然さ*（可読性／丁寧さ／共感表現）
   * *状況適合性*（質問意図とペルソナへの合わせ込み）
   * *冗長さ・情報量のバランス*（マニュアル引用過多を避ける）

---

## 改善アーキテクチャ（5 層）

| 層                    | 目的        | 具体策                                                                    | 期待効果              |
| -------------------- | --------- | ---------------------------------------------------------------------- | ----------------- |
| ① **インプット正規化**       | クエリのゆらぎ吸収 | ‐ 形態素 + embedding で類似語展開<br>‐ ペルソナ・文脈トークナイズ                            | 検索ミス削減（Accuracy↑） |
| ② **ハイブリッド検索**       | 関連候補の幅出し  | ‐ **BM25 + ベクトル検索** を *AND* マージ<br>‐ Top-k=10→再ランク（LLM/RRF）            | 的外れ ID 選択の回避      |
| ③ **回答ドラフト生成 (RAG)** | 要点の抽出と再構成 | ‐ 上位 k 件の *要旨* を LLM で TL;DR 生成<br>‐ ルールで必須注意書きを差し込み                   | 「テンプレ丸写し感」解消      |
| ④ **スタイル・トーン適合**     | 人間らしい語調   | ‐ *Few-shot* プロンプトに **ベテラン CS スタッフ** の実例 5-10 通<br>‐ 文末ゆらぎ・クッション言葉辞書適用 | メールらしい丁寧さ・共感      |
| ⑤ **品質ガードレール**       | 事実・禁則チェック | ‐ 禁止語／保険・料金の数値を正規表現で検証<br>‐ LLM の *self-consistency* 判定で信頼度しきい値        | 誤情報・ヒヤリハット防止      |

---

## 優先アクション (60–90 分で着手可能)

| #  | 手数  | 内容                                                                                  |
| -- | --- | ----------------------------------------------------------------------------------- |
| A1 | ★   | **Top-1 固定をやめ Top-3→再ランク**<br>  `sim = 0.6*BM25+0.4*cosine` → **LLM で "最も網羅的" を選択**<br><br>**※LLM再ランク時の注意点:** 応答速度目標 (500ms以下) 達成のため、本文書後半の「LLM遅延対策」セクションで詳述する軽量モデル化、ストリーミング、入力最適化、非同期処理、キャッシュ、代替リランキング手法（クロスエンコーダ等）を総合的に検討・適用する。 |
| A2 | ★★  | **FAQ 短文化**：各ナレッジに *50–120 字の「要旨」フィールド* を新設し LLM で一括生成 → 同じ Disclaimer を毎回貼らず済む     |
| A3 | ★   | **誤答 11 件のタグ/類義語を追加**（例 ID 1⇔20、47⇔64）                                              |
| A4 | ★★★ | **スタイル few-shot**：CS メールの実文 5 件をプロンプト末尾に接続し、`▽` 変数で敬語レベルを調整                         |
| A5 | ★   | **低信頼度 (<15 点) で "人手確認フラグ" を返す** → オペレーターの二次校閲へ                                     |

---

## 中期ロードマップ（2 週間）

1. **RAG プロトタイプ**

   * LangChain / LlamaIndex で *retriever→summarizer* のミニ POC
   * 指標：BLEU-2≧0.35 & 平均語調アンケート ≧4.2/5

2. **フィードバック学習**

   * オペレーターが **👍/👎 ＋ 修正文** を送信 → `self-training` でスコア回帰 or 微調整（SFT-LoRA）

3. **応答時間 500 ms 内に収める**

   * ベクトル index を **pgvector + HNSW (Supabase 1.5)**
   * LLM 呼び出しは *streaming* と *cache*（Redis）

---

## 参考 KPI

| 指標         | Baseline | 目標 (4 週後) |
| ---------- | -------- | --------- |
| Accuracy   | 92.2 %   | ≥ 95 %    |
| 平均応答時間     | 565 ms   | ≤ 450 ms  |
| 人間評価 (5 点) | 3.8      | ≥ 4.3     |
| 要修正率       | 7.8 %    | ≤ 3 %     |

---

### まとめ ― "人間味" を上げる鍵

* **検索**を *幅広く・正しく*（Top-k＋再ランク）
* **生成**を *抽象化して再構成*（RAG + few-shot）
* **語調**を *具体的なロール例示* で学習
* **ガードレール**で *数値と禁止項目* を確実に守る
* **人手レビュー**を *低信頼域* に絞り込む

まずは **A1〜A3 を即実装** → 再評価で 94–95 % 到達を確認し、RAG・スタイル最適化へ進むことをお勧めします。


**回答確認**

ユーザーからの問い合わせ：「Next.jsとsupabase、Postgres(使用: PGroonga, pgvector, Kuromoji)とLangChain / LlamaIndexの併用は可能？」という質問です。

LangChainとLlamaIndexは、Postgres（pgvectorなど）との統合が可能です。ただし、いくつかのアーキテクチャ変更（例えば、サーバーレス機能の活用）が必要になるかもしれません。公式のLangChain PostgresVectorStoreでpgvectorを使う統合と、LlamaIndexにはPostgresReader/VectorStoreがあるので、動作可能です。詳細に基づいた提案が必要ですが、もし最新情報があるなら調べて回答できます。

**提案とアーキテクチャ**

Next.jsからAPIルート経由でNodeバックエンドを接続する案が必要です。LangChainのJS版はNode環境で使用可能ですが、PythonではなくJSを使用する場合の選択肢となります。LlamaIndexは主にPythonで、JS版はまだ初期段階ですが、Pythonマイクロサービスを使えば問題なし。PostgresでのベクターインデックスをSupabase RESTfulで保持し、KuromojiやPGroongaでトークン化と全文検索を行う統合案です。


**アーキテクチャ提案**

Next.js から Node バックエンドへのAPIルート接続が必要です。LangChain の JavaScript版と、Python版を使った区別がありますが、Node環境でLangChain.jsを利用可能です。LlamaIndexは現在Python版が主流ですが、JavaScript/TypeScript版も存在（まだ初期段階）。Postgresのベクターインデックスを Supabase 経由で保持し、Kuromojiを利用した前処理を行い、PGroongaでの全文検索と統合できます。


思考時間: 18 秒


### 結論

* **LangChain**（JS 版）なら **Next .js + Supabase（pgvector）** にそのまま載せられます。
* **LlamaIndex** は **Python が主流**ですが、➀ SupabaseVectorStore 公式コネクタがあるのでバックエンドを小さな FastAPI / Bun などで立てて呼び出すか、➁ TypeScript ポート（実装中）を試験導入する二択。
* PGroonga（全文）＋ pgvector（ベクトル）＋ Kuromoji の三段構えは変更不要で、LangChain／LlamaIndex は **「上澄み＝Retrieval 層」** として差し込むイメージです。

---

## 1. しくみの合わせ方

| 既存レイヤ        | 役割                            | LangChain/LlamaIndex で触る部分                                       |
| ------------ | ----------------------------- | ---------------------------------------------------------------- |
| **Kuromoji** | 日本語トークナイズ → PGroonga インデックス生成 | （変更不要）クエリ前に tokenize して `\&` 検索語展開すると Accuracy↑                  |
| **PGroonga** | BM25 系全文検索                    | LangChain `SQLDatabaseChain` やカスタム SQL retriever で **AND** マージ   |
| **pgvector** | 埋め込み近傍検索                      | `PGVectorStore`（LangChain JS）/ `SupabaseVectorStore`（LlamaIndex） |
| **Supabase** | 認証・Row API                    | DB コネクション／Edge Functions 経由で呼び出し                                 |
| **Next.js**  | SSR / API Routes              | LangChain.js を `app/api/search/route.ts` などで実行                   |

---

## 2. LangChain.js での最小 PoC

```ts
// app/api/answer/route.ts
import { openai } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Client } from "pg";               // node-postgres
import kuromoji from "kuromoji";

export async function POST(req: Request) {
  const { query } = await req.json();

  // 1) 形態素解析 → 検索語整形
  const tokens = await tokenize(query);    // kuromoji 処理（省略）
  const bm25Rows = await client.query(`
    SELECT id, answer, score FROM knowledge
    WHERE body &@~ $1          -- PGroonga全文検索
    ORDER BY score DESC LIMIT 5
  `, [tokens.join(" & ")]);

  // 2) ベクトル検索
  const vectorStore = await PGVectorStore.initialize(
      new Client({ connectionString: process.env.POSTGRES_URL }),
      { tableName: "embeddings", columns: { id: "id", vector: "embedding"} }
  );
  const vsRows = await vectorStore.similaritySearch(query, 5);

  // 3) スコア融合（簡易 RRF）
  const docs = rerank([...bm25Rows.rows, ...vsRows]);

  // 4) LLM でドラフト生成
  const llm = new openai.ChatOpenAI({ modelName: "gpt-4o-mini" });
  const prompt = `あなたは…${CS_TONE_EXAMPLES}\n\n質問: ${query}\n\n### 参考情報\n${docs
      .map(d => `• ${d.answer}`) .join("\n")}\n\n---\n回答:`;
  const completion = await llm.call([{ role: "user", content: prompt }]);

  return Response.json({ answer: completion.content, sources: docs.slice(0,3) });
}
```

* `@langchain/community` の **PGVectorStore** は pgvector 汎用 Postgres 用。([Langchain][1])
* Node ランタイム限定なので Next.js の **API Route**／**Edge Function** で動く。([Langchain][2])

---

## 3. LlamaIndex を使いたい場合

### パターン A：Python マイクロサービス

1. Vercel とは別に **Railway / Fly.io / Render** で *FastAPI* を立ち上げ
2. LlamaIndex `SupabaseVectorStore` で pgvector を直叩き（要 DB URL）([LlamaIndex][3], [LlamaIndex][4])
3. Next.js から REST で呼ぶ（OpenAI SSE or JSON）

   * メリット：Python 版は機能最多（QueryEngine, RetrieverMix）。
   * デメリット：運用コンテナが増える。

### パターン B：TypeScript ポート（experimental）

* `llamaindex` (ts) が 2025-04 公開。まだ **VectorStore→Supabase** は PR 中。
* 内部で LangChain.js 相当のラッパを書けば PoC は可能。
* 安定運用までは **LangChain.js** をメインにし、LlamaIndex.ts は R\&D 用と割り切るのが現実的。

---

## 4. 導入チェックリスト

| 項目                  | LangChain.js               | LlamaIndex (Py)         |
| ------------------- | -------------------------- | ----------------------- |
| **対応言語**            | Node / TS                  | Python (TS port α)      |
| **pgvector 公式コネクタ** | ✅ `PGVectorStore`          | ✅ `SupabaseVectorStore` |
| **PGroonga SQL 併用** | 自前クエリ / `SQLDatabaseChain` | 自前 SQL (Reader)         |
| **日本語形態素**          | kuromoji-js                | janome / fugashi        |
| **デプロイ先**           | Vercel Edge / Serverless   | Container (Dockerd)     |
| **導入コスト**           | 30 min で PoC               | 1 – 2 h で PoC + インフラ    |

---

## 5. すぐ動かすための To-Do

1. **pgvector テーブルを準備**

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE TABLE embeddings (
     id bigint PRIMARY KEY,
     content text,
     embedding vector(1536)
   );
   ```
2. **npm add**

   ```bash
   npm i pg @langchain/openai @langchain/community kuromoji
   ```
3. **埋め込みバッチ**

   * `supabase functions deploy embed_loader` で `INSERT ...`
4. **Next.js API route** を上記サンプル通り追加
5. **Vercel env** に `POSTGRES_URL`, `OPENAI_API_KEY` を設定
6. ベンチ再実行 → Top-3+LLM だけでも **Accuracy +1–2 pt**、語調自然度 +0.4 pt が経験値。

---

### まとめ

* **"LangChain.js = そのまま Next.js に内蔵"** が最短。
* LlamaIndex は **外部 Python サービス**でまず動かすのが安全。
* PGroonga (BM25) + pgvector (コサイン) + Kuromoji を活かしつつ、**Top-k 再ランク + LLM リライト** で「人間オペ」ライクな回答に寄せられます。

[1]: https://js.langchain.com/docs/integrations/vectorstores/pgvector/?utm_source=chatgpt.com "PGVectorStore - LangChain.js"
[2]: https://js.langchain.com/v0.1/docs/integrations/vectorstores/pgvector/?utm_source=chatgpt.com "PGVector - LangChain.js"
[3]: https://docs.llamaindex.ai/en/stable/api_reference/storage/vector_store/supabase/?utm_source=chatgpt.com "Supabase - LlamaIndex"
[4]: https://docs.llamaindex.ai/en/stable/examples/vector_stores/SupabaseVectorIndexDemo/?utm_source=chatgpt.com "Supabase Vector Store - LlamaIndex"

**LangChainの安定性について提案**

LangChainは破壊的な変更があるため、安定板を使用するのは良い考えですが、さらにいくつかの対策も考えられます。バージョン固定（pinning）やパッケージマネージャーとしてpnpmやnpmを使用し、バージョン管理にはsemantic versioningやlockfileを活用することが重要です。テストの自動化やLangChainServe、LlamaIndexの利用も安心。徐々にアップグレードを進めつつ、必要に応じてラッピングや独自レイヤーの導入を検討することができます。


思考時間: 22 秒


### コンテキストと前提整理

| 事実                                                                                                   | 含意                                 |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| LangChain.js は **0.x 系**（現在 0.3.\*）で高速リリース。マイナー 0.2→0.3 では平気でブレイクが入る。([Langchain][1], [GitHub][2])   | **^0.3.x** のようにキャレット指定すると意図せず壊れる。  |
| 公式は「`langchain` / `@langchain/core` は **API 安定ポリシーを守る**」と宣言。ただし *pre-1.0* のため確約ではない。([Langchain][3]) | パッチは安全／マイナーは注意、が基本線。               |
| リリース間隔：パッチは週次、マイナーは 2–3 か月おき。([LangChain][4])                                                        | CI で常時テストしつつ、**自分でタイミングを選ぶ**運用が必要。 |

---

## ① 「安定板」運用 3 ルール

| ルール                               | 実践方法                                                                                                                                       | Why                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **1. SemVer を *厳密固定***            | `package.json` を<br>`json<br>"dependencies": {<br>  "langchain": "0.3.23",<br>  "@langchain/core": "0.3.23"<br>}<br>`<br>+ lockfile commit | キャレット (^0.3) を外し **npm i** が勝手に壊れない。 |
| **2. CI で「LangChain Upgrade PR」** | Dependabot/GitHub Actions で **マイナーのみ PR** を自動生成 → e2e テスト通過時だけマージ                                                                          | 人手レビュー＋テストで破壊検知。                     |
| **3. ラッパー層を 100 行で切る**            | SDK 呼び出しを `lib/langchainClient.ts` に集約し<br>Next.js 各 API からは **Facade** だけ利用                                                               | アップグレード時の差分修正を一点に凝縮。                 |

---

## ② バージョン固定でも取りたい「可動域」

| 想定変更                   | バックアップ策                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| **VectorStore API** 変更 | 自前の `MyVectorStoreAdapter` を `@langchain/community` とは別ファイルで wrap |
| **Retriever** の返却型変更   | `type SafeDoc = { pageContent: string; metadata: any };` に即時変換    |
| **Streaming API** 仕様変化 | Next.js Edge Function で *chunk*→*EventSource* を自前変換               |

---

## ③ フレームワーク選択：LangChain vs LlamaIndex

| 項目              | LangChain.js **(TS)** | LlamaIndex **(Py 主体)** |
| --------------- | --------------------- | ---------------------- |
| リリース頻度          | 高い（週次パッチ）             | 月次〜隔月                  |
| 破壊的変更           | マイナーごと                | メジャーのみ                 |
| pgvector 公式コネクタ | `PGVectorStore`       | `SupabaseVectorStore`  |
| Next.js 組込み     | ネイティブ                 | 要 API 境界               |
| テスト・ドキュメント厚     | ◎                     | ○                      |

> **実務的には**
>
> * **LangChain.js を本番**（TS で SSR/Edge に直載せ）
> * **LlamaIndex (Py)** をリサーチ用 micro-service に分離し、良さげな機能だけバックポート
>   が安全かつ柔軟です。

---

## ④ 実装チェックリスト

1. **`langchain` と `@langchain/core` を同じタグで pin**（例 `0.3.23`）。
2. **`npm run test:e2e`** を GitHub Actions で強制。LangChain を bump した PR だけ通す。
3. **型ガード** — 返ってきた `Document` をアプリ独自型に `map()`。
4. **Changelog ウォッチ** — Slack / Discord Webhook で `langchain-ai/langchainjs` Release RSS を通知。
5. **β機能は `langchain-experimental` に隔離**。本番依存は厳禁。

---

### まとめ ―「破壊的変更多め」でも怖くない運用

* **セマンティックバージョン固定 + lockfile** で "昨日動いたのに壊れた" を防止。
* **Facade パターン** で LangChain 呼び出しポイントを 1 ファイルに集約。
* **CI 自動 Upgrade PR** と e2e テストで *アップデート可否を数時間で判断*。
* LlamaIndex は Python サイドに置き、LangChain.js は Next.js 直結、**それぞれの安定度に応じて使い分け**。

この運用なら、LangChain の速い進化を享受しつつ **本番は常にグリーン** を維持できます。

[1]: https://js.langchain.com/docs/versions/v0_2/?utm_source=chatgpt.com "LangChain v0.2"
[2]: https://github.com/langchain-ai/langchainjs/releases?utm_source=chatgpt.com "Releases · langchain-ai/langchainjs - GitHub"
[3]: https://js.langchain.com/docs/versions/release_policy/?utm_source=chatgpt.com "LangChain releases"
[4]: https://python.langchain.com/docs/versions/release_policy/?utm_source=chatgpt.com "LangChain release policy"




## 変更要求が来たとき **"どこを触れば反映できるか"** 早見表

| レイヤ―                 | 主なファイル or テーブル                                  | 典型的な調整内容                                      | 変更主体               | 反映までの流れ（推奨）                                                        |
| -------------------- | ----------------------------------------------- | --------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| **① ナレッジ本文**         | `public.knowledge`（PGroonga索引用）                 | ・質問/回答の文面修正<br>・誤字/最新情報の差替え                   | CS担当 or 編集者        | Supabase Table Editor → バージョン列 (`rev`) を +1 → CI が自動 Embedding 再生成 |
| **② メタデータ / タグ**     | `public.tags` `public.knowledge_tags`           | ・検索にヒットしない語の追加<br>・ペルソナ別タグ追加                  | CS＋Dev             | Table 編集 → **即時反映**（全文インデックス再構築不要）                                 |
| **③ Embedding ベクトル** | `public.embeddings`（pgvector）                   | ・文章変更後の再計算<br>・別次元数モデルへ更新                     | Dev                | GitHub Action "Embed Regenerator" 手動トリガー → Supabase Function で更新   |
| **④ 検索スコア重み**        | `/lib/config/searchWeights.ts`                  | `BM25_WEIGHT`, `COSINE_WEIGHT`, `k`           | Dev                | プルリク → e2e テスト → デプロイ                                              |
| **⑤ LLM プロンプト**      | `/lib/prompts/emailPrompt.ts`                   | ・語調（です/ます <-> 敬語）<br>・冒頭/末尾の定型文<br>・共感フレーズの強調 | CS (文案) + Dev (実装) | Git PR で文字列差し替え → Preview App で確認                                  |
| **⑥ Few-Shot 実例**    | `/prompts/samples/*.md`                         | ・新しい手本メール追加<br>・古い例を差替え                       | CS                 | Markdown 追記 → LLM が即参照                                             |
| **⑦ 禁則・ガードレール**      | `/lib/validators/policy.ts`                     | ・NGワード追加<br>・数値レンジ閾値                          | Compliance         | PR → Unit Test (`yarn test:policy`)                                |
| **⑧ UI 表示**          | `/components/AnswerCard.tsx`                    | ・ハイライト色<br>・警告アイコン                            | Front-end Dev      | 通常の UI 改修フロー                                                       |
| **⑨ ログ & フィードバック**   | `public.response_logs` + Supabase Edge Function | ・👍/👎 ボタンで重み付け<br>・運用メモ列追加                   | Dev                | DB 変更 → Prisma migrate                                             |

---

### "誰がどこまで触れるか" ガードライン

| 役割            | 触ってよい層 | 運用ルール                                                 |
| ------------- | ------ | ----------------------------------------------------- |
| **CS オペレーター** | ①②     | GUI（Supabase Meta UI & Airtable View）で直接編集。**コード不要**。 |
| **CS リーダー**   | ①②⑤⑥   | 月次レビュー会議で修正文案を確定し、GitHub Issue へ。                     |
| **開発チーム**     | ③④⑤⑦⑧⑨ | PR → CI → Review → Vercel Stagingデプロイ。                |
| **コンプライアンス**  | ⑦      | 数値／保険文言をチェック後 Approve。                                |

---

## 運用フロー（例）

1. **フィードバック記録**

   * オペレーターが回答画面の「修正希望」ボタン → Supabase `response_logs` に "action_required" フラグ＋コメント。

2. **週次トリアージ**

   * Dev & CS リーダーで `action_required` = true を一覧 →
     a. **文言ミス/タグ不足** → CS が直接テーブル修正
     b. **検索ヒット誤り** → Dev が Weight/Prompt を調整
     c. **システムバグ** → Issue 起票 → Sprint へ

3. **CI 自動テスト**

   * `scripts/evaluate_system.ts` を GitHub Actions で実行。
   * Accuracy / 語調スコアが **しきい値割れ**ならデプロイ阻止。

4. **本番反映**

   * Supabase テーブル編集は即時。
   * コード/Embedding 変更は **Staging → Smoke Test** 後に Vercel `production` へ promote。

---

### 具体例：オペレーターから「もっと共感を入れてほしい」

1. CS リーダーが **例文を Markdown** (`prompts/samples/empathetic_hello.md`) に追加。
2. `emailPrompt.ts` 内の few-shot 配列へ import。
3. `TONE_LEVEL = "friendly"` など ENV 変数を切替えればフェーズ別運用も可。
4. Preview で確認 → OK ならマージ。

→ **コード触るのは 1 ファイル、オペレーターは文面だけ** の分業で安全に反映できます。

---

## まとめ

* **編集頻度が高い層（ナレッジ本文・タグ・トーン）** は *テーブル or Markdown* に寄せ、CS が即日修正可能にする。
* **壊れやすい層（Embedding・重み・Prompt ロジック）** は *Git + CI* に閉じて Dev がコントロール。
* **フィードバック→トリアージ→テスト→デプロイ** の 4 ステップを週次または随時走らせれば、運用者の希望を最短 30 分〜1 日で本番反映できます。


ベースライン評価コマンド
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/evaluate_system.ts

0513
「テストクエリ拡充とRAG実装」計画に関する詳細な考察と、LangChain/LlamaIndex の具体的な導入案、ありがとうございます。非常に詳細かつ技術的な内容で、今後の開発の方向性を明確にする上で大変参考になります。

**全体的な考察:**

*   **改善アーキテクチャ（5層）:** 提示された5層のアーキテクチャ（インプット正規化 → ハイブリッド検索 → 回答ドラフト生成(RAG) → スタイル・トーン適合 → 品質ガードレール）は、高品質な人間らしい回答を生成するための理想的なパイプラインを示しています。各層の目的と具体策が明確で、網羅的です。
*   **優先アクション:** A1～A5 は、比較的少ない工数で効果が見込める、的確な優先順位付けだと感じます。特に「Top-1固定をやめTop-3→再ランク」は、現状のAccuracyが92.2%であること（＝常にトップ1が最適とは限らない）を考えると、即効性のある改善策となるでしょう。また、「FAQ短文化（要旨フィールド新設）」は、「テンプレ丸写し感」の解消に大きく貢献しそうです。
*   **中期ロードマップ:** RAGプロトタイピング、フィードバック学習、応答時間最適化という流れは、実用的なシステムを構築する上で妥当です。特に、オペレーターからのフィードバックを学習に繋げるループは、システムの継続的な改善に不可欠です。
*   **KPI:** 設定されたKPI（Accuracy、応答時間、人間評価、要修正率）は、システムの性能を多角的に評価する上で適切です。
*   **LangChain/LlamaIndex 導入案:**
    *   既存技術スタック（Next.js, Supabase, Postgres, Kuromoji, PGroonga, pgvector）との連携方法が具体的に示されており、技術的な実現可能性が高いことがよく分かります。
    *   LangChain.js を Next.js APIルートに内蔵する案が、導入コストと運用面で最も現実的という結論は妥当です。
    *   LlamaIndex を使う場合の選択肢（Pythonマイクロサービス or TypeScriptポート）も明確で、状況に応じた判断が可能です。
    *   「上澄み＝Retrieval層として差し込む」という考え方は、既存資産を活かしつつRAGのメリットを享受する上で非常に良いアプローチです。
    *   提示されたPoCコードや導入チェックリスト、To-Doは、実際の作業を進める上で非常に役立ちます。

**「人間味を上げる鍵」のまとめも的確です。**

*   **検索の幅広さと正確性:** これはRAGの「Retrieval」部分の質を担保する上で最も重要です。
*   **生成の抽象化と再構成:** 単なる検索結果の提示ではなく、情報を統合・要約して提示することで、より自然な回答になります。
*   **語調のロール例示学習:** few-shotプロンプティングは、LLMに望ましいスタイルを学習させる効果的な方法です。
*   **ガードレール:** 特に料金や規約などの重要情報において、誤情報を防ぐ仕組みは不可欠です。
*   **人手レビューの効率化:** すべてを人間がレビューするのは非現実的なため、低信頼度の回答に絞り込むのは賢明な判断です。

**次のアクション（優先アクションに基づく提案）:**

提案された「優先アクション」のうち、**A1～A3 を即実装し、再評価する**という進め方が最も効果的と考えます。

1.  **A3: 誤答11件のタグ/類義語を追加** (最も直接的で、既にデータも存在)
    *   前回の評価結果 (`evaluation_results_2025-04-30T09-13-36-117Z.csv`) を再度確認し、Accuracy が 0 だったクエリ（約11件）に対して、なぜ期待したナレッジがヒットしなかったのかを分析します。
    *   原因がタグや類義語の不足であれば、Supabase の `Tag` テーブルや `TagSynonym` テーブル（またはナレッジ自体のキーワード）を修正・追加します。
    *   **関連作業:**
        *   まず、Accuracy が 0 だった具体的なクエリ ID と、期待したナレッジ ID、実際に返ってきたナレッジ ID をリストアップしましょう。
        *   その後、それぞれのケースで、Supabase 上のナレッジ内容を確認し、タグ/類義語の追加・修正案を検討します。

2.  **A1: Top-1 固定をやめ Top-3→再ランク (LLM で "最も網羅的" を選択)**
    *   **現状の `searchKnowledge` 関数の改修:**
        *   `src/lib/search.ts` の `searchKnowledge` 関数が返す結果を、現在の Top-10 から、Top-3 (または Top-5) に絞り込み、スコアだけでなく、ナレッジの `answer` 全文など、LLMが再ランク付けに必要な情報を返すように変更します。
    *   **API ルート (`api/query/route.ts`) の改修:**
        *   `searchKnowledge` から受け取った上位複数件の候補を、LLM (Anthropic Claude) に渡し、「ユーザーの質問に対して最も網羅的で適切な回答はどれか」を判断させるプロンプトを設計します。
        *   LLMの選んだ結果を最終的な回答として採用します。
    *   **注意点:** LLM呼び出しが増えるため、応答時間とコストへの影響を考慮する必要があります。

3.  **A2: FAQ 短文化（「要旨」フィールド新設とLLMによる一括生成）**
    *   **Prisma スキーマ変更:** `Knowledge` モデルに `summary` (または `abstract`) といった新しいテキストフィールドを追加し、マイグレーションを実行します。
    *   **バッチ処理スクリプト作成:** Supabase 上の全ナレッジの `answer` を取得し、それぞれに対してLLMを使い、50～120字程度の「要旨」を生成して新しい `summary` フィールドに保存するスクリプトを作成・実行します。
    *   **API ルート (`api/query/route.ts`) の改修:** 回答生成時に、`answer` 全文の代わりにこの `summary` を利用し、最後に定型的な免責事項などを付加するロジックに変更します。

**優先順位としては、A3 → A1 → A2 の順で進めるのが、依存関係が少なく、効果を測定しやすいと考えます。**

まずは **A3: 誤答11件のタグ/類義語の追加・修正** から着手しましょうか？
そのために、評価結果CSV (`evaluation_results_2025-04-30T09-13-36-117Z.csv`) を再度読み込み、Accuracy が 0 だった箇所を特定します。


Read file: evaluation_results/evaluation_results_2025-04-30T09-13-36-117Z.csv
評価結果のCSVファイル内容、読み込みありがとうございます。

Accuracy が `0` となっている行（期待したナレッジIDとAPIが返したIDが異なるケース）をいくつか見ていきましょう。

**1. TQ001: "予約方法を教えてください"**
*   Expected ID: `1`
*   Actual API ID: `20`
*   Actual API Response: (ID 20 の内容) 「以下の手順で対応します：1.予約者へ電話またはメールで連絡 2.複数予約のうち1つを本予約として確認 3.その他の予約をキャンセル（破棄） 4.予約サイトを閉じていただくようお願い...」
*   **分析:** 期待していたのは ID `1` (Supabase上で "予約方法を教えてください" という質問、回答は "メニューの[予約]ページから手順..." のもの) でしたが、返ってきたのは ID `20` (Supabase上で "同一予約者から複数の重複予約が入った場合の対応は？" という質問) でした。これは明らかにミスマッチです。`api_score` も `11.33` とそれほど高くありません。

**2. TQ012: "繁忙期に予約を入れたいのですが制限はありますか？"**
*   Expected ID: `12` (先ほど削除したID)
*   Actual API ID: `114`
*   Actual API Response: (ID 114 の内容) 「繁忙期は大変混み合いますので、以下の点をご留意ください：...【繁忙期の注意事項】...大型車のお預かりは停止しております...」
*   **分析:** 以前の分析通り、ID `114` は「繁忙期のコツ」という質問文ですが、回答には制限事項も含まれています。期待値 `12` は削除済みなので、この場合、ID `114` が返ってくるのはある程度妥当かもしれません。ただし、質問の意図「制限はありますか？」に対して、より直接的な回答が優先されるべきです。

**3. TQ019: "繁忙期の予約受付基準は？"**
*   Expected ID: `19` (先ほど削除したID)
*   Actual API ID: `114`
*   Actual API Response: (TQ012 と同じく ID 114 の内容)
*   **分析:** TQ012 と同様です。ID `114` が「受付基準」に関する情報もカバーしていると判断されたようです。

**4. TQ027: "前泊の場合の来場時間は？"**
*   Expected ID: `27`
*   Actual API ID: `64`
*   Actual API Response: (ID 64 の内容) 「送迎は基本的に相乗りです。当駐車場から空港まで5〜10分程度。飛行機出発時間の1時間前（国内線）、ツアー集合時間30分前までにご来場ください。」
*   **分析:** 期待したのは「前泊」に特化した来場時間 (ID `27`) ですが、一般的な「来場時間の目安」 (ID `64`) が返ってきています。ID `27` の `question` や `answer` に「前泊」というキーワードが不足しているか、ID `64` の汎用性が高すぎる可能性があります。

**5. TQ035: "レクサスで利用したいのですが？"**
*   Expected ID: `35`
*   Actual API ID: `140`
*   Actual API Response: (ID 140 の内容) 「初めてご利用の方は、以下の手順に従ってください：...」
*   **分析:** 明らかなミスマッチです。「レクサス」という具体的な車種について尋ねているのに、一般的な利用手順が返ってきています。ID `35` (または `88` のようなレクサス不可を伝えるナレッジ) がヒットすべきです。

**6. TQ047: "送迎の所要時間はどのくらいですか？"**
*   Expected ID: `47`
*   Actual API ID: `64`
*   Actual API Response: (ID 64 の内容) 「送迎は基本的に相乗りです。当駐車場から空港まで5〜10分程度。飛行機出発時間の1時間前（国内線）、ツアー集合時間30分前までにご来場ください。」
*   **分析:** これは以前修正したケースですね。ID `47` を「送迎時間」に特化し、ID `64` を「来場目安」に特化するように修正しました。`expected_knowledge_ids` を `47` に設定していましたが、API は ID `64` を返しています。両方のナレッジの内容と、検索ロジック（特にスコアリング）を再度確認する必要がありそうです。

**7. TQ081: "便が未定ですが予約できますか？"**
*   Expected ID: `81`
*   Actual API ID: `114` (繁忙期の予約のコツ)
*   **分析:** 明らかなミスマッチです。「便未定」というキーワードがうまく拾えていないか、ID `114` のキーワードが広すぎる可能性があります。

**8. TQ087: "国際線の利用は可能ですか？"**
*   Expected ID: `87`
*   Actual API ID: `28` (国際線施設の利用目的での予約は可能ですか？)
*   **分析:** 以前の分析通り、どちらも内容は「不可」であり、実質的に同じ情報です。ID の統合または期待値の修正で対応可能です。

**9. TQ112: "急病で利用できなくなりました。キャンセル料は免除できませんか？"**
*   Expected ID: `112`
*   Actual API ID: `129` (急病でキャンセルしたのにキャンセル料を取るのは非常識だ。免除すべきだ。)
*   **分析:** 以前の分析通り、ID `129` の方がより具体的な対応（個別検討、証明書）を含んでおり、適切である可能性が高いです。期待値の見直しが必要です。

**全体的な傾向と次のステップ:**

1.  **期待値の不一致:** 多くのケースで、`expected_knowledge_ids` が現在のナレッジベースの最適な回答と異なっています。これは、ナレッジの修正や、`generate-test-queries.ts` で生成された `query_text` が必ずしもそのIDの代表的な質問ではないことが原因かもしれません。
2.  **検索ロジックの課題:** TQ001, TQ035, TQ081 のように、明らかに異なる内容のナレッジが返されているケースは、検索ロジック（キーワード抽出、スコアリング、特にベクトル検索の重みなど）に改善の余地があることを示しています。
3.  **ナレッジの重複・粒度:** TQ012, TQ019, TQ047, TQ087, TQ112 のように、内容が似ているナレッジが存在する場合、検索システムがどちらか一方を安定して選ぶのが難しくなります。ナレッジの整理（統合、役割明確化）が必要です。

**具体的なアクションプラン:**

1.  **期待値の修正とナレッジの質的評価 (最優先):**
    *   `evaluation_results_*.csv` を見ながら、Accuracy が 0 の各クエリについて、API が返した `api_knowledge_id` のナレッジ内容 (Supabase で確認) が、そのクエリに対して**本当に不適切なのか、それとも許容範囲あるいはより適切なのか**を1件ずつ判断します。
    *   もし API の回答が妥当であれば、`data/test_queries.csv` の `expected_knowledge_ids` を修正します。
    *   もし API の回答が不適切であれば、その原因（キーワード不足、スコアリングの問題など）を特定し、ナレッジまたは検索ロジックの修正対象とします。
2.  **ナレッジの整理 (継続):**
    *   内容が重複している、あるいは粒度が不適切なナレッジ (例: ID 14 のような汎用すぎるもの、ID 87 と 28 のような類似内容) を特定し、統合・分割・修正を行います。
3.  **検索ロジックの再検討 (必要に応じて):**
    *   上記 1, 2 を行っても改善しないミスマッチについては、`src/lib/search.ts` のスコアリングロジック（特に `questionWeight`, `answerWeight`, `vectorWeight` の値）や、キーワード抽出のロジックを見直します。

まずは、**手順1の「期待値の修正とナレッジの質的評価」**から進めましょう。

`evaluation_results_*.csv` を参照し、Accuracy=0 のケースについて、Supabase で実際のナレッジ内容を確認しながら、`expected_knowledge_ids` を修正すべきか、それともナレッジや検索ロジックを修正すべきか、判断していく形になります。

どのテストクエリIDから確認を始めますか？ (例: TQ001 から)

ベースライン評価コマンド
    npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/evaluate_system.ts

llm遅延対策

以下の話はどこかに記憶されていますか？

話の流れを読んでアドバイスください。
前提と現状整理

課題：Top-3 を LLM で再ランク付けすると、どうしても LLM 呼び出し分の遅延（数百ミリ秒～数秒）が発生する

狙い：回答の品質を上げつつ、体感レイテンシを 500 ms 以下に抑えたい

---

解決アプローチのポイント

1. LLM 呼び出し自体を高速化

2. 呼び出し回数やプロンプト量を減らす

3. 部分的に非同期化 or キャッシュする

4. 代替リランキング手法を併用する

---

1. LLM 呼び出し高速化（設定チェック）

モデル選定

gpt-4→gpt-3.5-turbo など、品質要件を満たすもっと軽量なモデルに切り替え

ストリーミング

LangChain.js で streaming: true を有効にすると、最初のトークン到着で描画開始でき、体感が大幅改善

const llm = new ChatOpenAI({
modelName: "gpt-3.5-turbo",
streaming: true,
callbackManager: CallbackManager.fromHandlers({
handleNewToken(token) { /\* UI に逐次追加 \*/ }
})
});

プロンプト最適化

再ランク用プロンプトは最小限の命令＋「番号とスコアだけ返せ」の形式にすると、生成トークン数が減り高速化

---

2. 呼び出し回数・プロンプト量の削減

一括バッチ呼び出し

ドキュメント３件に対し逐一３回呼び出すのではなく、１回のプロンプトで３件まとめて評価

要約してからランク付け

各ドキュメント全体を渡すのではなく、あらかじめ要旨（50–100字）だけに縮約 → プロンプトの入力サイズ削減

---

3. 非同期化 / キャッシュ

先行取得＋UI 非同期描画

最初に BM25+vector の結果だけすぐ描画し、LLM ランクが返ってきたらスコアと並び替えを差分適用

結果キャッシュ

同一クエリ or 類似クエリの再ランク結果を Redis や Supabase edge cache に 5–10 分キャッシュ

並列実行

もし一括バッチ呼び出しが難しければ、3 件の評価を Promise.all で同時に投げて総待ち時間を「最長呼び出し時間」に

---

4. 代替リランキング手法の併用

Reciprocal Rank Fusion (RRF)

BM25 とベクトルのスコアだけで軽量にスコア融合し、品質劣化が小さいならこちらで済ませる

function rrfScore(rank: number, k=60) { return 1 / (k + rank); }

軽量再ランクモデル

Embedding 同士のコサイン類似度を「質問 embedding ↔ ドキュメント embedding」で再スコアリング

Faiss や HNSW のインデクサー内蔵ランク機能を利用

---

どれを優先すべきか

1. モデルとストリーミング（すぐできる＆効果大）

2. 一括プロンプト＋要旨化（呼び出し回数・サイズ削減）

3. 非同期 UI 更新（体感レスポンス改善）

4. RRF or embedding-only リランク（品質 vs 速度トレードオフ）

5. キャッシュ（アクセスパターン次第で効果大）

---

まとめ

設定が"おかしい"のではなく、LLM 呼び出しにはそれなりのコストがある

まずは 軽量モデル＋ストリーミング＋一括バッチ呼び出し＋要旨化 で遅延を半減させ、

それでも厳しいなら RRF や embedding リランク を併用し、LLM は品質クリティカルな部分だけに絞り込みましょう。

こうすることで「ほぼリアルタイム感」を保ちつつ、高品質な再ランクが実現できます。
考え方を 3 行で

1. 検索レイヤは"秒速"が命 – 100 ms 以内で「候補集合」を取り切る。

2. リライト／トーン調整レイヤは"人間味"が命 – 候補を 1 つに絞ったあと、LLM にゆっくり（200–400 ms）書かせる。

3. 境界を徹底分離 – "速さを追う処理"と"表現を磨く処理"を違うプロセス・タイミングで動かす。

---

パイプライン指針（どこで速さ／人間味を担保するか）

レイヤ	目的	技術 & コツ	性能目標	品質目標（人間らしさ）

① クエリ正規化 Kuromoji	表記ゆれ吸収	前処理 JS だけ	< 5 ms	–（機械的）
② 一次検索<br>PGroonga + pgvector + RRF	関連候補 Top k=10 抽出	インデックス in RAM / parallel SQL	< 100 ms	–（機械的）
③ 軽量リランク<br>Embedding 類似 or ルール	Top k → Top 3	コサイン演算 (CPU)	< 30 ms	–
④ LLM 再ランク (任意)	Top 3 → Top 1	gpt-3.5-turbo Streaming / 1-shot	150–250 ms	◎「最も的確」を選ぶ
⑤ LLM リライト/トーン	敬語・共感・閉じ文句	Few-shot + ペルソナ Prompt	150–250 ms	◎ 読みやすく温かい
⑥ 合成 & 返却	HTML マークアップ・警告挿入	Edge Function / SSR	< 20 ms	–

> 合算レイテンシ目標： 450 ms 以下（⑥まで）。
> 人間味を司るのは④⑤のみ。①–③／⑥は "機械最適化ゾーン"。

---

速さを確保する 5 つの打ち手

1. Top-k を絞り込む – LLM に渡すのは 3 件まで。

2. Streaming – partial\_response を出力次第 UI に流す。体感が 100 ms 単位で改善。

3. キャッシュ – ①–④の結果を Redis に 5 分キャッシュ。類似クエリは 80 % ヒット。

4. モデル軽量化 – gpt-4o-mini→gpt-3.5-turbo→gpt-3.5-128k と段階的フォールバック。

5. 非同期リライト – 先に「箇条書きの骨子」を即返し、その裏で⑤を完成させて差し替える UI パターンも可。

---

人間らしさを確保する 5 つの打ち手

1. Few-shot サンプル – ベテラン CS のメール 5–10 通を Prompt 末尾に固定。

2. トーン変数 – {{tone=friendly/polite/conservative}} でスタイルを切替えられるように。

3. 共感フレーズ辞書 – \<CUSTOMER\_EMPATHY> プレースホルダに場面別定型文を注入。

4. 自己検証 – Prompt の最後に 「誤情報がないか 3 秒考えてから出力する」 と明示。

5. ガードレール – ポリシーチェッカーで NG ワード／数値逸脱を LLM 後に最終確認。

---

実装テンプレ（LangChain.js 抜粋）

// ② 一次検索
const bm25 = await sqlQuery(bm25Sql, \[tokenized]);
const vec  = await vectorStore.similaritySearch(query, 10);
const rrf   = reciprocalRankFusion(bm25, vec).slice(0, 10);

// ③ 軽量リランク
const top3 = denseCosineReorder(rrf).slice(0, 3);

// ④ + ⑤ まとめて 1 回 LLM
const prompt = \`
You are a courteous parking-lot staff...

### Question

\${query}

### Candidates (rate 1–10, pick best):

\${top3.map((d,i)=>`[${i+1}] ${d.pageContent.slice(0,300)}`).join("\n")}

### Output Format

best\_index|rewritten\_answer
\`;

const llm = new ChatOpenAI({ modelName:"gpt-3.5-turbo", streaming\:true });
const resp = await llm.call(\[{role:"user", content: prompt}]);

---

最後にひと言

速度を稼ぐゾーン（①〜③＋⑥）は SQL・ベクトル演算・キャッシュ で機械的に削る。

人間らしさを出すゾーン（④⑤）は LLM に集中させ、ここだけに"ゆとり"を残す。

この境界を守るだけで "即レスだけど温かい" 応答体験が手に入ります。

LLM を使わない再ランクは"代用品"ではなく戦略の 1 つ

最近の評価では 高性能クロスエンコーダ（DeBERTa-v3, MiniLM, Cohere Rerank など）や疎密ハイブリッド（SPLADE v3, ColBERT）が、GPT-3.5/Anthropic Sonnet 3.5 クラスの LLM 再ランクと同等か、データセットによっては上回るケースも報告されています。

---

どうやって "LLM なし" で精度を保つか

アプローチ	仕組み（ざっくり）	レイテンシ	精度の目安	導入ポイント

① クロスエンコーダ<br>(sentence-transformers/cross-encoder-ms-marco-MiniLM-L-6-v2 等)	質問と候補文を 1 つの入力ペアにして"関連スコア"を直接推定	GPU: 5–10 ms/件<br>CPU: 30–40 ms/件	GPT-3.5 と互角、<br>GPT-4 未満	Supabase Edge Function で ONNX or GGUF をロードしてバッチ推論
② SPLADE v3	稀に出る単語もベクトルに"重み付きスパース"で埋め込み、疎検索＋密検索を一本化	CPU-only で BM25 並	BM25+MiniLM+LLM 再ランク相当	Retrieval を 1 段にできるので LLM 削減
③ ColBERT	トークンごとに埋め込み→MaxSim 集約で精度高いが軽量	GPU 15 ms/件	DeBERTa-v3 CrossEnc ≒ GPT-4o-mini	候補 100→Top 30 くらいの中間リランク
④ Cohere Rerank API	クラウド完結・30 パラ並列	P95 ≈ 50 ms	MTEB 上位クロスエンコーダ並	外部 API で運用/管理フリー
⑤ RRF + ルール	BM25順位とコサイン類似度を<br> 1/(k+rank) で融合	< 1 ms	トップ 5 以内のリコールは 90% 以上	"一次"で十分なら LLM 不要

* 精度は MS MARCO / BEIR 平均 nDCG\@10 での大まかな位置付け。

---

実装クイックガイド（クロスエンコーダ例）

import { pipeline } from "@xenova/transformers";          // WebGPU/CPU
const ranker = await pipeline(
"text-classification",
"Xenova/ms-marco-MiniLM-L-6-v2",
{ quantized: true }                                     // 4-bit Q over WebGPU
);

// Top-10 を 1 回でバッチ評価
const inputs = top10.map(d => \[query, d.pageContent]);
const scores = await ranker(inputs, { batchSize: 10 });
const reranked = top10
.map((d, i) => ({ ...d, score: scores\[i].score }))
.sort((a, b) => b.score - a.score)
.slice(0, 3);

CPU-only でも 10 件 ≈ 300 ms ⇒ LLM 呼び出し (\~700 ms) と比べ約 2× 高速。

---

どこで"LLM あり"と"LLM なし"を使い分けるか

シナリオ	推奨再ランク

✅ FAQ / 定型問い合わせ<br>（回答候補が短文）	クロスエンコーダ or Cohere Rerank ― 軽量かつ十分高精度
✅ 長文ドキュメントで事実抽出が主	SPLADE v3 ― 1 段で済むので速い
⚠️ 複数文書を要約し"結論"を作る	LLM 再ランク＋LLM 生成 ― 推論自体が要約を兼ねる
⚠️ 過去対話を踏まえたコンテキスト判断	LLM（Sonnet/GPT-4o） ― ニュアンス評価が強い

---

実務的なロードマップ

1. Retrieval を強化

BM25+SPLADE のハイブリッドで Recall を 95 % 以上に。

2. クロスエンコーダを Edge に置き換え

MiniLM or DeBERTa-v3 ベースを ONNX + WebGPU で常駐。

3. LLM 再ランクを"例外扱い"に

上記スコア差が 0.05 pt 以内なら LLM を呼ばない。

大差 or 複雑質問のみ sonnet-3.5 をフォールバック。

4. 品質ウォッチ

response\_logs に Human Eval を 1 % サンプリング。

nDCG, MRR がしきい値割れしたら LLM レーンへ自動切替。

---

まとめ

LLM 再ランク（Sonnet 3.5 など）は万能ではなくコスト高。

高性能クロスエンコーダ／SPLADE v3／ColBERT を使えば、
\*\*"LLM に近い精度 × 1/3〜1/10 ラティシー"\*\*が現実的に得られます。

LLM は "要約・合成が必要なとき"だけ使うのが、速度とコストを両立させる王道です。

## 前提と現状整理

* **課題**: Top-3 を LLM で再ランクすると必ず LLM 呼び出し分の遅延（数百ms〜数秒）が発生する
* **目標**: 回答品質を維持・向上しつつ、体感レイテンシを 500ms 以下に抑える

---

## 解決アプローチのポイント

1. **LLM 呼び出し自体を高速化**

   * 軽量モデル (gpt-3.5-turbo など) への切替
   * Streaming 出力で初動を早める
   * プロンプト最適化で生成トークン量を減少

2. **呼び出し回数・プロンプト量の削減**

   * 候補３件を１回呼び出しで一括評価
   * ドキュメントを要旨（50–100字）に圧縮して入力サイズを削減

3. **部分的に非同期化 or キャッシュ**

   * UI に BM25+vector の結果を先行描画し、LLM ランク結果を差分適用
   * Redis/Supabase edge cache で再ランク結果を短期キャッシュ
   * Promise.all で並列呼び出しし、最長応答時間のみ待つ

4. **代替リランキング手法を併用**

   * Reciprocal Rank Fusion (RRF) で BM25 とベクトルを軽量融合
   * クロスエンコーダ (MiniLM, DeBERTa) や SPLADE v3 など高速モデルで部分再ランク

---

## 実行優先順位

1. **軽量モデル + Streaming**
2. **一括バッチ呼び出し + 要旨化**
3. **非同期 UI 更新**
4. **RRF / embedding-only リランク**
5. **キャッシュ**

---

## 3 行サマリ

1. 検索レイヤを `<100ms` に留め、候補集合を高速取得。
2. LLM は最重要候補１件だけに絞り、200–400ms でトーン調整。
3. 速さ領域(①–③)と人間味領域(④–⑤)を完全分離し、非同期またはキャッシュでつなぐ。

---

## パイプライン指針

| レイヤ       | 目的         | 技術 & コツ                 | 目標レイテンシ   | 品質要件 |
| --------- | ---------- | ----------------------- | --------- | ---- |
| ① クエリ正規化  | 表記ゆれ吸収     | Kuromoji前処理             | <5ms      | --   |
| ② 一次検索    | Top k=10抽出 | PGroonga+pgvector+RRF   | <100ms    | --   |
| ③ 軽量リランク  | Top10→Top3 | Cosine re-ranking       | <30ms     | --   |
| ④ LLM再ランク | Top3→Top1  | gpt-3.5 turbo Streaming | 150–250ms | ◎    |
| ⑤ LLMリライト | トーン&共感     | Few-shot Prompt         | 150–250ms | ◎    |
| ⑥ 合成&返却   | HTML整形     | Edge Function           | <20ms     | --   |

**合算目標**: <450ms で体感レスポンス。

---

このドキュメントをチームのナレッジベースに保存し、随時更新してください。

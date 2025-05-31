# LLM 遅延対策

## 前提と現状整理

*   **課題**: Top-3 を LLM で再ランク付けすると、どうしても LLM 呼び出し分の遅延（数百ミリ秒～数秒）が発生する
*   **狙い**: 回答の品質を上げつつ、体感レイテンシを 500 ms 以下に抑えたい

---

## 解決アプローチのポイント

1.  LLM 呼び出し自体を高速化
2.  呼び出し回数やプロンプト量を減らす
3.  部分的に非同期化 or キャッシュする
4.  代替リランキング手法を併用する

---

## 1. LLM 呼び出し高速化（設定チェック）

### モデル選定

gpt-4→gpt-3.5-turbo など、品質要件を満たすもっと軽量なモデルに切り替え

### ストリーミング

LangChain.js で `streaming: true` を有効にすると、最初のトークン到着で描画開始でき、体感が大幅改善

```typescript
const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  streaming: true,
  callbackManager: CallbackManager.fromHandlers({
    async handleLLMNewToken(token: string) {
      // UI に逐次追加
    }
  })
});
```

### プロンプト最適化

再ランク用プロンプトは最小限の命令＋「番号とスコアだけ返せ」の形式にすると、生成トークン数が減り高速化

---

## 2. 呼び出し回数・プロンプト量の削減

### 一括バッチ呼び出し

ドキュメント３件に対し逐一３回呼び出すのではなく、１回のプロンプトで３件まとめて評価

### 要約してからランク付け

各ドキュメント全体を渡すのではなく、あらかじめ要旨（50–100字）だけに縮約 → プロンプトの入力サイズ削減

---

## 3. 非同期化 / キャッシュ

### 先行取得＋UI 非同期描画

最初に BM25+vector の結果だけすぐ描画し、LLM ランクが返ってきたらスコアと並び替えを差分適用

### 結果キャッシュ

同一クエリ or 類似クエリの再ランク結果を Redis や Supabase edge cache に 5–10 分キャッシュ

### 並列実行

もし一括バッチ呼び出しが難しければ、3 件の評価を `Promise.all` で同時に投げて総待ち時間を「最長呼び出し時間」に

---

## 4. 代替リランキング手法の併用

### Reciprocal Rank Fusion (RRF)

BM25 とベクトルのスコアだけで軽量にスコア融合し、品質劣化が小さいならこちらで済ませる

```typescript
function rrfScore(rank: number, k: number = 60): number {
  return 1 / (k + rank);
}
```

### 軽量再ランクモデル

Embedding 同士のコサイン類似度を「質問 embedding ↔ ドキュメント embedding」で再スコアリング

### Faiss や HNSW のインデクサー内蔵ランク機能を利用

---

## どれを優先すべきか

1.  モデルとストリーミング（すぐできる＆効果大）
2.  一括プロンプト＋要旨化（呼び出し回数・サイズ削減）
3.  非同期 UI 更新（体感レスポンス改善）
4.  RRF or embedding-only リランク（品質 vs 速度トレードオフ）
5.  キャッシュ（アクセスパターン次第で効果大）

---

## まとめ

設定が"おかしい"のではなく、LLM 呼び出しにはそれなりのコストがある

まずは 軽量モデル＋ストリーミング＋一括バッチ呼び出し＋要旨化 で遅延を半減させ、
それでも厳しいなら RRF や embedding リランク を併用し、LLM は品質クリティカルな部分だけに絞り込みましょう。

こうすることで「ほぼリアルタイム感」を保ちつつ、高品質な再ランクが実現できます。

### 考え方を 3 行で

1.  検索レイヤは"秒速"が命 – 100 ms 以内で「候補集合」を取り切る。
2.  リライト／トーン調整レイヤは"人間味"が命 – 候補を 1 つに絞ったあと、LLM にゆっくり（200–400 ms）書かせる。
3.  境界を徹底分離 – "速さを追う処理"と"表現を磨く処理"を違うプロセス・タイミングで動かす。

---

## パイプライン指針（どこで速さ／人間味を担保するか）

| レイヤ         | 目的                  | 技術 & コツ                                  | 性能目標     | 品質目標（人間らしさ） |
| -------------- | --------------------- | -------------------------------------------- | ------------ | ------------------ |
| ① クエリ正規化  | 表記ゆれ吸収            | 前処理 JS だけ                                 | < 5 ms       | –（機械的）         |
| ② 一次検索     | 関連候補 Top k=10 抽出  | インデックス in RAM / parallel SQL             | < 100 ms     | –（機械的）         |
| ③ 軽量リランク   | Top k → Top 3          | コサイン演算 (CPU)                             | < 30 ms      | –                  |
| ④ LLM 再ランク (任意) | Top 3 → Top 1          | gpt-3.5-turbo Streaming / 1-shot             | 150–250 ms   | ◎「最も的確」を選ぶ   |
| ⑤ LLM リライト/トーン | 敬語・共感・閉じ文句      | Few-shot + ペルソナ Prompt                     | 150–250 ms   | ◎ 読みやすく温かい    |
| ⑥ 合成 & 返却  | HTML マークアップ・警告挿入 | Edge Function / SSR                          | < 20 ms      | –                  |

> 合算レイテンシ目標： 450 ms 以下（⑥まで）。
> 人間味を司るのは④⑤のみ。①–③／⑥は "機械最適化ゾーン"。

---

## 速さを確保する 5 つの打ち手

1.  **Top-k を絞り込む** – LLM に渡すのは 3 件まで。
2.  **Streaming** – `partial_response` を出力次第 UI に流す。体感が 100 ms 単位で改善。
3.  **キャッシュ** – ①–④の結果を Redis に 5 分キャッシュ。類似クエリは 80 % ヒット。
4.  **モデル軽量化** – gpt-4o-mini→gpt-3.5-turbo→gpt-3.5-128k と段階的フォールバック。
5.  **非同期リライト** – 先に「箇条書きの骨子」を即返し、その裏で⑤を完成させて差し替える UI パターンも可。

---

## 人間らしさを確保する 5 つの打ち手

1.  **Few-shot サンプル** – ベテラン CS のメール 5–10 通を Prompt 末尾に固定。
2.  **トーン変数** – `{{tone=friendly/polite/conservative}}` でスタイルを切替えられるように。
3.  **共感フレーズ辞書** – `<CUSTOMER_EMPATHY>` プレースホルダに場面別定型文を注入。
4.  **自己検証** – Prompt の最後に 「誤情報がないか 3 秒考えてから出力する」 と明示。
5.  **ガードレール** – ポリシーチェッカーで NG ワード／数値逸脱を LLM 後に最終確認。

---

## 実装テンプレ（LangChain.js 抜粋）

```typescript
// ② 一次検索
const bm25 = await sqlQuery(bm25Sql, [tokenized]);
const vec  = await vectorStore.similaritySearch(query, 10);
const rrf  = reciprocalRankFusion(bm25, vec).slice(0, 10);

// ③ 軽量リランク
const top3 = denseCosineReorder(rrf).slice(0, 3);

// ④ + ⑤ まとめて 1 回 LLM
const prompt = `
You are a courteous parking-lot staff...

### Question

${query}

### Candidates (rate 1–10, pick best):

${top3.map((d,i)=>`[${i+1}] ${d.pageContent.slice(0,300)}`).join("\n")}

### Output Format

best_index|rewritten_answer
`;

const llm = new ChatOpenAI({ modelName:"gpt-3.5-turbo", streaming:true });
// 正しくは call ではなく invoke または stream を使用する想定
// const resp = await llm.call([{role:"user", content: prompt}]);
// 例: const resp = await llm.invoke([{role:"user", content: prompt}]);
// ストリーミングの場合は以下のように stream メソッドを使用
// const stream = await llm.stream([{role:"user", content: prompt}]);
// for await (const chunk of stream) { /* process chunk */ }
```

---

## 最後にひと言

速度を稼ぐゾーン（①〜③＋⑥）は SQL・ベクトル演算・キャッシュ で機械的に削る。
人間らしさを出すゾーン（④⑤）は LLM に集中させ、ここだけに"ゆとり"を残す。
この境界を守るだけで "即レスだけど温かい" 応答体験が手に入ります。

---

## LLM を使わない再ランクは"代用品"ではなく戦略の 1 つ

最近の評価では 高性能クロスエンコーダ（DeBERTa-v3, MiniLM, Cohere Rerank など）や疎密ハイブリッド（SPLADE v3, ColBERT）が、GPT-3.5/Anthropic Sonnet 3.5 クラスの LLM 再ランクと同等か、データセットによっては上回るケースも報告されています。

---

### どうやって "LLM なし" で精度を保つか

| アプローチ                                                                                             | 仕組み（ざっくり）                                                                  | レイテンシ                                        | 精度の目標                                      | 導入ポイント                                                                                                   |
| :--------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :------------------------------------------------ | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| ① クロスエンコーダ<br>(`sentence-transformers/cross-encoder-ms-marco-MiniLM-L-6-v2` 等)                     | 質問と候補文を 1 つの入力ペアにして"関連スコア"を直接推定                                         | GPU: 5–10 ms/件<br>CPU: 30–40 ms/件              | GPT-3.5 と互角、<br>GPT-4 未満                     | Supabase Edge Function で ONNX or GGUF をロードしてバッチ推論                                                          |
| ② SPLADE v3                                                                                         | 稀に出る単語もベクトルに"重み付きスパース"で埋め込み、疎検索＋密検索を一本化                               | CPU-only で BM25 並                                 | BM25+MiniLM+LLM 再ランク相当                      | Retrieval を 1 段にできるので LLM 削減                                                                        |
| ③ ColBERT                                                                                           | トークンごとに埋め込み→MaxSim 集約で精度高いが軽量                                               | GPU 15 ms/件                                    | DeBERTa-v3 CrossEnc ≒ GPT-4o-mini              | 候補 100→Top 30 くらいの中間リランク                                                                         |
| ④ Cohere Rerank API                                                                                 | クラウド完結・30 パラ並列                                                              | P95 ≈ 50 ms                                     | MTEB 上位クロスエンコーダ並                         | 外部 API で運用/管理フリー                                                                                      |
| ⑤ RRF + ルール                                                                                       | BM25順位とコサイン類似度を<br> `1/(k+rank)` で融合                                              | < 1 ms                                          | トップ 5 以内のリコールは 90% 以上                    | "一次"で十分なら LLM 不要                                                                                       |

\* 精度は MS MARCO / BEIR 平均 nDCG@10 での大まかな位置付け。

---

### 実装クイックガイド（クロスエンコーダ例）

```typescript
import { pipeline } from "@xenova/transformers"; // WebGPU/CPU
const ranker = await pipeline(
  "text-classification",
  "Xenova/ms-marco-MiniLM-L-6-v2",
  { quantized: true } // 4-bit Q over WebGPU
);

// Top-10 を 1 回でバッチ評価
// query: string, top10: Array<{ pageContent: string, ... }>
const inputs = top10.map(d => [query, d.pageContent]);
// `ranker` の型シグネチャに合わせて修正が必要な場合があります。
// 通常、text-classification パイプラインはテキストペアのリストではなく、単一テキストまたはテキストのリストを受け取ります。
// ここでは、関連度スコアリングを意図しているため、カスタム処理または別のパイプラインタイプが必要になる可能性があります。
// 仮に `ranker` が (query, document) のペアでスコアを返す TextClassificationPipeline の特殊な使い方を想定すると:
// const scores = await ranker(inputs, { batchSize: 10 }); // この呼び出しはパイプラインの期待する入力形式に依存
// 以下はスコアが得られた後の処理の例
// const reranked = top10
//   .map((d, i) => ({ ...d, score: scores[i].score })) // scores[i].score の形式はモデル出力に依存
//   .sort((a, b) => b.score - a.score)
//   .slice(0, 3);
```

CPU-only でも 10 件 ≈ 300 ms ⇒ LLM 呼び出し (\~700 ms) と比べ約 2× 高速。

---

### どこで"LLM あり"と"LLM なし"を使い分けるか

| シナリオ                               | 推奨再ランク                                              |
| :------------------------------------- | :-------------------------------------------------------- |
| ✅ FAQ / 定型問い合わせ<br>（回答候補が短文） | クロスエンコーダ or Cohere Rerank ― 軽量かつ十分高精度           |
| ✅ 長文ドキュメントで事実抽出が主            | SPLADE v3 ― 1 段で済むので速い                             |
| ⚠️ 複数文書を要約し"結論"を作る          | LLM 再ランク＋LLM 生成 ― 推論自体が要約を兼ねる                 |
| ⚠️ 過去対話を踏まえたコンテキスト判断      | LLM（Sonnet/GPT-4o） ― ニュアンス評価が強い                   |

---

### 実務的なロードマップ

1.  **Retrieval を強化**
    BM25+SPLADE のハイブリッドで Recall を 95 % 以上に。
2.  **クロスエンコーダを Edge に置き換え**
    MiniLM or DeBERTa-v3 ベースを ONNX + WebGPU で常駐。
3.  **LLM 再ランクを"例外扱い"に**
    上記スコア差が 0.05 pt 以内なら LLM を呼ばない。
    大差 or 複雑質問のみ sonnet-3.5 をフォールバック。
4.  **品質ウォッチ**
    `response_logs` に Human Eval を 1 % サンプリング。
    nDCG, MRR がしきい値割れしたら LLM レーンへ自動切替。

---

## (最終要約セクション) 前提と現状整理

*   **課題**: Top-3 を LLM で再ランクすると必ず LLM 呼び出し分の遅延（数百ms〜数秒）が発生する
*   **目標**: 回答品質を維持・向上しつつ、体感レイテンシを 500ms 以下に抑える

---

## (最終要約セクション) 解決アプローチのポイント

1.  **LLM 呼び出し自体を高速化**
    *   軽量モデル (gpt-3.5-turbo など) への切替
    *   Streaming 出力で初動を早める
    *   プロンプト最適化で生成トークン量を減少
2.  **呼び出し回数・プロンプト量の削減**
    *   候補３件を１回呼び出しで一括評価
    *   ドキュメントを要旨（50–100字）に圧縮して入力サイズを削減
3.  **部分的に非同期化 or キャッシュ**
    *   UI に BM25+vector の結果を先行描画し、LLM ランク結果を差分適用
    *   Redis/Supabase edge cache で再ランク結果を短期キャッシュ
    *   `Promise.all` で並列呼び出しし、最長応答時間のみ待つ
4.  **代替リランキング手法を併用**
    *   Reciprocal Rank Fusion (RRF) で BM25 とベクトルを軽量融合
    *   クロスエンコーダ (MiniLM, DeBERTa) や SPLADE v3 など高速モデルで部分再ランク

---

## (最終要約セクション) 実行優先順位

1.  **軽量モデル + Streaming**
2.  **一括バッチ呼び出し + 要旨化**
3.  **非同期 UI 更新**
4.  **RRF / embedding-only リランク**
5.  **キャッシュ**

---

## (最終要約セクション) 3 行サマリ

1.  検索レイヤを `<100ms` に留め、候補集合を高速取得。
2.  LLM は最重要候補１件だけに絞り、200–400ms でトーン調整。
3.  速さ領域(①–③)と人間味領域(④–⑤)を完全分離し、非同期またはキャッシュでつなぐ。

---

## (最終要約セクション) パイプライン指針

| レイヤ       | 目的         | 技術 & コツ                 | 目標レイテンシ   | 品質要件 |
| --------- | ---------- | ----------------------- | --------- | ---- |
| ① クエリ正規化  | 表記ゆれ吸収     | Kuromoji前処理             | <5ms      | --   |
| ② 一次検索    | Top k=10抽出 | PGroonga+pgvector+RRF   | <100ms    | --   |
| ③ 軽量リランク  | Top10→Top3 | Cosine re-ranking       | <30ms     | --   |
| ④ LLM再ランク | Top3→Top1  | gpt-3.5 turbo Streaming | 150–250ms | ◎    |
| ⑤ LLMリライト | トーン&共感     | Few-shot Prompt         | 150–250ms | ◎    |
| ⑥ 合成&返却   | HTML整形     | Edge Function           | <20ms     | --   |

**合算目標**: <450ms で体感レスポンス。 
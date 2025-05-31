# 512次元 vs 1536次元ベクトル検索におけるエラー克服の経緯

## 1. 背景・目的

検索パフォーマンス改善のため、埋め込みベクトルの次元数 (512次元 vs 1536次元) の比較検証を実施。
`src/lib/embeddings.ts` の `searchSimilarKnowledge` 関数を改修し、`targetDimensions` 引数に応じて検索対象のベクトルカラム (`embedding_vector` (512次元) または `embedding_vector_1536` (1536次元)) とクエリベクトルの次元を動的に切り替えることを目指した。

## 2. 発生した主な問題

テストスクリプト (`tests/testSearchDimensions.ts`) を実行した際、以下のエラーが一貫して発生した。

```
Raw query failed. Code: '22000'. Message: 'ERROR: different vector dimensions 512 and 1536'
```

このエラーは、データベース (PostgreSQL with pgvector) が、クエリで指定されたベクトル (例: 512次元) と、比較対象のカラムに格納されているベクトルの次元 (例: 1536次元) が一致しないことを示している。

## 3. 問題の原因特定までの試行錯誤

エラーメッセージから、当初は `searchSimilarKnowledge` 関数内のSQLクエリのキャスト部分 (`$1::vector(XXX)`) や、渡されるクエリベクトルの次元が正しく動的に設定されていない可能性を疑った。

### 主な試行内容と判明したこと

1.  **SQLクエリとパラメータのデバッグログ追加:**
    *   `src/lib/embeddings.ts` 内の `searchSimilarKnowledge` 関数および `generateEmbedding` 関数に多数の `console.log` や `console.debug` を追加し、渡されるパラメータ、生成されるSQL、OpenAI APIに渡す次元数などを確認しようとした。
    *   **判明したこと:** 追加したはずのログが全く出力されず、`prisma:query` ログに表示されるSQLも古いままだった。これにより、`ts-node` がファイルの最新の変更を読み込めていない可能性が浮上した。

2.  **`ts-node` のキャッシュクリア試行:**
    *   `rm -rf node_modules/.cache/ts-node`
    *   `rm -rf node_modules/.cache`
    *   `ts-node` 実行時の環境変数設定 (`TS_NODE_CACHE_DIRECTORY=/dev/null`, `TS_NODE_TRANSPILE_ONLY=true`, `TS_NODE_CACHE=false`)
    *   `ts-node` 実行時のオプション変更 (`--no-cache` (非対応だった), `--compiler-options`, `--project`)
    *   **判明したこと:** これらのキャッシュクリアやオプション変更を試みても、依然として最新のコードが実行されず、ログも古いままだった。

3.  **TypeScriptのコンパイル (`tsc`) 試行:**
    *   `ts-node` を介さずに、`tsc` でJavaScriptにビルドしてから実行するアプローチを試みた。
    *   **判明したこと:** `openai` ライブラリの型定義ファイル (`.d.ts`) 内でプライベート識別子 (`#private`) が使用されており、`tsconfig.json` の `target` 設定 (`ES2015`, `ES2017`, `ES2020`, `ESNext` を試行) との兼ね合いでコンパイルエラーが発生し、ビルド自体が成功しなかった。

4.  **`node_modules` の完全再インストール:**
    *   `rm -rf node_modules package-lock.json && npm install` を実行。
    *   **判明したこと:** 状況は変わらず、最新コードは読み込まれなかった。

5.  **テストスクリプトからのモジュール読み込み方法の変更 (require):**
    *   テストスクリプト (`tests/testSearchDimensions.ts`) 内で `import` 文の代わりに `require('../src/lib/embeddings')` を使用。
    *   **判明したこと:** `require` 自体は成功し、エクスポートされる関数名も認識された。しかし、`src/lib/embeddings.ts` 内の先頭に書いたはずの `console.log('****** LOADED ******')` が出力されず、関数内のログも依然として出なかった。この時点で、拡張子なしの `require` では、`ts-node` がトランスパイル済みだが古いキャッシュされたモジュールを返しているか、正しく最新版をトランスパイルできていないと推測された。

## 4. 真の原因と最終的な解決策

### 原因

根本的な原因は、`tests/testSearchDimensions.ts` から `src/lib/embeddings.ts` を `require` する際に、拡張子 (`.ts`) を省略していたことだった。
`ts-node` は、拡張子なしの `require` パスに対して、内部のキャッシュ機構やモジュール解決のロジックが働き、最新の `.ts` ファイルの変更を検知・トランスパイルせず、古い、あるいは不完全なモジュールを返していた。

### 解決策

テストスクリプト (`tests/testSearchDimensions.ts`) 内のモジュール読み込みを、以下のように **`.ts` 拡張子を明示した `require` 文に変更**した。

```typescript
// tests/testSearchDimensions.ts
// ...
try {
  console.log("→ Attempting require('../src/lib/embeddings.ts')…"); // .ts を追加
  embModule = require('../src/lib/embeddings.ts'); // .ts を追加
  console.log("→ require succeeded. Available exports:", Object.keys(embModule));
} catch (err) {
  console.error("!! require failed:", err);
  process.exit(1);
}
// ...
```

この変更により、`ts-node` は強制的に指定された `.ts` ファイルを読み込み、正しくトランスパイルするようになった。
その結果、`src/lib/embeddings.ts` 内に追加した全てのデバッグ用 `console.log` が期待通りに出力され、以下の点が確認できた。

*   `generateEmbedding` 関数は、渡された `targetDimensions` (512または1536) に基づいて、正しい次元数のベクトルをOpenAI APIにリクエストし、取得している。
*   `searchSimilarKnowledge` 関数は、正しいカラム名 (`embedding_vector` または `embedding_vector_1536`) と、正しいキャスト次元 (`$1::vector(512)` または `$1::vector(1536)`) を使用してSQLクエリを構築している。
*   キャッシュバスターコメント (`/*dim:...*/`) もSQLに含まれている。

最終的に、`ERROR: different vector dimensions 512 and 1536` エラーは完全に解消され、各テストケースで期待通りの検索結果が得られた。

## 5. 教訓

*   `ts-node` 環境でモジュール内の変更が反映されない場合、`require` や `import` のパス解決が期待通りに動作していない可能性を疑う。
*   特に `require` を使用する場合、拡張子 (`.ts`) を明示的に指定することで、`ts-node` による確実なファイル読み込みとトランスパイルを促せる場合がある。
*   問題解決のためのデバッグログは、まず `console.log` を使用し、ファイルや関数の先頭など、確実に実行されるべき箇所に配置して、コードの実行フローと最新性が保たれているかを確認することが重要。
*   Prisma Client が発行するSQLクエリのログ (`prisma:query`) は、実際にDBに送られるSQLを確認する上で非常に有用。
*   PostgreSQLの `vector` 型では、比較や代入の際にベクトルの次元数が厳密に一致している必要がある。 
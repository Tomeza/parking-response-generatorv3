Supabase MCP（Model Context Protocol）は、LLMをSupabaseに安全かつ高精度に接続し、自然言語から直接SQLクエリを生成・実行できる仕組みです。Sudachiが形態素解析によってテキストの分割・正規化を担うのに対し、MCPは「スキーマ情報をもとに正しいSQL構文を自動生成」し、PostgREST経由でSupabaseのデータベース操作を行います。特に複雑な複合クエリでも、テーブル・カラム名の誤りや文法ミスを防ぎつつ、必要なJOINやWHERE節を構築できるため、Sudachi単体でのテキスト処理よりもSQL生成精度が高いことが実運用で確認されています。さらに2025年4月リリースのTypeScript SDK v1.10.0以降では、Streamable HTTP transport によるステートレス／ストリーミング通信がサポートされ、従来の標準入出力（stdio）ベースと比較してリモートサーバー環境への導入も格段に容易になっています。以下、詳細とベストプラクティス、想定エラーと対処法をまとめました。

## Supabase MCP の概要と主な機能

* **モデルコンテキストプロトコル（MCP）**：LLMと外部サービスのコミュニケーションを標準化するプロトコルです ([GitHub][1])。
* **公式Supabase MCPサーバー**：`@supabase/mcp-server-supabase` パッケージとして提供。Cursor、Claude、WindsurfなどのAIツールからJSON-RPC経由でSQL実行やスキーマ操作が可能です ([Supabase][2])。
* **20以上のツール群**：`execute_sql`（SELECT, INSERT, UPDATE, DELETE）、`apply_migration`、`list_tables`、管理API呼び出しなど、多彩な操作を型安全に実行できます ([GitHub][1], [Cline][3])。
* **Read-Only / Read-Write モード**：CLIフラグ`--read-only`でSQL実行を読み取り専用に制限でき、安全性を担保します ([GitHub][4])。

## SQL生成精度の理由とSudachiとの比較

* **スキーマインスペクション**：MCPサーバーは起動時にSupabaseのテーブル・カラム構造を取得し、ツール定義として保持します。これにより、LLMが生成するSQL文は必ず存在するスキーマ要素を参照し、誤字や構文エラーを防ぎます ([Supabase][5])。
* **文脈理解＋構文生成**：Cursor等のクライアントはプロジェクトリファレンスやカスタムツールの説明をコンテキストとしてLLMに渡し、自然言語を「意図抽出 → SQL変換」という形で処理します ([apidog][6])。
* **形態素解析との違い**：Sudachiは日本語テキストのトークン化・正規化を担う一方で、SQL構文の生成やスキーマ検証には不向きです。SudachiをEmbedding前処理や全文検索向上に活かす一方で、SQL生成はMCPの専用ツールに任せることで、それぞれの強みを最大限に活用できます ([Azuki Azusa][7], [GitHub][8])。

## Streamable HTTP Transport の新機能

* **HTTPストリーミング対応**：v1.10.0以降、標準入出力に加えStreamable HTTPによるJSON-RPC通信をサポート。Expressなどの既存インフラに容易に組み込めます ([Azuki Azusa][7])。
* **ステートレスサーバー実装**：Session ID管理が不要なケースでは、単一エンドポイント`/mcp`で完結するシンプル構成が可能です ([Azuki Azusa][7])。
* **下位互換性**：旧仕様のSSEトランスポートとの互換性を保ちつつ、導入の煩雑さを大幅削減しています ([Azuki Azusa][7])。

## ベストプラクティス

1. **ツール定義の整備**

   * `tools/execute_sql`や`tools/apply_migration`など、使用頻度の高い機能を明示的に有効化しましょう ([GitHub][1])。
2. **アクセス制御**

   * \*\*PAT（Personal Access Token）\*\*を環境変数`SUPABASE_ACCESS_TOKEN`で管理し、CLI設定やJSONファイルにトークンを直接書かないようにします ([MCP][9])。
3. **モノリポ運用 vs サービス分離**

   * LLM → MCPサーバー → Supabase の3層構成を明確化し、MCPは専用インスタンスとして運用するとデバッグ性が高まります ([GitHub][8])。
4. **HTTPストリーミングの活用**

   * リモート環境ではStreamable HTTP transportを使い、標準入出力に依存しない非同期通信を実現しましょう ([Azuki Azusa][7])。
5. **テストとA/B比較**

   * 代表的な自然言語クエリと、それに対するSudachi前処理＋Embedding検索 vs MCPサーバーによるSQL実行の結果を定量比較し、精度向上効果を可視化します ([apidog][6])。

## 想定エラーと対処法

| エラー内容                                          | 原因                              | 対処法                                                |
| ---------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `Tool mcp__query not found`                    | MCPクライアント設定に`execute_sql`未登録    | `mcpServers`設定に`tools/execute_sql`を追加              |
| `Connection closed` during HTTP streaming      | 認証ヘッダー欠如 or Session IDミスマッチ     | OAuth2.1ベースの認証設定を見直し、HTTPヘッダー`Authorization`を付与    |
| `JSON-RPC error -32603: Internal server error` | サーバー実装の例外（ツールハンドラ内エラー）          | サーバーログを確認し、`transport.handleRequest`周辺の例外をキャッチ     |
| SQL構文エラー (`syntax error at or near`)           | スキーマ情報取得失敗 or LLMの誤変換           | `list_tables`・`list_columns`ツールでスキーマ取得状況を検証        |
| パフォーマンス劣化 (high p95 latency)                   | `ef_search`やHTTPストリーミングのバッファ未調整 | `ef_search`を40→80→100でチューニング、必要ならConnection Pool設定 |

---

これらを踏まえ、Supabase MCPを導入することで**Sudachi単独では難しい自然言語 → SQL変換の安全性と精度**を大幅に向上させることができます。何か追加で深掘りしたい点や、具体的な設定例が必要でしたらお知らせください！

[1]: https://github.com/supabase-community/supabase-mcp?utm_source=chatgpt.com "Supabase MCP Server - GitHub"
[2]: https://supabase.com/blog/mcp-server?utm_source=chatgpt.com "Supabase MCP Server"
[3]: https://cline.bot/blog/manage-your-database-directly-from-cline-with-the-supabase-mcp?utm_source=chatgpt.com "Manage Your Database Directly From Cline with the Supabase MCP"
[4]: https://github.com/supabase-community/supabase-mcp/releases?utm_source=chatgpt.com "Releases · supabase-community/supabase-mcp - GitHub"
[5]: https://supabase.com/docs/guides/getting-started/mcp?utm_source=chatgpt.com "Model context protocol (MCP) | Supabase Docs"
[6]: https://apidog.com/blog/supabase-mcp/?utm_source=chatgpt.com "How to Connect Your Supabase Database via MCP Server to Cursor"
[7]: https://azukiazusa.dev/blog/mcp-server-streamable-http-transport/ "MCP サーバーの Streamable HTTP transport を試してみる"
[8]: https://github.com/alexander-zuev/supabase-mcp-server?utm_source=chatgpt.com "alexander-zuev/supabase-mcp-server - GitHub"
[9]: https://mcp.so/server/mcp-supabase/supabase-community?utm_source=chatgpt.com "Supabase MCP Servers"

## 要約

LangChainは2025年初頭にv0.9系を中心とした多数のコアアップデートを実施し、LangSmithやLLM評価機能を強化しています ([LangChain Changelog][1])。Supabaseとの連携も公式ドキュメントでサポートされ、`pgvector`拡張を用いたベクトルストア機能がシームレスに利用可能です ([Supabase][2])。さらにModel Context Protocol（MCP）対応として、`langchain-mcp-adapters` パッケージを公開し、MCPサーバー上のツールをLangChainエージェントから直接呼び出せるようになりました ([LangChain][3])。加えて、2025年のAgentアーキテクチャ刷新により、計画・実行・評価・コミュニケーションを担うモジュール型エージェント設計が可能になり、複雑ワークフロー構築の自由度が大幅に向上しています ([Info Services][4])。

---

## 1. LangChainのコアアップデート

### 1.1 v0.9系リリース

* 2025年3月下旬、v0.9.71が公開され、LangSmithでのインタラクティブ評価機能やデータセット管理が強化されました ([LangChain Changelog][1])。
* 同時期に、`llms.txt`ファイル対応やLangGraph向けツールサポートの追加など、IDE統合が進化しています ([LangChain Changelog][1])。

### 1.2 Interrupt 2025 レポート

* 2025年5月開催の「Interrupt 2025」では、エージェント関連の新機能発表やLangGraphとの連携デモが行われ、Agent向けUI・OSSコンポーネント群の公開がアナウンスされました ([LangChain Blog][5])。

### 1.3 構造化出力・ツール呼び出し

* 2025年3月には、複数モデルでの構造化出力改善と“強制ツール呼び出し”標準化が導入され、ツールチェーンの信頼性が向上しました ([LangChain Changelog][6])。

---

## 2. Supabaseとの統合

### 2.1 公式ガイド

* Supabase公式ドキュメントでは、LangChainのVector Storeとして`pgvector`拡張を利用する手順を解説し、SQLエディタからテーブル作成→Index設定→コードサンプルまでを一貫して案内しています ([Supabase][2])。

### 2.2 Supabase MCPサーバー

* SupabaseコミュニティのMCPサーバー(`supabase-mcp`)は、JSON-RPC経由で`execute_sql`や`list_tables`などのツールを提供し、CursorやClaudeなどのAIクライアントから安全にDB操作が可能です ([Supabase][7])。
* GitHubリポジトリでは、SupabaseプロジェクトへのMCPサーバー導入手順とストリーミングHTTP経由の運用例が公開されています ([GitHub][8])。

---

## 3. LangChainでのMCP活用

### 3.1 MCPサーバー利用のセットアップ

* LangChainのOAP (Open Agent Platform)ドキュメントでは、MCPサーバーとJWT交換を行うプロキシ実装例を示し、Supabase JWT→MCPトークンの発効フローを詳述しています ([docs.oap.langchain.com][9])。

### 3.2 `langchain-mcp-adapters` パッケージ

* `langchain-mcp-adapters` を導入することで、複数のMCPサーバーにまたがるツールをLangGraphエージェントやLangChainチェーンから透過的に呼び出せます ([LangChain][3])。
* インストールは `pip install langchain-mcp-adapters`、使用例として `MultiServerMCPClient` と `create_react_agent` の組み合わせが公式に示されています ([LangChain][3])。

---

## 4. Agentアーキテクチャの進化

### 4.1 モジュール型エージェント設計

* 2025年3月には、エージェントを「計画」「実行」「評価」「コミュニケーション」の4機能モジュールに分割するアーキテクチャが発表され、各モジュールの再利用性とテスト性が飛躍的に向上しました ([Info Services][4])。

### 4.2 コミュニティの声

* Redditのスレッドでは、LangChainのエージェントテンプレート増加が評価される一方、シンプル用途には軽量化を望む声も見られ、用途に応じた選択が推奨されています ([Reddit][10])。
* LangChain公式ブログでも、Webtoonなど大規模事例を通じたエージェント活用ケーススタディが数多く公開され、実運用化のノウハウが蓄積されています ([LangChain Blog][11])。

---

## 5. 今後の展望と選択肢

* **ハイブリッド利用**: Supabase MCPとLangChainを組み合わせ、データベース操作はMCP、ドキュメント検索・RAGはLangChainで担うアーキテクチャが最適です。
* **セルフホストとクラウド利用**: MCPサーバーはクラウド（Vercel/Render）でもステートレス動作するようHTTPストリーミング対応が整備済み ([docs.oap.langchain.com][9])。LangChainはPython/JS両対応なので、Next.js＋API Routeでも組み込み可能です。
* **評価・監視**: LangSmithによるエージェント評価とMCPのログを組み合わせ、エンドツーエンドのトレースと品質管理を実現しましょう ([LangChain Changelog][1])。

これらの情報を踏まえ、**Supabase MCPとLangChainを連携させたハイブリッドAIアーキテクチャ**の構築が、堅牢かつ拡張性の高い実装を実現します。さらに踏み込んだコード例や設定ファイルが必要でしたらお知らせください。

[1]: https://changelog.langchain.com/?utm_source=chatgpt.com "LangChain - Changelog"
[2]: https://supabase.com/docs/guides/ai/langchain?utm_source=chatgpt.com "LangChain | Supabase Docs"
[3]: https://langchain-ai.github.io/langgraph/agents/mcp/?utm_source=chatgpt.com "MCP Integration - GitHub Pages"
[4]: https://blogs.infoservices.com/artificial-intelligence/langchain-multi-agent-ai-framework-2025/?utm_source=chatgpt.com "LangChain & Multi-Agent AI in 2025: Framework, Tools & Use Cases"
[5]: https://blog.langchain.dev/interrupt-2025-recap/?utm_source=chatgpt.com "Recap of Interrupt 2025: The AI Agent Conference by LangChain"
[6]: https://changelog.langchain.com/?date=2025-05-01&page=2&utm_source=chatgpt.com "LangChain - Changelog"
[7]: https://supabase.com/blog/mcp-server?utm_source=chatgpt.com "Supabase MCP Server"
[8]: https://github.com/supabase-community/supabase-mcp?utm_source=chatgpt.com "Supabase MCP Server - GitHub"
[9]: https://docs.oap.langchain.com/setup/mcp-server?utm_source=chatgpt.com "MCP Server - Open Agent Platform"
[10]: https://www.reddit.com/r/AI_Agents/comments/1ks8s4h/thoughts_on_langchain_2025/?utm_source=chatgpt.com "Thoughts on Langchain? 2025 : r/AI_Agents - Reddit"
[11]: https://blog.langchain.dev/?utm_source=chatgpt.com "LangChain Blog"


実装計画

1.  **形態素解析器の変更 (Kuromoji → Sudachi):**
    *   より高性能で現代的な日本語形態素解析器であるSudachiを導入します。
    *   Sudachiを使ってテキストを分割・正規化し、これをEmbeddingベクトル生成の前処理や、場合によってはPGroongaのインデックス作成時のトークナイズ処理に利用します。
2.  **データベース操作の高度化 (Supabase MCPの導入):**
    *   自然言語クエリから直接SQLを高精度に生成・実行できるSupabase MCPサーバーを導入します。
    *   これにより、複雑な検索条件やデータベース更新操作を、より安全かつ柔軟に扱えるようになります。
    *   PGroongaやベクトル検索と組み合わせて、より高度な検索パイプラインを構築できます。
3.  **LLM連携のフレームワーク化 (LangChainの活用):**
    *   LLMとの連携をより体系的かつ効率的に行うためにLangChainを導入します。
    *   クエリ分析、リトリーバー（PGroonga, ベクトル検索, MCP経由のSQL実行などを含む）、LLMによる応答生成、後処理といった一連の処理をチェインとして構築し、管理しやすくします。
    *   プロンプトエンジニアリングやRAG (Retrieval Augmented Generation) の実装もLangChainを通じて行いやすくなります。

**この移行によって期待される効果:**

*   **日本語処理の精度向上:** Sudachiによるより質の高い形態素解析。
*   **検索柔軟性と精度の向上:** MCPによる自然言語での高度なDBクエリと、LangChainによるRAGなどの高度なLLM活用。
*   **開発効率の向上:** LangChainによるLLMアプリケーション開発の効率化、MCPによるSQL生成の自動化。
*   **システムの堅牢性と保守性の向上:** 各コンポーネントの役割分担の明確化。

**移行のステップ案:**

1.  **Sudachiの導入と評価:**
    *   Sudachiをプロジェクトに組み込み、現在のKuromojiと同様のテキスト処理（トークナイズ、正規化）を行えるようにします。
    *   いくつかのサンプルクエリでSudachiの解析結果がKuromojiと比較してどう変わるか、期待通りかを確認します。
    *   可能であれば、Sudachiでトークナイズした結果を使ってEmbeddingベクトルを再生成し、ベクトル検索の精度に変化があるか小規模にテストします。
2.  **Supabase MCPサーバーのセットアップと基本動作確認:**
    *   MCPサーバーを構築し、Supabaseデータベースに接続します。
    *   基本的な `execute_sql` ツールを使って、簡単な自然言語からSQLが生成され、実行されることを確認します。
3.  **LangChainの導入と基本的な検索チェインの構築:**
    *   LangChainを導入し、まずは現在の検索パイプライン（Sudachi/Kuromojiでの前処理 → PGroonga検索/ベクトル検索 → （MCPはまだ使わず）結果統合 → LLMによる応答生成）をLangChainのコンポーネントを使って再構築することを試みます。
4.  **MCPとLangChainの統合:**
    *   LangChainのカスタムツールとしてMCPの `execute_sql` を呼び出せるようにし、自然言語クエリに基づいてDBから直接情報を取得するリトリーバーを実装します。
    *   例えば、「特定の条件に合致するナレッジを3件教えて」という指示をMCPが解釈し、SQLを実行して結果を返す、といった流れです。
5.  **RAGパイプラインの構築:**
    *   取得したナレッジ（PGroonga、ベクトル、MCP経由）をコンテキストとしてLLMに渡し、より精度の高い回答を生成するRAGパイプラインをLangChainで構築します。
6.  **評価とチューニング:**
    *   既存の評価セット (`data/test_queries.csv`) を使い、新しいアーキテクチャでの検索精度や応答速度を評価し、各コンポーネント（Sudachiの辞書、Embeddingモデル、MCPのプロンプト、LLMの種類など）をチューニングします。

この移行は大きな変更となりますので、段階的に進め、各ステップで動作確認と評価を行うことが重要です。

まずは、「Sudachiの導入と基本的なトークナイズ処理の実装」から着手するのが現実的かと思いますが、いかがでしょうか？
現在の `src/lib/search.ts` にあるKuromoji関連の処理をSudachiに置き換えるイメージです。
Sudachiを利用するためのnpmパッケージの選定や、基本的な使い方を調査するところから始められます。


セキュリティについて

セキュリティを強固に保つには、\*\*「最小権限」「秘密情報の安全な保管」「アクセス監査」「鍵のライフサイクル管理」\*\*の４つを徹底することが肝要です。以下、Supabase＋MCP／LangChain 環境を想定した具体的なベストプラクティスをまとめます。

---

## 1. 最小権限の原則（Principle of Least Privilege）

* **匿名キー（anon）**

  * クライアント（ブラウザ／モバイル）用。RLSポリシーで必要最小限の操作に絞る。
* **Service Role Key**

  * サーバーサイド専用。Edge Functions や自前バックエンドだけに渡し、クライアントには絶対に露出しない。
* **PAT（Personal Access Token）**

  * アカウント管理用 API 限定。DBの読み書きでは使わず、MCPのマイグレーションやチーム管理ワークフローのみで運用。

### アクション

1. 環境変数（`.env` もしくは Secret Manager）にそれぞれ別の名前で分離して定義

   ```bash
   SUPABASE_ANON_KEY=…
   SUPABASE_SERVICE_ROLE_KEY=…
   SUPABASE_ACCESS_TOKEN=…
   ```
2. アプリコード／CI設定では用途別に正しい変数を参照するように厳密に分離
3. RLSポリシーを最初に設計し直し、**匿名キーでもできること→Service Role Keyが本当に必要な操作**を明確化

---

## 2. 秘密情報の安全な保管と供給

* **Local 開発環境**

  * macOS の Keychain、Windows の Credential Manager、Linux の `gpg-agent` など、OSの安全ストアを活用。
* **CI／CD 環境**

  * GitHub Actions の Secrets、GitLab CI の Variables、CircleCI の Contexts など、暗号化された環境変数機能を利用。
* **クラウド環境／Production**

  * AWS Secrets Manager、GCP Secret Manager、HashiCorp Vault などで鍵を管理し、ランタイムに注入。

### アクション

* 秘密情報は**平文ファイルやコードリポジトリに絶対コミットしない**
* CI環境へは **手動で登録 or Terraform など IaC で暗号化** された形でのみ投入

---

## 3. アクセス監査とモニタリング

* **Supabase の Audit Logs（Enterpriseプラン）**

  * 誰がいつ Service Role Key を使ってどの操作をしたかを記録。
* **Edge Function／API サーバーのアクセスログ**

  * 生成リクエストごとに「使用したキー種別」「発行元IP」「実行したクエリ or エンドポイント」をログ出力。
* **アラート設定**

  * 不正なキー利用（例: anon キーで許可されない操作を試みた、Service Role Key による大量クエリなど）を検知したら Slack やメールでリアルタイム通知。

### アクション

* Supabase ダッシュボードで Logs → Audit を有効化
* 独自サーバー／Edge Functions で、リクエストごとに `x-supabase-auth` ヘッダの種類を記録し、異常検知ルールを設定

---

## 4. 鍵のライフサイクル管理とローテーション

* **用途ごとに鍵を発行**し、使わなくなったら即時削除
* **定期ローテーション**（例：90日ごと）をポリシー化し、古い鍵は段階的に取り替え
* **ロールバックプラン** を用意

  * 新しい鍵での動作確認 → 問題なければ古い鍵を無効化
  * 万一不具合が出たら旧鍵にロールバックできるよう、鍵の有効化順序をドキュメント化

---

### まとめ

1. **キーごとに用途を厳密に分け**、RLS／環境変数によってガードする
2. **秘密情報は暗号化ストア／OSのシークレット管理機能で保護**
3. **アクセスログとアラート**で不正利用を即時検知
4. **定期的な鍵のローテーション**とロールバックプランの整備

これらを踏まえれば、Supabase＋MCP＋LangChain 環境においても高い水準でセキュリティを確保できます。追加で「具体的な Terraform 定義例」や「Edge Function ロギングサンプル」が必要でしたらお申し付けください。


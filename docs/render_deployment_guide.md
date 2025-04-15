# Docker コンテナ (PostgreSQL + PGroonga) を Render にデプロイする手順

このドキュメントは、PostgreSQL と PGroonga を使用した検索システムの Docker コンテナを Render プラットフォームにデプロイするための詳細な手順を示します。プロジェクトの成功に向けて、各ステップを慎重に実行してください。

## フェーズ 1: ローカル環境での準備

### 1.1 データベースのデータエクスポート

現在稼働中のローカル Docker コンテナから PostgreSQL のデータをダンプ（バックアップ）します。これにより、Render 上でデータを復元できます。

```bash
# コマンド実行前に、<container-name>, <user>, <db-name> を実際の値に置き換えてください
# 例: docker exec -it parking-db-container pg_dump -U postgres -d parking_db > knowledge_dump.sql

docker exec -it <container-name> pg_dump -U <user> -d <db-name> > knowledge_dump.sql
```

*   **確認事項:** `knowledge_dump.sql` ファイルがプロジェクトの適切な場所に生成されたことを確認してください。

### 1.2 プロジェクトディレクトリ構成の準備

Render でのデプロイに必要な設定ファイルを整理するためのディレクトリ構造を準備します。リポジトリのルートに `render-db-deploy` ディレクトリを作成し、その中にファイルを配置することを推奨します。

```
<リポジトリルート>/
├── render-db-deploy/
│   ├── Dockerfile          # Render でコンテナをビルドするための設定ファイル
│   ├── init.sql            # DB初期化スクリプト (テーブル作成、拡張有効化など)
│   ├── knowledge_dump.sql  # 手順1.1でエクスポートしたデータファイル
│   └── render.yaml         # Render のデプロイ設定 (Blueprintファイル)
└── ... (他のプロジェクトファイル)
```

*   **注意:** `knowledge_dump.sql` を `render-db-deploy` ディレクトリ内に移動またはコピーしてください。

### 1.3 Git での管理

作成したデプロイ関連ファイルを Git リポジトリで管理します。これにより、変更履歴の追跡やチームでの共有が容易になります。

```bash
# render-db-deploy ディレクトリに移動 (すでにリポジトリルートにいる場合)
cd render-db-deploy

# もしまだ Git リポジトリでなければ初期化
# git init

# 新しいファイルと変更をステージング
git add Dockerfile init.sql render.yaml knowledge_dump.sql

# 変更内容をコミット
git commit -m "feat: Prepare files for Render PostgreSQL+PGroonga deployment"

# リモートリポジトリ (GitHubなど) にプッシュ
# git remote add origin <your-remote-repo-url> # まだの場合
# git push origin <your-branch-name> # 例: git push origin main
```

*   **確認事項:** ファイルが正しくコミットされ、リモートリポジトリにプッシュされたことを確認してください。

## フェーズ 2: 設定ファイルの作成

### 2.1 Dockerfile の作成

PostgreSQL 16 をベースイメージとし、PGroonga 拡張機能をインストールするための `Dockerfile` を作成します。

```dockerfile
# render-db-deploy/Dockerfile

# ベースイメージとして PostgreSQL 16 を指定
FROM postgres:16

# PGroonga のインストールに必要なパッケージをインストールし、リポジトリを追加
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg \
    && curl -fsSL https://packages.groonga.org/debian/groonga-apt-source-latest-bookworm.deb -o /tmp/groonga.deb \
    && apt-get install -y /tmp/groonga.deb \
    && apt-get update \
    # PostgreSQL 用の PGroonga パッケージをインストール
    && apt-get install -y --no-install-recommends postgresql-16-pgroonga \
    # 不要なキャッシュやファイルを削除してイメージサイズを最適化
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/*.deb

# データベース初期化時に実行されるSQLスクリプトとデータファイルをコンテナ内にコピー
# /docker-entrypoint-initdb.d/ ディレクトリに置かれた .sql や .sh ファイルは、
# PostgreSQL コンテナの初回起動時に自動的に実行されます。
COPY ./init.sql /docker-entrypoint-initdb.d/
COPY ./knowledge_dump.sql /docker-entrypoint-initdb.d/

# PostgreSQL がリッスンする標準ポートを公開 (情報提供目的、Renderでは自動処理)
EXPOSE 5432
```

*   **確認事項:** Dockerfile の内容を確認し、特に PGroonga のインストール手順に誤りがないか確認してください。

### 2.2 初期化スクリプト (`init.sql`) の作成

データベースコンテナの初回起動時に実行され、テーブルスキーマの作成、PGroonga 拡張の有効化、データインポートを行う SQL スクリプトを作成します。

```sql
-- render-db-deploy/init.sql

-- スクリプト全体を一つのトランザクションとして実行し、エラー発生時に自動ロールバック
BEGIN;

-- PGroonga 拡張機能が存在しない場合のみ作成
CREATE EXTENSION IF NOT EXISTS pgroonga;

-- 'Knowledge' テーブルが存在しない場合のみ作成
-- 注意: カラム名、データ型、制約は実際のプロジェクトのスキーマに合わせて正確に定義してください
CREATE TABLE IF NOT EXISTS "Knowledge" (
  id SERIAL PRIMARY KEY,
  question TEXT,
  answer TEXT,
  is_template BOOLEAN DEFAULT FALSE,
  sub_category TEXT,
  tags TEXT[] -- 配列型を使用する場合の例
  -- 必要に応じて他のカラム (created_at, updated_at など) も追加
);

-- PGroonga インデックスが存在しない場合のみ作成
-- 'question' と 'answer' カラムを日本語形態素解析 (TokenMecab) を使ってインデックス化
CREATE INDEX IF NOT EXISTS pgroonga_knowledge_idx ON "Knowledge"
USING pgroonga (question, answer)
WITH (tokenizer = 'TokenMecab');

-- データダンプファイルをインポート
-- \i は psql のメタコマンドですが、PostgreSQL の公式 Docker イメージのエントリーポイントスクリプトが
-- /docker-entrypoint-initdb.d/ 内の .sql ファイルを適切に処理します。
\echo 'Importing data from knowledge_dump.sql...'
\i /docker-entrypoint-initdb.d/knowledge_dump.sql
\echo 'Data import finished.'

-- トランザクションをコミット
COMMIT;
```

*   **確認事項:** `CREATE TABLE` 文と `CREATE INDEX` 文がプロジェクトの実際のデータベーススキーマと完全に一致していることを確認してください。特にカラム名、データ型、インデックス対象カラムが重要です。

### 2.3 `render.yaml` (Blueprint) の作成

Render に対して、インフラストラクチャ（データベースサービス）をどのようにコードで定義し、デプロイするかを指定する Blueprint ファイルを作成します。

```yaml
# render-db-deploy/render.yaml

services:
  # PostgreSQL + PGroonga データベースサービスの定義
  - type: pserv # Private Service: 同一 Render アカウント内のサービスからのみアクセス可能
    name: parking-search-db # Render 上で表示されるサービス名 (任意に設定可能)
    env: docker # Dockerfile を使用して環境を構築
    # 接続する Git リポジトリの URL を指定
    repo: https://github.com/<your-username>/<your-repo-name>.git # 例: https://github.com/user1/parking-response-generatorv3.git
    # デプロイ対象のブランチを指定
    branch: main
    # リポジトリルートからの Dockerfile へのパスを指定
    dockerfilePath: ./render-db-deploy/Dockerfile
    # (オプション) Docker ビルドコンテキストのパス (Dockerfile と同じディレクトリなら通常不要)
    # dockerContext: ./render-db-deploy
    # Render のリソースプランを選択 (最初は 'starter' で、必要に応じてスケールアップ)
    plan: starter
    # デプロイするリージョンを選択 (ユーザーに近い、または連携するアプリと同じリージョンを推奨)
    # 例: oregon, frankfurt, singapore, tokyo
    region: singapore
    envVars: # 環境変数の設定
      - key: POSTGRES_USER
        value: postgres # PostgreSQL のユーザー名 (任意に変更可能)
      - key: POSTGRES_PASSWORD
        sync: false # セキュリティ上、パスワードは Render ダッシュボードで直接設定する
      - key: POSTGRES_DB
        value: parking_db # 作成するデータベース名 (任意に変更可能)
      # (オプション) PostgreSQL や PGroonga のパフォーマンスチューニング用環境変数
      # 例: shared_buffers, work_mem など (必要に応じて追加)
    disk: # データベースのデータを永続化するためのディスク設定
      name: postgres-data # ディスクの名前 (任意)
      mountPath: /var/lib/postgresql/data # コンテナ内のデータディレクトリをマウント
      sizeGB: 10 # ディスクサイズ (GB単位、データ量に応じて調整)
```

*   **確認事項:** `repo`, `branch`, `dockerfilePath`, `region`, 各 `envVars` の `value` (パスワード以外), `disk` の設定がプロジェクトに合わせて正しく指定されていることを確認してください。特に `repo` と `dockerfilePath` は重要です。

## フェーズ 3: Render へのデプロイ

### 3.1 設定ファイルを Git に Push

フェーズ 2 で作成・修正した `Dockerfile`, `init.sql`, `render.yaml` を Git にコミットし、リモートリポジトリにプッシュします。

```bash
# render-db-deploy ディレクトリにいることを確認
git add Dockerfile init.sql render.yaml
git commit -m "feat: Finalize configuration files for Render DB deployment"
git push origin <your-branch-name> # 例: git push origin main
```

### 3.2 Render で Blueprint からデプロイ

1.  Render ダッシュボード ([https://dashboard.render.com/](https://dashboard.render.com/)) にログインします。
2.  画面右上の「New」ボタンをクリックし、「Blueprint」を選択します。
3.  「Connect repository」で、設定ファイルをプッシュした Git リポジトリを選択・接続します。
4.  Render がリポジトリ内の `render.yaml` を自動的に検出し、プレビューが表示されます。サービス名 (`parking-search-db`) や設定内容を確認します。
5.  **最重要:** `parking-search-db` サービスの「Environment」セクションで、`POSTGRES_PASSWORD` の右側にある「Edit」または鍵アイコンをクリックし、**安全で強力なパスワードを設定**します。パスワードマネージャーなどで生成したランダムな文字列を推奨します。**このパスワードは後でアプリケーション接続に使用しますので、安全な場所に記録してください。**
6.  すべての設定を確認したら、「Apply」または「Create」ボタンをクリックしてデプロイを開始します。

### 3.3 デプロイ状況の確認

*   Render ダッシュボードの「Events」タブでデプロイの進捗状況を確認できます。リポジトリのクローン、Docker イメージのビルド、コンテナの起動、初期化スクリプトの実行が行われます。
*   「Logs」タブでは、コンテナのリアルタイムログを確認できます。特に初回起動時の `init.sql` の実行ログや PGroonga の初期化ログに注目し、エラーが発生していないか確認します。
*   デプロイが成功すると、ステータスが "Live" になります。初回はデータインポートがあるため、数分から数十分かかる場合があります。

## フェーズ 4: アプリケーションとの接続

### 4.1 Render DB 接続情報の取得

1.  Render ダッシュボードで、デプロイされた `parking-search-db` サービスの詳細ページを開きます。
2.  ページ内の「Connect」または「Info」セクションを探します。
3.  **Internal Connection String** または **Internal Hostname** を見つけます。これは、同じ Render アカウント内の他のサービス（例: バックエンドAPI）からデータベースに接続するために使用するホスト名です（例: `parking-search-db-xxxx.onrender.com` のような形式ではなく、`parking-search-db` のような短い形式の場合があります）。
4.  ユーザー名 (`postgres` または設定した値)、データベース名 (`parking_db` または設定した値)、ポート番号 (`5432`) も確認します。

### 4.2 バックエンドアプリケーションの環境変数設定

検索機能を持つバックエンドアプリケーション（例: Next.js API ルート）が Render のデータベースに接続できるように、環境変数を設定します。

```bash
# アプリケーションの .env ファイルまたは Render の Web Service 環境変数設定に追加
# <user>, <password>, <internal-hostname>, <db-name> は Render ダッシュボードで確認/設定した値に置き換える
DATABASE_URL="postgresql://<user>:<password>@<internal-hostname>:5432/<db-name>?sslmode=prefer"
```

*   **注意:** `<password>` はフェーズ 3.2 で設定した **安全なパスワード** を使用します。
*   `sslmode=prefer` を追加しておくと、Render が SSL 接続を提供している場合に利用され、より安全です。
*   アプリケーションが Prisma を使用している場合は、`schema.prisma` ファイルの `datasource db` の `url` が `env("DATABASE_URL")` を参照していることを確認してください。
*   環境変数を変更したら、バックエンドアプリケーションを再起動または再デプロイする必要があります。

## フェーズ 5: 動作確認と保守

### 5.1 ログの最終確認

*   Render ダッシュボードで DB サービスのログを再度確認し、アプリケーションからの接続試行時にエラーが発生していないか確認します。

### 5.2 接続テスト (推奨)

*   **Render Shell:** Render のバックエンドアプリケーションサービス（Web Service）のダッシュボードに「Shell」タブがあれば、そこから `psql` コマンドを使って Internal Hostname で DB に接続試行できます。
    ```bash
    # Render Web Service の Shell タブ内で実行
    psql "$DATABASE_URL"
    # 接続後、テーブル一覧表示などで確認
    \dt
    SELECT COUNT(*) FROM "Knowledge";
    \q
    ```
*   **ローカルからの接続 (注意が必要):** Private Service は通常、外部からの直接接続を許可しません。テスト目的で一時的に外部接続を許可したい場合は、Render の設定で IP 制限などを構成する必要がありますが、セキュリティリスクが高まるため非推奨です。基本的にはアプリケーション経由でのテストを行います。

### 5.3 アプリケーションからの検索機能テスト

*   実際にバックエンドアプリケーションの検索 API エンドポイントを叩き、様々なキーワードで検索を実行します。
*   期待通りの結果が返ってくるか、PGroonga が意図通りに動作しているか（例: `is_template=true` の優先順位付け、関連性の高い結果）を確認します。
*   パフォーマンス（応答速度）も確認します。

### 5.4 バックアップ戦略の確立

*   **重要:** Render の Private Service には自動バックアップ機能が標準で提供されません。データの損失を防ぐために、**必ず定期的なバックアップ計画を立て、実行してください。**
*   **方法:**
    *   **Render Cron Jobs:** Render の Cron Job 機能を使って、定期的に `pg_dump` を実行するスクリプトを動かします。
        ```bash
        # Cron Job で実行するコマンド例 (バックアップファイルを外部ストレージに送る処理も追加推奨)
        pg_dump "$DATABASE_URL" -F c -b -v -f "/path/to/backup/backup_$(date +%Y%m%d_%H%M%S).dump"
        # 例: aws s3 cp /path/to/backup/ s3://your-backup-bucket/ --recursive
        ```
    *   **手動バックアップ:** 定期的に手動で `pg_dump` を実行します（推奨されません）。
*   バックアップファイルは、Render のディスクとは別の安全な場所（例: AWS S3, Google Cloud Storage）に保存することを強く推奨します。
*   定期的にバックアップからのリストアテストを行い、バックアップが有効であることを確認します。

### 5.5 監視とメンテナンス

*   Render ダッシュボードで DB サービスの「Metrics」タブを定期的に確認し、CPU 使用率、メモリ使用量、ディスク I/O、ディスク使用量などを監視します。
*   リソースが逼迫している場合は、Render のプランをアップグレードすることを検討します。
*   PostgreSQL や PGroonga のバージョンアップは、Render 側でのベースイメージ更新や、Dockerfile の手動更新と再デプロイによって行います。互換性を十分にテストしてから本番環境に適用してください。

---

この手順書が、プロジェクトの Render へのデプロイを成功させる一助となることを願っています。各ステップを慎重に進め、疑問点があればその都度確認してください。 
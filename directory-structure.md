# Parking Response Generator - ディレクトリ構造

## プロジェクト概要
駐車場の予約および問い合わせ対応に関する質問応答システム。日本語の自然言語クエリを処理し、PostgreSQLと全文検索エンジンPGroongaを使用して適切な回答を検索します。

## ディレクトリ構造

```
parking-response-generatorv3/
│
├── data/ 
│   ├── QA01.txt              # 質問応答データ
│   ├── test-Q.txt            # テスト用質問
│   ├── test-results.csv      # テスト結果(CSV形式)
│   └── test-results.json     # テスト結果(JSON形式)
│
├── docs/
│   ├── database-setup.md     # データベースセットアップ手順
│   ├── response-algorithm.md # 応答生成アルゴリズムの説明
│   └── roadmap.md            # 開発ロードマップ
│
├── prisma/
│   ├── migrations/           # データベースマイグレーション
│   │   ├── 20250306181223_init/
│   │   ├── 20250307094718_add_full_text_search/
│   │   ├── 20250310000000_create_search_synonym/
│   │   ├── 20250310_enhance_japanese_search/
│   │   ├── 20250311_update_search_weights/
│   │   └── ...
│   └── schema.prisma         # Prismaスキーマ定義
│
├── public/
│   ├── kuromoji/             # 日本語形態素解析エンジン
│   │   └── dict/             # 形態素解析辞書データ
│   └── ...                   # 静的アセット
│
├── scripts/
│   ├── add-complaint-tags.ts # 苦情タグ追加スクリプト
│   ├── add-synonyms.ts       # 同義語追加スクリプト
│   ├── import-data.ts        # データインポートスクリプト
│   └── import-tags.ts        # タグインポートスクリプト
│
├── src/
│   ├── app/                  # Next.js アプリケーション
│   │   ├── admin/            # 管理者インターフェース
│   │   │   ├── components/   # 管理者UI部品
│   │   │   ├── hooks/        # 管理者用カスタムフック
│   │   │   ├── knowledge/    # ナレッジベース管理
│   │   │   └── login/        # 管理者ログイン
│   │   │
│   │   ├── api/              # APIエンドポイント
│   │   │   ├── admin/        # 管理者API
│   │   │   ├── auth/         # 認証API
│   │   │   ├── knowledge/    # ナレッジベースAPI
│   │   │   ├── query/        # 検索クエリAPI
│   │   │   ├── refine/       # 検索結果精緻化API
│   │   │   ├── search/       # 検索API
│   │   │   └── tags/         # タグ管理API
│   │   │
│   │   ├── providers/        # コンテキストプロバイダー
│   │   ├── search/           # 検索ページ
│   │   ├── globals.css       # グローバルスタイル
│   │   ├── layout.tsx        # レイアウト定義
│   │   └── page.tsx          # メインページ
│   │
│   ├── components/           # 共通コンポーネント
│   │   ├── HistoryList.tsx   # 検索履歴リスト
│   │   ├── QueryInput.tsx    # 検索入力フォーム
│   │   ├── ResponseArea.tsx  # 応答表示エリア
│   │   └── ...
│   │
│   ├── data/                 # データファイル
│   │   ├── csv/              # CSVデータ
│   │   │   ├── backup/       # バックアップデータ
│   │   │   └── production/   # 本番用データ
│   │   │
│   │   └── sql/              # SQLスクリプト
│   │       ├── backup/       # SQLバックアップ
│   │       └── ...
│   │
│   ├── db/                   # データベース関連
│   │   ├── migrations/       # データベースマイグレーション
│   │   └── setup.ts          # DB設定
│   │
│   ├── lib/                  # ユーティリティライブラリ
│   │   ├── anthropic.ts      # Anthropic AI連携
│   │   ├── db.ts             # データベース接続
│   │   ├── prisma.ts         # Prismaクライアント
│   │   ├── search.ts         # 検索機能実装
│   │   ├── tag-search.ts     # タグベース検索
│   │   └── utils.ts          # ユーティリティ関数
│   │
│   ├── scripts/              # スクリプト
│   │   ├── check-db.ts       # DB接続確認
│   │   ├── check-pgroonga.js # PGroonga確認
│   │   ├── create-pgroonga-indexes.js    # PGroongaインデックス作成
│   │   ├── normalize-search-vectors.js   # 検索ベクトル正規化
│   │   ├── test-improved-search.js       # 改善後検索テスト
│   │   └── test-search.js                # 検索テスト
│   │
│   └── types/                # 型定義
│       └── next-auth.d.ts    # 認証型定義
│
├── tests/                    # テストファイル
│   ├── test-cancel-queries.ts   # キャンセル関連クエリのテスト
│   ├── test-complaint-queries.ts # 苦情関連クエリのテスト
│   ├── test-hours-queries.ts     # 営業時間関連クエリのテスト
│   ├── test-queries.ts           # 一般的なクエリのテスト
│   └── test-search.ts            # 検索機能のテスト
│
├── .env                      # 環境変数
├── .env.local                # ローカル環境変数
├── docker-compose.yml        # Docker Compose設定
├── next.config.js            # Next.js設定
├── package.json              # パッケージ設定
├── search-improvements.md    # 検索機能改善計画
└── tailwind.config.ts        # Tailwind CSS設定
```

## 重要な検索関連ファイル

1. **src/lib/search.ts**
   - 検索機能のメイン実装
   - 日本語クエリの前処理
   - PGroongaを使用した全文検索
   - 検索結果のスコアリング

2. **src/lib/tag-search.ts**
   - タグベースの検索機能
   - カテゴリマッチングスコアの計算

3. **src/scripts/test-search.js**
   - 検索機能のテスト実行スクリプト
   - 各クエリに対する検索結果の評価

4. **src/scripts/test-improved-search.js**
   - 改善された検索機能のテスト

5. **prisma/migrations/20250310_enhance_japanese_search/migration.sql**
   - 日本語検索機能強化のためのマイグレーション

6. **src/scripts/normalize-search-vectors.js**
   - 検索ベクトルの正規化スクリプト

7. **src/scripts/create-pgroonga-indexes.js**
   - PGroongaインデックス作成スクリプト

## 検索関連のキー機能

1. **preprocessJapaneseQuery**
   - 日本語クエリの前処理
   - キーワード抽出
   - 同義語展開

2. **searchKnowledge**
   - メイン検索機能
   - 複数の検索戦略を段階的に適用
   - 結果のスコアリングと並べ替え

3. **PGroonga検索演算子**
   - `&@~`: 自然言語検索
   - `&@`: 単語マッチング検索

4. **フォールバック検索戦略**
   - PGroonga検索
   - ILIKE検索
   - 最新エントリ返却

## データベースモデル

1. **Knowledge**
   - 質問応答データを格納
   - 検索ベクトルを含む

2. **Tag**
   - タグ情報の格納

3. **KnowledgeTag**
   - ナレッジとタグの関連付け

4. **ResponseLog**
   - 検索クエリと応答の記録 
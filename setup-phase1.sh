#!/bin/bash

set -e

echo "=== Phase 1 (ハイブリッド検索) セットアップ開始 ==="

# 0. 前提条件の確認
echo "0. 前提条件の確認..."
if [ -z "$OPENAI_API_KEY" ]; then
  if [ ! -f .env ]; then
    echo "エラー: .envファイルが見つかりません。.env.exampleをコピーして.envを作成し、OPENAI_API_KEYを設定してください。"
    exit 1
  fi
  
  if ! grep -q "OPENAI_API_KEY" .env; then
    echo "エラー: .envファイルにOPENAI_API_KEYが設定されていません。"
    exit 1
  fi
fi

# 1. pgvector拡張のインストール確認
echo "1. pgvector拡張のインストール確認..."
echo "注意: PostgreSQLのパスワードを入力する必要があります。"
echo "  コマンド: CREATE EXTENSION IF NOT EXISTS vector;"
echo "実行しますか？ (y/n)"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  psql -h db.cvftwowputplnkskjbfx.supabase.co -p 5432 -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
else
  echo "SQL拡張のインストールはスキップされました。手動で実行してください。"
fi

# 2. 依存パッケージのインストール
echo "2. 依存パッケージのインストール..."
echo "  npm install node-fetch openai"
if ! npm list openai >/dev/null 2>&1; then
  npm install node-fetch openai
else
  echo "openaiパッケージはすでにインストールされています。"
fi

# 3. Prismaスキーマの更新とマイグレーション
echo "3. Prismaスキーマの更新とマイグレーション..."
echo "  npx prisma migrate dev --name add_embedding_vector"
echo "実行しますか？ (y/n)"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  npx prisma migrate dev --name add_embedding_vector
else
  echo "マイグレーションはスキップされました。手動で実行してください。"
fi

# 4. ナレッジベクトルの生成
echo "4. ナレッジベクトルの生成..."
echo "注意: このステップではOpenAI APIが使用され、料金が発生する可能性があります。"
echo "実行しますか？ (y/n)"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  npm run generate-embeddings
else
  echo "ベクトル生成はスキップされました。手動で実行してください。"
fi

# 5. ハイブリッド検索のテスト
echo "5. ハイブリッド検索のテスト..."
echo "実行しますか？ (y/n)"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  npm run test:comprehensive
else
  echo "テストはスキップされました。手動で実行してください。"
fi

echo "=== Phase 1 セットアップ完了 ==="
echo "各ステップが正常に完了したら、ハイブリッド検索が利用可能になります！"
echo ""
echo "手動で実行するコマンド:"
echo "1. CREATE EXTENSION IF NOT EXISTS vector;"
echo "2. npm install node-fetch openai"
echo "3. npx prisma migrate dev --name add_embedding_vector"
echo "4. npm run generate-embeddings"
echo "5. npm run test:comprehensive" 
#!/bin/bash

# PostgreSQLコンテナ名
CONTAINER_NAME="parking-response-generatorv3-db-1"
# データベース名
DB_NAME="parking_response"
# ユーザー名
DB_USER="postgres"

# SQLファイルのディレクトリ
SQL_DIR="$(dirname "$0")"

# テーブルの作成
echo "Creating tables..."
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < "$SQL_DIR/create-tables.sql"

# 既存の関連付けを削除
echo "Cleaning up existing relationships..."
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "DELETE FROM knowledge_tag;"

# タグと同義語のインポート
echo "Importing tags and synonyms..."
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < "$SQL_DIR/import-tags.sql"

# ナレッジとタグの関連付け
echo "Linking knowledge with tags..."
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < "$SQL_DIR/link-knowledge-tags.sql"

echo "Data import completed." 
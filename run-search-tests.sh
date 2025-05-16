#!/bin/bash

echo "===== 検索テストログの記録開始 ====="
echo "実行日時: $(date)"
echo ""

# シンプルな検索テストを実行
echo "===== シンプル検索テストを実行します ====="
node simple-search-test.js | tee search-test.log

echo ""
echo "検索テストログは以下のファイルに保存されました:"
echo "- search-test.log"

echo ""
echo "===== 検索テストログの記録終了 ====="

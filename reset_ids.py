import csv
import os

# IDマッピングを保存する辞書
id_mapping = {}

# Knowledge CSVファイルの処理
with open('knowledge_backup.csv', 'r', encoding='utf-8') as infile, \
     open('knowledge_reset.csv', 'w', encoding='utf-8', newline='') as outfile:
    reader = csv.reader(infile)
    writer = csv.writer(outfile)
    
    # ヘッダー行を読み込んで書き込む
    header = next(reader)
    writer.writerow(header)
    
    # データ行を処理
    new_id = 1
    for row in reader:
        old_id = int(row[0])
        id_mapping[old_id] = new_id
        
        # IDを新しい値に置き換える
        row[0] = str(new_id)
        writer.writerow(row)
        new_id += 1

print(f"Knowledgeテーブルの処理完了: {len(id_mapping)}件のIDを1から{new_id-1}に振り直しました。")

# KnowledgeTag CSVファイルの処理
if os.path.exists('knowledge_tag_backup.csv'):
    with open('knowledge_tag_backup.csv', 'r', encoding='utf-8') as infile, \
         open('knowledge_tag_reset.csv', 'w', encoding='utf-8', newline='') as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        # ヘッダー行を読み込んで書き込む
        header = next(reader)
        writer.writerow(header)
        
        # データ行を処理
        updated_count = 0
        skipped_count = 0
        for row in reader:
            if row[0].isdigit():  # knowledge_idが数値であることを確認
                old_knowledge_id = int(row[0])
                if old_knowledge_id in id_mapping:
                    # knowledge_idを新しい値に置き換える
                    row[0] = str(id_mapping[old_knowledge_id])
                    writer.writerow(row)
                    updated_count += 1
                else:
                    # マッピングにないIDはスキップ
                    skipped_count += 1
            else:
                # 数値でない行はそのまま書き込む
                writer.writerow(row)
        
        print(f"KnowledgeTagテーブルの処理完了: {updated_count}件のIDを更新、{skipped_count}件をスキップしました。")
else:
    print("KnowledgeTagのバックアップファイルが見つかりません。")

print("処理が完了しました。") 
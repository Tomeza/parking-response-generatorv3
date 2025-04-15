import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface KnowledgeData {
  main_category?: string;
  sub_category?: string;
  detail_category?: string;
  question?: string;
  answer?: string;
  original_tags?: string;
  reply_type_tags?: string;
  info_source_tags?: string;
  situation_tags?: string;
  usage?: string;
  note?: string;
  issue?: string;
  is_template?: string;
}

async function deleteAndImportData() {
  try {
    console.log('処理を開始します...');
    
    // 削除対象のID
    const idsToDelete = [134, 135, 136];
    
    // 関連するKnowledgeTagエントリを先に削除
    console.log('関連するKnowledgeTagエントリを削除中...');
    const deleteTagsResult = await prisma.knowledgeTag.deleteMany({
      where: {
        knowledge_id: {
          in: idsToDelete
        }
      }
    });
    
    console.log(`${deleteTagsResult.count}件のKnowledgeTagエントリを削除しました`);
    
    // 既存の予約関連エントリを削除
    console.log('既存の予約関連エントリを削除中...');
    const deleteResult = await prisma.knowledge.deleteMany({
      where: {
        id: {
          in: idsToDelete
        }
      }
    });
    
    console.log(`${deleteResult.count}件のKnowledgeエントリを削除しました`);
    
    // CSVファイルを読み込む
    const projectRoot = path.resolve(__dirname, '..');
    const csvPath = path.join(projectRoot, 'src', 'data', 'csv', 'production', 'knowledge_update_reservation_items.csv');
    console.log(`CSVファイル読み込み: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSVファイルが見つかりません: ${csvPath}`);
    }
    
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // CSVをパース
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    
    console.log('新しいエントリを追加中...');
    let createdCount = 0;
    const createdIds = [];
    
    // データをインポート
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const data: KnowledgeData = {};
      
      headers.forEach((header: string, index: number) => {
        if (values[index]) {
          data[header.trim() as keyof KnowledgeData] = values[index].trim();
        }
      });
      
      // Knowledgeテーブルに挿入
      const created = await prisma.knowledge.create({
        data: {
          main_category: data.main_category || null,
          sub_category: data.sub_category || null,
          detail_category: data.detail_category || null,
          question: data.question || null,
          answer: data.answer || '',
          is_template: data.is_template === 'true',
          usage: data.usage || null,
          note: data.note || null,
          issue: data.issue || null
        }
      });
      
      createdIds.push(created.id);
      createdCount++;
      console.log(`エントリ作成: ID=${created.id}, main_category=${created.main_category}, sub_category=${created.sub_category}`);
    }
    
    console.log(`${createdCount}件の新しいエントリを追加しました`);
    console.log(`作成されたID: ${createdIds.join(', ')}`);
    console.log('処理が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAndImportData(); 
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface KnowledgeData {
  main_category?: string;
  sub_category?: string;
  detail_category?: string;
  question?: string;
  answer?: string;
  is_template?: string;
  usage?: string;
  note?: string;
  issue?: string;
}

async function importKnowledgeData() {
  try {
    console.log('データインポート開始...');
    
    // CSVファイルを読み込む
    const csvPath = path.join(__dirname, 'src', 'data', 'csv', 'production', 'knowledge_complaint_template.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // CSVをパース
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    
    // 既存のデータを削除（コメントアウトして既存データを保持）
    // await prisma.knowledgeTag.deleteMany({});
    // await prisma.knowledge.deleteMany({});
    
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
      await prisma.knowledge.create({
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
    }
    
    console.log('データインポート完了');
  } catch (error) {
    console.error('データインポートエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importKnowledgeData(); 
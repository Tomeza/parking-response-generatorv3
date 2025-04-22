import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
// const __filename = fileURLToPath(import.meta.url); // <- コメントアウト
// const __dirname = path.dirname(__filename);

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
    const projectRoot = path.resolve(__dirname, '..'); // プロジェクトルートを取得
    const csvPath = path.join(projectRoot, 'src', 'data', 'csv', 'production', 'knowledge_solo_shuttle.csv'); // <- ファイル名を変更
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
        if (values[index] !== undefined) { // 値が存在するかチェック
          let value = values[index].trim(); // まずtrim

          // 前後のダブルクォートを除去
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
            // ダブルクォート内で "" となっているエスケープされたクォートを " に戻す (必要に応じて)
            // value = value.replace(/""/g, '"');
          }

          // answerフィールドの場合、改行文字 \n を削除 (以前のリクエストのまま)
          // ※ もし改行を残したい場合は、この if ブロックを削除またはコメントアウト
          // if (header.trim() === 'answer') { 
          //    value = value.replace(/\\n/g, '').replace(/\\r/g, '');
          // }

          data[header.trim() as keyof KnowledgeData] = value;
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
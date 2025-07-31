import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function backupFaqData() {
  try {
    // FAQ RAWデータの取得
    const faqRawData = await prisma.faqRaw.findMany({
      orderBy: { id: 'asc' }
    });

    // バックアップファイル名の生成（日付付き）
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const backupDir = path.join(path.dirname(__dirname), 'backups', 'faq');
    const filename = `faq_raw_backup_${timestamp}.csv`;
    const filepath = path.join(backupDir, filename);

    // CSVデータの作成
    const csvHeader = 'id,question,answer,created_at,updated_at\n';
    const csvRows = faqRawData.map(row => {
      return `${row.id},"${row.question.replace(/"/g, '""')}","${row.answer.replace(/"/g, '""')}","${row.createdAt.toISOString()}","${row.updatedAt.toISOString()}"`;
    }).join('\n');

    // CSVファイルの保存
    writeFileSync(filepath, csvHeader + csvRows);

    console.log(`Backup completed successfully: ${filename}`);
    console.log(`Total records backed up: ${faqRawData.length}`);
    console.log(`Backup location: ${filepath}`);

    return filepath;
  } catch (error) {
    console.error('Error during backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  backupFaqData()
    .catch(console.error);
}

export { backupFaqData }; 
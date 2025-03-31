const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  try {
    const records = await prisma.knowledge.findMany({
      where: { id: { gte: 132, lte: 153 } },
      orderBy: { id: 'asc' }
    });

    let csvContent = 'id,main_category,sub_category,detail_category,question,answer,is_template,usage,note,issue\n';
    
    for (const r of records) {
      // CSVフォーマットでエスケープ処理
      const escapeCSV = (text) => {
        if (text === null || text === undefined) return '';
        return `"${String(text).replace(/"/g, '""')}"`;
      };
      
      csvContent += `${r.id},${escapeCSV(r.main_category)},${escapeCSV(r.sub_category)},${escapeCSV(r.detail_category)},${escapeCSV(r.question)},${escapeCSV(r.answer)},${r.is_template},${escapeCSV(r.usage)},${escapeCSV(r.note)},${escapeCSV(r.issue)}\n`;
    }
    
    fs.writeFileSync('export_knowledge_132_to_153.csv', csvContent);
    console.log('CSVファイルにエクスポートしました: export_knowledge_132_to_153.csv');
    
    // ファイルサイズを表示
    const stats = fs.statSync('export_knowledge_132_to_153.csv');
    console.log(`ファイルサイズ: ${stats.size} バイト`);
    
    // ファイルの内容を確認（最初の200文字）
    const data = fs.readFileSync('export_knowledge_132_to_153.csv', 'utf8');
    console.log('ファイルの先頭200文字:');
    console.log(data.substring(0, 200));
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 
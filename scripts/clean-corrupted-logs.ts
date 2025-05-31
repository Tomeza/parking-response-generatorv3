import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanCorruptedLogs() {
  try {
    console.log('文字化けしたResponseLogエントリを検索中...');
    
    // 文字化けパターンを検索
    const corruptedLogs = await prisma.responseLog.findMany({
      where: {
        OR: [
          { query: { contains: 'ä' } },
          { query: { contains: 'º' } },
          { query: { contains: 'ç' } },
          { query: { contains: 'Ä' } },
          { query: { contains: 'Â' } },
          { query: { contains: 'ã' } },
          { query: { contains: '®¹' } },
          { query: { contains: 'ÄoÂoÄ' } }
        ]
      },
      orderBy: { created_at: 'desc' }
    });

    console.log(`見つかった文字化けエントリ: ${corruptedLogs.length}件`);
    
    if (corruptedLogs.length === 0) {
      console.log('文字化けしたエントリはありませんでした。');
      return;
    }

    // 文字化けしたエントリの詳細を表示
    console.log('\n文字化けしたエントリ一覧:');
    corruptedLogs.forEach((log, index) => {
      console.log(`${index + 1}. ID: ${log.id}, Query: "${log.query.substring(0, 50)}..."${log.query.length > 50 ? '...' : ''}, Created: ${log.created_at}`);
    });

    // 実際の削除を実行
    console.log(`\n${corruptedLogs.length}件の文字化けエントリを削除しています...`);
    
    const deleteResult = await prisma.responseLog.deleteMany({
      where: {
        OR: [
          { query: { contains: 'ä' } },
          { query: { contains: 'º' } },
          { query: { contains: 'ç' } },
          { query: { contains: 'Ä' } },
          { query: { contains: 'Â' } },
          { query: { contains: 'ã' } },
          { query: { contains: '®¹' } },
          { query: { contains: 'ÄoÂoÄ' } }
        ]
      }
    });

    console.log(`削除完了: ${deleteResult.count}件のエントリを削除しました。`);

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
cleanCorruptedLogs(); 
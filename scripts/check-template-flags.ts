import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // 予約関連のエントリを取得
    const reservationEntries = await prisma.knowledge.findMany({
      where: {
        main_category: '予約関連'
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log('=== 予約関連エントリのis_template設定 ===');
    reservationEntries.forEach(entry => {
      console.log(`ID=${entry.id}, サブカテゴリ=${entry.sub_category}, is_template=${entry.is_template}`);
    });
    
    // テンプレート設定されている全エントリを取得
    const templateEntries = await prisma.knowledge.findMany({
      where: {
        is_template: true
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log('\n=== テンプレート設定されている全エントリ ===');
    templateEntries.forEach(entry => {
      console.log(`ID=${entry.id}, メインカテゴリ=${entry.main_category}, サブカテゴリ=${entry.sub_category}, is_template=${entry.is_template}`);
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 
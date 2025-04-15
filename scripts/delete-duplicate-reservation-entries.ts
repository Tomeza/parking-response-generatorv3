import { PrismaClient, Knowledge } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // 予約関連エントリを取得
    const reservationEntries = await prisma.knowledge.findMany({
      where: {
        main_category: '予約関連'
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log('=== 予約関連エントリの一覧 ===');
    reservationEntries.forEach(entry => {
      console.log(`ID=${entry.id}, サブカテゴリ=${entry.sub_category}, detail=${entry.detail_category}`);
    });
    
    // サブカテゴリごとにグループ化
    const groupedEntries: Record<string, Knowledge[]> = {};
    reservationEntries.forEach(entry => {
      const key = entry.sub_category || '';
      if (!groupedEntries[key]) {
        groupedEntries[key] = [];
      }
      groupedEntries[key].push(entry);
    });
    
    console.log('\n=== 重複エントリの検出 ===');
    const duplicateGroups: Knowledge[][] = [];
    for (const [subCategory, entries] of Object.entries(groupedEntries)) {
      if (entries.length > 1) {
        console.log(`サブカテゴリ "${subCategory}" に ${entries.length} 件のエントリがあります`);
        duplicateGroups.push(entries);
      }
    }
    
    // 重複エントリの削除（各グループで最新のもの以外を削除）
    console.log('\n=== 重複エントリの削除 ===');
    let totalDeleted = 0;
    
    for (const group of duplicateGroups) {
      // ID順にソート（降順）して最新のエントリを特定
      const sortedEntries = [...group].sort((a, b) => b.id - a.id);
      const latestEntry = sortedEntries[0];
      const entriesToDelete = sortedEntries.slice(1);
      
      console.log(`サブカテゴリ "${latestEntry.sub_category}" で最新のエントリ ID=${latestEntry.id} を保持`);
      
      for (const entry of entriesToDelete) {
        console.log(`削除準備: ID=${entry.id}, サブカテゴリ=${entry.sub_category}`);
        
        // 関連するKnowledgeTagを先に削除
        const deletedTags = await prisma.knowledgeTag.deleteMany({
          where: {
            knowledge_id: entry.id
          }
        });
        
        console.log(`  関連タグ ${deletedTags.count} 件を削除しました`);
        
        // Knowledgeエントリを削除
        await prisma.knowledge.delete({
          where: {
            id: entry.id
          }
        });
        
        console.log(`  エントリID=${entry.id} を削除しました`);
        
        totalDeleted++;
      }
    }
    
    console.log(`\n合計 ${totalDeleted} 件の重複エントリを削除しました`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // 総レコード数を確認
    const totalCount = await prisma.knowledge.count();
    console.log(`総レコード数: ${totalCount}`);
    
    // 営業時間関連のデータを確認
    const businessHoursData = await prisma.knowledge.findMany({
      where: {
        OR: [
          { sub_category: '営業時間' },
          { question: { contains: '営業時間' } },
          { answer: { contains: '営業時間' } }
        ]
      },
      take: 2
    });
    
    console.log('\n営業時間関連データ:');
    console.log(businessHoursData.map(item => ({
      id: item.id,
      categories: `${item.main_category || 'N/A'} > ${item.sub_category || 'N/A'}`,
      question: item.question,
      answer: item.answer?.substring(0, 100) + '...',
      search_vector: item.search_vector?.substring(0, 50) + '...' 
    })));
    
    // 予約キャンセル関連のデータを確認
    const cancellationData = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: 'キャンセル' } },
          { answer: { contains: 'キャンセル' } },
          { sub_category: { contains: 'キャンセル' } }
        ]
      },
      take: 2
    });
    
    console.log('\n予約キャンセル関連データ:');
    console.log(cancellationData.map(item => ({
      id: item.id,
      categories: `${item.main_category || 'N/A'} > ${item.sub_category || 'N/A'}`,
      question: item.question,
      answer: item.answer?.substring(0, 100) + '...',
      search_vector: item.search_vector?.substring(0, 50) + '...'
    })));
    
    // search_vectorフィールドの構造を確認
    const sampleWithSearchVector = await prisma.knowledge.findFirst({
      where: {
        search_vector: { not: null }
      }
    });
    
    if (sampleWithSearchVector) {
      console.log('\nsearch_vectorの例:');
      console.log(`ID: ${sampleWithSearchVector.id}`);
      console.log(`search_vector: ${sampleWithSearchVector.search_vector}`);
    }
    
    // PostgreSQLの拡張機能を確認
    try {
      const extensions = await prisma.$queryRaw`SELECT extname FROM pg_extension`;
      console.log('\nPostgreSQL拡張機能:');
      console.log(extensions);
    } catch (e) {
      console.log('拡張機能の確認エラー:', e);
    }
  } catch (e) {
    console.error('エラー:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 
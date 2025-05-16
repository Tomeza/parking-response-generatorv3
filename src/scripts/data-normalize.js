/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function normalizeData() {
  try {
    console.log('=== データ均質化スクリプト ===');
    
    // 1. 全レコード数を確認
    const totalCount = await prisma.knowledge.count();
    console.log(`総ナレッジエントリ数: ${totalCount}`);
    
    // 2. search_vectorフィールドの状態を確認
    const vectorStatus = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(search_vector) as with_vector,
        COUNT(*) - COUNT(search_vector) as without_vector
      FROM "Knowledge"
    `;
    
    console.log('検索ベクトル現在の状態:');
    console.log(`- 総レコード数: ${vectorStatus[0].total}`);
    console.log(`- search_vectorあり: ${vectorStatus[0].with_vector}`);
    console.log(`- search_vectorなし: ${vectorStatus[0].without_vector}`);
    
    // 3. 各IDの範囲ごとの状態確認（データ追加の傾向を確認）
    console.log('\nID範囲ごとのレコード状態:');
    const ranges = [
      { min: 1, max: 50 },
      { min: 51, max: 100 },
      { min: 101, max: 150 },
      { min: 151, max: 200 }
    ];
    
    for (const range of ranges) {
      const count = await prisma.knowledge.count({
        where: {
          id: {
            gte: range.min,
            lte: range.max
          }
        }
      });
      
      if (count > 0) {
        console.log(`- ID ${range.min}〜${range.max}: ${count}件`);
        
        // サンプルレコードを取得
        const sample = await prisma.knowledge.findFirst({
          where: {
            id: {
              gte: range.min,
              lte: range.max
            }
          },
          select: {
            id: true,
            question: true,
            main_category: true,
            sub_category: true,
            search_vector: true
          }
        });
        
        if (sample) {
          console.log(`  サンプル(ID: ${sample.id}): ${sample.question?.substring(0, 30) || 'N/A'}... (${sample.main_category || 'N/A'} > ${sample.sub_category || 'N/A'})`);
          console.log(`  search_vector: ${sample.search_vector ? '存在します' : '存在しません'}`);
        }
      }
    }
    
    // 4. 「予約」を含むレコードの確認
    const reservationCount = await prisma.knowledge.count({
      where: {
        OR: [
          { question: { contains: '予約', mode: 'insensitive' } },
          { answer: { contains: '予約', mode: 'insensitive' } }
        ]
      }
    });
    
    console.log(`\n「予約」を含むレコード数: ${reservationCount}`);
    
    // 5. search_vectorの内容を確認
    console.log('\n検索ベクトルの内容を確認:');
    
    // 「予約」を含むレコードのsearch_vectorを確認
    const reservationSamples = await prisma.$queryRaw`
      SELECT id, question, LEFT(search_vector::text, 100) as vector_preview
      FROM "Knowledge"
      WHERE question ILIKE ${'%予約%'} OR answer ILIKE ${'%予約%'}
      ORDER BY id
      LIMIT 3
    `;
    
    if (reservationSamples.length > 0) {
      console.log('「予約」を含むレコードのsearch_vector:');
      reservationSamples.forEach(sample => {
        console.log(`- ID ${sample.id}: ${sample.question?.substring(0, 30) || 'N/A'}...`);
        console.log(`  vector_preview: ${sample.vector_preview}`);
      });
    }
    
    // 6. 「営業時間」を含むレコードの確認（正常に検索できる例として）
    const businessHoursSamples = await prisma.$queryRaw`
      SELECT id, question, LEFT(search_vector::text, 100) as vector_preview
      FROM "Knowledge"
      WHERE question ILIKE ${'%営業時間%'} OR answer ILIKE ${'%営業時間%'}
      ORDER BY id
      LIMIT 3
    `;
    
    if (businessHoursSamples.length > 0) {
      console.log('\n「営業時間」を含むレコードのsearch_vector:');
      businessHoursSamples.forEach(sample => {
        console.log(`- ID ${sample.id}: ${sample.question?.substring(0, 30) || 'N/A'}...`);
        console.log(`  vector_preview: ${sample.vector_preview}`);
      });
    }
    
    // 7. データの均質化：全レコードのsearch_vectorを再構築
    console.log('\n全レコードのsearch_vectorを再構築中...');
    
    // まず正しい順序で構築するバージョンを試す
    const updateResult1 = await prisma.$executeRaw`
      UPDATE "Knowledge"
      SET search_vector = to_tsvector('japanese', 
        COALESCE(question, '') || ' ' || 
        COALESCE(answer, '') || ' ' || 
        COALESCE(main_category, '') || ' ' || 
        COALESCE(sub_category, ''))
    `;
    
    console.log(`更新されたレコード数: ${updateResult1}`);
    
    // 更新後のsearch_vectorの状態を確認
    const updatedVectorStatus = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(search_vector) as with_vector,
        COUNT(*) - COUNT(search_vector) as without_vector
      FROM "Knowledge"
    `;
    
    console.log('\n更新後の検索ベクトル状態:');
    console.log(`- 総レコード数: ${updatedVectorStatus[0].total}`);
    console.log(`- search_vectorあり: ${updatedVectorStatus[0].with_vector}`);
    console.log(`- search_vectorなし: ${updatedVectorStatus[0].without_vector}`);
    
    // 8. PGroonga検索テスト
    console.log('\nPGroonga検索テスト:');
    
    // 「予約」の検索テスト
    const pgroongaReservationTest = await prisma.$queryRaw`
      SELECT id, question
      FROM "Knowledge"
      WHERE question &@ '予約' OR answer &@ '予約'
      LIMIT 5
    `;
    
    console.log(`「予約」のPGroonga検索結果数: ${pgroongaReservationTest.length}`);
    if (pgroongaReservationTest.length > 0) {
      console.log('検索結果サンプル:');
      pgroongaReservationTest.forEach(result => {
        console.log(`- ID ${result.id}: ${result.question?.substring(0, 50) || 'N/A'}...`);
      });
    }
    
    // 「営業時間」の検索テスト
    const pgroongaBusinessHoursTest = await prisma.$queryRaw`
      SELECT id, question
      FROM "Knowledge"
      WHERE question &@ '営業時間' OR answer &@ '営業時間'
      LIMIT 5
    `;
    
    console.log(`\n「営業時間」のPGroonga検索結果数: ${pgroongaBusinessHoursTest.length}`);
    if (pgroongaBusinessHoursTest.length > 0) {
      console.log('検索結果サンプル:');
      pgroongaBusinessHoursTest.forEach(result => {
        console.log(`- ID ${result.id}: ${result.question?.substring(0, 50) || 'N/A'}...`);
      });
    }
    
    // 「予約はどのように行えますか」の検索テスト
    const pgroongaReservationHowTest = await prisma.$queryRaw`
      SELECT id, question
      FROM "Knowledge"
      WHERE question &@~ '予約はどのように行えますか' OR answer &@~ '予約はどのように行えますか'
      LIMIT 5
    `;
    
    console.log(`\n「予約はどのように行えますか」のPGroonga検索結果数: ${pgroongaReservationHowTest.length}`);
    if (pgroongaReservationHowTest.length > 0) {
      console.log('検索結果サンプル:');
      pgroongaReservationHowTest.forEach(result => {
        console.log(`- ID ${result.id}: ${result.question?.substring(0, 50) || 'N/A'}...`);
      });
    }
    
    console.log('\n=== データ均質化完了 ===');
    
  } catch (error) {
    console.error('データ均質化エラー:', error);
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message);
      console.error('スタックトレース:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

normalizeData(); 
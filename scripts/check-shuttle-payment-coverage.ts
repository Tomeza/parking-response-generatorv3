import { prisma } from '../src/lib/db';

async function checkShuttlePaymentCoverage() {
  console.log('🔍 Phase2.5: shuttle/payment カバレッジ確認開始...');
  
  try {
    // 1. 現在の承認済みテンプレート確認
    const approvedTemplates = await prisma.$queryRaw`
      SELECT 
        category,
        intent,
        tone,
        COUNT(*) as count
      FROM "Templates" 
      WHERE status = 'approved' 
        AND category IN ('shuttle', 'payment')
      GROUP BY category, intent, tone
      ORDER BY category, intent, tone
    `;
    
    console.log('\n📊 現在の承認済みテンプレート (shuttle/payment):');
    console.table(approvedTemplates);
    
    // 2. ドラフト候補の確認
    const draftCandidates = await prisma.templates.findMany({
      where: {
        status: 'draft',
        category: { in: ['shuttle', 'payment'] }
      },
      select: {
        id: true,
        title: true,
        category: true,
        intent: true,
        tone: true,
        usageLabel: true,
        updated_at: true
      },
      orderBy: [
        { usageLabel: 'desc' },
        { updated_at: 'desc' }
      ],
      take: 20
    });
    
    console.log('\n📋 ドラフト候補:');
    draftCandidates.forEach(t => {
      console.log(`  ID: ${t.id}, Title: ${t.title}, Category: ${t.category}/${t.intent}/${t.tone}, Usage: ${t.usageLabel || 'N/A'}`);
    });
    
    // 3. 必要なカバレッジの定義
    const requiredCoverage = [
      { category: 'shuttle', intent: 'inquiry', tone: 'normal' },
      { category: 'shuttle', intent: 'check', tone: 'normal' },
      { category: 'payment', intent: 'inquiry', tone: 'normal' },
      { category: 'payment', intent: 'check', tone: 'normal' }
    ];
    
    console.log('\n💡 必要なカバレッジ:');
    for (const required of requiredCoverage) {
      const exists = (approvedTemplates as any[]).some((row: any) => 
        row.category === required.category && 
        row.intent === required.intent && 
        row.tone === required.tone &&
        row.count > 0
      );
      
      if (exists) {
        console.log(`  ✅ 存在: ${required.category}/${required.intent}/${required.tone}`);
      } else {
        console.log(`  ❌ 不足: ${required.category}/${required.intent}/${required.tone}`);
        
        // 不足している場合、適切な候補を探す
        const candidates = draftCandidates.filter(t => 
          t.category === required.category && 
          t.intent === required.intent && 
          t.tone === required.tone
        );
        
        if (candidates.length > 0) {
          const bestCandidate = candidates.find(t => t.usageLabel === '◯') || candidates[0];
          console.log(`    💡 候補: ID ${bestCandidate.id} (${bestCandidate.title})`);
          
          // 自動承認
          try {
            await prisma.templates.update({
              where: { id: bestCandidate.id },
              data: { status: 'approved' }
            });
            console.log(`    ✅ 承認完了: ID ${bestCandidate.id}`);
          } catch (error) {
            console.log(`    ❌ 承認失敗: ${error}`);
          }
        } else {
          console.log(`    ⚠️  候補なし`);
        }
      }
    }
    
    // 4. 更新後の確認
    const updatedTemplates = await prisma.$queryRaw`
      SELECT 
        category,
        intent,
        tone,
        COUNT(*) as count
      FROM "Templates" 
      WHERE status = 'approved' 
        AND category IN ('shuttle', 'payment')
      GROUP BY category, intent, tone
      ORDER BY category, intent, tone
    `;
    
    console.log('\n📈 更新後のカバレッジ:');
    console.table(updatedTemplates);
    
  } catch (error) {
    console.error('❌ カバレッジ確認エラー:', error);
  }
}

checkShuttlePaymentCoverage()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 
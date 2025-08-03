import { prisma } from '../src/lib/db';

async function approveAccessCheckTemplate() {
  console.log('🔧 Phase2.5: access/check/normal テンプレート承認開始...');
  
  try {
    // 1. 対象テンプレートの確認
    const template = await prisma.templates.findUnique({
      where: { id: 188 },
      select: {
        id: true,
        title: true,
        category: true,
        intent: true,
        tone: true,
        status: true,
        usageLabel: true
      }
    });
    
    console.log('\n📋 対象テンプレート:');
    console.log(`  ID: ${template?.id}`);
    console.log(`  Title: ${template?.title}`);
    console.log(`  Category: ${template?.category}`);
    console.log(`  Intent: ${template?.intent}`);
    console.log(`  Tone: ${template?.tone}`);
    console.log(`  Status: ${template?.status}`);
    console.log(`  Usage: ${template?.usageLabel || 'N/A'}`);
    
    if (!template) {
      console.log('\n❌ テンプレートが見つかりません');
      return;
    }
    
    // 2. テンプレートの承認とintent変更
    const updated = await prisma.templates.update({
      where: { id: 188 },
      data: {
        intent: 'check',
        status: 'approved',
        updated_at: new Date()
      }
    });
    
    console.log('\n🎉 テンプレート承認完了:');
    console.log(`  ID: ${updated.id}`);
    console.log(`  Title: ${updated.title}`);
    console.log(`  Category: ${updated.category}`);
    console.log(`  Intent: ${updated.intent}`);
    console.log(`  Tone: ${updated.tone}`);
    console.log(`  Status: ${updated.status}`);
    
    // 3. access/vehicle の承認済みテンプレート確認
    const coverageAfter = await prisma.$queryRaw`
      SELECT 
        category,
        intent,
        tone,
        COUNT(*) as count
      FROM "Templates" 
      WHERE status = 'approved' 
        AND category IN ('access', 'vehicle')
      GROUP BY category, intent, tone
      ORDER BY category, intent, tone
    `;
    
    console.log('\n📈 更新後のカバレッジ:');
    console.table(coverageAfter);
    
    // 4. カバレッジ分析
    const missingCombinations = [
      { category: 'access', intent: 'check', tone: 'normal' },
      { category: 'access', intent: 'inquiry', tone: 'normal' },
      { category: 'vehicle', intent: 'check', tone: 'normal' },
      { category: 'vehicle', intent: 'inquiry', tone: 'normal' }
    ];
    
    console.log('\n💡 カバレッジ確認:');
    for (const combo of missingCombinations) {
      const exists = (coverageAfter as any[]).some((row: any) => 
        row.category === combo.category && 
        row.intent === combo.intent && 
        row.tone === combo.tone &&
        row.count > 0
      );
      
      if (exists) {
        console.log(`  ✅ 存在: ${combo.category}/${combo.intent}/${combo.tone}`);
      } else {
        console.log(`  ❌ 不足: ${combo.category}/${combo.intent}/${combo.tone}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 承認エラー:', error);
  }
}

approveAccessCheckTemplate()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 
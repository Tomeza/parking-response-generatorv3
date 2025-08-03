import { prisma } from '../src/lib/db';

async function checkApprovalCoverage() {
  console.log('🔍 Phase2.5: 承認カバレッジ監査開始...');
  
  try {
    // 1. カテゴリ別の承認件数
    const categoryStats = await prisma.$queryRaw`
      SELECT 
        category, 
        COUNT(*) as approved_count,
        COUNT(*) FILTER (WHERE intent = 'check') as check_count,
        COUNT(*) FILTER (WHERE intent = 'inquiry') as inquiry_count,
        COUNT(*) FILTER (WHERE intent = 'create') as create_count,
        COUNT(*) FILTER (WHERE intent = 'modify') as modify_count,
        COUNT(*) FILTER (WHERE intent = 'cancel') as cancel_count,
        COUNT(*) FILTER (WHERE intent = 'report') as report_count
      FROM "Templates" 
      WHERE status = 'approved' 
      GROUP BY category 
      ORDER BY approved_count DESC
    `;
    
    console.log('\n📊 カテゴリ別承認件数:');
    console.table(categoryStats);
    
    // 2. access/vehicle のドラフト候補
    const draftCandidates = await prisma.templates.findMany({
      where: {
        status: 'draft',
        category: { in: ['access', 'vehicle'] }
      },
      select: {
        id: true,
        title: true,
        category: true,
        intent: true,
        tone: true,
        usageLabel: true,
        updated_at: true,
        replyTypeTags: true,
        infoSourceTags: true,
        situationTags: true
      },
      orderBy: [
        { usageLabel: 'desc' },
        { updated_at: 'desc' }
      ],
      take: 20
    });
    
    console.log('\n📋 access/vehicle ドラフト候補:');
    draftCandidates.forEach(t => {
      console.log(`  ID: ${t.id}, Title: ${t.title}, Category: ${t.category}/${t.intent}/${t.tone}, Usage: ${t.usageLabel || 'N/A'}`);
    });
    
    // 3. 承認済みテンプレートの詳細確認
    const approvedTemplates = await prisma.templates.findMany({
      where: {
        status: 'approved',
        category: { in: ['access', 'vehicle'] }
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
        { category: 'asc' },
        { intent: 'asc' },
        { tone: 'asc' }
      ]
    });
    
    console.log('\n✅ 承認済みテンプレート (access/vehicle):');
    approvedTemplates.forEach(t => {
      console.log(`  ID: ${t.id}, Title: ${t.title}, Category: ${t.category}/${t.intent}/${t.tone}, Usage: ${t.usageLabel || 'N/A'}`);
    });
    
    // 4. カバレッジ分析
    const accessVehicleStats = await prisma.$queryRaw`
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
    
    console.log('\n📈 access/vehicle カバレッジ分析:');
    console.table(accessVehicleStats);
    
    // 5. 推奨アクション
    console.log('\n💡 推奨アクション:');
    
    const missingCombinations = [
      { category: 'access', intent: 'check', tone: 'normal' },
      { category: 'access', intent: 'inquiry', tone: 'normal' },
      { category: 'vehicle', intent: 'check', tone: 'normal' },
      { category: 'vehicle', intent: 'inquiry', tone: 'normal' }
    ];
    
    for (const combo of missingCombinations) {
      const exists = approvedTemplates.some(t => 
        t.category === combo.category && 
        t.intent === combo.intent && 
        t.tone === combo.tone
      );
      
      if (!exists) {
        console.log(`  ❌ 不足: ${combo.category}/${combo.intent}/${combo.tone}`);
      } else {
        console.log(`  ✅ 存在: ${combo.category}/${combo.intent}/${combo.tone}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 監査エラー:', error);
  }
}

checkApprovalCoverage()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 
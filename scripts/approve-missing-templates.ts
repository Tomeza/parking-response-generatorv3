import { prisma } from '../src/lib/db';

async function approveMissingTemplates() {
  console.log('🔧 Phase2.5: 不足テンプレートの承認開始...');
  
  try {
    // access/check/normal の候補を探す
    const accessCheckCandidates = await prisma.templates.findMany({
      where: {
        status: 'draft',
        category: 'access',
        intent: 'check',
        tone: 'normal'
      },
      select: {
        id: true,
        title: true,
        content: true,
        usageLabel: true,
        replyTypeTags: true,
        infoSourceTags: true,
        situationTags: true
      },
      orderBy: [
        { usageLabel: 'desc' },
        { updated_at: 'desc' }
      ]
    });
    
    console.log(`\n📋 access/check/normal 候補: ${accessCheckCandidates.length}件`);
    accessCheckCandidates.forEach(t => {
      console.log(`  ID: ${t.id}, Title: ${t.title}, Usage: ${t.usageLabel || 'N/A'}`);
    });
    
    if (accessCheckCandidates.length === 0) {
      console.log('\n❌ access/check/normal の候補が見つかりません');
      console.log('💡 代替案: 既存のaccessテンプレートを修正');
      
      // 既存のaccessテンプレートを確認
      const existingAccess = await prisma.templates.findMany({
        where: {
          category: 'access',
          status: 'approved'
        },
        select: {
          id: true,
          title: true,
          intent: true,
          tone: true
        }
      });
      
      console.log('\n📋 既存のaccessテンプレート:');
      existingAccess.forEach(t => {
        console.log(`  ID: ${t.id}, Title: ${t.title}, Intent: ${t.intent}, Tone: ${t.tone}`);
      });
      
      // 最も適切な候補を選んでintentを変更
      const bestCandidate = await prisma.templates.findFirst({
        where: {
          status: 'draft',
          category: 'access',
          tone: 'normal'
        },
        orderBy: [
          { usageLabel: 'desc' },
          { updated_at: 'desc' }
        ]
      });
      
      if (bestCandidate) {
        console.log(`\n💡 最適候補: ID ${bestCandidate.id} (${bestCandidate.title})`);
        console.log('  このテンプレートのintentをcheckに変更しますか？');
        
        // 実際の更新は手動で行う
        console.log('\n🔧 手動更新コマンド:');
        console.log(`UPDATE "Templates" SET intent = 'check', status = 'approved' WHERE id = ${bestCandidate.id};`);
      }
      
      return;
    }
    
    // 最適な候補を選択（usageLabelが◯のものを優先）
    const bestCandidate = accessCheckCandidates.find(t => t.usageLabel === '◯') || accessCheckCandidates[0];
    
    console.log(`\n✅ 選択された候補: ID ${bestCandidate.id} (${bestCandidate.title})`);
    
    // テンプレートを承認
    const updated = await prisma.templates.update({
      where: { id: bestCandidate.id },
      data: { status: 'approved' }
    });
    
    console.log(`\n🎉 テンプレート承認完了: ID ${updated.id}`);
    console.log(`   Category: ${updated.category}`);
    console.log(`   Intent: ${updated.intent}`);
    console.log(`   Tone: ${updated.tone}`);
    console.log(`   Title: ${updated.title}`);
    
    // 承認後のカバレッジ確認
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
    
  } catch (error) {
    console.error('❌ 承認エラー:', error);
  }
}

approveMissingTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 
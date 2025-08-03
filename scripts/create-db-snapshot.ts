import { prisma } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

async function createDBSnapshot() {
  console.log('📸 Phase2開始前のDBスナップショットを作成...');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotDir = path.join(process.cwd(), 'snapshots');
    
    // スナップショットディレクトリの作成
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    
    // 1. Templatesテーブルのスナップショット
    const templates = await prisma.templates.findMany({
      orderBy: { id: 'asc' }
    });
    
    const templatesSnapshot = {
      timestamp,
      phase: 'phase1-completed',
      totalCount: templates.length,
      approvedCount: templates.filter(t => t.status === 'approved').length,
      draftCount: templates.filter(t => t.status === 'draft').length,
      templates: templates.map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
        intent: t.intent,
        tone: t.tone,
        status: t.status,
        source: t.source,
        originQuestion: t.originQuestion,
        replyTypeTags: t.replyTypeTags,
        infoSourceTags: t.infoSourceTags,
        situationTags: t.situationTags,
        note: t.note,
        usageLabel: t.usageLabel,
        created_at: t.created_at,
        updated_at: t.updated_at
      }))
    };
    
    const templatesPath = path.join(snapshotDir, `templates-phase1-${timestamp}.json`);
    fs.writeFileSync(templatesPath, JSON.stringify(templatesSnapshot, null, 2));
    console.log(`✅ Templatesスナップショット保存: ${templatesPath}`);
    
    // 2. 統計情報のスナップショット
    type StatsRow = {
      total_templates: number;
      approved_count: number;
      draft_count: number;
      with_source: number;
      with_origin_question: number;
      with_reply_tags: number;
      with_info_tags: number;
      with_situation_tags: number;
    };

    const stats = await prisma.$queryRaw<StatsRow[]>`
      SELECT 
        COUNT(*)::int as total_templates,
        COUNT(*) FILTER (WHERE status = 'approved')::int as approved_count,
        COUNT(*) FILTER (WHERE status = 'draft')::int as draft_count,
        COUNT(*) FILTER (WHERE source IS NOT NULL)::int as with_source,
        COUNT(*) FILTER (WHERE "originQuestion" IS NOT NULL)::int as with_origin_question,
        COUNT(*) FILTER (WHERE array_length("replyTypeTags", 1) > 0)::int as with_reply_tags,
        COUNT(*) FILTER (WHERE array_length("infoSourceTags", 1) > 0)::int as with_info_tags,
        COUNT(*) FILTER (WHERE array_length("situationTags", 1) > 0)::int as with_situation_tags
      FROM "Templates"
    `;
    
    const statsData = stats[0];
    const statsSnapshot = {
      timestamp,
      phase: 'phase1-completed',
      statistics: {
        total_templates: Number(statsData.total_templates),
        approved_count: Number(statsData.approved_count),
        draft_count: Number(statsData.draft_count),
        with_source: Number(statsData.with_source),
        with_origin_question: Number(statsData.with_origin_question),
        with_reply_tags: Number(statsData.with_reply_tags),
        with_info_tags: Number(statsData.with_info_tags),
        with_situation_tags: Number(statsData.with_situation_tags)
      }
    };
    
    const statsPath = path.join(snapshotDir, `stats-phase1-${timestamp}.json`);
    fs.writeFileSync(statsPath, JSON.stringify(statsSnapshot, null, 2));
    console.log(`✅ 統計スナップショット保存: ${statsPath}`);
    
    // 3. 制約とインデックスのスナップショット
    type ConstraintRow = {
      constraint_name: string;
      constraint_definition: string;
    };

    type IndexRow = {
      indexname: string;
      indexdef: string;
    };

    const constraints = await prisma.$queryRaw<ConstraintRow[]>`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'public."Templates"'::regclass
    `;
    
    const indexes = await prisma.$queryRaw<IndexRow[]>`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'Templates'
      ORDER BY indexname
    `;
    
    const schemaSnapshot = {
      timestamp,
      phase: 'phase1-completed',
      constraints,
      indexes
    };
    
    const schemaPath = path.join(snapshotDir, `schema-phase1-${timestamp}.json`);
    fs.writeFileSync(schemaPath, JSON.stringify(schemaSnapshot, null, 2));
    console.log(`✅ スキーマスナップショット保存: ${schemaPath}`);
    
    // 4. サンプルテンプレートの確認
    const sampleTemplates = await prisma.templates.findMany({
      where: {
        status: 'approved'
      },
      take: 3,
      orderBy: { id: 'asc' }
    });
    
    console.log('\n📊 サンプルテンプレート（承認済み）:');
    sampleTemplates.forEach(t => {
      console.log(`  ID: ${t.id}, Title: ${t.title}, Category: ${t.category}/${t.intent}/${t.tone}`);
    });
    
    // 5. スナップショット完了レポート
    const report = {
      timestamp,
      phase: 'phase1-completed',
      files: [
        templatesPath,
        statsPath,
        schemaPath
      ],
      summary: {
        totalTemplates: templates.length,
        approvedTemplates: templates.filter(t => t.status === 'approved').length,
        draftTemplates: templates.filter(t => t.status === 'draft').length,
        constraintsCount: constraints.length,
        indexesCount: indexes.length
      }
    };
    
    const reportPath = path.join(snapshotDir, `report-phase1-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ レポート保存: ${reportPath}`);
    
    console.log('\n🎯 Phase2開始前のDBスナップショット完了');
    console.log('📁 スナップショットディレクトリ:', snapshotDir);
    console.log('📊 統計:', report.summary);
    
    return report;
    
  } catch (error) {
    console.error('❌ スナップショット作成エラー:', error);
    throw error;
  }
}

createDBSnapshot()
  .then((report) => {
    console.log('\n✅ Phase2開始準備完了！');
    console.log('📸 スナップショットが正常に作成されました');
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 
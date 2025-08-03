import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTemplateImport() {
  try {
    console.log('テンプレートインポート結果の確認...\n');

    // 全テンプレートの取得
    const templates = await prisma.templates.findMany({
      orderBy: { created_at: 'desc' }
    });

    console.log(`総テンプレート数: ${templates.length}件\n`);

    // カテゴリ別集計
    const categoryStats = templates.reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('カテゴリ別集計:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}件`);
    });

    console.log('\n意図別集計:');
    const intentStats = templates.reduce((acc, template) => {
      acc[template.intent] = (acc[template.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(intentStats).forEach(([intent, count]) => {
      console.log(`  ${intent}: ${count}件`);
    });

    console.log('\nトーン別集計:');
    const toneStats = templates.reduce((acc, template) => {
      acc[template.tone] = (acc[template.tone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(toneStats).forEach(([tone, count]) => {
      console.log(`  ${tone}: ${count}件`);
    });

    // 承認状況
    const approvedCount = templates.filter(t => t.is_approved).length;
    console.log(`\n承認状況:`);
    console.log(`  承認済み: ${approvedCount}件`);
    console.log(`  未承認: ${templates.length - approvedCount}件`);

    // 最新のテンプレート（サンプル表示）
    console.log('\n最新のテンプレート（上位5件）:');
    templates.slice(0, 5).forEach((template, index) => {
      console.log(`\n${index + 1}. ${template.title}`);
      console.log(`   カテゴリ: ${template.category}`);
      console.log(`   意図: ${template.intent}`);
      console.log(`   トーン: ${template.tone}`);
      console.log(`   承認: ${template.is_approved ? '済み' : '未承認'}`);
      console.log(`   内容: ${template.content.substring(0, 100)}...`);
      
      if (template.metadata) {
        const metadata = template.metadata as any;
        console.log(`   根拠: ${metadata.source || '不明'}`);
        console.log(`   重要度: ${metadata.importance || '未設定'}`);
      }
    });

    // 変数を持つテンプレート
    const templatesWithVariables = templates.filter(t => 
      t.variables && Object.keys(t.variables as any).length > 0
    );
    console.log(`\n変数を持つテンプレート: ${templatesWithVariables.length}件`);

  } catch (error) {
    console.error('確認エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplateImport().catch(console.error); 
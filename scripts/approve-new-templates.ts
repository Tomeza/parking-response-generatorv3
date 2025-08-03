import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function approveNewTemplates() {
  try {
    console.log('新しくインポートしたテンプレートを承認中...\n');

    // CSVからインポートしたテンプレートを承認
    const result = await prisma.templates.updateMany({
      where: {
        metadata: {
          path: ['source'],
          equals: 'csv'
        },
        is_approved: false
      },
      data: {
        is_approved: true,
        approved_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`${result.count}件のテンプレートを承認しました`);

    // 承認状況の確認
    const approvedCount = await prisma.templates.count({
      where: { is_approved: true }
    });

    const totalCount = await prisma.templates.count();

    console.log(`\n承認状況:`);
    console.log(`  承認済み: ${approvedCount}件`);
    console.log(`  未承認: ${totalCount - approvedCount}件`);
    console.log(`  合計: ${totalCount}件`);

    // 新しく承認したテンプレートの一覧
    const newlyApproved = await prisma.templates.findMany({
      where: {
        metadata: {
          path: ['source'],
          equals: 'csv'
        },
        is_approved: true
      },
      orderBy: { created_at: 'desc' }
    });

    console.log('\n新しく承認したテンプレート:');
    newlyApproved.slice(0, 20).forEach((template, index) => {
      console.log(`${index + 1}. ${template.title}`);
      console.log(`   カテゴリ: ${template.category}`);
      console.log(`   意図: ${template.intent}`);
      console.log(`   トーン: ${template.tone}`);
      console.log(`   内容: ${template.content.substring(0, 80)}...`);
      console.log('');
    });

    if (newlyApproved.length > 20) {
      console.log(`... 他${newlyApproved.length - 20}件`);
    }

  } catch (error) {
    console.error('承認エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approveNewTemplates().catch(console.error); 
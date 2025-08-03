import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function archiveDummyTemplates() {
  try {
    console.log('📦 既存ダミーテンプレートの退避を開始...');
    
    // 現在のテンプレート状況を確認
    const totalCount = await prisma.templates.count();
    const csvCount = await prisma.templates.count({
      where: {
        metadata: {
          path: ['source'],
          equals: 'csv'
        }
      }
    });
    const nonCsvCount = await prisma.templates.count({
      where: {
        metadata: {
          path: ['source'],
          not: 'csv'
        }
      }
    });
    
    console.log('📊 現在のテンプレート状況:');
    console.log(`  - 総数: ${totalCount}件`);
    console.log(`  - CSVテンプレート: ${csvCount}件`);
    console.log(`  - 非CSVテンプレート: ${nonCsvCount}件`);
    
    // metadata.source !== 'csv' のテンプレートをis_approved=falseに変更
    const result = await prisma.templates.updateMany({
      where: {
        metadata: {
          path: ['source'],
          not: 'csv'
        },
        is_approved: true
      },
      data: {
        is_approved: false
      }
    });
    
    console.log(`✅ ${result.count}件のダミーテンプレートを退避しました`);
    
    // 変更後の状況を確認
    const afterTotalCount = await prisma.templates.count();
    const afterApprovedCount = await prisma.templates.count({
      where: {
        is_approved: true
      }
    });
    const afterCsvApprovedCount = await prisma.templates.count({
      where: {
        metadata: {
          path: ['source'],
          equals: 'csv'
        },
        is_approved: true
      }
    });
    
    console.log('📊 変更後のテンプレート状況:');
    console.log(`  - 総数: ${afterTotalCount}件`);
    console.log(`  - 承認済み: ${afterApprovedCount}件`);
    console.log(`  - CSV承認済み: ${afterCsvApprovedCount}件`);
    
    // 復元用のSQLコマンドを表示
    console.log('\n🔄 復元が必要な場合のコマンド:');
    console.log('UPDATE "Templates" SET is_approved = true WHERE metadata->>\'source\' <> \'csv\' AND is_approved = false;');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  archiveDummyTemplates();
}

export { archiveDummyTemplates }; 
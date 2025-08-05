#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 必要なカテゴリとインテントの組み合わせ
const REQUIRED_COMBINATIONS = [
  // アクセス関連
  { category: 'access', intent: 'inquiry', tone: 'normal' },
  { category: 'access', intent: 'check', tone: 'normal' },
  
  // 車両関連
  { category: 'vehicle', intent: 'inquiry', tone: 'normal' },
  { category: 'vehicle', intent: 'check', tone: 'normal' },
  
  // 予約関連
  { category: 'reservation', intent: 'inquiry', tone: 'normal' },
  { category: 'reservation', intent: 'check', tone: 'normal' },
  { category: 'reservation', intent: 'modify', tone: 'normal' },
  { category: 'reservation', intent: 'cancel', tone: 'normal' },
  
  // 支払い関連
  { category: 'payment', intent: 'inquiry', tone: 'normal' },
  { category: 'payment', intent: 'check', tone: 'normal' },
  
  // 送迎関連
  { category: 'shuttle', intent: 'inquiry', tone: 'normal' },
  { category: 'shuttle', intent: 'check', tone: 'normal' },
  
  // 設備関連
  { category: 'facility', intent: 'inquiry', tone: 'normal' },
  { category: 'facility', intent: 'check', tone: 'normal' },
  
  // トラブル関連
  { category: 'trouble', intent: 'inquiry', tone: 'normal' },
  { category: 'trouble', intent: 'report', tone: 'urgent' },
  { category: 'trouble', intent: 'report', tone: 'normal' },
];

async function checkTemplateCoverage() {
  console.log('🔍 Checking template coverage...');
  
  const missingTemplates: Array<{category: string, intent: string, tone: string}> = [];
  const existingTemplates: Array<{category: string, intent: string, tone: string, title: string}> = [];
  
  // 各組み合わせをチェック
  for (const combination of REQUIRED_COMBINATIONS) {
    const template = await prisma.templates.findFirst({
      where: {
        category: combination.category,
        intent: combination.intent,
        tone: combination.tone,
        status: 'approved'
      },
      select: {
        id: true,
        title: true,
        category: true,
        intent: true,
        tone: true
      }
    });
    
    if (template) {
      existingTemplates.push({
        category: template.category,
        intent: template.intent,
        tone: template.tone,
        title: template.title
      });
    } else {
      missingTemplates.push(combination);
    }
  }
  
  // 結果を表示
  console.log('\n📊 Template Coverage Report');
  console.log('========================');
  
  console.log(`\n✅ Existing Templates (${existingTemplates.length}/${REQUIRED_COMBINATIONS.length}):`);
  existingTemplates.forEach(template => {
    console.log(`  - ${template.category}/${template.intent}/${template.tone}: ${template.title}`);
  });
  
  if (missingTemplates.length > 0) {
    console.log(`\n❌ Missing Templates (${missingTemplates.length}):`);
    missingTemplates.forEach(template => {
      console.log(`  - ${template.category}/${template.intent}/${template.tone}`);
    });
    
    console.log('\n⚠️  Coverage Issues Found!');
    console.log('Please add missing templates or check existing ones.');
    
    // CI/CDで失敗させる
    process.exit(1);
  } else {
    console.log('\n🎉 All required templates are present!');
    console.log('✅ Template coverage: 100%');
  }
  
  // 追加の統計情報
  const totalTemplates = await prisma.templates.count({
    where: { status: 'approved' }
  });
  
  const draftTemplates = await prisma.templates.count({
    where: { status: 'draft' }
  });
  
  console.log('\n📈 Template Statistics:');
  console.log(`  - Approved templates: ${totalTemplates}`);
  console.log(`  - Draft templates: ${draftTemplates}`);
  console.log(`  - Total templates: ${totalTemplates + draftTemplates}`);
  
  // カテゴリ別統計
  const categoryStats = await prisma.templates.groupBy({
    by: ['category', 'status'],
    _count: { id: true }
  });
  
  console.log('\n📋 Templates by Category:');
  const categoryMap = new Map<string, {approved: number, draft: number}>();
  
  categoryStats.forEach(stat => {
    const key = stat.category;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { approved: 0, draft: 0 });
    }
    const current = categoryMap.get(key)!;
    if (stat.status === 'approved') {
      current.approved = stat._count.id;
    } else {
      current.draft = stat._count.id;
    }
  });
  
  categoryMap.forEach((stats, category) => {
    console.log(`  - ${category}: ${stats.approved} approved, ${stats.draft} draft`);
  });
}

async function main() {
  try {
    await checkTemplateCoverage();
  } catch (error) {
    console.error('❌ Error checking template coverage:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
} 
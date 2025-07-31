import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFaqData() {
  try {
    // FAQデータの取得
    const faqs = await prisma.faqRaw.findMany({
      orderBy: { id: 'asc' }
    });

    console.log('=== FAQ Data ===');
    console.log(`Total FAQs: ${faqs.length}`);
    
    faqs.forEach(faq => {
      console.log('\n---');
      console.log(`ID: ${faq.id}`);
      console.log(`Question: ${faq.question}`);
      console.log(`Category: ${faq.category || 'Not set'}`);
      console.log(`Complexity: ${faq.complexity}`);
      console.log(`Requires Review: ${faq.requiresReview}`);
    });

    // レビュートリガー条件の取得
    const triggers = await prisma.faqReviewTriggers.findMany();
    
    console.log('\n=== Review Triggers ===');
    console.log(`Total Triggers: ${triggers.length}`);
    
    triggers.forEach(trigger => {
      console.log('\n---');
      console.log(`Type: ${trigger.conditionType}`);
      console.log(`Threshold: ${JSON.stringify(trigger.threshold, null, 2)}`);
      console.log(`Active: ${trigger.isActive}`);
    });

  } catch (error) {
    console.error('Error checking FAQ data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFaqData(); 
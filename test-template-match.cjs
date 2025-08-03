const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTemplateMatch() {
  try {
    console.log('Testing template matching...');
    
    // 1. 全テンプレートを確認
    const allTemplates = await prisma.templates.findMany({
      select: {
        id: true,
        category: true,
        intent: true,
        tone: true,
        is_approved: true,
        title: true
      }
    });
    
    console.log('All templates:', allTemplates);
    
    // 2. reservation + check + normal の組み合わせを検索
    const exactMatch = await prisma.templates.findFirst({
      where: {
        category: 'reservation',
        intent: 'check',
        tone: 'normal',
        is_approved: true
      }
    });
    
    console.log('Exact match for reservation+check+normal:', exactMatch);
    
    // 3. reservation + check の組み合わせを検索
    const partialMatch = await prisma.templates.findFirst({
      where: {
        category: 'reservation',
        intent: 'check',
        is_approved: true
      }
    });
    
    console.log('Partial match for reservation+check:', partialMatch);
    
    // 4. reservation のみの検索
    const categoryMatch = await prisma.templates.findFirst({
      where: {
        category: 'reservation',
        is_approved: true
      }
    });
    
    console.log('Category match for reservation:', categoryMatch);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTemplateMatch(); 
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addFacilityTemplate() {
  try {
    const template = await prisma.templates.create({
      data: {
        category: 'facility',
        intent: 'inquiry',
        tone: 'normal',
        title: '設備の使い方_通常',
        content: '設備の使い方についてご案内いたします。',
        variables: {},
        status: 'approved',
        is_approved: true,
        source: 'manual',
        usageLabel: '設備_使い方_通常',
        note: '設備の使い方に関する汎用テンプレート',
        originQuestion: '設備の使い方を教えてください',
        replyTypeTags: ['guide'],
        infoSourceTags: ['manual'],
        situationTags: ['normal'],
        metadata: {
          description: '設備の使い方に関する一般的な案内',
          keywords: ['使い方', '方法', '手順', '設備', '精算機', '充電器', 'ゲート']
        }
      }
    });

    console.log('✅ facility/inquiry/normal テンプレートを追加しました:', template.id);
  } catch (error) {
    console.error('❌ テンプレート追加に失敗しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addFacilityTemplate(); 
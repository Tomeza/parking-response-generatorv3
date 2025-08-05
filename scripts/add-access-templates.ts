import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addAccessTemplates() {
  try {
    // access/inquiry/normal: 住所・行き方（Googleマップリンク案内）
    const inquiryTemplate = await prisma.templates.create({
      data: {
        category: 'access',
        intent: 'inquiry',
        tone: 'normal',
        title: '住所・行き方案内_通常',
        content: '当駐車場の住所とアクセス方法をご案内いたします。Googleマップのリンクもご利用いただけます。',
        variables: {},
        status: 'approved',
        is_approved: true,
        source: 'manual',
        usageLabel: 'アクセス_住所案内_通常',
        note: '住所・行き方に関する汎用テンプレート',
        originQuestion: '住所を教えてください',
        replyTypeTags: ['guide'],
        infoSourceTags: ['manual'],
        situationTags: ['normal'],
        metadata: {
          description: '住所・行き方に関する一般的な案内',
          keywords: ['住所', '行き方', 'アクセス', '地図', 'Googleマップ', '場所']
        }
      }
    });
    console.log('✅ access/inquiry/normal テンプレートを追加しました:', inquiryTemplate.id);

    // access/check/normal: 経路確認（最寄駅→駐車場）
    const checkTemplate = await prisma.templates.create({
      data: {
        category: 'access',
        intent: 'check',
        tone: 'normal',
        title: '経路確認_通常',
        content: '最寄り駅からの経路をご確認いたします。詳細な道順をお伝えいたします。',
        variables: {},
        status: 'approved',
        is_approved: true,
        source: 'manual',
        usageLabel: 'アクセス_経路確認_通常',
        note: '経路確認に関する汎用テンプレート',
        originQuestion: '最寄り駅からの経路を確認したい',
        replyTypeTags: ['guide'],
        infoSourceTags: ['manual'],
        situationTags: ['normal'],
        metadata: {
          description: '経路確認に関する一般的な案内',
          keywords: ['経路', '道順', '最寄り駅', '確認', 'ルート', 'アクセス']
        }
      }
    });
    console.log('✅ access/check/normal テンプレートを追加しました:', checkTemplate.id);

  } catch (error) {
    console.error('❌ テンプレート追加に失敗しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addAccessTemplates(); 
const { PrismaClient } = require('@prisma/client');
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('シードデータの投入を開始します');
  
  try {
    // 既存のデータを削除
    console.log('既存のデータを削除します');
    await prisma.alertWord.deleteMany({});
    await prisma.knowledgeTag.deleteMany({});
    await prisma.knowledge.deleteMany({});
    await prisma.tag.deleteMany({});
    
    // タグの作成
    console.log('タグを作成します');
    const reservationTag = await prisma.tag.create({
      data: {
        tag_name: '予約',
        description: '予約に関する情報',
      },
    });
    console.log('予約タグを作成しました:', reservationTag);

    const priceTag = await prisma.tag.create({
      data: {
        tag_name: '料金',
        description: '料金に関する情報',
      },
    });
    console.log('料金タグを作成しました:', priceTag);

    // ナレッジの作成
    console.log('ナレッジを作成します');
    const knowledge = await prisma.knowledge.create({
      data: {
        main_category: '予約',
        sub_category: '予約方法',
        detail_category: 'オンライン予約',
        question: '駐車場の予約方法を教えてください',
        answer: '当駐車場は24時間オンライン予約に対応しています。予約は以下の手順で行えます：\n\n1. 当社ウェブサイトにアクセス\n2. 予約フォームに必要事項を入力\n3. 予約内容の確認\n4. 予約完了\n\n予約は24時間前まで可能です。',
        is_template: false,
        usage: '○',
        note: '基本的な予約方法の説明',
        knowledge_tags: {
          create: [
            { tag_id: reservationTag.id },
            { tag_id: priceTag.id },
          ],
        },
      },
    });
    console.log('ナレッジを作成しました:', knowledge);

    // アラートワードの作成
    console.log('アラートワードを作成します');
    const alertWord = await prisma.alertWord.create({
      data: {
        word: '予約',
        description: '予約に関する問い合わせ',
        related_tag_id: reservationTag.id,
        priority: 1,
      },
    });
    console.log('アラートワードを作成しました:', alertWord);

    // 管理者ユーザーの作成
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existingAdmin = await prisma.adminUser.findUnique({
      where: { username: adminUsername }
    });

    if (!existingAdmin) {
      await prisma.adminUser.create({
        data: {
          username: adminUsername,
          email: 'admin@example.com',
          password_hash: hashedPassword
        }
      });
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    console.log('シードデータの投入が完了しました');
  } catch (error) {
    console.error('シードデータの投入中にエラーが発生しました:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
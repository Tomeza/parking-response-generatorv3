import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // サンプルの知識データを作成
  await prisma.knowledge.create({
    data: {
      question: '大型車の予約はいつからできますか？',
      answer: '大型車の予約は、利用日の3ヶ月前から可能です。ただし、繁忙期は早めに埋まる可能性があるため、できるだけ早めの予約をお勧めします。',
      main_category: '予約',
      sub_category: '大型車',
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
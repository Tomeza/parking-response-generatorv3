import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NEW_KNOWLEDGE = [
  {
    id: 200, // 仮のID (既存と重複しないように注意)
    question: '予約方法 予約の手順 予約 方法 手順 やり方 知りたい 教えて ウェブサイト web site', // キーワードをスペース区切りで
    answer: '当駐車場の予約はウェブサイトから簡単に行えます。ご希望の日時と車両情報を入力し、画面の指示に従って手続きを進めてください。',
    is_template: true,
    main_category: '予約',
    sub_category: '予約方法'
  },
  {
    id: 201, // 仮のID
    question: '外車 外車の駐車 ベンツ BMW アウディ レクサス 駐車 可能 停められる サイズ 制限', 
    answer: '外車の駐車は可能ですが、一部大型車や特殊車両についてはサイズ制限がございます。詳細はお問い合わせいただくか、ウェブサイトの車両制限をご確認ください。',
    is_template: true,
    main_category: '車両規定',
    sub_category: '外車'
  }
];

async function addMissingKnowledge() {
  console.log('不足しているナレッジを追加します...');

  for (const knowledgeData of NEW_KNOWLEDGE) {
    try {
      // 既に存在するか確認 (IDまたはquestionで)
      const existingById = await prisma.knowledge.findUnique({ where: { id: knowledgeData.id } });
      const existingByQuestion = await prisma.knowledge.findFirst({ where: { question: knowledgeData.question } });

      if (existingById || existingByQuestion) {
        console.log(`ID: ${knowledgeData.id} または Question: "${knowledgeData.question.substring(0,20)}..." は既に存在するためスキップします。`);
        continue;
      }

      await prisma.knowledge.create({
        data: knowledgeData
      });
      console.log(`ID: ${knowledgeData.id}, Question: "${knowledgeData.question.substring(0,20)}..." を追加しました。`);
    } catch (e) {
      console.error(`ID: ${knowledgeData.id} の追加中にエラーが発生しました:`, e);
    }
  }

  console.log('ナレッジの追加処理が完了しました。');
}

addMissingKnowledge()
  .catch(e => {
    console.error('スクリプト実行エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
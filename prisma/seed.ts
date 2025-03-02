const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // タグの作成
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { tag_name: '料金' },
      update: {},
      create: {
        tag_name: '料金',
        description: '駐車場の料金に関する情報',
      },
    }),
    prisma.tag.upsert({
      where: { tag_name: '営業時間' },
      update: {},
      create: {
        tag_name: '営業時間',
        description: '駐車場の営業時間に関する情報',
      },
    }),
    prisma.tag.upsert({
      where: { tag_name: '予約' },
      update: {},
      create: {
        tag_name: '予約',
        description: '駐車場の予約に関する情報',
      },
    }),
    prisma.tag.upsert({
      where: { tag_name: '場所' },
      update: {},
      create: {
        tag_name: '場所',
        description: '駐車場の場所や位置に関する情報',
      },
    }),
    prisma.tag.upsert({
      where: { tag_name: '設備' },
      update: {},
      create: {
        tag_name: '設備',
        description: '駐車場の設備に関する情報',
      },
    }),
    prisma.tag.upsert({
      where: { tag_name: 'キャンセル' },
      update: {},
      create: {
        tag_name: 'キャンセル',
        description: '予約のキャンセルに関する情報',
      },
    }),
    prisma.tag.upsert({
      where: { tag_name: '支払い方法' },
      update: {},
      create: {
        tag_name: '支払い方法',
        description: '駐車場の支払い方法に関する情報',
      },
    }),
  ]);

  console.log('タグを作成しました');

  // アラートワードの作成
  const alertWords = await Promise.all([
    prisma.alertWord.upsert({
      where: { word: '返金' },
      update: {},
      create: {
        word: '返金',
        description: '返金に関する問い合わせ',
        related_tag_id: tags[0].id, // 料金タグに関連付け
        priority: 8,
      },
    }),
    prisma.alertWord.upsert({
      where: { word: 'クレーム' },
      update: {},
      create: {
        word: 'クレーム',
        description: 'クレームや苦情に関する問い合わせ',
        priority: 9,
      },
    }),
    prisma.alertWord.upsert({
      where: { word: '障害者' },
      update: {},
      create: {
        word: '障害者',
        description: '障害者用駐車スペースに関する問い合わせ',
        related_tag_id: tags[4].id, // 設備タグに関連付け
        priority: 7,
      },
    }),
    prisma.alertWord.upsert({
      where: { word: '緊急' },
      update: {},
      create: {
        word: '緊急',
        description: '緊急の問い合わせ',
        priority: 10,
      },
    }),
    prisma.alertWord.upsert({
      where: { word: '故障' },
      update: {},
      create: {
        word: '故障',
        description: '設備の故障に関する問い合わせ',
        related_tag_id: tags[4].id, // 設備タグに関連付け
        priority: 8,
      },
    }),
  ]);

  console.log('アラートワードを作成しました');

  // ナレッジベースの作成
  const knowledgeEntries = await Promise.all([
    prisma.knowledge.upsert({
      where: { id: 1 },
      update: {},
      create: {
        main_category: '料金',
        sub_category: '通常料金',
        question: '駐車場の料金はいくらですか？',
        answer: '当駐車場の料金は以下の通りです。\n・平日：最初の1時間は300円、以降30分ごとに150円\n・土日祝：最初の1時間は400円、以降30分ごとに200円\n・深夜割引（22:00-8:00）：30分100円\n・1日最大料金：平日1,500円、土日祝2,000円',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[0].id } } } // 料金タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 2 },
      update: {},
      create: {
        main_category: '営業時間',
        sub_category: '通常営業',
        question: '駐車場の営業時間を教えてください',
        answer: '当駐車場は24時間営業しております。ただし、メンテナンス等で一時的に利用できない場合がございますので、事前に公式ウェブサイトでご確認いただくことをお勧めします。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[1].id } } } // 営業時間タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 3 },
      update: {},
      create: {
        main_category: '予約',
        sub_category: '予約方法',
        question: '駐車場の予約はできますか？',
        answer: '当駐車場では、公式ウェブサイトまたはアプリから事前予約が可能です。予約は利用日の3ヶ月前から前日まで受け付けております。予約時には車両情報（ナンバープレート、車種）の入力が必要です。予約確定後、予約番号が発行されますので、当日は予約番号をご提示ください。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[2].id } } } // 予約タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 4 },
      update: {},
      create: {
        main_category: '予約',
        sub_category: 'キャンセル',
        question: '予約をキャンセルしたい場合はどうすればいいですか？',
        answer: '予約のキャンセルは、利用予定時間の2時間前までであれば、公式ウェブサイトまたはアプリから無料で行えます。2時間を切ってからのキャンセルは、予約料金の50%のキャンセル料が発生します。当日キャンセルの場合は、予約料金の全額が発生しますのでご注意ください。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[2].id } } }, // 予約タグに関連付け
            { tag: { connect: { id: tags[5].id } } }  // キャンセルタグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 5 },
      update: {},
      create: {
        main_category: '場所',
        sub_category: 'アクセス',
        question: '駐車場の場所はどこですか？',
        answer: '当駐車場は東京都新宿区西新宿1-1-1に位置しております。最寄り駅は新宿駅で、西口から徒歩5分です。大きな赤い看板が目印となっております。また、カーナビでは「新宿パーキングセンター」で検索いただくとスムーズにご案内できます。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[3].id } } } // 場所タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 6 },
      update: {},
      create: {
        main_category: '設備',
        sub_category: '充電設備',
        question: '電気自動車の充電設備はありますか？',
        answer: '当駐車場には電気自動車用の充電設備を5台分ご用意しております。内訳はテスラ専用充電器が2台、汎用急速充電器（CHAdeMO/CCS対応）が3台です。充電は有料で、15分あたり500円の料金が発生します。充電スペースは事前予約も可能です。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[4].id } } } // 設備タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 7 },
      update: {},
      create: {
        main_category: '設備',
        sub_category: '障害者用駐車スペース',
        question: '障害者用の駐車スペースはありますか？',
        answer: '当駐車場には障害者用の駐車スペースを10台分ご用意しております。これらのスペースは入口に最も近い場所に位置し、幅も広くなっております。ご利用の際は障害者手帳または専用駐車証をフロントにてご提示ください。また、これらのスペースは一般の方のご利用はご遠慮いただいております。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[4].id } } } // 設備タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 8 },
      update: {},
      create: {
        main_category: '支払い',
        sub_category: '支払い方法',
        question: '支払い方法は何がありますか？',
        answer: '当駐車場では、現金、クレジットカード（VISA、Mastercard、JCB、AMEX）、電子マネー（Suica、PASMO、楽天Edy、iD、QUICPay）、QRコード決済（PayPay、LINE Pay、楽天ペイ）がご利用いただけます。また、定期利用のお客様は口座振替も可能です。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[6].id } } } // 支払い方法タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 9 },
      update: {},
      create: {
        main_category: '料金',
        sub_category: '定期利用',
        question: '月極駐車場の料金はいくらですか？',
        answer: '月極駐車場の料金は、立地や車のサイズによって異なります。標準的なサイズ（全長5m以内、全幅1.9m以内、全高1.5m以内）の場合、都心部で月額25,000円〜35,000円、郊外で月額15,000円〜25,000円となっております。大型車や特殊車両は別途お見積りとなりますので、お問い合わせください。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[0].id } } } // 料金タグに関連付け
          ]
        }
      },
    }),
    prisma.knowledge.upsert({
      where: { id: 10 },
      update: {},
      create: {
        main_category: '設備',
        sub_category: 'セキュリティ',
        question: '駐車場のセキュリティ対策はどうなっていますか？',
        answer: '当駐車場では、24時間体制の監視カメラ、定期的な警備員の巡回、車両ナンバー認証システム、夜間の照明強化など、複数のセキュリティ対策を講じております。また、出入口にはゲートを設置し、駐車券または会員カードがないと入退場できない仕組みになっております。お客様の大切なお車を守るため、万全の体制を整えております。',
        knowledge_tags: {
          create: [
            { tag: { connect: { id: tags[4].id } } } // 設備タグに関連付け
          ]
        }
      },
    }),
  ]);

  console.log('ナレッジベースを作成しました');

  // タグの同義語を追加
  const tagSynonyms = await Promise.all([
    prisma.tagSynonym.upsert({
      where: { id: 1 },
      update: {},
      create: {
        tag_id: tags[0].id, // 料金タグ
        synonym: '値段',
      },
    }),
    prisma.tagSynonym.upsert({
      where: { id: 2 },
      update: {},
      create: {
        tag_id: tags[0].id, // 料金タグ
        synonym: 'コスト',
      },
    }),
    prisma.tagSynonym.upsert({
      where: { id: 3 },
      update: {},
      create: {
        tag_id: tags[1].id, // 営業時間タグ
        synonym: '開店時間',
      },
    }),
    prisma.tagSynonym.upsert({
      where: { id: 4 },
      update: {},
      create: {
        tag_id: tags[1].id, // 営業時間タグ
        synonym: '閉店時間',
      },
    }),
    prisma.tagSynonym.upsert({
      where: { id: 5 },
      update: {},
      create: {
        tag_id: tags[2].id, // 予約タグ
        synonym: '事前登録',
      },
    }),
  ]);

  console.log('タグの同義語を作成しました');

  // 季節情報を追加
  const seasonalInfo = await Promise.all([
    prisma.seasonalInfo.upsert({
      where: { id: 1 },
      update: {},
      create: {
        info_type: '年末年始営業時間',
        start_date: new Date('2024-12-29'),
        end_date: new Date('2025-01-03'),
        description: '年末年始期間中（12/29〜1/3）は、営業時間を9:00〜18:00に短縮させていただきます。ご不便をおかけしますが、ご理解のほどよろしくお願いいたします。',
      },
    }),
    prisma.seasonalInfo.upsert({
      where: { id: 2 },
      update: {},
      create: {
        info_type: 'ゴールデンウィーク料金',
        start_date: new Date('2024-04-27'),
        end_date: new Date('2024-05-06'),
        description: 'ゴールデンウィーク期間中（4/27〜5/6）は、特別料金となります。通常の土日祝料金に加えて、30分ごとに50円の追加料金が発生します。また、1日最大料金は2,500円となります。',
      },
    }),
  ]);

  console.log('季節情報を作成しました');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
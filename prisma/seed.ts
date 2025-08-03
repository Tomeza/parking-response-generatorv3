import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // サンプルテンプレートの投入
  const templates = [
    // 予約関連テンプレート
    {
      title: '予約確認_通常',
      content: 'ご予約の確認をいたします。予約番号をご確認ください。',
      category: 'reservation',
      intent: 'check',
      tone: 'normal',
      variables: { reservation_number: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '予約作成_緊急',
      content: '緊急のご予約を承ります。至急対応いたします。',
      category: 'reservation',
      intent: 'create',
      tone: 'urgent',
      variables: { customer_name: 'string', vehicle_number: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '予約変更_通常',
      content: 'ご予約の変更を承ります。変更内容をご確認ください。',
      category: 'reservation',
      intent: 'modify',
      tone: 'normal',
      variables: { reservation_number: 'string', new_date: 'date' },
      version: 1,
      is_approved: true
    },
    {
      title: '予約キャンセル_通常',
      content: 'ご予約のキャンセルを承ります。キャンセル手数料についてご案内いたします。',
      category: 'reservation',
      intent: 'cancel',
      tone: 'normal',
      variables: { reservation_number: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '予約確認_将来',
      content: '将来のご予約についてご案内いたします。',
      category: 'reservation',
      intent: 'check',
      tone: 'future',
      variables: { future_date: 'date' },
      version: 1,
      is_approved: true
    },

    // 支払い関連テンプレート
    {
      title: '支払い確認_通常',
      content: 'お支払い状況をご確認いたします。',
      category: 'payment',
      intent: 'check',
      tone: 'normal',
      variables: { invoice_number: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '支払い方法_通常',
      content: 'お支払い方法についてご案内いたします。',
      category: 'payment',
      intent: 'inquiry',
      tone: 'normal',
      variables: {},
      version: 1,
      is_approved: true
    },
    {
      title: '支払い報告_緊急',
      content: '支払いに関する緊急事態を報告いたします。',
      category: 'payment',
      intent: 'report',
      tone: 'urgent',
      variables: { issue_type: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '料金確認_将来',
      content: '将来の料金体系についてご案内いたします。',
      category: 'payment',
      intent: 'check',
      tone: 'future',
      variables: { service_type: 'string' },
      version: 1,
      is_approved: true
    },

    // 送迎関連テンプレート
    {
      title: '送迎確認_通常',
      content: '送迎サービスのご確認をいたします。',
      category: 'shuttle',
      intent: 'check',
      tone: 'normal',
      variables: { pickup_location: 'string', dropoff_location: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '送迎予約_緊急',
      content: '緊急の送迎サービスを承ります。',
      category: 'shuttle',
      intent: 'create',
      tone: 'urgent',
      variables: { customer_name: 'string', urgent_reason: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '送迎変更_通常',
      content: '送迎サービスの変更を承ります。',
      category: 'shuttle',
      intent: 'modify',
      tone: 'normal',
      variables: { reservation_number: 'string', new_time: 'time' },
      version: 1,
      is_approved: true
    },
    {
      title: '送迎キャンセル_通常',
      content: '送迎サービスのキャンセルを承ります。',
      category: 'shuttle',
      intent: 'cancel',
      tone: 'normal',
      variables: { reservation_number: 'string' },
      version: 1,
      is_approved: true
    },

    // 設備関連テンプレート
    {
      title: '設備確認_通常',
      content: '設備の利用状況をご確認いたします。',
      category: 'facility',
      intent: 'check',
      tone: 'normal',
      variables: { facility_type: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '設備予約_通常',
      content: '設備のご予約を承ります。',
      category: 'facility',
      intent: 'create',
      tone: 'normal',
      variables: { facility_type: 'string', usage_date: 'date' },
      version: 1,
      is_approved: true
    },
    {
      title: '設備故障_緊急',
      content: '設備の故障を報告いたします。緊急対応いたします。',
      category: 'facility',
      intent: 'report',
      tone: 'urgent',
      variables: { facility_type: 'string', issue_description: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '設備案内_将来',
      content: '新設備についてご案内いたします。',
      category: 'facility',
      intent: 'inquiry',
      tone: 'future',
      variables: { new_facility: 'string' },
      version: 1,
      is_approved: true
    },

    // トラブル関連テンプレート
    {
      title: 'トラブル報告_緊急',
      content: 'トラブルを報告いたします。緊急対応いたします。',
      category: 'trouble',
      intent: 'report',
      tone: 'urgent',
      variables: { trouble_type: 'string', description: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: 'トラブル確認_通常',
      content: 'トラブルの状況をご確認いたします。',
      category: 'trouble',
      intent: 'check',
      tone: 'normal',
      variables: { trouble_id: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: 'トラブル対応_通常',
      content: 'トラブルへの対応についてご案内いたします。',
      category: 'trouble',
      intent: 'inquiry',
      tone: 'normal',
      variables: { trouble_type: 'string' },
      version: 1,
      is_approved: true
    },

    // その他関連テンプレート
    {
      title: '営業時間_通常',
      content: '営業時間についてご案内いたします。',
      category: 'other',
      intent: 'inquiry',
      tone: 'normal',
      variables: {},
      version: 1,
      is_approved: true
    },
    {
      title: '問い合わせ_通常',
      content: 'お問い合わせを承ります。',
      category: 'other',
      intent: 'inquiry',
      tone: 'normal',
      variables: { inquiry_type: 'string' },
      version: 1,
      is_approved: true
    },
    {
      title: '緊急連絡_緊急',
      content: '緊急のご連絡を承ります。',
      category: 'other',
      intent: 'report',
      tone: 'urgent',
      variables: { emergency_type: 'string' },
      version: 1,
      is_approved: true
    }
  ];

  for (const template of templates) {
    await prisma.templates.create({
      data: template
    });
  }

  console.log(`Created ${templates.length} templates`);
  console.log('Seeding completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
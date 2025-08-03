const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');

const prisma = new PrismaClient();

// カテゴリマッピング（現場粒度を保持）
const categoryMapping = {
  '利用の流れ': 'reservation',
  '予約関連': 'reservation',
  '車両関連': 'vehicle',
  '送迎関連': 'shuttle',
  '料金関連': 'payment',
  '記入情報': 'information',
  '利用制限': 'restriction',
  '免責約款': 'disclaimer',
  'アクセス': 'access',
  'サービス案内': 'general',
  '対応': 'trouble'
};

// 意図マッピング（現場の質問タイプを反映）
const intentMapping = {
  '丁寧説明': 'explain',
  '簡潔回答': 'answer',
  '注意喚起': 'warn',
  '重要説明': 'important',
  '謝罪必須': 'apologize',
  '明確制限': 'restrict',
  '手順説明': 'procedure',
  '代替提案': 'alternative',
  '明確拒否': 'deny',
  '免責説明': 'disclaimer',
  '時間提示': 'time',
  '配慮説明': 'consideration',
  '安全優先': 'safety',
  '迅速連絡': 'urgent',
  '案内物説明': 'guide',
  '設備案内': 'facility',
  '特別対応案内': 'special',
  '明確説明': 'clarify',
  '明確指示': 'instruction',
  '入力例示': 'example',
  '補償説明': 'compensation',
  '解決方法提示': 'solution',
  '場所説明': 'location',
  '経路案内': 'route',
  '情報提供': 'inform',
  '具体案内': 'guide',
  '共感対応': 'empathize',
  '条件付対応': 'conditional',
  'サービス説明': 'explain',
  '明確回答': 'answer',
  'ルール説明': 'explain',
  '手順案内': 'guide',
  '可否回答': 'answer',
  '条件説明': 'explain',
  '条件付き回答': 'conditional'
};

// トーンマッピング（状況に応じた対応）
const toneMapping = {
  '標準対応': 'normal',
  '条件付対応': 'conditional',
  '例外不可': 'strict',
  '時間制限あり': 'urgent',
  '計画必要': 'future',
  '連絡必須': 'required',
  '免責事項': 'disclaimer',
  '事前準備必要': 'preparation',
  '追加費用発生': 'additional',
  '詳細列挙': 'detailed',
  '必須説明': 'mandatory',
  '事前確認必要': 'confirmation',
  '緊急対応': 'emergency',
  '運用対処': 'operational',
  '手順説明': 'procedural',
  '事前承諾必要': 'approval',
  '代替確認方法': 'alternative',
  '例外なし': 'no_exception',
  '入力指示': 'input',
  '罰則あり': 'penalty',
  '当社判断': 'discretion',
  '事前申告必要': 'declaration',
  '待機可能性あり': 'waiting',
  '内部管理': 'internal',
  '状況依存': 'situational',
  '人数制限あり': 'capacity',
  '理由説明': 'reasoning',
  '相乗り情報': 'carpool',
  '案内資料あり': 'documentation',
  'スタッフ依頼': 'staff',
  '事前申告可能': 'optional_declaration',
  '払戻対応': 'refund',
  '手順詳細': 'detailed_procedure',
  'トラブル対応': 'trouble',
  '条件分岐あり': 'conditional_branch',
  '必須情報': 'required_info',
  '形式指定': 'format',
  '確認必須': 'verification',
  '補償制限あり': 'limited_compensation',
  '調査必要': 'investigation',
  '詳細説明': 'detailed_explanation',
  '注意点あり': 'caution',
  '証拠確認必須': 'evidence_required',
  '特殊対応': 'special'
};

function generateGranularTitle(mainCategory, subCategory, detailCategory) {
  return `${mainCategory}_${subCategory}_${detailCategory}`;
}

function mapCategory(mainCategory) {
  return categoryMapping[mainCategory] || 'general';
}

function mapIntent(replyTypeTags) {
  if (!replyTypeTags) return 'inquiry';

  const tags = replyTypeTags.split(',').map(tag => tag.trim());

  for (const tag of tags) {
    if (intentMapping[tag]) {
      return intentMapping[tag];
    }
  }

  return 'inquiry';
}

function mapTone(situationTags) {
  if (!situationTags) return 'normal';

  const tags = situationTags.split(',').map(tag => tag.trim());

  for (const tag of tags) {
    if (toneMapping[tag]) {
      return toneMapping[tag];
    }
  }

  return 'normal';
}

function extractVariables(content) {
  const variables = {};
  
  // 料金関連の変数を抽出
  if (content.includes('20%') || content.includes('50%')) {
    variables.cancel_rate = 'string';
  }
  
  // 予約番号関連
  if (content.includes('予約番号')) {
    variables.reservation_number = 'string';
  }
  
  // 振込関連
  if (content.includes('振込')) {
    variables.payment_method = 'string';
  }
  
  // 証明書関連
  if (content.includes('証明書')) {
    variables.documentation = 'string';
  }

  // 初回利用関連
  if (content.includes('初めて') || content.includes('初回')) {
    variables.first_time = 'boolean';
  }

  // 送迎時間関連
  if (content.includes('10分')) {
    variables.shuttle_time = 'string';
  }

  // 営業時間関連
  if (content.includes('5時') || content.includes('0時') || content.includes('24時')) {
    variables.business_hours = 'string';
  }

  // 人数制限関連
  if (content.includes('5名') || content.includes('6名')) {
    variables.passenger_limit = 'number';
  }

  // 車椅子関連
  if (content.includes('車椅子')) {
    variables.wheelchair = 'boolean';
  }

  // クレーム関連
  if (content.includes('クレーム') || content.includes('苦情')) {
    variables.complaint_type = 'string';
  }

  // 返金関連
  if (content.includes('返金') || content.includes('払い戻し')) {
    variables.refund_amount = 'string';
  }

  return variables;
}

async function generateGranularTemplates() {
  try {
      console.log('=== 現場粒度テンプレート生成開始 ===');
  console.log('CSVファイル: knowledge_complaint.csv');

    const results = [];

    // CSVファイルを読み込み
    await new Promise((resolve, reject) => {
      fs.createReadStream('src/data/csv/production/knowledge_complaint.csv')
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`総エントリ数: ${results.length}`);

    // 使用可能なエントリのみをフィルタ
    const usableEntries = results.filter(entry => entry.usage === '◯');
    console.log(`使用可能エントリ数: ${usableEntries.length}`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const entry of usableEntries) {
      try {
        const title = generateGranularTitle(
          entry.main_category,
          entry.sub_category,
          entry.detail_category
        );

        const category = mapCategory(entry.main_category);
        const intent = mapIntent(entry.reply_type_tags);
        const tone = mapTone(entry.situation_tags);
        const variables = extractVariables(entry.answer);

        // メタデータを構築
        const metadata = {
          main_category: entry.main_category,
          sub_category: entry.sub_category,
          detail_category: entry.detail_category,
          original_question: entry.question,
          original_tags: entry.original_tags,
          reply_type_tags: entry.reply_type_tags,
          info_source_tags: entry.info_source_tags,
          situation_tags: entry.situation_tags,
          note: entry.note,
          issue: entry.issue,
          is_template: entry.is_template === 'true'
        };

        // 既存テンプレートをチェック
        const existingTemplate = await prisma.templates.findFirst({
          where: {
            title,
            category,
            intent,
            tone
          }
        });

        if (existingTemplate) {
          console.log(`スキップ: ${title} (既存)`);
          skippedCount++;
          continue;
        }

        // 新しいテンプレートを作成
        const template = await prisma.templates.create({
          data: {
            title,
            content: entry.answer,
            category,
            intent,
            tone,
            variables,
            version: 1,
            is_approved: true,
            metadata
          }
        });

        console.log(`作成: ${title} (${category}/${intent}/${tone})`);
        createdCount++;

      } catch (error) {
        console.error(`エラー (${entry.main_category}/${entry.sub_category}/${entry.detail_category}):`, error.message);
      }
    }

    console.log('\n=== 生成完了 ===');
    console.log(`作成されたテンプレート: ${createdCount}件`);
    console.log(`スキップされたテンプレート: ${skippedCount}件`);

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateGranularTemplates(); 
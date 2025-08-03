const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');

const prisma = new PrismaClient();

// カテゴリマッピング
const categoryMapping = {
  '利用の流れ': 'reservation',
  '予約関連': 'reservation', 
  '車両関連': 'vehicle',
  '送迎関連': 'shuttle',
  '料金関連': 'payment',
  '記入情報': 'information',
  '利用制限': 'restriction',
  '免責約款': 'disclaimer'
};

// 意図マッピング
const intentMapping = {
  '丁寧説明': 'explain',
  '簡潔回答': 'answer',
  '注意喚起': 'warn',
  '重要説明': 'important',
  '謝罪必須': 'apologize',
  '明確制限': 'restrict'
};

// トーンマッピング
const toneMapping = {
  '標準対応': 'normal',
  '条件付対応': 'conditional',
  '例外不可': 'strict',
  '時間制限あり': 'urgent',
  '計画必要': 'future'
};

function mapCategory(mainCategory) {
  return categoryMapping[mainCategory] || 'general';
}

function mapIntent(replyTypeTags) {
  if (!replyTypeTags) return 'explain';
  const types = replyTypeTags.split(' ');
  for (const type of types) {
    if (intentMapping[type]) {
      return intentMapping[type];
    }
  }
  return 'explain';
}

function mapTone(situationTags) {
  if (!situationTags) return 'normal';
  const types = situationTags.split(' ');
  for (const type of types) {
    if (toneMapping[type]) {
      return toneMapping[type];
    }
  }
  return 'normal';
}

function generateTitle(knowledge) {
  return `${knowledge.main_category}_${knowledge.sub_category}_${knowledge.detail_category}`;
}

function extractVariables(knowledge) {
  // 回答内容から変数を抽出する簡易ロジック
  const variables = {};
  
  // 料金関連の変数
  if (knowledge.answer.includes('料金') || knowledge.answer.includes('金額')) {
    variables.price = 'number';
  }
  
  // 時間関連の変数
  if (knowledge.answer.includes('時間') || knowledge.answer.includes('分')) {
    variables.time = 'string';
  }
  
  // 車両関連の変数
  if (knowledge.answer.includes('車両') || knowledge.answer.includes('車種')) {
    variables.vehicle = 'string';
  }
  
  return variables;
}

function convertToTemplate(knowledge) {
  return {
    title: generateTitle(knowledge),
    content: knowledge.answer,
    category: mapCategory(knowledge.main_category),
    intent: mapIntent(knowledge.reply_type_tags),
    tone: mapTone(knowledge.situation_tags),
    variables: extractVariables(knowledge),
    version: 1,
    is_approved: knowledge.usage === '◯' // 完全対応のみ承認
  };
}

async function generateTemplatesFromKnowledge() {
  const knowledgeEntries = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream('src/data/csv/production/knowledge.csv')
      .pipe(csv())
      .on('data', (data) => knowledgeEntries.push(data))
      .on('end', async () => {
        try {
          console.log('=== ナレッジCSVからテンプレート生成 ===');
          console.log(`総エントリ数: ${knowledgeEntries.length}`);
          
          // 完全対応（◯）のみをテンプレート候補として抽出
          const templateCandidates = knowledgeEntries.filter(entry => entry.usage === '◯');
          console.log(`テンプレート候補数 (◯のみ): ${templateCandidates.length}`);
          
          // カテゴリ別統計
          const categoryStats = templateCandidates.reduce((acc, entry) => {
            const category = mapCategory(entry.main_category);
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {});
          
          console.log('\nカテゴリ別テンプレート生成予定:');
          Object.entries(categoryStats).forEach(([category, count]) => {
            console.log(`${category}: ${count}件`);
          });
          
          // 既存テンプレートの確認
          const existingTemplates = await prisma.templates.findMany();
          console.log(`\n既存テンプレート数: ${existingTemplates.length}`);
          
          // テンプレート生成とデータベース挿入
          let createdCount = 0;
          for (const knowledge of templateCandidates) {
            try {
              const template = convertToTemplate(knowledge);
              
              // 重複チェック（タイトルベース）
              const existing = await prisma.templates.findFirst({
                where: { title: template.title }
              });
              
              if (!existing) {
                await prisma.templates.create({
                  data: template
                });
                createdCount++;
                console.log(`✓ 作成: ${template.title}`);
              } else {
                console.log(`- スキップ: ${template.title} (既存)`);
              }
            } catch (error) {
              console.error(`✗ エラー: ${knowledge.question}`, error.message);
            }
          }
          
          console.log(`\n=== 生成完了 ===`);
          console.log(`新規作成: ${createdCount}件`);
          console.log(`スキップ: ${templateCandidates.length - createdCount}件`);
          
          resolve();
        } catch (error) {
          reject(error);
        }
      });
  });
}

generateTemplatesFromKnowledge()
  .then(() => {
    console.log('テンプレート生成処理完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('エラー:', error);
    process.exit(1);
  }); 
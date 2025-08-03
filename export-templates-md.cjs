const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function exportTemplatesToMarkdown() {
  try {
    console.log('📋 テンプレートをMarkdown形式でエクスポート中...');
    
    // 全テンプレートを取得
    const templates = await prisma.templates.findMany({
      where: {
        is_approved: true
      },
      orderBy: [
        { category: 'asc' },
        { intent: 'asc' },
        { tone: 'asc' }
      ]
    });
    
    console.log(`✅ ${templates.length}件のテンプレートを取得しました`);
    
    // Markdown形式で出力
    let markdown = '# 駐車場サービス テンプレート一覧\n\n';
    markdown += '## 概要\n\n';
    markdown += `- **総テンプレート数**: ${templates.length}件\n`;
    markdown += `- **承認済みテンプレート**: ${templates.length}件\n`;
    markdown += `- **エクスポート日時**: ${new Date().toLocaleString('ja-JP')}\n\n`;
    
    // カテゴリ別にグループ化
    const groupedTemplates = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {});
    
    // カテゴリ別に出力
    for (const [category, categoryTemplates] of Object.entries(groupedTemplates)) {
      const categoryName = getCategoryName(category);
      markdown += `## ${categoryName}\n\n`;
      
      // 意図別にグループ化
      const intentGroups = categoryTemplates.reduce((acc, template) => {
        if (!acc[template.intent]) {
          acc[template.intent] = [];
        }
        acc[template.intent].push(template);
        return acc;
      }, {});
      
      for (const [intent, intentTemplates] of Object.entries(intentGroups)) {
        const intentName = getIntentName(intent);
        markdown += `### ${intentName}\n\n`;
        
        for (const template of intentTemplates) {
          const toneName = getToneName(template.tone);
          markdown += `#### ${template.title} (${toneName})\n\n`;
          markdown += `**カテゴリ**: ${categoryName}\n`;
          markdown += `**意図**: ${intentName}\n`;
          markdown += `**トーン**: ${toneName}\n`;
          markdown += `**信頼度**: ${(template.confidence || 0.8) * 100}%\n\n`;
          markdown += `**内容**:\n\n`;
          markdown += `\`\`\`\n${template.content}\n\`\`\`\n\n`;
          
          if (template.variables && Object.keys(template.variables).length > 0) {
            markdown += `**変数**:\n`;
            for (const [key, type] of Object.entries(template.variables)) {
              markdown += `- \`${key}\`: ${type}\n`;
            }
            markdown += '\n';
          }
          
          markdown += `---\n\n`;
        }
      }
    }
    
    // 統計情報
    markdown += '## 統計情報\n\n';
    const categoryStats = Object.entries(groupedTemplates).map(([category, templates]) => {
      return `- **${getCategoryName(category)}**: ${templates.length}件`;
    }).join('\n');
    markdown += categoryStats + '\n\n';
    
    // ファイルに保存
    const fs = require('fs');
    const filename = `templates-export-${new Date().toISOString().split('T')[0]}.md`;
    fs.writeFileSync(filename, markdown, 'utf8');
    
    console.log(`✅ Markdownファイルを保存しました: ${filename}`);
    console.log('\n📊 統計情報:');
    console.log(`- 総テンプレート数: ${templates.length}件`);
    console.log(`- カテゴリ数: ${Object.keys(groupedTemplates).length}種類`);
    
    // カテゴリ別統計
    for (const [category, categoryTemplates] of Object.entries(groupedTemplates)) {
      console.log(`  - ${getCategoryName(category)}: ${categoryTemplates.length}件`);
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function getCategoryName(category) {
  const categoryNames = {
    'reservation': '予約関連',
    'payment': '支払い関連',
    'shuttle': '送迎関連',
    'facility': '設備関連',
    'trouble': 'トラブル関連',
    'other': 'その他'
  };
  return categoryNames[category] || category;
}

function getIntentName(intent) {
  const intentNames = {
    'create': '新規作成',
    'check': '確認・照会',
    'modify': '変更・修正',
    'cancel': 'キャンセル・削除',
    'report': '報告・通知',
    'inquiry': '問い合わせ'
  };
  return intentNames[intent] || intent;
}

function getToneName(tone) {
  const toneNames = {
    'urgent': '緊急',
    'normal': '通常',
    'future': '将来'
  };
  return toneNames[tone] || tone;
}

// 実行
exportTemplatesToMarkdown(); 
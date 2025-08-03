import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

interface CSVRow {
  main_category: string;
  sub_category: string;
  detail_category: string;
  question: string;
  answer: string;
  original_tags: string;
  reply_type_tags: string;
  info_source_tags: string;
  situation_tags: string;
  usage: string;
  note: string;
  issue: string;
  is_template: string;
}

interface TemplateData {
  title: string;
  content: string;
  category: string;
  intent: string;
  tone: string;
  variables: any;
  source: string;
  sourceRowId: number;
  sourceHash: string;
  usageLabel: string;
  note: string;
  replyTypeTags: string[];
  infoSourceTags: string[];
  situationTags: string[];
}

// 変換ルール（確定案）
const categoryMapping: Record<string, string> = {
  '利用の流れ': 'flow'
};

function parseTags(tagString: string): string[] {
  if (!tagString) return [];
  return tagString.split(' ').filter(tag => tag.trim() !== '');
}

function generateHash(question: string, answer: string): string {
  return crypto.createHash('sha256').update(`${question}|${answer}`).digest('hex').substring(0, 16);
}

function convertCSVToTemplate(row: CSVRow, rowId: number): TemplateData {
  // カテゴリ変換
  const category = categoryMapping[row.main_category] || 'other';
  
  // タイトル生成
  const title = `${row.main_category}_${row.sub_category}_${row.detail_category}`;
  
  // タグ解析
  const replyTypeTags = parseTags(row.reply_type_tags);
  const infoSourceTags = parseTags(row.info_source_tags);
  const situationTags = parseTags(row.situation_tags);
  
  // ハッシュ生成
  const sourceHash = generateHash(row.question, row.answer);
  
  return {
    title,
    content: row.answer,
    category,
    intent: 'inquiry', // 8件はすべて問い合わせ
    tone: 'normal',    // 緊急性のタグなし
    variables: null,   // 空配列/空オブジェクト
    source: 'csv',
    sourceRowId: rowId,
    sourceHash,
    usageLabel: row.usage,
    note: row.note,
    replyTypeTags,
    infoSourceTags,
    situationTags
  };
}

async function convert8Templates() {
  try {
    console.log('🔄 8行のCSVデータを変換中...');
    
    const csvFile = 'src/data/csv/production/knowledge.csv';
    const results: CSVRow[] = [];
    
    // CSVファイルを読み込み
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFile)
        .pipe(csv())
        .on('data', (row: any) => {
          if (row.usage === '◯') {
            results.push(row as CSVRow);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 CSVから ${results.length}件のusage=◯データを読み込みました`);
    
    // 最初の8件を変換
    const first8Rows = results.slice(0, 8);
    const convertedTemplates: TemplateData[] = [];
    
    console.log('\n📋 変換プレビュー（8件）:');
    console.log('='.repeat(80));
    
    for (let i = 0; i < first8Rows.length; i++) {
      const row = first8Rows[i];
      const template = convertCSVToTemplate(row, i + 1);
      convertedTemplates.push(template);
      
      console.log(`\n${i + 1}. ${template.title}`);
      console.log(`   カテゴリ: ${template.category}`);
      console.log(`   意図: ${template.intent}`);
      console.log(`   トーン: ${template.tone}`);
      console.log(`   内容: ${template.content.substring(0, 50)}...`);
      console.log(`   タグ: ${template.replyTypeTags.join(', ')}`);
      console.log(`   情報源: ${template.infoSourceTags.join(', ')}`);
      console.log(`   状況: ${template.situationTags.join(', ')}`);
      console.log(`   使用: ${template.usageLabel}`);
      console.log(`   備考: ${template.note}`);
      console.log(`   根拠: source=${template.source}, rowId=${template.sourceRowId}, hash=${template.sourceHash}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 変換統計:');
    console.log(`   - 変換対象: ${first8Rows.length}件`);
    console.log(`   - カテゴリ分布:`);
    
    const categoryStats = convertedTemplates.reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`     ${category}: ${count}件`);
    });
    
    // 重複チェック
    const titles = convertedTemplates.map(t => t.title);
    const uniqueTitles = new Set(titles);
    
    if (titles.length !== uniqueTitles.size) {
      console.log(`\n⚠️  重複タイトル: ${titles.length - uniqueTitles.size}件`);
    } else {
      console.log('\n✅ 重複なし');
    }
    
    return convertedTemplates;
    
  } catch (error) {
    console.error('❌ 変換エラー:', error);
    return [];
  }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  convert8Templates().finally(() => {
    prisma.$disconnect();
  });
}

export { convert8Templates, convertCSVToTemplate }; 
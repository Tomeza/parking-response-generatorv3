const fs = require('fs');
const csv = require('csv-parser');

async function analyzeKnowledgeStructure() {
  const results = [];
  
  fs.createReadStream('src/data/csv/production/knowledge.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      console.log('=== ナレッジCSV構造分析 ===');
      
      // 基本統計
      console.log(`総エントリ数: ${results.length}`);
      
      // カテゴリ分析
      const categories = [...new Set(results.map(r => r.main_category))];
      console.log('\n主要カテゴリ:', categories);
      
      // usage分析（修正された解釈）
      const usageStats = results.reduce((acc, r) => {
        acc[r.usage] = (acc[r.usage] || 0) + 1;
        return acc;
      }, {});
      console.log('\n対応可否分析:');
      console.log('◯ (完全対応):', usageStats['◯'] || 0, '件');
      console.log('△ (条件付き対応):', usageStats['△'] || 0, '件');
      console.log('✖️ (対応不可):', usageStats['✖️'] || 0, '件');
      
      // テンプレート候補分析（◯のみ）
      const templateCandidates = results.filter(r => r.usage === '◯');
      console.log('\nテンプレート候補数 (◯のみ):', templateCandidates.length);
      
      // カテゴリ別テンプレート候補
      const categoryCandidates = templateCandidates.reduce((acc, r) => {
        acc[r.main_category] = (acc[r.main_category] || 0) + 1;
        return acc;
      }, {});
      console.log('\nカテゴリ別テンプレート候補:');
      Object.entries(categoryCandidates).forEach(([category, count]) => {
        console.log(`${category}: ${count}件`);
      });
      
      // 品質分析
      const qualityIssues = results.filter(r => 
        !r.question || !r.answer || r.usage === '✖️'
      );
      console.log('\n品質問題件数:', qualityIssues.length);
      
      // reply_type_tags分析
      const replyTypes = results.reduce((acc, r) => {
        if (r.reply_type_tags) {
          const types = r.reply_type_tags.split(' ');
          types.forEach(type => {
            acc[type] = (acc[type] || 0) + 1;
          });
        }
        return acc;
      }, {});
      console.log('\n回答タイプ分析:');
      Object.entries(replyTypes).forEach(([type, count]) => {
        console.log(`${type}: ${count}件`);
      });
      
      // situation_tags分析
      const situations = results.reduce((acc, r) => {
        if (r.situation_tags) {
          const types = r.situation_tags.split(' ');
          types.forEach(type => {
            acc[type] = (acc[type] || 0) + 1;
          });
        }
        return acc;
      }, {});
      console.log('\n状況タイプ分析:');
      Object.entries(situations).forEach(([type, count]) => {
        console.log(`${type}: ${count}件`);
      });
    });
}

analyzeKnowledgeStructure(); 
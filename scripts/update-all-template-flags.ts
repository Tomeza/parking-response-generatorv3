import { PrismaClient } from '@prisma/client';

// アルゴリズム実装例に基づいた優先度設定
const PRIORITY_ENTRIES = [
  // アラートワードに基づく優先順位
  { id: 87, description: '国際線関連', priority: 10, usage: '✖️' }, // 国際線 - 最優先
  { id: 88, description: '外車関連', priority: 9, usage: '✖️' },  // 外車・高級車
  { id: 28, description: '国際線施設', priority: 8, usage: '✖️' }, // 国際線施設利用
  { id: 167, description: '予約注意点', priority: 7, usage: '◯' }, // 予約に関する注意点
  { id: 166, description: '予約確認事項', priority: 6, usage: '◯' }, // 予約確認事項
  { id: 165, description: '予約必要情報', priority: 5, usage: '◯' }, // 予約必要情報
  { id: 164, description: '予約開始時期', priority: 4, usage: '◯' }, // 予約開始時期
  { id: 168, description: '予約方法', priority: 3, usage: '◯' },  // 予約方法
];

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('テンプレートフラグの初期化と優先度設定を開始...');
    
    // 1. まず全てのエントリのis_templateフラグをfalseに設定
    const resetResult = await prisma.knowledge.updateMany({
      data: {
        is_template: false
      }
    });
    
    console.log(`${resetResult.count}件のエントリのテンプレートフラグをfalseにリセットしました`);
    
    // 2. 優先度の高いエントリのis_templateフラグをtrueに設定
    for (const entry of PRIORITY_ENTRIES) {
      const result = await prisma.knowledge.update({
        where: { id: entry.id },
        data: { is_template: true },
        select: { 
          id: true, 
          main_category: true, 
          sub_category: true,
          is_template: true 
        }
      });
      
      console.log(`ID=${result.id}, ${result.main_category}/${result.sub_category}, 優先度=${entry.priority}, 使用可否=${entry.usage} のテンプレートフラグをtrueに設定しました`);
    }
    
    console.log('テンプレートフラグの更新が完了しました');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function importTagData() {
  try {
    console.log('タグデータインポート開始...');
    
    // 既存のタグを削除
    // await prisma.tagSynonym.deleteMany({});
    // await prisma.knowledgeTag.deleteMany({});
    // await prisma.tag.deleteMany({});
    
    // 基本タグの作成
    const tags = [
      { tag_name: '予約', description: '予約に関する情報' },
      { tag_name: '料金', description: '料金に関する情報' },
      { tag_name: '駐車場', description: '駐車場に関する情報' },
      { tag_name: '送迎', description: '送迎に関する情報' },
      { tag_name: '支払い', description: '支払いに関する情報' },
      { tag_name: '車種', description: '車種に関する情報' },
      { tag_name: '繁忙期', description: '繁忙期に関する情報' },
      { tag_name: '国際線', description: '国際線に関する情報' },
      { tag_name: '国内線', description: '国内線に関する情報' },
      { tag_name: 'キャンセル', description: 'キャンセルに関する情報' },
      { tag_name: '営業時間', description: '営業時間に関する情報' },
      { tag_name: '領収書', description: '領収書に関する情報' },
      { tag_name: '割引', description: '割引に関する情報' }
    ];
    
    // タグが存在しない場合のみ作成
    for (const tag of tags) {
      const existingTag = await prisma.tag.findFirst({
        where: { tag_name: tag.tag_name }
      });
      
      if (!existingTag) {
        await prisma.tag.create({
          data: tag
        });
      }
    }
    
    // タグの同義語を作成
    const synonyms = [
      // 予約関連
      { tag_name: '予約', synonym: '予約方法' },
      { tag_name: '予約', synonym: '予約手続き' },
      { tag_name: '予約', synonym: 'リザーブ' },
      { tag_name: '予約', synonym: '申し込み' },
      { tag_name: '予約', synonym: '申込' },
      { tag_name: '予約', synonym: '予約する' },
      
      // 料金関連
      { tag_name: '料金', synonym: '価格' },
      { tag_name: '料金', synonym: '費用' },
      { tag_name: '料金', synonym: 'コスト' },
      { tag_name: '料金', synonym: '値段' },
      { tag_name: '料金', synonym: '代金' },
      { tag_name: '料金', synonym: '金額' },
      
      // 支払い関連
      { tag_name: '支払い', synonym: '精算' },
      { tag_name: '支払い', synonym: '会計' },
      { tag_name: '支払い', synonym: '支払方法' },
      { tag_name: '支払い', synonym: '決済' },
      { tag_name: '支払い', synonym: '支払う' },
      
      // キャンセル関連
      { tag_name: 'キャンセル', synonym: '解約' },
      { tag_name: 'キャンセル', synonym: '取り消し' },
      { tag_name: 'キャンセル', synonym: 'キャンセルする' },
      
      // 営業時間関連
      { tag_name: '営業時間', synonym: '営業' },
      { tag_name: '営業時間', synonym: '開店時間' },
      { tag_name: '営業時間', synonym: '閉店時間' },
      { tag_name: '営業時間', synonym: '営業日' },
      
      // 駐車場関連
      { tag_name: '駐車場', synonym: 'パーキング' },
      { tag_name: '駐車場', synonym: '駐車' },
      { tag_name: '駐車場', synonym: '車置き場' },
      
      // 車種関連
      { tag_name: '車種', synonym: '自動車' },
      { tag_name: '車種', synonym: '車' },
      { tag_name: '車種', synonym: '車両' },
      
      // 国際線・国内線関連
      { tag_name: '国際線', synonym: 'インターナショナル' },
      { tag_name: '国際線', synonym: '国際便' },
      { tag_name: '国内線', synonym: 'ドメスティック' },
      { tag_name: '国内線', synonym: '国内便' },
      
      // 領収書関連
      { tag_name: '領収書', synonym: 'レシート' },
      { tag_name: '領収書', synonym: '明細' },
      { tag_name: '領収書', synonym: '証明書' },
      
      // 割引関連
      { tag_name: '割引', synonym: 'クーポン' },
      { tag_name: '割引', synonym: 'ディスカウント' },
      { tag_name: '割引', synonym: '特典' }
    ];
    
    for (const { tag_name, synonym } of synonyms) {
      const tag = await prisma.tag.findFirst({
        where: { tag_name }
      });
      
      if (tag) {
        // 既存の同義語をチェック
        const existingSynonym = await prisma.tagSynonym.findFirst({
          where: {
            tag_id: tag.id,
            synonym: synonym
          }
        });
        
        // 存在しない場合のみ作成
        if (!existingSynonym) {
          await prisma.tagSynonym.create({
            data: {
              tag_id: tag.id,
              synonym
            }
          });
        }
      }
    }
    
    // ナレッジとタグの関連付け
    const knowledgeEntries = await prisma.knowledge.findMany();
    
    for (const knowledge of knowledgeEntries) {
      // カテゴリに基づいてタグを関連付け
      const tagsToLink = [];
      
      // メインカテゴリに基づくタグ付け
      if (knowledge.main_category?.includes('予約')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '予約' } });
        if (tag) tagsToLink.push(tag.id);
      }
      
      if (knowledge.main_category?.includes('料金')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '料金' } });
        if (tag) tagsToLink.push(tag.id);
      }
      
      // サブカテゴリに基づくタグ付け
      if (knowledge.sub_category?.includes('支払')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '支払い' } });
        if (tag) tagsToLink.push(tag.id);
      }
      
      if (knowledge.sub_category?.includes('キャンセル')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: 'キャンセル' } });
        if (tag) tagsToLink.push(tag.id);
      }
      
      if (knowledge.sub_category?.includes('領収書')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '領収書' } });
        if (tag) tagsToLink.push(tag.id);
      }
      
      // 質問内容に基づくタグ付け
      const contentText = `${knowledge.question} ${knowledge.answer} ${knowledge.main_category} ${knowledge.sub_category} ${knowledge.detail_category}`.toLowerCase();
      
      // 支払い関連
      if (contentText.includes('支払') || contentText.includes('精算') || contentText.includes('会計') || 
          contentText.includes('決済') || contentText.includes('カード') || contentText.includes('現金')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '支払い' } });
        if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
      }
      
      // 料金関連
      if (contentText.includes('料金') || contentText.includes('価格') || contentText.includes('費用') || 
          contentText.includes('コスト') || contentText.includes('値段') || contentText.includes('代金')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '料金' } });
        if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
      }
      
      // キャンセル関連
      if (contentText.includes('キャンセル') || contentText.includes('解約') || contentText.includes('取り消し') || 
          contentText.includes('返金')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: 'キャンセル' } });
        if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
      }
      
      // 営業時間関連
      if (contentText.includes('営業時間') || contentText.includes('営業') || contentText.includes('開店') || 
          contentText.includes('閉店') || contentText.includes('営業日')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '営業時間' } });
        if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
      }
      
      // 領収書関連
      if (contentText.includes('領収書') || contentText.includes('レシート') || contentText.includes('明細') || 
          contentText.includes('証明書')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '領収書' } });
        if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
      }
      
      // 割引関連
      if (contentText.includes('割引') || contentText.includes('クーポン') || contentText.includes('ディスカウント') || 
          contentText.includes('特典')) {
        const tag = await prisma.tag.findFirst({ where: { tag_name: '割引' } });
        if (tag && !tagsToLink.includes(tag.id)) tagsToLink.push(tag.id);
      }
      
      // タグを関連付け
      for (const tagId of tagsToLink) {
        // 既存の関連付けをチェック
        const existingKnowledgeTag = await prisma.knowledgeTag.findFirst({
          where: {
            knowledge_id: knowledge.id,
            tag_id: tagId
          }
        });
        
        // 存在しない場合のみ作成
        if (!existingKnowledgeTag) {
          await prisma.knowledgeTag.create({
            data: {
              knowledge_id: knowledge.id,
              tag_id: tagId
            }
          });
        }
      }
    }
    
    console.log('タグデータインポート完了');
  } catch (error) {
    console.error('タグデータインポートエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importTagData(); 
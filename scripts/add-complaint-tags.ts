import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addComplaintTags() {
  try {
    console.log('クレームタグ関連付け開始...');
    
    // クレームタグを取得
    const complaintTag = await prisma.tag.findFirst({
      where: { tag_name: 'クレーム' }
    });
    
    if (!complaintTag) {
      console.error('クレームタグが見つかりません');
      return;
    }
    
    // 特殊対応のナレッジを取得
    const specialHandlingKnowledge = await prisma.knowledge.findMany({
      where: { main_category: '特殊対応' }
    });
    
    console.log(`特殊対応のナレッジ: ${specialHandlingKnowledge.length}件`);
    
    // クレームタグを関連付け
    for (const knowledge of specialHandlingKnowledge) {
      // 既存の関連付けをチェック
      const existingKnowledgeTag = await prisma.knowledgeTag.findFirst({
        where: {
          knowledge_id: knowledge.id,
          tag_id: complaintTag.id
        }
      });
      
      // 存在しない場合のみ作成
      if (!existingKnowledgeTag) {
        await prisma.knowledgeTag.create({
          data: {
            knowledge_id: knowledge.id,
            tag_id: complaintTag.id
          }
        });
        console.log(`ID ${knowledge.id} (${knowledge.sub_category} > ${knowledge.detail_category}) にクレームタグを関連付けました`);
      } else {
        console.log(`ID ${knowledge.id} は既にクレームタグが関連付けられています`);
      }
    }
    
    console.log('クレームタグ関連付け完了');
  } catch (error) {
    console.error('クレームタグ関連付けエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addComplaintTags(); 
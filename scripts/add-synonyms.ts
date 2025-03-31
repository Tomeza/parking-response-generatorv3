import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addSynonyms() {
  try {
    console.log('シノニム追加開始...');
    
    // 営業時間タグを取得
    const businessHoursTag = await prisma.tag.findFirst({
      where: { tag_name: '営業時間' }
    });
    
    if (!businessHoursTag) {
      console.error('営業時間タグが見つかりません');
      return;
    }
    
    // 追加するシノニム
    const newSynonyms = [
      '何時から何時まで',
      '深夜の利用',
      '営業時間外',
      '夜間',
      '早朝'
    ];
    
    // シノニムを追加
    for (const synonym of newSynonyms) {
      // 既存のシノニムをチェック
      const existingSynonym = await prisma.tagSynonym.findFirst({
        where: {
          tag_id: businessHoursTag.id,
          synonym: synonym
        }
      });
      
      // 存在しない場合のみ作成
      if (!existingSynonym) {
        await prisma.tagSynonym.create({
          data: {
            tag_id: businessHoursTag.id,
            synonym: synonym
          }
        });
        console.log(`シノニム「${synonym}」を追加しました`);
      } else {
        console.log(`シノニム「${synonym}」は既に存在します`);
      }
    }
    
    // クレーム対応のタグを作成
    const complaintTag = await prisma.tag.findFirst({
      where: { tag_name: 'クレーム' }
    });
    
    if (!complaintTag) {
      // タグが存在しない場合は作成
      const newComplaintTag = await prisma.tag.create({
        data: {
          tag_name: 'クレーム',
          description: 'クレームや特殊対応に関する情報'
        }
      });
      
      console.log(`「クレーム」タグを作成しました (ID: ${newComplaintTag.id})`);
      
      // クレームタグのシノニムを追加
      const complaintSynonyms = [
        '苦情',
        '不満',
        '問題',
        '特殊対応',
        '対応',
        '解決',
        'トラブル'
      ];
      
      for (const synonym of complaintSynonyms) {
        await prisma.tagSynonym.create({
          data: {
            tag_id: newComplaintTag.id,
            synonym: synonym
          }
        });
        console.log(`クレームタグのシノニム「${synonym}」を追加しました`);
      }
    } else {
      console.log(`「クレーム」タグは既に存在します (ID: ${complaintTag.id})`);
    }
    
    console.log('シノニム追加完了');
  } catch (error) {
    console.error('シノニム追加エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSynonyms(); 
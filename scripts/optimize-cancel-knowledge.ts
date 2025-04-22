import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OPTIMIZED_QUESTIONS = {
  // 基本的なキャンセル料関連
  109: 'キャンセル料 支払 精算 返金',
  108: 'キャンセル料 料金 費用 規約',
  
  // 時期・状況によるキャンセル
  70: '当日 キャンセル 取消',
  110: '部分 一部 キャンセル 変更',
  
  // 特殊事由によるキャンセル
  29: '欠航 飛行機 運休',
  111: '台風 天候 災害 欠航',
  112: '病気 怪我 急病 キャンセル'
}

async function updateQuestions() {
  console.log('キャンセル関連ナレッジの質問部分を更新します...')
  
  for (const [id, keywords] of Object.entries(OPTIMIZED_QUESTIONS)) {
    const knowledge = await prisma.knowledge.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!knowledge) {
      console.log(`ID ${id} のナレッジが見つかりません`)
      continue
    }
    
    // 元の質問をnoteに保存し、最適化されたキーワードを設定
    await prisma.knowledge.update({
      where: { id: parseInt(id) },
      data: {
        note: `元の質問: ${knowledge.question}\n${knowledge.note || ''}`,
        question: keywords
      }
    })
    
    console.log(`ID ${id} を更新しました: ${keywords}`)
  }
  
  console.log('更新が完了しました')
}

updateQuestions()
  .catch(e => {
    console.error('エラーが発生しました:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 
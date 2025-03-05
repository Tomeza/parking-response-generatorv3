import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detectDates, detectAlertWords } from '@/lib/utils';
import { extractKeywords, analyzeText } from '@/lib/tokenizer';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: '問い合わせテキストが必要です' },
        { status: 400 }
      );
    }

    // 以下の処理は共通関数に移動
    return await processQuery(query);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // リクエストボディからクエリを取得
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { error: '問い合わせテキストが必要です' },
        { status: 400 }
      );
    }

    // 共通の処理を呼び出し
    return await processQuery(query);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

async function processQuery(query: string) {
  // ステップ1: アラートワード検出
  const alertWords = await prisma.alertWord.findMany({
    orderBy: { priority: 'asc' },
    include: { related_tag: true },
  });

  const detectedAlerts = detectAlertWords(query, alertWords);
  const detectedAlertWords = detectedAlerts.map(alert => alert.word);
  const missingAlerts = alertWords
    .filter(alert => !detectedAlertWords.includes(alert.word))
    .slice(0, 5); // 上位5件のみ

  // 日付検出
  const dates = detectDates(query);
  const seasonalInfo = [];

  // 検出された日付が繁忙期かどうかチェック
  if (dates.length > 0) {
    for (const date of dates) {
      const busyPeriod = await prisma.seasonalInfo.findFirst({
        where: {
          start_date: { lte: date },
          end_date: { gte: date },
        },
      });

      if (busyPeriod) {
        seasonalInfo.push({
          date: date.toISOString().split('T')[0],
          type: busyPeriod.info_type,
          description: busyPeriod.description,
        });
      }
    }
  }

  // ステップ2: ナレッジ検索
  // 高度な形態素解析を使用してキーワードを抽出
  const keywords = await extractKeywords(query);
  const analyzedText = await analyzeText(query);
  
  // 重み付けされたキーワードを取得
  const weightedKeywords = analyzedText
    .filter(item => item.weight >= 1.0) // 重要度が一定以上のキーワードのみ使用
    .map(item => item.keyword);
  
  // PostgreSQL全文検索用のtsqueryを構築
  const tsQuery = weightedKeywords.length > 0 
    ? weightedKeywords.join(' | ') 
    : query.replace(/\s+/g, ' | ');
  
  // 全文検索を使用してナレッジを検索
  const rawQuery = Prisma.sql`
    SELECT 
      k.id, 
      k.main_category, 
      k.sub_category, 
      k.detail_category, 
      k.question, 
      k.answer, 
      k.is_template, 
      k.usage, 
      k.note, 
      k.issue,
      ts_rank(k.search_vector, to_tsquery('japanese', ${tsQuery})) AS rank
    FROM "Knowledge" k
    WHERE k.search_vector @@ to_tsquery('japanese', ${tsQuery})
    ORDER BY rank DESC
    LIMIT 5
  `;
  
  const knowledgeResults = await prisma.$queryRaw(rawQuery);
  
  // 結果をPrismaの型に合わせて整形
  const knowledgeEntries = await Promise.all(
    (knowledgeResults as any[]).map(async (k) => {
      const knowledgeTags = await prisma.knowledgeTag.findMany({
        where: { knowledge_id: k.id },
        include: { tag: true },
      });
      
      return {
        ...k,
        knowledge_tags: knowledgeTags,
      };
    })
  );
  
  // フォールバック: 全文検索で結果が得られなかった場合は従来の検索方法を使用
  if (knowledgeEntries.length === 0) {
    console.log('全文検索で結果が得られなかったため、従来の検索方法を使用します');
    
    const fallbackEntries = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: query } },
          { answer: { contains: query } },
          ...keywords.map(keyword => ({
            OR: [
              { question: { contains: keyword } },
              { answer: { contains: keyword } },
              { main_category: { contains: keyword } },
              { sub_category: { contains: keyword } },
              { detail_category: { contains: keyword } },
            ],
          })),
        ],
      },
      include: {
        knowledge_tags: {
          include: {
            tag: true,
          },
        },
      },
      take: 5,
    });
    
    // 結果があれば使用
    if (fallbackEntries.length > 0) {
      Object.assign(knowledgeEntries, fallbackEntries);
    }
  }

  // 使用するナレッジと使用しないナレッジを分類
  const usedKnowledge = knowledgeEntries.filter(k => k.usage !== '✖️');
  const unusedKnowledge = knowledgeEntries.filter(k => k.usage === '✖️');

  // 不足しているタグを特定
  const allTags = await prisma.tag.findMany();
  const usedTags = new Set(
    usedKnowledge.flatMap(k => k.knowledge_tags.map((kt: { tag: { name: string } }) => kt.tag.name))
  );
  const missingTags = allTags
    .filter(tag => !usedTags.has(tag.name))
    .slice(0, 5); // 上位5件のみ

  // ステップ3: トレースと改善提案
  const suggestions = [];

  if (missingTags.length > 0) {
    suggestions.push(`タグの追加: ${missingTags.map(t => t.name).join(', ')}`);
  }

  if (missingAlerts.length > 0) {
    suggestions.push(`アラートワードの追加: ${missingAlerts.map(a => a.word).join(', ')}`);
  }

  // ステップ4: テンプレート適用
  let template = null;
  let templateReason = '';

  // テンプレートの選択ロジック
  const templates = await prisma.knowledge.findMany({
    where: { is_template: true },
  });

  if (detectedAlerts.length > 0 && templates.length > 0) {
    // 優先度の高いアラートに基づいてテンプレートを選択
    const highestPriorityAlert = detectedAlerts[0];
    template = templates.find(t => 
      t.main_category?.includes(highestPriorityAlert.word) || 
      t.sub_category?.includes(highestPriorityAlert.word)
    );
    
    if (template) {
      templateReason = `${highestPriorityAlert.word}アラート検出`;
    }
  }

  // テンプレートがない場合はナレッジから回答を生成
  if (!template && usedKnowledge.length > 0) {
    template = {
      id: 0,
      answer: usedKnowledge.map(k => k.answer).join('\n\n'),
    };
    templateReason = 'ナレッジベースから生成';
  }

  // 最終的な回答がない場合
  if (!template) {
    template = {
      id: 0,
      answer: '申し訳ございませんが、お問い合わせ内容に関する情報が見つかりませんでした。詳細な情報をご提供いただけますと、より適切なご案内ができます。',
    };
    templateReason = '該当情報なし';
  }

  // レスポンスログを保存
  const responseLog = await prisma.responseLog.create({
    data: {
      query,
      response: template.answer,
      used_knowledge_ids: usedKnowledge.map(k => k.id),
      missing_tags: missingTags.map(t => t.name),
      missing_alerts: missingAlerts.map(a => a.word),
      created_at: new Date(),
    },
  });

  // 新しいステップ形式に変換
  const alertWordsArray = detectedAlerts.map(alert => alert.word);
  const knowledgeArray = usedKnowledge.map(k => ({
    id: k.id,
    content: k.answer,
    tags: k.knowledge_tags.map((kt: { tag: { name: string } }) => kt.tag.name),
  }));

  // 結果を返す
  return NextResponse.json({
    response: template.answer,
    responseId: responseLog.id,
    steps: {
      alertWords: alertWordsArray,
      knowledge: knowledgeArray,
      suggestions: suggestions,
    }
  });
} 
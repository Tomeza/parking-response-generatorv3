import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detectDates, detectAlertWords, tokenizeJapanese } from '@/lib/utils';

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
  // 簡易的な形態素解析
  const tokens = tokenizeJapanese(query);
  
  // 関連するナレッジを検索
  const knowledgeEntries = await prisma.knowledge.findMany({
    where: {
      OR: [
        { question: { contains: query } },
        { answer: { contains: query } },
        ...tokens.map(token => ({
          OR: [
            { question: { contains: token } },
            { answer: { contains: token } },
            { main_category: { contains: token } },
            { sub_category: { contains: token } },
            { detail_category: { contains: token } },
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
    take: 5, // 上位5件のみ
  });

  // 使用するナレッジと使用しないナレッジを分類
  const usedKnowledge = knowledgeEntries.filter(k => k.usage !== '✖️');
  const unusedKnowledge = knowledgeEntries.filter(k => k.usage === '✖️');

  // 不足しているタグを特定
  const allTags = await prisma.tag.findMany();
  const usedTags = new Set(
    usedKnowledge.flatMap(k => k.knowledge_tags.map(kt => kt.tag.tag_name))
  );
  const missingTags = allTags
    .filter(tag => !usedTags.has(tag.tag_name))
    .slice(0, 5); // 上位5件のみ

  // ステップ3: トレースと改善提案
  const suggestions = [];

  if (missingTags.length > 0) {
    suggestions.push(`タグの追加: ${missingTags.map(t => t.tag_name).join(', ')}`);
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
  await prisma.responseLog.create({
    data: {
      query,
      response: template.answer,
      used_knowledge_ids: usedKnowledge.map(k => k.id),
      missing_tags: missingTags.map(t => t.tag_name),
      missing_alerts: missingAlerts.map(a => a.word),
      created_at: new Date(),
    },
  });

  // 新しいステップ形式に変換
  const alertWordsArray = detectedAlerts.map(alert => alert.word);
  const knowledgeArray = usedKnowledge.map(k => ({
    id: k.id,
    content: k.answer,
    tags: k.knowledge_tags.map(kt => kt.tag.tag_name),
  }));

  // 結果を返す
  return NextResponse.json({
    response: template.answer,
    steps: {
      alertWords: alertWordsArray,
      knowledge: knowledgeArray,
      suggestions: suggestions,
    }
  });
} 
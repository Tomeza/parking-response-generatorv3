import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detectDates, detectAlertWords, tokenizeJapanese } from '@/lib/utils';
import { searchKnowledge } from '@/lib/search';

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    console.log('Received query:', query);

    if (!query) {
      return NextResponse.json(
        { error: '問い合わせテキストが必要です' },
        { status: 400 }
      );
    }

    // ナレッジ検索
    const results = await searchKnowledge(query);
    console.log('Search results in API:', results);

    // 結果が見つからない場合は、200ステータスでエラーメッセージを返す
    if (!results || results.length === 0) {
      console.log('No results found in API');
      return NextResponse.json({
        response: 'お問い合わせ内容に関する情報が見つかりませんでした。詳細な情報をご提供いただけますと、より適切なご案内ができます。',
        steps: [
          {
            step: 'ナレッジ検索',
            content: {
              used: [],
              message: '該当する情報が見つかりませんでした。'
            },
          },
        ],
      });
    }

    // 最も関連性の高い回答を返す
    const bestMatch = results[0];
    console.log('Best match:', bestMatch);

    // レスポンスログを保存
    await prisma.responseLog.create({
      data: {
        query,
        response: bestMatch.answer,
        used_knowledge_ids: [bestMatch.id],
        missing_tags: [],
        missing_alerts: [],
        created_at: new Date(),
      },
    });

    return NextResponse.json({
      response: bestMatch.answer,
      steps: [
        {
          step: 'ナレッジ検索',
          content: {
            used: [{
              id: bestMatch.id,
              answer: bestMatch.answer,
              category: [bestMatch.main_category, bestMatch.sub_category, bestMatch.detail_category].filter(Boolean).join(' > '),
            }],
          },
        },
      ],
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'クエリが指定されていません' },
        { status: 400 }
      );
    }

    const results = await searchKnowledge(query);

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: 'お問い合わせ内容に関する情報が見つかりませんでした。詳細な情報をご提供いただけますと、より適切なご案内ができます。' },
        { status: 404 }
      );
    }

    // 最も関連性の高い回答を返す
    const bestMatch = results[0];
    return NextResponse.json({ answer: bestMatch.answer });

  } catch (error) {
    console.error('Error processing query:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
} 
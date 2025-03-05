import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSearchKeywords } from '@/lib/kuromoji-utils';
import { detectAlertWords, checkAlertUsage } from '@/lib/alert-utils';
import { extractDates, checkBusyPeriods, formatDateInfo } from '@/lib/date-utils';
import { detectCategories, getMostRelevantCategory } from '@/lib/category-utils';
import { SearchResult, SearchResponse } from '@/types/search';

// サーバーサイドでのみ形態素解析を実行
export const runtime = 'nodejs';

async function performSearch(query: string, limit: number = 10): Promise<SearchResponse> {
  // 1. アラートワード検出
  const detectedAlerts = detectAlertWords(query);
  const alertUsage = checkAlertUsage(detectedAlerts);

  // 2. 日付検出と繁忙期チェック
  const dates = extractDates(query);
  const busyPeriods = await checkBusyPeriods(dates);

  // 3. カテゴリ検出
  const categories = detectCategories(query);
  const mostRelevantCategory = getMostRelevantCategory(categories);

  // 4. 形態素解析でキーワードを生成
  const keywords = await generateSearchKeywords(query);
  
  // 5. tsQueryの生成（重み付けを考慮）
  const tsQuery = keywords
    .map((keyword: string) => `${keyword}:*`)
    .join(' & ');

  // 6. 重み付けを含む検索クエリ
  const results = await prisma.$queryRaw<SearchResult[]>`
    WITH search_results AS (
      SELECT 
        k.*,
        ts_rank(search_vector, to_tsquery('japanese', ${tsQuery})) as text_rank,
        COALESCE(cw.weight, 1.0) as category_weight,
        COALESCE(
          (
            SELECT AVG(tw.weight)
            FROM "KnowledgeTag" kt
            JOIN "Tag" t ON kt.tag_id = t.id
            JOIN "TagWeight" tw ON t.name = tw.tag
            WHERE kt.knowledge_id = k.id
          ),
          1.0
        ) as tag_weight
      FROM "Knowledge" k
      LEFT JOIN "CategoryWeight" cw ON k.main_category = cw.category
      WHERE search_vector @@ to_tsquery('japanese', ${tsQuery})
    )
    SELECT 
      id,
      question,
      answer,
      main_category,
      sub_category,
      detail_category,
      text_rank,
      category_weight,
      tag_weight,
      (text_rank * category_weight * tag_weight) as final_score
    FROM search_results
    ORDER BY final_score DESC
    LIMIT ${limit}
  `;

  // 7. タグ情報を取得
  const resultsWithTags = await Promise.all(
    results.map(async (result) => {
      const knowledgeTags = await prisma.knowledgeTag.findMany({
        where: {
          knowledge_id: result.id,
        },
        select: {
          tag: {
            select: {
              name: true,
            },
          },
        },
      });

      return {
        ...result,
        tags: knowledgeTags.map((kt) => kt.tag.name),
        rank: result.final_score // 後方互換性のため
      };
    })
  );

  // 8. 検索結果の分析情報を追加
  const analysis = {
    alerts: {
      detected: detectedAlerts,
      usage: alertUsage
    },
    dates: {
      detected: dates,
      busyPeriods: busyPeriods.map(({ dateInfo, busyPeriod }) => ({
        date: formatDateInfo(dateInfo),
        description: busyPeriod.description
      }))
    },
    categories: {
      detected: categories,
      mostRelevant: mostRelevantCategory
    }
  };

  return {
    results: resultsWithTags,
    total: resultsWithTags.length,
    query,
    tsQuery,
    analysis
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      );
    }

    // URLデコードを行う
    const decodedQuery = decodeURIComponent(query);
    const response = await performSearch(decodedQuery, limit);
    return NextResponse.json(response);

  } catch (error) {
    console.error('検索エラー:', error);
    return NextResponse.json(
      { error: '検索中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 10 } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      );
    }

    const response = await performSearch(query, limit);
    return NextResponse.json(response);

  } catch (error) {
    console.error('検索エラー:', error);
    return NextResponse.json(
      { error: '検索中にエラーが発生しました' },
      { status: 500 }
    );
  }
} 
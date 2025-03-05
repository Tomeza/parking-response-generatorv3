import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSearchKeywords, generateTsQuery } from '@/lib/kuromoji-utils';
import { SearchResult, SearchResponse } from '@/types/search';

// サーバーサイドでのみ形態素解析を実行
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // URLデコードを行う
    const decodedQuery = decodeURIComponent(query);
    console.log('Search query:', decodedQuery);

    // 検索クエリの生成
    const keywords = await generateSearchKeywords(decodedQuery);
    console.log('検索キーワード:', keywords);
    
    // tsQueryの生成
    const tsQuery = keywords.map(k => `${k}:*`).join(' | ');
    console.log('生成されたtsQuery:', tsQuery);
    
    // 全文検索クエリ
    const searchQuery = `
      SELECT 
        k.id,
        k.question,
        k.answer,
        k.main_category,
        k.sub_category,
        k.detail_category,
        ts_rank_cd(
          setweight(to_tsvector('japanese', k.answer), 'A') ||
          setweight(to_tsvector('japanese', k.question), 'B') ||
          setweight(to_tsvector('japanese', k.main_category), 'C') ||
          setweight(to_tsvector('japanese', k.sub_category), 'C') ||
          setweight(to_tsvector('japanese', k.detail_category), 'C'),
          to_tsquery('japanese', $1)
        ) as rank
      FROM "Knowledge" k
      WHERE 
        to_tsvector('japanese', k.question) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.answer) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.main_category) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.sub_category) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.detail_category) @@ to_tsquery('japanese', $1)
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    // 全文検索を使用
    const searchResults = await prisma.$queryRawUnsafe<SearchResult[]>(searchQuery, tsQuery);

    console.log(`Found ${searchResults.length} results using full-text search`);

    // 全文検索で結果が得られなかった場合は従来の検索方法を使用
    if (searchResults.length === 0) {
      console.log('全文検索で結果が得られなかったため、従来の検索方法を使用します');
      
      // より効率的なフォールバック検索
      // 最も重要なフィールドに絞ってLIKE検索を行う
      const mainKeyword = keywords[0]; // 最初のキーワードを使用
      
      const fallbackResults = await prisma.knowledge.findMany({
        where: {
          OR: [
            { answer: { contains: mainKeyword } },
            { question: { contains: mainKeyword } }
          ]
        },
        take: limit,
        skip: offset,
        orderBy: {
          id: 'asc' // 一貫性のある順序付け
        }
      });
      
      console.log(`Found ${fallbackResults.length} results using optimized fallback search`);
      
      // タグ情報を取得
      const resultsWithTags = await Promise.all(
        fallbackResults.map(async (result) => {
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
            rank: 0.1 // フォールバック検索の結果には低いランクを設定
          };
        })
      );

      const response: SearchResponse = {
        results: resultsWithTags,
        total: resultsWithTags.length,
        query: decodedQuery,
        tsQuery: tsQuery
      };

      return NextResponse.json(response);
    }

    // タグ情報を取得
    const resultsWithTags = await Promise.all(
      searchResults.map(async (result) => {
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
        };
      })
    );

    const response: SearchResponse = {
      results: resultsWithTags,
      total: resultsWithTags.length,
      query: decodedQuery,
      tsQuery: tsQuery
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 10, offset = 0 } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    console.log('Search query:', query);

    // 検索クエリの生成
    const keywords = await generateSearchKeywords(query);
    console.log('検索キーワード:', keywords);
    
    // tsQueryの生成
    const tsQuery = keywords.map(k => `${k}:*`).join(' | ');
    console.log('生成されたtsQuery:', tsQuery);
    
    // 全文検索クエリ
    const searchQuery = `
      SELECT 
        k.id,
        k.question,
        k.answer,
        k.main_category,
        k.sub_category,
        k.detail_category,
        ts_rank_cd(
          setweight(to_tsvector('japanese', k.answer), 'A') ||
          setweight(to_tsvector('japanese', k.question), 'B') ||
          setweight(to_tsvector('japanese', k.main_category), 'C') ||
          setweight(to_tsvector('japanese', k.sub_category), 'C') ||
          setweight(to_tsvector('japanese', k.detail_category), 'C'),
          to_tsquery('japanese', $1)
        ) as rank
      FROM "Knowledge" k
      WHERE 
        to_tsvector('japanese', k.question) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.answer) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.main_category) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.sub_category) @@ to_tsquery('japanese', $1) OR
        to_tsvector('japanese', k.detail_category) @@ to_tsquery('japanese', $1)
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    // 全文検索を使用
    const searchResults = await prisma.$queryRawUnsafe<SearchResult[]>(searchQuery, tsQuery);

    console.log(`Found ${searchResults.length} results using full-text search`);

    // 全文検索で結果が得られなかった場合は従来の検索方法を使用
    if (searchResults.length === 0) {
      console.log('全文検索で結果が得られなかったため、従来の検索方法を使用します');
      
      // より効率的なフォールバック検索
      // 最も重要なフィールドに絞ってLIKE検索を行う
      const mainKeyword = keywords[0]; // 最初のキーワードを使用
      
      const fallbackResults = await prisma.knowledge.findMany({
        where: {
          OR: [
            { answer: { contains: mainKeyword } },
            { question: { contains: mainKeyword } }
          ]
        },
        take: limit,
        skip: offset,
        orderBy: {
          id: 'asc' // 一貫性のある順序付け
        }
      });
      
      console.log(`Found ${fallbackResults.length} results using optimized fallback search`);
      
      // タグ情報を取得
      const resultsWithTags = await Promise.all(
        fallbackResults.map(async (result) => {
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
            rank: 0.1 // フォールバック検索の結果には低いランクを設定
          };
        })
      );

      const response: SearchResponse = {
        results: resultsWithTags,
        total: resultsWithTags.length,
        query: query,
        tsQuery: tsQuery
      };

      return NextResponse.json(response);
    }

    // タグ情報を取得
    const resultsWithTags = await Promise.all(
      searchResults.map(async (result) => {
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
        };
      })
    );

    const response: SearchResponse = {
      results: resultsWithTags,
      total: resultsWithTags.length,
      query: query,
      tsQuery: tsQuery
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 
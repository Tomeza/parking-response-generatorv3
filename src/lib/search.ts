import { Prisma, type Knowledge } from '@prisma/client';
import { prisma } from './db';
import { SearchResult } from './common-types';

// 結果に含めるKnowledgeモデルのカラムを選択
const selectKnowledgeFields = {
  id: true,
  main_category: true,
  sub_category: true,
  detail_category: true,
  question: true,
  answer: true,
  is_template: true,
  usage: true,
  note: true,
  issue: true,
  createdAt: true,
  updatedAt: true,
};

type KnowledgeWithScore = Prisma.KnowledgeGetPayload<{ select: typeof selectKnowledgeFields }> & { pgroonga_score: number };

export async function searchKnowledge(query: string): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  try {
    console.log('検索クエリ (Simple PGroonga):', normalizedQuery);

    // シンプルなPGroonga全文検索クエリ (&@~)
    const results = await prisma.$queryRaw<KnowledgeWithScore[]>`
      SELECT 
        k.id, k.main_category, k.sub_category, k.detail_category, k.question, k.answer, k.is_template, k.usage, k.note, k.issue, k."createdAt", k."updatedAt",
        pgroonga_score(k.tableoid, k.ctid) AS pgroonga_score
      FROM "Knowledge" k
      WHERE 
        k.question &@~ ${normalizedQuery} OR
        k.answer &@~ ${normalizedQuery}
      ORDER BY pgroonga_score DESC
      LIMIT 10
    `;

    console.log(`Simple PGroonga 検索結果: ${results.length}件`);

    // 結果をSearchResult型にマッピング
    const searchResults: SearchResult[] = results.map(result => ({
      ...result,
      score: result.pgroonga_score,
      note: result.note || '' 
    }));

    console.log('ソート済み検索結果 (Simple PGroonga):', searchResults.map(r => ({ id: r.id, question: r.question, score: r.score })));

    return searchResults;

  } catch (error) {
    console.error('Simple PGroonga 検索エラー:', error);
    return []; // エラー時は空配列を返す
  }
}

export type { SearchResult };

// フォールバック検索関数 (例)
/*
async function runFallbackSearch(query: string): Promise<SearchResult[]> {
  console.log('Fallback ILIKE search executing...');
  const finalSearchTerms = query.split(/\s+/).filter(term => term.length > 0);
  if (finalSearchTerms.length === 0) finalSearchTerms.push(query);

  try {
    const results = await prisma.knowledge.findMany({
       where: {
         OR: [
           { question: { contains: query, mode: 'insensitive' } },
           ...finalSearchTerms.map((term: string) => ({ 
             question: { contains: term, mode: 'insensitive' }
           }))
         ]
       },
       select: selectKnowledgeFields, // 必要なカラムのみ選択
       take: 10 
    });
    return results.map(r => ({ ...r, score: 0.1, note: r.note || '' })); // 固定スコア
  } catch (fallbackError) {
      console.error('Fallback search error:', fallbackError);
      return [];
  }
}
*/
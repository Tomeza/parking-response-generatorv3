import { Prisma, type Knowledge } from '@prisma/client';
import { prisma } from './db';
import { SearchResult } from './common-types';
// @ts-ignore
import kuromoji from 'kuromoji'; // Kuromoji.jsをインポート

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

// scoreのみ必要
type KnowledgeWithScore = Prisma.KnowledgeGetPayload<{ select: typeof selectKnowledgeFields }> & { pgroonga_score: number };

// KuromojiのTokenizerを保持する変数（非同期で初期化）
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

// PromiseでKuromojiの初期化をラップ
const tokenizerPromise = new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null>((resolve, reject) => {
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err: Error | null, _tokenizer: any) => {
    if (err) {
      console.error('Kuromoji tokenizer build error:', err);
      reject(err);
    } else {
      console.log('Kuromoji tokenizer ready.');
      tokenizer = _tokenizer;
      resolve(_tokenizer);
    }
  });
}).catch(err => {
  console.error('Kuromoji Promise initialization catch:', err);
  return null;
});

// Step 2: 抽出する品詞を変更
const VALID_POS = ['名詞', '動詞', '形容詞', '副詞']; 

export async function searchKnowledge(query: string, tags?: string): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();
  const decodedTags = tags ? decodeURIComponent(tags) : '';

  if (!normalizedQuery) {
    return [];
  }

  if (!tokenizer) {
    tokenizer = await tokenizerPromise;
    if (!tokenizer) {
      console.error('Kuromoji Tokenizer is not available.');
      return [];
    }
  }

  let finalSearchTerms: string[] = [normalizedQuery];

  try {
    console.log('検索クエリ (Final Simplified Logic):', normalizedQuery);
    console.log('入力タグ (Decoded):', decodedTags);

    const tokens = tokenizer.tokenize(normalizedQuery);

    const searchTerms: string[] = tokens
        .filter((token: any) => VALID_POS.some(pos => token.pos.startsWith(pos)))
        .map((token: any) => token.basic_form === '*' ? token.surface_form : token.basic_form)
        .filter((term: any): term is string => term !== null && term.length > 1);
    const uniqueSearchTerms: string[] = [...new Set(searchTerms)];
    console.log('検索単語 (Kuromoji Final):', uniqueSearchTerms);
    if (uniqueSearchTerms.length > 0) {
        finalSearchTerms = uniqueSearchTerms;
    }

    console.log('[DEBUG] Final search terms for DB query:', finalSearchTerms);

    // --- PGroongaクエリ構築 (Final Simplified Logic) ---
    // WHERE句は常に動的OR検索（タグがあっても一旦無視）
    const termConditions = finalSearchTerms.map(term => 
        Prisma.sql`(k.question &@~ ${term} OR k.answer &@~ ${term})`
    );
    const fullQueryCondition = Prisma.sql`(k.question &@~ ${normalizedQuery} OR k.answer &@~ ${normalizedQuery})`
    const whereClause = Prisma.join([fullQueryCondition, ...termConditions], " OR ");
    console.log('[DEBUG] WHERE Clause (dynamic OR):', whereClause);

    const querySql = Prisma.sql`
      SELECT 
        k.id, k.main_category, k.sub_category, k.detail_category, k.question, k.answer, k.is_template, k.usage, k.note, k.issue, k."createdAt", k."updatedAt",
        pgroonga_score(k.tableoid, k.ctid) AS pgroonga_score
      FROM "Knowledge" k
      WHERE ${whereClause} -- 動的OR検索
      ORDER BY CASE 
        WHEN k.is_template IS TRUE THEN 1 -- IS TRUE を使用
        ELSE 0 
      END DESC, 
      pgroonga_score(k.tableoid, k.ctid) DESC -- 次にPGroongaスコア
      LIMIT 10 -- 上限10件
    `;

    console.log('[DEBUG] Executing Final Simplified PGroonga Query:', querySql);

    const results = await prisma.$queryRaw<KnowledgeWithScore[]>(querySql);

    console.log(`PGroonga検索結果 (Final): ${results.length}件`);

    const searchResults: SearchResult[] = results.map(result => ({
      ...result,
      score: result.pgroonga_score,
      note: result.note || ''
    }));

    console.log('ソート済み検索結果 (Final Simplified):', searchResults.map(r => ({ id: r.id, question: r.question, score: r.score })));

    return searchResults;

  } catch (error) {
    console.error('Search Error (Final Simplified):', error);
    return [];
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
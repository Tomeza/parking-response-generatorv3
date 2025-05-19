import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { SearchResult } from './common-types';
import kuromoji, { IpadicFeatures } from 'kuromoji';
import { searchSimilarKnowledge } from './embeddings';
import { rerankResults } from './anthropic';

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

// KuromojiのTokenizerを保持する変数（非同期で初期化）
let tokenizer: kuromoji.Tokenizer<IpadicFeatures> | null = null;

// PromiseでKuromojiの初期化をラップ
const tokenizerPromise = new Promise<kuromoji.Tokenizer<IpadicFeatures> | null>((resolve, reject) => {
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err: Error | null, _tokenizer: kuromoji.Tokenizer<IpadicFeatures>) => {
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

// シンプルな検索フォールバック関数 (先に定義)
async function simpleSearch(query: string, terms: string[]): Promise<SearchResult[]> {
    console.log('Fallback simple search executing...');
    type InsensitiveMode = 'insensitive';
    try {
        // トップレベルの OR 条件を格納する配列
        const orConditions: Prisma.KnowledgeWhereInput[] = [
          { question: { contains: query, mode: 'insensitive' as InsensitiveMode } },
          { answer: { contains: query, mode: 'insensitive' as InsensitiveMode } },
        ];

        // 各 term に対する条件を orConditions 配列に直接追加する
        if (terms && terms.length > 0) {
            terms.forEach(term => {
                orConditions.push({ question: { contains: term, mode: 'insensitive' as InsensitiveMode } });
                orConditions.push({ answer: { contains: term, mode: 'insensitive' as InsensitiveMode } });
            });
        }

        const results = await prisma.knowledge.findMany({
            // where 句にはトップレベルの OR 配列を渡す
            where: { OR: orConditions },
            select: selectKnowledgeFields,
            take: 10
        });

        return results.map(r => ({
            ...r,
            score: r.question?.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0.2,
            note: 'フォールバック検索結果'
        }));
    } catch (fallbackError) {
        console.error('Simple search error:', fallbackError);
        return [];
    }
}

export async function searchKnowledge(query: string, isDev: boolean, pgroongaOnly: boolean = false, query_id?: string): Promise<SearchResult[]> {
  if (isDev) console.time('SK_Total');

  const normalizedQuery = query.trim();
  // const decodedTags = query_id ? decodeURIComponent(query_id) : ''; // query_id はタグではないので修正

  if (!normalizedQuery) {
    if (isDev) console.timeEnd('SK_Total');
    return [];
  }

  if (!tokenizer) {
    console.time('SK_KuromojiInit');
    tokenizer = await tokenizerPromise;
    console.timeEnd('SK_KuromojiInit');
    if (!tokenizer) {
      console.error('Kuromoji Tokenizer is not available.');
      console.warn('Kuromoji not available, running simple fallback search.');
      console.time('SK_SimpleSearch_NoTokenizer');
      const fallbackResult = await simpleSearch(normalizedQuery, []);
      console.timeEnd('SK_SimpleSearch_NoTokenizer');
      if (isDev) console.timeEnd('SK_Total');
      return fallbackResult;
    }
  }

  let allTokens: string[] = [];
  try {
    console.log('検索クエリ (Final Simplified Logic):', normalizedQuery);
    if (query_id) { // query_id があればログに出力
      console.log('Query ID:', query_id);
    }
    // console.log('入力タグ (Decoded):', decodedTags); // decodedTags は query_id を誤って使っていたのでコメントアウト

    console.time('SK_KuromojiTokenize');
    const tokens: IpadicFeatures[] = tokenizer.tokenize(normalizedQuery);

    // 1. Kuromojiでトークン化し、品詞情報と共に用語リストを生成
    const searchTermsWithPos: Array<{ term: string; pos: string; detail_1: string | null }> = tokens
      .map((token: IpadicFeatures) => ({
        term: token.basic_form === '*' ? token.surface_form : token.basic_form,
        pos: token.pos,
        detail_1: token.pos_detail_1
      }))
      .filter(t => t.term !== null && t.term.length > 1); // 1文字以下のタームを除外

    // 2. PGroonga検索用に名詞のみを抽出
    const nounTermsForPGroonga = Array.from(
      new Set(
        searchTermsWithPos
          .filter(t => t.pos === '名詞')
          .map(t => t.term)
      )
    );
    const pgroongaQueryString = nounTermsForPGroonga.join(' ');

    // 以前の uniqueSearchTerms (名詞、動詞-自立、形容詞、副詞) はログ表示やフォールバック等で利用する場合のために残すことも検討可能
    // 今回は pgroongaQueryString を主に使用する
    const originalUniqueSearchTerms: string[] = [...new Set(searchTermsWithPos
        .filter(t => 
            t.pos === '名詞' || 
            (t.pos === '動詞' && t.detail_1 === '自立') || 
            t.pos === '形容詞' || 
            t.pos === '副詞'
        )
        .map(t => t.term)
    )];

    console.timeEnd('SK_KuromojiTokenize');
    console.log('検索単語 (元ロジック - Kuromoji OR - Array):', originalUniqueSearchTerms);
    console.log('PGroonga 検索文字列 (名詞のみ):', pgroongaQueryString);

    allTokens = tokenizer.tokenize(normalizedQuery)
                        .map((token: IpadicFeatures) => token.basic_form === '*' ? token.surface_form : token.basic_form)
                        .filter((term): term is string => typeof term === 'string' && term.length > 0);
    allTokens = [...new Set(allTokens)];

    if (originalUniqueSearchTerms.length === 0) {
      console.warn('No meaningful search terms extracted. Running fallback search.');
      console.time('SK_SimpleSearch_NoTerms');
      const fallbackResult = await simpleSearch(normalizedQuery, allTokens);
      console.timeEnd('SK_SimpleSearch_NoTerms');
      if (isDev) console.timeEnd('SK_Total');
      return fallbackResult;
    }

    const questionWeight = 1.0;
    const answerWeight = 1.0;
    const vectorWeight = 1.0;
    const fetchLimit = 20;

    console.time('SK_ParallelSearches');
    const [questionResults, answerResults, vectorResults] = await Promise.all([
      (async () => {
        console.time('SK_PGSearchQuestion');
        const res = await prisma.$queryRaw< { id: number; score: number }[] >`
          SELECT id, pgroonga_score(k.tableoid, k.ctid) AS score
          FROM "Knowledge" k
          WHERE question &@~ ${pgroongaQueryString}
          ORDER BY score DESC
          LIMIT ${fetchLimit};
        `.catch(err => { console.error("Question search failed:", err); return []; });
        console.timeEnd('SK_PGSearchQuestion');
        return res;
      })(),
      (async () => {
        console.time('SK_PGSearchAnswer');
        const res = await prisma.$queryRaw< { id: number; score: number }[] >`
          SELECT id, pgroonga_score(k.tableoid, k.ctid) AS score
          FROM "Knowledge" k
          WHERE answer &@~ ${pgroongaQueryString}
          ORDER BY score DESC
          LIMIT ${fetchLimit};
        `.catch(err => { console.error("Answer search failed:", err); return []; });
        console.timeEnd('SK_PGSearchAnswer');
        return res;
      })(),
      (async () => {
        console.time('SK_VectorSearch');
        const res = await searchSimilarKnowledge(normalizedQuery, fetchLimit)
          .catch(err => { console.error("Vector search failed:", err); return []; });
        console.timeEnd('SK_VectorSearch');
        return res;
      })()
    ]);
    console.timeEnd('SK_ParallelSearches');

    // --- 追加: TQ132の場合のPGroonga検索結果ログ ---
    if (isDev && query_id === 'TQ132') {
      console.log(`[TQ132] PGroonga Question Results for "${query}":`, JSON.stringify(questionResults.map(r => ({ id: r.id, score: r.score })), null, 2));
      console.log(`[TQ132] PGroonga Answer Results for "${query}":`, JSON.stringify(answerResults.map(r => ({ id: r.id, score: r.score })), null, 2));
    }
    // --- ここまで追加 ---

    console.log(`Question search results count: ${questionResults.length}`);
    console.log(`Answer search results count: ${answerResults.length}`);
    console.log(`Vector search results count: ${vectorResults.length}`);

    // --- ここからログ追加 (生のスコア) ---
    const idsToLog = [64, 35, 88, 141, 16]; // 確認したいIDのリスト
    console.log('--- Raw Scores for Specific IDs ---');
    idsToLog.forEach(id => {
        const rawQRes = questionResults.find(r => r.id === id);
        const rawARes = answerResults.find(r => r.id === id);
        const rawVRes = vectorResults.find(r => r.id === id); // Vector search results are already similarities
        console.log(`ID ${id}: rawQ: ${rawQRes?.score ?? 'N/A'}, rawA: ${rawARes?.score ?? 'N/A'}, rawV (sim): ${rawVRes?.similarity ?? 'N/A'}`);
    });
    // --- ここまでログ追加 (生のスコア) ---

    // --- スコア正規化処理を追加 ---
    const normalizeScores = (results: Array<{ id: number; score?: number; similarity?: number }>, scoreField: 'score' | 'similarity' = 'score') => {
      if (!results || results.length === 0) return [];
      const scores = results.map(r => r[scoreField] ?? 0);
      const maxScore = Math.max(...scores, 0); 
      return results.map(r => ({
        ...r,
        normalizedScore: maxScore > 0 ? (r[scoreField] ?? 0) / maxScore : 0,
      }));
    };

    const normalizedQuestionResults = normalizeScores(questionResults, 'score');
    const normalizedAnswerResults = normalizeScores(answerResults, 'score');
    const normalizedVectorResults = normalizeScores(vectorResults, 'similarity');

    // --- 正規化スコアのログ出力 (確認用) ---
    console.log('--- Normalized Scores for Specific IDs ---');
    idsToLog.forEach(id => {
        const qRes = normalizedQuestionResults.find(r => r.id === id);
        const aRes = normalizedAnswerResults.find(r => r.id === id);
        const vRes = normalizedVectorResults.find(r => r.id === id);
        console.log(`ID ${id}: normQ: ${qRes?.normalizedScore?.toFixed(3) ?? 'N/A'}, normA: ${aRes?.normalizedScore?.toFixed(3) ?? 'N/A'}, normV: ${vRes?.normalizedScore?.toFixed(3) ?? 'N/A'}`);
    });
    // --- ここまでログ追加 ---

    console.time('SK_ScoreCombinationAndSort');
    const combinedScores: { [id: number]: { qScore: number; aScore: number; vScore: number } } = {};

    normalizedQuestionResults.forEach(r => {
      if (r && typeof r.id === 'number') {
        if (!combinedScores[r.id]) combinedScores[r.id] = { qScore: 0, aScore: 0, vScore: 0 };
        combinedScores[r.id].qScore = r.normalizedScore ?? 0;
      }
    });
    normalizedAnswerResults.forEach(r => {
        if (r && typeof r.id === 'number') {
            if (!combinedScores[r.id]) combinedScores[r.id] = { qScore: 0, aScore: 0, vScore: 0 };
            combinedScores[r.id].aScore = r.normalizedScore ?? 0;
        }
    });
    normalizedVectorResults.forEach(r => {
      if (r && typeof r.id === 'number') {
        if (!combinedScores[r.id]) combinedScores[r.id] = { qScore: 0, aScore: 0, vScore: 0 };
        combinedScores[r.id].vScore = r.normalizedScore ?? 0;
      }
    });

    const weightedResults = Object.entries(combinedScores).map(([idStr, scores]) => {
      const id = parseInt(idStr, 10);
      const weightedScore = 
        (scores.qScore * questionWeight) + 
        (scores.aScore * answerWeight) + 
        (scores.vScore * vectorWeight);
      const scoreDetails = {
        normQ: scores.qScore,
        normA: scores.aScore,
        normV: scores.vScore,
        weighted: weightedScore
      };
      return { id, score: weightedScore, scoreDetails };
    });

    weightedResults.sort((a, b) => b.score - a.score);
    console.timeEnd('SK_ScoreCombinationAndSort');
    const topIds = weightedResults.slice(0, 3).map(r => r.id);

    if (topIds.length === 0 || weightedResults.every(r => r.score === 0)) {
       console.log('No results after merging/weighting or all scores zero. Running fallback search.');
        console.time('SK_SimpleSearch_NoWeightedResults');
        const fallbackResult = await simpleSearch(normalizedQuery, allTokens);
        console.timeEnd('SK_SimpleSearch_NoWeightedResults');
        if (isDev) console.timeEnd('SK_Total');
        return fallbackResult;
    }

    console.time('SK_FetchFinalKnowledge');
    const finalResultsData = await prisma.knowledge.findMany({
      where: {
            id: { in: topIds }
        },
        select: selectKnowledgeFields
    });
    console.timeEnd('SK_FetchFinalKnowledge');

    const finalSortedResultsMap = new Map<number, SearchResult>();
    finalResultsData.forEach(data => {
        const scoreInfo = weightedResults.find(r => r.id === data.id);
        if (scoreInfo) {
            finalSortedResultsMap.set(data.id, {
                ...data,
                score: scoreInfo.score,
                note: data.note || '',
                score_details: scoreInfo.scoreDetails
            });
        }
    });

    const finalSortedResults = topIds
        .map(id => finalSortedResultsMap.get(id))
        .filter((r): r is SearchResult => r !== undefined);

    let rerankedResults: SearchResult[] = finalSortedResults;
    if (finalSortedResults.length > 0) {
      try {
        console.time('SK_RerankResultsCall'); // rerankResults呼び出しの時間を計測
        console.log('Performing LLM reranking for query:', normalizedQuery, 'with results:', finalSortedResults.map(r => r.id));
        rerankedResults = await rerankResults(normalizedQuery, finalSortedResults);
        console.timeEnd('SK_RerankResultsCall');
        console.log('LLM reranked results:', rerankedResults.map(r => ({ id: r.id, question: r.question?.substring(0,30), score: r.score })) );
      } catch (rerankError) {
        console.error('LLM reranking failed, returning original top 3:', rerankError);
      }
    }

    console.log('最終検索結果 (After LLM Rerank):', rerankedResults.map(r => ({ 
      id: r.id, 
      question: r.question?.substring(0, 30) + (r.question && r.question.length > 30 ? '...' : ''), 
      score: r.score,
      scoreDetails: r.score_details 
    })));

    // if (isDev && query_id === 'TQ132') { // こちらのログは一旦コメントアウト
    //   console.log(`[TQ132] Raw results from $queryRaw for "${query}":`, JSON.stringify(rerankedResults.map(r => ({ id: r.id, score: r.score, question: r.question, answer: r.answer })), null, 2));
    // }

    if (isDev) console.timeEnd('SK_Total');
    return rerankedResults;

  } catch (error) {
    console.error('Search Error (Hybrid Search):', error);
    try {
      console.warn('Error occurred during hybrid search, running fallback search.');
      console.time('SK_SimpleSearch_ErrorFallback');
      const fallbackResult = await simpleSearch(normalizedQuery, allTokens);
      console.timeEnd('SK_SimpleSearch_ErrorFallback');
      if (isDev) console.timeEnd('SK_Total');
      return fallbackResult;
  } catch (fallbackError) {
        console.error('Fallback search also failed after error:', fallbackError);
    if (isDev) console.timeEnd('SK_Total');
    return [];
    }
  }
}

export type { SearchResult };

// フォールバック検索関数 (例) - コメントアウトされたまま
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
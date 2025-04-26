import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { SearchResult, KuromojiToken } from './common-types';
import kuromoji from 'kuromoji';
import { searchSimilarKnowledge } from './embeddings';

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
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

// PromiseでKuromojiの初期化をラップ
const tokenizerPromise = new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null>((resolve, reject) => {
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err: Error | null, _tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>) => {
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
      // Kuromoji が利用できない場合はフォールバックを実行
      console.warn('Kuromoji not available, running simple fallback search.');
      return await simpleSearch(normalizedQuery, []); // 空の terms で実行
    }
  }

  let allTokens: string[] = []; // allTokensをtryブロックの外で定義
  try {
    console.log('検索クエリ (Final Simplified Logic):', normalizedQuery);
    console.log('入力タグ (Decoded):', decodedTags);

    const tokens = tokenizer.tokenize(normalizedQuery);
    const searchTerms: string[] = tokens
        .filter((token: KuromojiToken) => VALID_POS.some(pos => token.pos.startsWith(pos)))
        .map((token: KuromojiToken) => token.basic_form === '*' ? token.surface_form : token.basic_form)
        .filter((term: string) => term !== null && term.length > 1);
    const uniqueSearchTerms: string[] = [...new Set(searchTerms)];
    console.log('検索単語 (Kuromoji OR - Array):', uniqueSearchTerms);

    // フォールバック用に allTokens を計算しておく
    allTokens = tokenizer.tokenize(normalizedQuery)
                        .map((token: KuromojiToken) => token.basic_form === '*' ? token.surface_form : token.basic_form)
                        .filter((term): term is string => typeof term === 'string' && term.length > 0);
    allTokens = [...new Set(allTokens)];

    if (uniqueSearchTerms.length === 0) {
      console.warn('No meaningful search terms extracted. Running fallback search.');
      return await simpleSearch(normalizedQuery, allTokens);
    }

    // --- アプローチ: 2段階検索 + マージ + ベクトル検索 ---
    const questionWeight = 4.0;
    const answerWeight = 0.5;
    const vectorWeight = 1.5;
    const fetchLimit = 20;

    const [questionResults, answerResults, vectorResults] = await Promise.all([
      prisma.$queryRaw< { id: number; score: number }[] >`
        SELECT id, pgroonga_score(k.tableoid, k.ctid) AS score
        FROM "Knowledge" k
        WHERE question &@~| ${uniqueSearchTerms}
        ORDER BY score DESC
        LIMIT ${fetchLimit};
      `.catch(err => { console.error("Question search failed:", err); return []; }),
      prisma.$queryRaw< { id: number; score: number }[] >`
        SELECT id, pgroonga_score(k.tableoid, k.ctid) AS score
        FROM "Knowledge" k
        WHERE answer &@~| ${uniqueSearchTerms}
        ORDER BY score DESC
        LIMIT ${fetchLimit};
      `.catch(err => { console.error("Answer search failed:", err); return []; }),
      // ベクトル検索
      searchSimilarKnowledge(normalizedQuery, fetchLimit)
        .catch(err => { console.error("Vector search failed:", err); return []; })
    ]);

    console.log(`Question search results count: ${questionResults.length}`);
    console.log(`Answer search results count: ${answerResults.length}`);
    console.log(`Vector search results count: ${vectorResults.length}`);

    const combinedScores: { [id: number]: { qScore: number; aScore: number; vScore: number } } = {};
    questionResults.forEach(r => {
      if (r && typeof r.id === 'number') {
        if (!combinedScores[r.id]) combinedScores[r.id] = { qScore: 0, aScore: 0, vScore: 0 };
        combinedScores[r.id].qScore = r.score ?? 0;
      }
    });
    answerResults.forEach(r => {
        if (r && typeof r.id === 'number') {
            if (!combinedScores[r.id]) combinedScores[r.id] = { qScore: 0, aScore: 0, vScore: 0 };
            combinedScores[r.id].aScore = r.score ?? 0;
        }
    });
    // ベクトル検索結果を統合
    vectorResults.forEach(r => {
      if (r && typeof r.id === 'number') {
        if (!combinedScores[r.id]) combinedScores[r.id] = { qScore: 0, aScore: 0, vScore: 0 };
        // 類似度をスコアとして利用
        combinedScores[r.id].vScore = r.similarity ?? 0;
      }
    });

    const weightedResults = Object.entries(combinedScores).map(([idStr, scores]) => {
      const id = parseInt(idStr, 10);
      // ハイブリッドスコアの計算
      const weightedScore = 
        (scores.qScore * questionWeight) + 
        (scores.aScore * answerWeight) + 
        (scores.vScore * vectorWeight);
      
      // デバッグ用に詳細なスコア情報を保持
      const scoreDetails = {
        q: scores.qScore,
        a: scores.aScore,
        v: scores.vScore,
        weighted: weightedScore
      };
      return { id, score: weightedScore, scoreDetails };
    }); // スコア0フィルターは削除したまま

    weightedResults.sort((a, b) => b.score - a.score);
    const top10Ids = weightedResults.slice(0, 10).map(r => r.id);

    if (top10Ids.length === 0 || weightedResults.every(r => r.score === 0)) { // スコアが全て0の場合もフォールバック
       console.log('No results after merging/weighting or all scores zero. Running fallback search.');
        return await simpleSearch(normalizedQuery, allTokens);
    }

    const finalResultsData = await prisma.knowledge.findMany({
      where: {
            id: { in: top10Ids }
        },
        select: selectKnowledgeFields
    });

    const finalSortedResultsMap = new Map<number, SearchResult>();
    finalResultsData.forEach(data => {
        const scoreInfo = weightedResults.find(r => r.id === data.id);
        if (scoreInfo) {
            finalSortedResultsMap.set(data.id, {
                ...data,
                score: scoreInfo.score,
                note: data.note || '',
                score_details: scoreInfo.scoreDetails // スコア詳細情報を追加
            });
        }
    });

    const finalSortedResults = top10Ids
        .map(id => finalSortedResultsMap.get(id))
        .filter((r): r is SearchResult => r !== undefined);

    console.log('ソート済み検索結果 (Hybrid):', finalSortedResults.map(r => ({ 
      id: r.id, 
      question: r.question?.substring(0, 30) + (r.question && r.question.length > 30 ? '...' : ''), 
      score: r.score,
      scoreDetails: r.score_details 
    })));

    return finalSortedResults;

  } catch (error) {
    console.error('Search Error (Hybrid Search):', error);
    // エラー発生時もフォールバックを試みる
    try {
      console.warn('Error occurred during hybrid search, running fallback search.');
       return await simpleSearch(normalizedQuery, allTokens);
  } catch (fallbackError) {
        console.error('Fallback search also failed after error:', fallbackError);
        return []; // フォールバックも失敗したら空を返す
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
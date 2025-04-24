import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { SearchResult, KuromojiToken } from './common-types';
import kuromoji from 'kuromoji';

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
      return []; // Kuromojiがない場合は空を返す
    }
  }

  try {
    console.log('検索クエリ (Final Simplified Logic):', normalizedQuery);
    console.log('入力タグ (Decoded):', decodedTags); // タグは現状未使用

    // --- Kuromojiによる形態素解析を復活 ---
    const tokens = tokenizer.tokenize(normalizedQuery);
    const searchTerms: string[] = tokens
        .filter((token: KuromojiToken) => VALID_POS.some(pos => token.pos.startsWith(pos)))
        // '*' (未知語) の場合はそのまま、それ以外は基本形を使う
        .map((token: KuromojiToken) => token.basic_form === '*' ? token.surface_form : token.basic_form)
        // 1文字以下の単語を除外
        .filter((term: string) => term !== null && term.length > 1);
    // 重複を除去
    const uniqueSearchTerms: string[] = [...new Set(searchTerms)];
    console.log('検索単語 (Kuromoji AND):', uniqueSearchTerms);

    // --- 修正されたPGroongaクエリ構築 (AND検索) ---
    let whereClause: Prisma.Sql;
    if (uniqueSearchTerms.length > 0) {
      // 抽出した単語をスペースで結合し、pgroonga_query_escape を通して AND 検索
      const andQueryString = uniqueSearchTerms.join(' ');
      whereClause = Prisma.sql`(question || ' ' || answer) &@~ pgroonga_query_escape(${andQueryString})`;
    } else {
      // Kuromojiで検索語が抽出できなかった場合は、元のクエリで検索 (フォールバック)
      console.warn('No meaningful search terms extracted by Kuromoji. Using original query.');
      whereClause = Prisma.sql`(question || ' ' || answer) &@~ pgroonga_query_escape(${normalizedQuery})`;
    }

    console.log('[DEBUG] WHERE Clause (Kuromoji AND):', whereClause);

    // SQLクエリ自体は変更なし (score DESC でソート)
    const querySql = Prisma.sql`
      SELECT
        k.id, k.main_category, k.sub_category, k.detail_category, k.question, k.answer, k.is_template, k.usage, k.note, k.issue, k."createdAt", k."updatedAt",
        pgroonga_score(k.tableoid, k.ctid) AS score
      FROM "Knowledge" k
      WHERE ${whereClause}
      ORDER BY score DESC
      LIMIT 10
    `;

    console.log('[DEBUG] Executing Kuromoji AND PGroonga Query:', querySql);

    // 型定義も変更なし
    type KnowledgeWithCorrectScore = Prisma.KnowledgeGetPayload<{ select: typeof selectKnowledgeFields }> & { score: number };
    const results = await prisma.$queryRaw<KnowledgeWithCorrectScore[]>(querySql);

    console.log(`PGroonga検索結果 (Kuromoji AND): ${results.length}件`);

    // 戻り値マッピングも変更なし (score ?? 0)
    const searchResults: SearchResult[] = results.map(result => ({
      ...result,
      score: result.score ?? 0,
      note: result.note || ''
    }));

    console.log('ソート済み検索結果 (Kuromoji AND):', searchResults.map(r => ({ id: r.id, question: r.question, score: r.score })));

    // --- フォールバック処理の追加 ---
    if (searchResults.length === 0) {
      console.log('Primary search returned 0 results. Running fallback simple search...');
      // Kuromojiで抽出した全トークン（フィルタ前）を simpleSearch に渡す
      const allTokens = tokenizer.tokenize(normalizedQuery)
                          .map((token: KuromojiToken) => token.basic_form === '*' ? token.surface_form : token.basic_form)
                          // string であることを保証し、1文字を除外
                          .filter((term): term is string => typeof term === 'string' && term.length > 0);
      const uniqueAllTokens = [...new Set(allTokens)];
      // 型アサーションでエラーを抑制 (根本解決ではない可能性あり)
      return await simpleSearch(normalizedQuery, uniqueAllTokens as string[]); // フォールバック検索を実行して結果を返す
    }
    // --- フォールバック処理ここまで ---

    return searchResults;

  } catch (error) {
    console.error('Search Error (Kuromoji AND):', error);
    return []; // エラー時は空配列
  }
}

// シンプルな検索フォールバック関数 (変更なし、呼び出し元はコメントアウト)
async function simpleSearch(query: string, terms: string[]): Promise<SearchResult[]> {
  console.log('Fallback simple search executing...');

  type InsensitiveMode = 'insensitive';

  try {
    const results = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: query, mode: 'insensitive' as InsensitiveMode } },
          { answer: { contains: query, mode: 'insensitive' as InsensitiveMode } },
          ...terms.map(term => ({
            OR: [
              { question: { contains: term, mode: 'insensitive' as InsensitiveMode } },
              { answer: { contains: term, mode: 'insensitive' as InsensitiveMode } }
            ]
          }))
        ]
      },
      select: selectKnowledgeFields,
      take: 10
    });

    // フォールバック結果には低いスコアと目印のnoteを付与
    return results.map(r => ({
      ...r,
      score: r.question?.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0.2, // スコアを少し下げる (例: 0.5 / 0.2)
      note: 'フォールバック検索結果' // note を変更
    }));
  } catch (fallbackError) {
    console.error('Simple search error:', fallbackError);
    return [];
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
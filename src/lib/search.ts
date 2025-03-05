import { PrismaClient } from '@prisma/client';
import { SearchResponse, SearchResult } from '../types/search';
import { saveSearchHistory } from './history-utils';

const prisma = new PrismaClient();

export async function performSearch(query: string): Promise<SearchResponse> {
  const response = {
    results: [] as SearchResult[]
  };

  // カテゴリの重みを取得
  const categoryWeights = await prisma.categoryWeight.findMany();
  const categoryWeightMap = new Map(
    categoryWeights.map(cw => [cw.category, cw.weight])
  );

  // 検索結果を取得
  const results = await prisma.$queryRaw<Array<{
    id: number;
    question: string;
    answer: string;
    main_category: string;
    sub_category: string;
    detail_category: string | null;
  }>>`
    SELECT DISTINCT ON (k.id)
      k.id,
      k.question,
      k.answer,
      k.main_category,
      k.sub_category,
      k.detail_category
    FROM "Knowledge" k
    WHERE k.question ILIKE ${`%${query}%`} OR k.answer ILIKE ${`%${query}%`}
    ORDER BY k.id
    LIMIT 2
  `;

  // タグ情報を取得
  const knowledgeTags = await prisma.knowledgeTag.findMany({
    where: {
      knowledge_id: {
        in: results.map(r => r.id)
      }
    },
    include: {
      tag: true
    }
  });

  // 検索結果を整形
  response.results = results.map((result, index) => {
    const tags = knowledgeTags
      .filter(kt => kt.knowledge_id === result.id)
      .map(kt => kt.tag.name);
    const categoryWeight = categoryWeightMap.get(result.main_category) || 1.0;
    
    // 基本スコアを計算（カテゴリの重みを使用）
    let finalScore = categoryWeight;

    // タグの重みを加算
    const tagWeightMultiplier = 0.9; // タグごとの重み係数
    finalScore += tags.length * tagWeightMultiplier;

    return {
      id: result.id,
      question: result.question,
      answer: result.answer,
      main_category: result.main_category,
      sub_category: result.sub_category,
      detail_category: result.detail_category,
      tags,
      category_weight: categoryWeight,
      tag_weight: tags.length * tagWeightMultiplier,
      final_score: finalScore,
      rank: index + 1,
      text_rank: 1
    };
  });

  // スコアでソート
  response.results.sort((a, b) => b.final_score - a.final_score);

  // 分析結果の作成
  const analysis = {
    alerts: [],
    categories: Array.from(new Set(response.results.map(r => r.main_category))),
    tags: Array.from(new Set(response.results.flatMap(r => r.tags))),
    dates: []
  };

  const responseObj: SearchResponse = {
    results: response.results,
    total: results.length,
    query,
    tsQuery: query.split(/\s+/).map(term => `${term}:*`).join(' & '),
    analysis
  };

  // 検索履歴を保存
  if (response.results.length > 0) {
    const firstResult = response.results[0];
    await saveSearchHistory(query, firstResult.id, 1);
  }

  return responseObj;
} 
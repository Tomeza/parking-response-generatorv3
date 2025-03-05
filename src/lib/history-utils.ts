import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function saveSearchHistory(query: string, knowledgeId: number, position: number) {
  return prisma.searchHistory.create({
    data: {
      query,
      clicked_knowledge_id: knowledgeId,
      clicked_position: position
    }
  });
}

export async function getRelatedQueries(query: string) {
  const similarQueries = await prisma.$queryRaw<Array<{ query: string; similarity: number }>>`
    SELECT query, similarity(query, ${query}) as similarity
    FROM (
      SELECT DISTINCT query
      FROM "SearchHistory"
      WHERE query <> ${query}
      AND query LIKE ${`%${query}%`}
    ) sq
    ORDER BY similarity DESC
    LIMIT 5
  `;
  return similarQueries;
}

export async function getPopularCategories() {
  const popularCategories = await prisma.$queryRaw<Array<{ category: string; count: number }>>`
    SELECT k.main_category as category, COUNT(*) as count
    FROM "SearchHistory" sh
    JOIN "Knowledge" k ON k.id = sh.clicked_knowledge_id
    GROUP BY k.main_category
    ORDER BY count DESC
    LIMIT 5
  `;
  return popularCategories;
}

export async function getPopularTags() {
  const popularTags = await prisma.$queryRaw<Array<{ tag: string; count: number }>>`
    SELECT t.name as tag, COUNT(*) as count
    FROM "SearchHistory" sh
    JOIN "Knowledge" k ON k.id = sh.clicked_knowledge_id
    JOIN "KnowledgeTag" kt ON kt.knowledge_id = k.id
    JOIN "Tag" t ON t.id = kt.tag_id
    GROUP BY t.name
    ORDER BY count DESC
    LIMIT 5
  `;
  return popularTags;
} 
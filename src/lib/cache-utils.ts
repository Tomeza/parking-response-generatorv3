import { PrismaClient } from '@prisma/client';
import { SearchResponse } from '@/types/search';

const prisma = new PrismaClient();
const CACHE_DURATION_HOURS = 1;

export async function getCachedSearch(query: string): Promise<SearchResponse | null> {
  const now = new Date();
  const cache = await prisma.$queryRaw<SearchResponse[]>`
    SELECT 
      "query",
      "ts_query" as "tsQuery",
      "results",
      "total",
      "analysis"
    FROM "SearchCache"
    WHERE "query" = ${query}
    AND "expires_at" > ${now}
    ORDER BY "created_at" DESC
    LIMIT 1
  `;

  if (!cache || cache.length === 0) {
    return null;
  }

  return cache[0];
}

export async function cacheSearchResult(response: SearchResponse): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);

  await prisma.$executeRaw`
    INSERT INTO "SearchCache" (
      "query",
      "ts_query",
      "results",
      "total",
      "analysis",
      "created_at",
      "expires_at"
    ) VALUES (
      ${response.query},
      ${response.tsQuery},
      ${JSON.stringify(response.results)}::jsonb,
      ${response.total},
      ${JSON.stringify(response.analysis)}::jsonb,
      NOW(),
      ${expiresAt}
    )
  `;
}

export async function clearExpiredCache(): Promise<void> {
  const now = new Date();
  await prisma.$executeRaw`
    DELETE FROM "SearchCache"
    WHERE "expires_at" <= ${now}
  `;
} 
import { PrismaClient } from '@prisma/client';
import { getCachedSearch, cacheSearchResult, clearExpiredCache } from '../cache-utils';

const prisma = new PrismaClient();

describe('Cache Functionality', () => {
  const mockSearchResponse = {
    results: [
      {
        id: 1,
        question: 'テスト質問',
        answer: 'テスト回答',
        main_category: 'テストカテゴリ',
        sub_category: 'テストサブカテゴリ',
        detail_category: 'テスト詳細カテゴリ',
        rank: 1,
        text_rank: 1.0,
        category_weight: 1.0,
        tag_weight: 1.0,
        final_score: 1.0,
        tags: ['テスト']
      }
    ],
    total: 1,
    query: 'テスト',
    tsQuery: 'テスト:*',
    analysis: {
      alerts: [],
      dates: [],
      categories: ['テストカテゴリ']
    }
  };

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM "SearchCache"`;
  });

  it('should cache and retrieve search results', async () => {
    // キャッシュに保存
    await cacheSearchResult(mockSearchResponse);

    // キャッシュから取得
    const cachedResult = await getCachedSearch(mockSearchResponse.query);
    expect(cachedResult).toBeTruthy();
    expect(cachedResult?.query).toBe(mockSearchResponse.query);
    expect(cachedResult?.results).toHaveLength(1);
  });

  it('should not return expired cache', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1000); // 1秒前

    // 期限切れのキャッシュを作成
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
        '期限切れ',
        '期限切れ:*',
        '[]'::jsonb,
        0,
        '{"alerts": [], "dates": [], "categories": []}'::jsonb,
        ${expiresAt},
        ${expiresAt}
      )
    `;

    // キャッシュから取得（期限切れなのでnullが返る）
    const cachedResult = await getCachedSearch('期限切れ');
    expect(cachedResult).toBeNull();
  });

  it('should clear expired cache', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1000); // 1秒前

    // 期限切れのキャッシュを作成
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
        'クリア対象',
        'クリア対象:*',
        '[]'::jsonb,
        0,
        '{"alerts": [], "dates": [], "categories": []}'::jsonb,
        ${expiresAt},
        ${expiresAt}
      )
    `;

    // 期限切れのキャッシュをクリア
    await clearExpiredCache();

    // キャッシュが削除されていることを確認
    const count = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM "SearchCache"
      WHERE "query" = 'クリア対象'
    `;
    expect(Number(count[0].count)).toBe(0);
  });
}); 
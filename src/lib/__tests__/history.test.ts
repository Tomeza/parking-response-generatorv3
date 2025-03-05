import { PrismaClient } from '@prisma/client';
import { saveSearchHistory, getRelatedQueries, getPopularCategories, getPopularTags } from '../history-utils';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';

const prisma = new PrismaClient();

describe('Search History Functionality', () => {
  beforeAll(async () => {
    await prisma.searchHistory.deleteMany();
    await prisma.knowledgeTag.deleteMany();
    await prisma.knowledge.deleteMany();
    await prisma.tag.deleteMany();

    // タグの作成
    const tag1 = await prisma.tag.create({
      data: { name: '予約' }
    });
    const tag2 = await prisma.tag.create({
      data: { name: 'オンライン' }
    });

    // ナレッジの作成
    const knowledge1 = await prisma.knowledge.create({
      data: {
        question: '予約方法について教えてください',
        answer: '予約は電話またはウェブサイトから可能です。',
        main_category: 'カテゴリA',
        sub_category: 'サブカテゴリA',
        detail_category: '詳細カテゴリA'
      }
    });

    await prisma.knowledgeTag.createMany({
      data: [
        { knowledge_id: knowledge1.id, tag_id: tag1.id },
        { knowledge_id: knowledge1.id, tag_id: tag2.id }
      ]
    });

    const knowledge2 = await prisma.knowledge.create({
      data: {
        question: '予約のキャンセル方法を教えてください',
        answer: 'キャンセルは予約番号をご用意の上、お電話にてお願いします。',
        main_category: 'カテゴリA',
        sub_category: 'サブカテゴリB',
        detail_category: '詳細カテゴリB'
      }
    });

    await prisma.knowledgeTag.create({
      data: {
        knowledge_id: knowledge2.id,
        tag_id: tag1.id
      }
    });

    // 検索履歴の作成
    await prisma.searchHistory.createMany({
      data: [
        {
          query: '予約方法',
          clicked_knowledge_id: knowledge1.id,
          clicked_position: 1
        },
        {
          query: '予約',
          clicked_knowledge_id: knowledge2.id,
          clicked_position: 1
        }
      ]
    });
  });

  afterAll(async () => {
    await prisma.searchHistory.deleteMany();
    await prisma.knowledgeTag.deleteMany();
    await prisma.knowledge.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.$disconnect();
  });

  it('should save search history', async () => {
    const query = 'テスト検索';
    const knowledgeId = 3;
    const position = 2;

    await saveSearchHistory(query, knowledgeId, position);

    const history = await prisma.searchHistory.findFirst({
      where: {
        query,
        clicked_knowledge_id: knowledgeId,
        clicked_position: position
      }
    });

    expect(history).not.toBeNull();
    expect(history?.query).toBe(query);
    expect(history?.clicked_knowledge_id).toBe(knowledgeId);
    expect(history?.clicked_position).toBe(position);
  });

  it('should get popular categories', async () => {
    const popularCategories = await getPopularCategories();
    expect(popularCategories).toHaveLength(1);
    expect(popularCategories[0].category).toBe('カテゴリA');
    expect(Number(popularCategories[0].count)).toBe(2);
  });

  it('should get popular tags', async () => {
    const popularTags = await getPopularTags();
    expect(popularTags).toHaveLength(2);
    expect(popularTags[0].tag).toBe('予約');
    expect(Number(popularTags[0].count)).toBe(2);
    expect(popularTags[1].tag).toBe('オンライン');
    expect(Number(popularTags[1].count)).toBe(1);
  });

  it('should get related queries', async () => {
    const relatedQueries = await getRelatedQueries('予約');
    expect(relatedQueries).toHaveLength(1);
    expect(relatedQueries[0].query).toBe('予約方法');
  });
}); 
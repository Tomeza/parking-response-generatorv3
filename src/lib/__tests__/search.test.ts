import { PrismaClient } from '@prisma/client';
import { SearchResponse, SearchResult } from '../../types/search';
import { performSearch } from '../search';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';

const prisma = new PrismaClient();

describe('Search Functionality', () => {
  beforeAll(async () => {
    await prisma.knowledgeTag.deleteMany();
    await prisma.knowledge.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.categoryWeight.deleteMany();

    // タグの作成
    await prisma.tag.upsert({
      where: { id: 1 },
      update: { id: 1, name: '予約' },
      create: { id: 1, name: '予約' }
    });
    await prisma.tag.upsert({
      where: { id: 2 },
      update: { id: 2, name: 'オンライン' },
      create: { id: 2, name: 'オンライン' }
    });
    await prisma.tag.upsert({
      where: { id: 3 },
      update: { id: 3, name: '料金' },
      create: { id: 3, name: '料金' }
    });

    // カテゴリの重みを設定
    await prisma.categoryWeight.createMany({
      data: [
        { category: 'カテゴリA', weight: 1.5 },
        { category: 'カテゴリB', weight: 1.0 }
      ]
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
        { knowledge_id: knowledge1.id, tag_id: 1 },
        { knowledge_id: knowledge1.id, tag_id: 2 }
      ]
    });

    const knowledge2 = await prisma.knowledge.create({
      data: {
        question: '予約のキャンセル方法を教えてください',
        answer: 'キャンセルは予約番号をご用意の上、お電話にてお願いします。',
        main_category: 'カテゴリB',
        sub_category: 'サブカテゴリB',
        detail_category: '詳細カテゴリB'
      }
    });

    await prisma.knowledgeTag.create({
      data: {
        knowledge_id: knowledge2.id,
        tag_id: 1
      }
    });
  });

  afterAll(async () => {
    await prisma.knowledgeTag.deleteMany();
    await prisma.knowledge.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.categoryWeight.deleteMany();
    await prisma.$disconnect();
  });

  it('should return relevant results for "予約" query', async () => {
    const result = await performSearch('予約');
    expect(result.results).toHaveLength(2);
    expect(result.results[0].question).toContain('予約');
    expect(result.results[1].question).toContain('予約');
  });

  it('should apply category weights correctly', async () => {
    const result = await performSearch('予約');
    const categoryAResult = result.results.find(r => r.main_category === 'カテゴリA');
    const categoryBResult = result.results.find(r => r.main_category === 'カテゴリB');
    expect(categoryAResult?.category_weight).toBe(1.5);
    expect(categoryBResult?.category_weight).toBe(1.0);
  });

  it('should combine category and tag weights', async () => {
    const result = await performSearch('予約');
    const firstResult = result.results[0];
    expect(firstResult.final_score).toBeGreaterThan(firstResult.category_weight);
  });
}); 
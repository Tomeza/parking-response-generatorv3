/**
 * 高度なタグ検索機能
 * 
 * タグの階層構造を活用した検索や、同義語を考慮した検索機能を提供します。
 */
import { prisma } from '@/lib/prisma';
import { Knowledge, Tag, TagSynonym } from '@prisma/client';

/**
 * タグ情報と同義語を含む拡張タグ型
 */
export type ExtendedTag = Tag & {
  tag_synonyms: TagSynonym[];
};

/**
 * 検索結果型
 */
export type TagSearchResult = {
  knowledge: Knowledge;
  score: number;
  matchedTags: string[];
};

/**
 * 検索クエリからタグを抽出する関数
 * 
 * @param query 検索クエリ
 * @returns 抽出されたタグ名の配列
 */
export function extractTagsFromQuery(query: string): string[] {
  // タグとして扱う可能性のある単語を抽出
  const words = query.split(/[\s,、。．！？!?.]+/).filter(word => word.length >= 2);
  return words;
}

/**
 * 抽出されたタグ名に基づいてタグを検索する関数
 * 
 * @param tagNames タグ名の配列
 * @returns タグ情報の配列（同義語を含む）
 */
export async function findTagsByNames(tagNames: string[]): Promise<ExtendedTag[]> {
  if (tagNames.length === 0) {
    return [];
  }
  
  // タグ名の完全一致検索
  const exactTags = await prisma.tag.findMany({
    where: {
      tag_name: {
        in: tagNames
      }
    },
    include: {
      tag_synonyms: true
    }
  });
  
  // 同義語からタグを検索
  const synonymTags = await prisma.tag.findMany({
    where: {
      tag_synonyms: {
        some: {
          synonym: {
            in: tagNames
          }
        }
      }
    },
    include: {
      tag_synonyms: true
    }
  });
  
  // 部分一致検索
  const partialTags = await prisma.tag.findMany({
    where: {
      OR: tagNames.map(name => ({
        tag_name: {
          contains: name
        }
      }))
    },
    include: {
      tag_synonyms: true
    }
  });
  
  // 結果をマージして重複を除去
  const allTags = [...exactTags, ...synonymTags, ...partialTags];
  const uniqueTags: ExtendedTag[] = [];
  
  allTags.forEach(tag => {
    if (!uniqueTags.some(t => t.id === tag.id)) {
      uniqueTags.push(tag);
    }
  });
  
  return uniqueTags;
}

/**
 * タグに基づいてナレッジを検索する関数
 */
export async function searchKnowledgeByTags(terms: string[]): Promise<TagSearchResult[]> {
  if (!terms.length) return [];
  
  // タグとその同義語を検索
  const tags = await prisma.tag.findMany({
    where: {
      OR: [
        { tag_name: { in: terms } },
        {
          tag_synonyms: {
            some: {
              synonym: { in: terms }
            }
          }
        }
      ]
    },
    include: {
      knowledge_tags: {
        include: {
          knowledge: true
        }
      }
    }
  });
  
  // 結果をスコアリング
  const results: TagSearchResult[] = [];
  const knowledgeMap = new Map<string, TagSearchResult>();
  
  tags.forEach(tag => {
    tag.knowledge_tags.forEach(kt => {
      const knowledge = kt.knowledge;
      const existing = knowledgeMap.get(knowledge.id.toString());
      
      if (existing) {
        // 既存の結果のスコアを更新
        existing.score += 1;
      } else {
        // 新しい結果を追加
        knowledgeMap.set(knowledge.id.toString(), {
          knowledge,
          score: 1,
          matchedTags: []
        });
      }
    });
  });
  
  // マップから配列に変換
  return Array.from(knowledgeMap.values());
}

/**
 * カテゴリの一致度を計算する関数
 */
function calculateCategoryMatchScore(knowledge: Knowledge, keyTerms: string[]): number {
  let score = 0;
  
  // メインカテゴリの一致度（重み: 0.5）
  if (knowledge.main_category) {
    const mainCategoryMatch = keyTerms.some(term => 
      knowledge.main_category?.toLowerCase().includes(term.toLowerCase())
    );
    if (mainCategoryMatch) score += 0.5;
  }
  
  // サブカテゴリの一致度（重み: 0.3）
  if (knowledge.sub_category) {
    const subCategoryMatch = keyTerms.some(term => 
      knowledge.sub_category?.toLowerCase().includes(term.toLowerCase())
    );
    if (subCategoryMatch) score += 0.3;
  }
  
  // 詳細カテゴリの一致度（重み: 0.2）
  if (knowledge.detail_category) {
    const detailCategoryMatch = keyTerms.some(term => 
      knowledge.detail_category?.toLowerCase().includes(term.toLowerCase())
    );
    if (detailCategoryMatch) score += 0.2;
  }
  
  return Math.min(score, 1.0);
}

/**
 * タグに基づくスコアを計算する関数
 * 
 * @param matchedTags マッチしたタグ名の配列
 * @param allTags 検出されたすべてのタグ
 * @param keyTerms 検索キーワード
 * @returns スコア（0.0〜1.0）
 */
function calculateTagScore(
  matchedTags: string[],
  allTags: ExtendedTag[],
  keyTerms: string[]
): number {
  if (matchedTags.length === 0) {
    return 0;
  }
  
  // 基本スコア: マッチしたタグの数 / 全タグの数
  const baseScore = matchedTags.length / allTags.length;
  
  // 完全一致ボーナス
  let exactMatchBonus = 0;
  matchedTags.forEach(tag => {
    if (keyTerms.includes(tag)) {
      exactMatchBonus += 0.2;
    }
  });
  
  // 同義語マッチボーナス
  let synonymMatchBonus = 0;
  matchedTags.forEach(tag => {
    const tagInfo = allTags.find(t => t.tag_name === tag);
    if (tagInfo?.tag_synonyms) {
      const hasSynonymMatch = tagInfo.tag_synonyms.some(synonym => 
        keyTerms.includes(synonym.synonym)
      );
      if (hasSynonymMatch) {
        synonymMatchBonus += 0.1;
      }
    }
  });
  
  // 最終スコア（0.0〜1.0に正規化）
  let finalScore = baseScore + exactMatchBonus + synonymMatchBonus;
  if (finalScore > 1.0) {
    finalScore = 1.0;
  }
  
  return finalScore;
}

// 以下は旧バージョンの関数（互換性のために残す）
export async function searchKnowledgeByTagsLegacy(query: string) {
  try {
    // クエリからタグを抽出
    const tagNames = extractTagsFromQuery(query);
    console.log('抽出されたタグ名:', tagNames);
    
    if (tagNames.length === 0) {
      return [];
    }
    
    // タグを検索
    const tags = await findTagsByNames(tagNames);
    console.log('検出されたタグ:', tags.map(t => t.tag_name));
    
    if (tags.length === 0) {
      return [];
    }
    
    // タグIDのリストを作成
    const tagIds = tags.map(tag => tag.id);
    
    // タグに関連するナレッジを検索
    const knowledgeWithTags = await prisma.knowledge.findMany({
      where: {
        knowledge_tags: {
          some: {
            tag_id: {
              in: tagIds
            }
          }
        }
      }
    });
    
    // 検索結果に関連度を付与
    const results = knowledgeWithTags.map(knowledge => ({
      ...knowledge,
      relevance: 0.9 // タグベース検索には高い関連度を与える
    }));
    
    return results;
  } catch (error) {
    console.error('タグ検索エラー:', error);
    return [];
  }
}

/**
 * タグに関連するナレッジを検索する関数
 * 
 * @param tagIds タグIDの配列
 * @returns ナレッジの配列（関連度スコア付き）
 */
export async function findKnowledgeByTags(tagIds: number[]): Promise<(Knowledge & { relevance: number })[]> {
  if (tagIds.length === 0) {
    return [];
  }
  
  // タグに関連するナレッジを検索
  const knowledgeEntries = await prisma.knowledgeTag.findMany({
    where: {
      tag_id: {
        in: tagIds
      }
    },
    include: {
      knowledge: true
    }
  });
  
  // ナレッジごとにマッチしたタグの数をカウント
  const knowledgeMap = new Map<number, { knowledge: Knowledge, matchCount: number }>();
  
  knowledgeEntries.forEach(entry => {
    const { knowledge } = entry;
    const existingEntry = knowledgeMap.get(knowledge.id);
    
    if (existingEntry) {
      existingEntry.matchCount += 1;
    } else {
      knowledgeMap.set(knowledge.id, { knowledge, matchCount: 1 });
    }
  });
  
  // 関連度スコアを計算して結果を返す
  const results: (Knowledge & { relevance: number })[] = Array.from(knowledgeMap.values()).map(({ knowledge, matchCount }) => {
    // 関連度スコア: マッチしたタグ数 / 検索タグ数（最大1.0）
    const relevance = Math.min(matchCount / tagIds.length, 1.0);
    return { ...knowledge, relevance };
  });
  
  // 関連度スコアで降順ソート
  results.sort((a, b) => b.relevance - a.relevance);
  
  return results;
}

/**
 * タグの階層構造を解析する関数
 * 
 * @param tagName タグ名（「カテゴリ/サブカテゴリ/詳細」形式）
 * @returns 階層構造の配列 [カテゴリ, サブカテゴリ, 詳細]
 */
export function parseTagHierarchy(tagName: string): string[] {
  return tagName.split('/').map(part => part.trim()).filter(Boolean);
}

/**
 * 階層構造を持つタグを検索する関数
 * 
 * @param hierarchy 階層構造の配列 [カテゴリ, サブカテゴリ, 詳細]
 * @returns タグ情報の配列
 */
export async function findTagsByHierarchy(hierarchy: string[]): Promise<Tag[]> {
  if (hierarchy.length === 0) {
    return [];
  }
  
  // 階層の各レベルに一致するタグを検索
  const tags: Tag[] = [];
  
  // カテゴリレベル
  if (hierarchy[0]) {
    const categoryTags = await prisma.tag.findMany({
      where: {
        tag_name: {
          startsWith: hierarchy[0],
          mode: 'insensitive'
        }
      }
    });
    tags.push(...categoryTags);
  }
  
  // サブカテゴリレベル
  if (hierarchy.length >= 2 && hierarchy[1]) {
    const subCategoryPattern = `${hierarchy[0]}/${hierarchy[1]}`;
    const subCategoryTags = await prisma.tag.findMany({
      where: {
        tag_name: {
          startsWith: subCategoryPattern,
          mode: 'insensitive'
        }
      }
    });
    tags.push(...subCategoryTags);
  }
  
  // 詳細レベル
  if (hierarchy.length >= 3 && hierarchy[2]) {
    const detailPattern = `${hierarchy[0]}/${hierarchy[1]}/${hierarchy[2]}`;
    const detailTags = await prisma.tag.findMany({
      where: {
        tag_name: {
          startsWith: detailPattern,
          mode: 'insensitive'
        }
      }
    });
    tags.push(...detailTags);
  }
  
  // 重複を除外
  const uniqueTags = tags.filter((tag, index, self) => 
    index === self.findIndex(t => t.id === tag.id)
  );
  
  return uniqueTags;
}

/**
 * カテゴリ情報に基づいてナレッジを検索する関数
 * 
 * @param mainCategory メインカテゴリ
 * @param subCategory サブカテゴリ（オプション）
 * @param detailCategory 詳細カテゴリ（オプション）
 * @returns ナレッジの配列（関連度スコア付き）
 */
export async function searchKnowledgeByCategories(
  mainCategory?: string,
  subCategory?: string,
  detailCategory?: string
): Promise<(Knowledge & { relevance: number })[]> {
  // 検索条件を構築
  const whereConditions: any = {};
  
  if (mainCategory) {
    whereConditions.main_category = {
      contains: mainCategory,
      mode: 'insensitive'
    };
  }
  
  if (subCategory) {
    whereConditions.sub_category = {
      contains: subCategory,
      mode: 'insensitive'
    };
  }
  
  if (detailCategory) {
    whereConditions.detail_category = {
      contains: detailCategory,
      mode: 'insensitive'
    };
  }
  
  // カテゴリに一致するナレッジを検索
  const knowledge = await prisma.knowledge.findMany({
    where: whereConditions
  });
  
  // 関連度スコアを計算
  const results: (Knowledge & { relevance: number })[] = knowledge.map(k => {
    let relevance = 0;
    
    // 完全一致の場合は高いスコア、部分一致の場合は低いスコア
    if (mainCategory && k.main_category === mainCategory) {
      relevance += 0.5;
    } else if (mainCategory && k.main_category?.includes(mainCategory)) {
      relevance += 0.3;
    }
    
    if (subCategory && k.sub_category === subCategory) {
      relevance += 0.3;
    } else if (subCategory && k.sub_category?.includes(subCategory)) {
      relevance += 0.2;
    }
    
    if (detailCategory && k.detail_category === detailCategory) {
      relevance += 0.2;
    } else if (detailCategory && k.detail_category?.includes(detailCategory)) {
      relevance += 0.1;
    }
    
    return { ...k, relevance };
  });
  
  // 関連度スコアで降順ソート
  results.sort((a, b) => b.relevance - a.relevance);
  
  return results;
} 
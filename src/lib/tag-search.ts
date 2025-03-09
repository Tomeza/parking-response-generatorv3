/**
 * 高度なタグ検索機能
 * 
 * タグの階層構造を活用した検索や、同義語を考慮した検索機能を提供します。
 */
import { prisma } from './prisma';
import { Knowledge, Tag, TagSynonym } from '@prisma/client';

/**
 * タグ情報と同義語を含む拡張タグ型
 */
export type ExtendedTag = Tag & {
  tag_synonyms: TagSynonym[];
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
  const synonymTags = await prisma.tagSynonym.findMany({
    where: {
      synonym: {
        in: tagNames
      }
    },
    include: {
      tag: {
        include: {
          tag_synonyms: true
        }
      }
    }
  });
  
  // 同義語から取得したタグを追加（重複を除外）
  const allTags: ExtendedTag[] = [...exactTags];
  
  synonymTags.forEach(synonym => {
    if (!allTags.some(tag => tag.id === synonym.tag.id)) {
      allTags.push(synonym.tag);
    }
  });
  
  // 部分一致検索（完全一致で見つからなかった場合）
  if (allTags.length < tagNames.length) {
    const remainingTagNames = tagNames.filter(
      name => !exactTags.some(tag => tag.tag_name === name) && 
              !synonymTags.some(syn => syn.synonym === name)
    );
    
    if (remainingTagNames.length > 0) {
      const partialTags = await prisma.tag.findMany({
        where: {
          OR: remainingTagNames.map(name => ({
            tag_name: {
              contains: name,
              mode: 'insensitive'
            }
          }))
        },
        include: {
          tag_synonyms: true
        }
      });
      
      // 部分一致で見つかったタグを追加（重複を除外）
      partialTags.forEach(tag => {
        if (!allTags.some(existingTag => existingTag.id === tag.id)) {
          allTags.push(tag);
        }
      });
    }
  }
  
  return allTags;
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
 * 検索クエリに基づいてタグ検索を実行し、関連するナレッジを取得する関数
 * 
 * @param query 検索クエリ
 * @returns ナレッジの配列（関連度スコア付き）
 */
export async function searchKnowledgeByTags(query: string): Promise<(Knowledge & { relevance: number })[]> {
  // クエリからタグを抽出
  const tagNames = extractTagsFromQuery(query);
  
  // タグ情報を取得
  const tags = await findTagsByNames(tagNames);
  
  // 階層構造を持つタグを検索
  const hierarchyTags: Tag[] = [];
  for (const tagName of tagNames) {
    if (tagName.includes('/')) {
      const hierarchy = parseTagHierarchy(tagName);
      const hTags = await findTagsByHierarchy(hierarchy);
      hierarchyTags.push(...hTags);
    }
  }
  
  // 全てのタグIDを収集（重複を除外）
  const allTagIds = [...tags, ...hierarchyTags].map(tag => tag.id);
  const uniqueTagIds = [...new Set(allTagIds)];
  
  // タグに関連するナレッジを検索
  return await findKnowledgeByTags(uniqueTagIds);
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
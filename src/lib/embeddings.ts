import OpenAI from 'openai';
import { prisma } from './db';

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ベクトル埋め込みのキャッシュ
const embeddingCache: Record<string, number[]> = {};

/**
 * テキストの埋め込みベクトルを生成する
 * @param text テキスト
 * @param targetDimensions オプションで次元数を受け取る
 * @returns 埋め込みベクトル
 */
export async function generateEmbedding(text: string, targetDimensions?: number): Promise<number[]> {
  if (!text || text.trim() === '') {
    return [];
  }
  const cacheKey = `${text.trim().toLowerCase()}_dim:${targetDimensions || 'default'}`;
  if (embeddingCache[cacheKey]) {
    return embeddingCache[cacheKey];
  }
  try {
    const createParams: OpenAI.Embeddings.EmbeddingCreateParams = {
      model: 'text-embedding-3-small',
      input: text.trim(),
    };
    if (targetDimensions) {
      createParams.dimensions = targetDimensions;
    }
    const response = await openai.embeddings.create(createParams);
    const embedding = response.data[0].embedding;
    embeddingCache[cacheKey] = embedding;
    return embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Knowledgeテーブルの全レコードに埋め込みベクトルを生成して保存する
 * @param targetDimensions 生成する次元数 (未指定なら1536)
 * @param targetColumnName 保存先のカラム名 (未指定なら 'embedding_vector')
 * @returns 処理されたレコード数
 */
export async function generateAllKnowledgeEmbeddings(
  targetDimensions?: number, 
  targetColumnName?: string
): Promise<number> {
  try {
    const knowledgeItems = await prisma.knowledge.findMany({
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });

    const effectiveDimensions = targetDimensions || 1536;
    
    let processedCount = 0;
    for (let i = 0; i < knowledgeItems.length; i += 10) {
      const batch = knowledgeItems.slice(i, i + 10);
      await Promise.all(
        batch.map(async (item) => {
          const text = `${item.question || ''} ${item.answer || ''}`.trim();
          if (!text) return;
          try {
            const embedding = await generateEmbedding(text, targetDimensions);
            const columnToUpdate = targetColumnName || "embedding_vector";
            if (embedding && embedding.length > 0) {
              await prisma.$executeRawUnsafe(
                `UPDATE "Knowledge" SET "${columnToUpdate}" = $1::vector(${effectiveDimensions}), "updatedAt" = NOW() WHERE id = $2`,
                embedding,
                item.id
              );
              processedCount++;
            } else {
              console.warn(`Skipping update for item ${item.id} due to empty embedding or generation failure.`);
            }
          } catch (error) {
            console.error(`Error processing item ${item.id} for column ${targetColumnName || 'embedding_vector'}:`, error);
          }
        })
      );
    }
    console.log(`Completed embedding generation for ${processedCount} items for column ${targetColumnName || 'embedding_vector'}.`);
    return processedCount;
  } catch (error) {
    console.error(`Error in generateAllKnowledgeEmbeddings for column ${targetColumnName || 'embedding_vector'}:`, error);
    throw error;
  }
}

/**
 * テキストに最も関連する知識エントリを検索する
 * @param query 検索クエリ
 * @param limit 取得する最大件数
 * @param efSearchValue オプションで hnsw.ef_search の値を受け取る
 * @param targetDimensions 検索対象の次元数を指定
 * @returns 関連度スコア付きの知識エントリ配列
 */
export async function searchSimilarKnowledge(
  query: string,
  limit: number = 10,
  efSearchValue?: number,
  targetDimensions: number = 1536
): Promise<Array<{ id: number; similarity: number }>> {
  try {
    if (!query || query.trim() === '') {
      return [];
    }

    if (targetDimensions !== 1536) {
      throw new Error(`[searchSimilarKnowledge] Invalid targetDimensions: ${targetDimensions}. This function is fixed to 1536 dimensions.`);
    }

    const efSearch = efSearchValue || (process.env.VECTOR_EFSEARCH_DEFAULT ? parseInt(process.env.VECTOR_EFSEARCH_DEFAULT, 10) : 100);
    if (efSearch > 0) {
      await prisma.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${efSearch};`);
    }
    
    const queryEmbedding = await generateEmbedding(query, 1536);
    
    if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn('Failed to generate query embedding or got empty embedding.');
        return [];
    }

    const columnName = 'embedding_vector';
    const columnCastDimension = 1536;

    const queryEmbeddingVector = queryEmbedding as any;
    
    const sql = `
    /*dim:${columnCastDimension}_${Date.now()}*/
    SELECT
      id,
      1 - (${columnName} <=> $1::vector(${columnCastDimension})) AS similarity
    FROM "Knowledge"
    WHERE ${columnName} IS NOT NULL
    ORDER BY similarity DESC
    LIMIT $2
  `;

    const rawResults: unknown = await prisma.$queryRawUnsafe(
      sql, 
      queryEmbeddingVector, 
      limit 
    );
    const results = rawResults as Array<{ id: number; similarity: number }>;

    return results;
  } catch (error) {
    console.error('Error in searchSimilarKnowledge:', error);
    if (error instanceof Error && error.message.startsWith('[searchSimilarKnowledge] Invalid targetDimensions')) {
        throw error;
    }
    return [];
  }
} 
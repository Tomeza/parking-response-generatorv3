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
 * @returns 埋め込みベクトル
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // テキストが空の場合、空の配列を返す
  if (!text || text.trim() === '') {
    return [];
  }

  // キャッシュにあればそれを返す
  const cacheKey = text.trim().toLowerCase();
  if (embeddingCache[cacheKey]) {
    return embeddingCache[cacheKey];
  }

  try {
    // OpenAIのembedding APIを使用
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
    });

    const embedding = response.data[0].embedding;
    
    // キャッシュに保存
    embeddingCache[cacheKey] = embedding;
    
    return embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Knowledgeテーブルの全レコードに埋め込みベクトルを生成して保存する
 * @returns 処理されたレコード数
 */
export async function generateAllKnowledgeEmbeddings(): Promise<number> {
  try {
    // すべてのKnowledgeレコードを取得 (embedding_vectorが認識されていないため条件を削除)
    const knowledgeItems = await prisma.knowledge.findMany({
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });

    console.log(`Generating embeddings for ${knowledgeItems.length} knowledge items...`);
    
    let processedCount = 0;
    
    // バッチ処理: 10レコードずつ処理
    for (let i = 0; i < knowledgeItems.length; i += 10) {
      const batch = knowledgeItems.slice(i, i + 10);
      
      // 並列処理
      await Promise.all(
        batch.map(async (item) => {
          // 質問と回答を結合してテキストを作成
          const text = `${item.question || ''} ${item.answer || ''}`.trim();
          
          if (!text) return;
          
          try {
            // 埋め込みベクトルを生成
            const embedding = await generateEmbedding(text);
            
            // Raw SQLを使用してデータベースに保存（Prismaがembedding_vectorを認識していないため）
            await prisma.$executeRaw`
              UPDATE "Knowledge"
              SET embedding_vector = ${embedding}::vector,
                  "updatedAt" = NOW()
              WHERE id = ${item.id}
            `;
            
            processedCount++;
            
            // 進捗表示
            if (processedCount % 50 === 0 || processedCount === knowledgeItems.length) {
              console.log(`Processed ${processedCount}/${knowledgeItems.length} items.`);
            }
          } catch (error) {
            console.error(`Error processing item ${item.id}:`, error);
          }
        })
      );
    }
    
    console.log(`Completed embedding generation for ${processedCount} items.`);
    return processedCount;
  } catch (error) {
    console.error('Error in generateAllKnowledgeEmbeddings:', error);
    throw error;
  }
}

/**
 * テキストに最も関連する知識エントリを検索する
 * @param query 検索クエリ
 * @param limit 取得する最大件数
 * @returns 関連度スコア付きの知識エントリ配列
 */
export async function searchSimilarKnowledge(query: string, limit: number = 10): Promise<Array<{ id: number; similarity: number }>> {
  try {
    if (!query || query.trim() === '') {
      return [];
    }
    
    // クエリの埋め込みベクトルを生成
    const queryEmbedding = await generateEmbedding(query);
    
    // コサイン類似度に基づいて類似した知識エントリを検索
    const results = await prisma.$queryRaw<Array<{ id: number; similarity: number }>>`
      SELECT id, 1 - (embedding_vector <=> ${queryEmbedding}::vector) as similarity
      FROM "Knowledge"
      WHERE embedding_vector IS NOT NULL
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
    
    return results;
  } catch (error) {
    console.error('Error in searchSimilarKnowledge:', error);
    return [];
  }
} 
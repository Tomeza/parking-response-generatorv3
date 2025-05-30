const { generateAllKnowledgeEmbeddings } = require('../src/lib/embeddings'); // この行のコメントを解除
const { prisma } = require('../src/lib/db'); // Prismaクライアントをインポート
// const OpenAI = require('openai'); // OpenAIを追加 // この行を削除

// OpenAI クライアント初期化 (src/lib/embeddings.ts から移動) // このセクション全体を削除
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// ベクトル埋め込みのキャッシュ (src/lib/embeddings.ts から移動) // このセクション全体を削除
// const embeddingCache = {}; 

/**
 * テキストの埋め込みベクトルを生成する (src/lib/embeddings.ts からコピー) // この関数全体を削除
 * @param text テキスト
 * @param targetDimensions オプションで次元数を受け取る
 * @returns 埋め込みベクトル
 */
// async function generateEmbedding(text, targetDimensions) { 
//   if (!text || text.trim() === '') {
//     return [];
//   }
//   const cacheKey = \`\${text.trim().toLowerCase()}_dim:\${targetDimensions || 'default'}\`;
//   if (embeddingCache[cacheKey]) {
//     return embeddingCache[cacheKey];
//   }
//   try {
//     const baseParams = {
//       model: 'text-embedding-3-small',
//       input: text.trim(),
//     };
//     const createParams = targetDimensions
//       ? { ...baseParams, dimensions: targetDimensions }
//       : baseParams;

//     const response = await openai.embeddings.create(createParams);
//     const embedding = response.data[0].embedding;
//     embeddingCache[cacheKey] = embedding;
//     return embedding;
//   } catch (error) {
//     console.error('Embedding generation error:', error);
//     throw new Error('Failed to generate embedding');
//   }
// }

async function main() {
  try {
    console.log('Starting population of embedding vectors...');

    // --- 512次元ベクトルを embedding_vector カラムに格納 ---
    console.log('\nPopulating 512-dimension vectors into "embedding_vector" column...');
    const count512 = await generateAllKnowledgeEmbeddings(512, "embedding_vector");
    console.log(`Successfully populated ${count512} records into "embedding_vector" with 512-dimension vectors.`);

    // --- 1536次元ベクトルを embedding_vector_1536 カラムに格納 ---
    console.log('\nPopulating 1536-dimension vectors into "embedding_vector_1536" column...');
    const count1536 = await generateAllKnowledgeEmbeddings(1536, "embedding_vector_1536");
    console.log(`Successfully populated ${count1536} records into "embedding_vector_1536" with 1536-dimension vectors.`);

    console.log('\nEmbedding vector population completed.');

  } catch (error) {
    console.error('Error during embedding vector population:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect(); // Prismaクライアントを切断
  }
}

main(); 
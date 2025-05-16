// 全Knowledgeレコードに対するEmbeddingベクトル生成スクリプト
const { generateAllKnowledgeEmbeddings } = require('../src/lib/embeddings');

async function main() {
  try {
    console.log('Embedding生成を開始しています...');
    const count = await generateAllKnowledgeEmbeddings();
    console.log(`${count}件のKnowledgeにEmbeddingを生成しました。`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main(); 
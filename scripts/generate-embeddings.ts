import { generateAllKnowledgeEmbeddings } from '../src/lib/embeddings';

// スクリプトの実行
async function main() {
  console.log('知識ベース埋め込みベクトル生成を開始します...');
  
  try {
    // 埋め込みベクトルを生成
    const processedCount = await generateAllKnowledgeEmbeddings();
    
    console.log(`埋め込みベクトル生成が完了しました。${processedCount}件の知識データを処理しました。`);
  } catch (error) {
    console.error('埋め込みベクトル生成中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  }); 
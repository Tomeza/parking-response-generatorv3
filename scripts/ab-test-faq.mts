import { PrismaClient } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.7
});

const evaluatorLLM = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.2
});

const outputParser = new StringOutputParser();

interface QualityMetrics {
  accuracy: number;    // 情報の正確性（1-5）
  completeness: number; // 情報の網羅性（1-5）
  clarity: number;     // 説明の明確さ（1-5）
  consistency: number; // 表現の一貫性（1-5）
  naturalness: number; // 自然な日本語（1-5）
}

interface TestResult {
  query: string;
  rawResponse: string;
  refinedResponse: string;
  metrics: {
    responseTime: {
      raw: number;
      refined: number;
    };
    tokenCount: {
      raw: number;
      refined: number;
    };
    quality: {
      raw: QualityMetrics;
      refined: QualityMetrics;
    };
  };
}

const promptTemplate = PromptTemplate.fromTemplate(`
以下のコンテキストを元に、質問に丁寧に答えてください：

コンテキスト：
{context}

質問：
{query}

回答：`);

const evaluationPrompt = PromptTemplate.fromTemplate(`
以下の回答の品質を評価してください。

回答：
{response}

質問：
{query}

各項目を1（低品質）から5（高品質）で評価し、以下の形式で出力してください：

評価基準：
1. accuracy（正確性）: 回答が質問に正確に答えているか
2. completeness（網羅性）: 必要な情報が漏れなく含まれているか
3. clarity（明確さ）: 説明が明確で分かりやすいか
4. consistency（一貫性）: 表現や用語が一貫しているか
5. naturalness（自然さ）: 日本語として自然で読みやすいか

評価結果を1行のJSONで出力してください。`);

async function getResponse(question: string, answer: string): Promise<string> {
  const chain = promptTemplate.pipe(llm).pipe(outputParser);
  return await chain.invoke({
    context: answer,
    query: question
  });
}

async function evaluateResponse(response: string, query: string): Promise<QualityMetrics> {
  const chain = evaluationPrompt.pipe(evaluatorLLM).pipe(outputParser);
  const evaluationResult = await chain.invoke({
    response,
    query
  });
  return JSON.parse(evaluationResult);
}

async function runABTest(testQueries: string[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const query of testQueries) {
    console.log(`Testing query: ${query}`);
    
    // Raw FAQテスト
    const rawStart = Date.now();
    const rawFaq = await prisma.faqRaw.findFirst({
      where: {
        question: {
          contains: query
        }
      }
    });
    const rawResponse = rawFaq ? await getResponse(query, rawFaq.answer) : "回答が見つかりませんでした。";
    const rawTime = Date.now() - rawStart;
    const rawQuality = await evaluateResponse(rawResponse, query);

    // Refined FAQテスト
    const refinedStart = Date.now();
    const refinedFaq = await prisma.faqRefined.findFirst({
      where: {
        question: {
          contains: query
        }
      }
    });
    const refinedResponse = refinedFaq ? await getResponse(query, refinedFaq.answer) : "回答が見つかりませんでした。";
    const refinedTime = Date.now() - refinedStart;
    const refinedQuality = await evaluateResponse(refinedResponse, query);

    results.push({
      query,
      rawResponse,
      refinedResponse,
      metrics: {
        responseTime: {
          raw: rawTime,
          refined: refinedTime
        },
        tokenCount: {
          raw: rawResponse.split(' ').length,
          refined: refinedResponse.split(' ').length
        },
        quality: {
          raw: rawQuality,
          refined: refinedQuality
        }
      }
    });
  }

  return results;
}

async function generateReport(results: TestResult[]) {
  const report = {
    timestamp: new Date().toISOString(),
    totalQueries: results.length,
    averageMetrics: {
      responseTime: {
        raw: 0,
        refined: 0
      },
      tokenCount: {
        raw: 0,
        refined: 0
      },
      quality: {
        raw: {
          accuracy: 0,
          completeness: 0,
          clarity: 0,
          consistency: 0,
          naturalness: 0
        },
        refined: {
          accuracy: 0,
          completeness: 0,
          clarity: 0,
          consistency: 0,
          naturalness: 0
        }
      }
    },
    detailedResults: results
  };

  // 平均値の計算
  report.averageMetrics.responseTime.raw = 
    results.reduce((acc, r) => acc + r.metrics.responseTime.raw, 0) / results.length;
  report.averageMetrics.responseTime.refined = 
    results.reduce((acc, r) => acc + r.metrics.responseTime.refined, 0) / results.length;
  report.averageMetrics.tokenCount.raw = 
    results.reduce((acc, r) => acc + r.metrics.tokenCount.raw, 0) / results.length;
  report.averageMetrics.tokenCount.refined = 
    results.reduce((acc, r) => acc + r.metrics.tokenCount.refined, 0) / results.length;

  // 品質指標の平均値計算
  const qualityMetrics = ['accuracy', 'completeness', 'clarity', 'consistency', 'naturalness'] as const;
  for (const metric of qualityMetrics) {
    report.averageMetrics.quality.raw[metric] = 
      results.reduce((acc, r) => acc + r.metrics.quality.raw[metric], 0) / results.length;
    report.averageMetrics.quality.refined[metric] = 
      results.reduce((acc, r) => acc + r.metrics.quality.refined[metric], 0) / results.length;
  }

  // レポートの保存
  const reportsDir = path.join(path.dirname(__dirname), 'test-results');
  const filename = `faq-ab-test-${report.timestamp.split('T')[0]}.json`;
  const filepath = path.join(reportsDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${filepath}`);

  return report;
}

// テストの実行
const testQueries = [
  // 基本的な質問
  "駐車場の予約方法を教えてください",
  "キャンセルはいつまでできますか",
  "支払い方法は何がありますか",
  "予約の変更は可能ですか",
  "領収書は発行できますか",
  // 複雑な質問
  "予約した駐車場に入れない場合はどうすればいいですか",
  "台風や大雨の場合のキャンセルについて教えてください",
  "予約した時間に遅れそうな場合はどうすればいいですか",
  "月極駐車場への切り替えは可能ですか",
  "電気自動車の充電設備がある駐車場を探したいのですが"
];

async function main() {
  try {
    console.log('Starting A/B test...');
  const results = await runABTest(testQueries);
  const report = await generateReport(results);
    
    console.log('\nTest completed. Summary:');
  console.log(`Total queries tested: ${report.totalQueries}`);
    
    console.log('\nAverage response times:');
  console.log(`  Raw: ${report.averageMetrics.responseTime.raw}ms`);
  console.log(`  Refined: ${report.averageMetrics.responseTime.refined}ms`);
    
    console.log('\nAverage token counts:');
  console.log(`  Raw: ${report.averageMetrics.tokenCount.raw}`);
  console.log(`  Refined: ${report.averageMetrics.tokenCount.refined}`);
    
    console.log('\nQuality metrics (1-5 scale):');
    console.log('Raw:');
    Object.entries(report.averageMetrics.quality.raw).forEach(([metric, score]) => {
      console.log(`  ${metric}: ${score.toFixed(2)}`);
    });
    console.log('Refined:');
    Object.entries(report.averageMetrics.quality.refined).forEach(([metric, score]) => {
      console.log(`  ${metric}: ${score.toFixed(2)}`);
    });
    
    console.log('\nDetailed results have been saved to the report file.');
  } catch (error) {
    console.error('Error during A/B test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
main().catch(console.error); 
}

export { runABTest, generateReport }; 
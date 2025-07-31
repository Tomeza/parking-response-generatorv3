import { PrismaClient } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { HumanMessage } from '@langchain/core/messages';

const prisma = new PrismaClient();
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.2
});

// 複雑度評価用のプロンプト
const complexityPrompt = PromptTemplate.fromTemplate(`
以下のFAQの複雑度を評価してください。

質問：
{question}

回答：
{answer}

以下の基準で1から3の数値で評価してください：

1: 基本的
- 単純な情報提供のみ
- 条件分岐なし
- 一つの明確な手順や情報

2: 中程度
- 複数の情報や条件を含む
- 簡単な条件分岐あり
- 複数のステップや選択肢

3: 複雑
- 多くの条件分岐
- 例外ケースの説明
- 複雑なビジネスルール
- 複数の関連トピックの組み合わせ

次のフォーマットで1行のJSONで出力してください：

出力例：
"complexity": 1
"reason": "単純な情報提供のみで、条件分岐なし"
"key_factors": ["単純な情報", "明確な手順"]`);
  

interface ComplexityEvaluation {
  complexity: number;
  reason: string;
  key_factors: string[];
}

interface FaqSummary {
  id: number;
  question: string;
  complexity: number;
  reason: string;
  key_factors: string[];
}

async function evaluateComplexity(question: string, answer: string): Promise<ComplexityEvaluation> {
  try {
    const formattedPrompt = await complexityPrompt.format({
      question,
      answer
    });
    const response = await llm.invoke([{
      role: 'user',
      content: formattedPrompt.toString()
    }]);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    return JSON.parse(content);
  } catch (error) {
    console.error('評価中にエラーが発生しました:', error);
    throw error;
  }
}

async function evaluateAllFaqs() {
  try {
    console.log('FAQ複雑度評価を開始します...\n');

    // 全FAQを取得
    const faqs = await prisma.faqRaw.findMany({
      orderBy: { id: 'asc' }
    });

    console.log(`${faqs.length}件のFAQを評価します...\n`);

    let complexityStats = {
      basic: 0,    // 複雑度1
      moderate: 0, // 複雑度2
      complex: 0   // 複雑度3
    };

    // 評価結果のサマリー
    let evaluationSummary: FaqSummary[] = [];

    // 各FAQを評価
    for (const faq of faqs) {
      console.log(`FAQ ID ${faq.id} を評価中...`);
      console.log(`質問: ${faq.question}`);
      
      const evaluation = await evaluateComplexity(faq.question, faq.answer);
      
      // 統計を更新
      switch (evaluation.complexity) {
        case 1: complexityStats.basic++; break;
        case 2: complexityStats.moderate++; break;
        case 3: complexityStats.complex++; break;
      }

      // 評価結果を保存
      await prisma.faqRaw.update({
        where: { id: faq.id },
        data: {
          complexity: evaluation.complexity,
          requires_review: evaluation.complexity >= 3,
          review_reason: evaluation.complexity >= 3 ? '複雑度が高い' : null
        }
      });

      // サマリーに追加
      evaluationSummary.push({
        id: faq.id,
        question: faq.question,
        complexity: evaluation.complexity,
        reason: evaluation.reason,
        key_factors: evaluation.key_factors
      });

      // 進捗表示
      console.log(`評価完了: 複雑度 ${evaluation.complexity}`);
      console.log(`理由: ${evaluation.reason}\n`);
    }

    // 結果レポートの出力
    console.log('\n=== FAQ複雑度評価レポート ===\n');
    console.log('統計サマリー:');
    console.log(`- 基本的 (複雑度1): ${complexityStats.basic}件`);
    console.log(`- 中程度 (複雑度2): ${complexityStats.moderate}件`);
    console.log(`- 複雑  (複雑度3): ${complexityStats.complex}件`);
    console.log(`- レビュー要: ${complexityStats.complex}件\n`);

    console.log('詳細評価結果:');
    evaluationSummary.forEach(summary => {
      console.log('\n---');
      console.log(`FAQ ID: ${summary.id}`);
      console.log(`質問: ${summary.question}`);
      console.log(`複雑度: ${summary.complexity}`);
      console.log(`評価理由: ${summary.reason}`);
      console.log('主な要因:');
      summary.key_factors.forEach(factor => console.log(`- ${factor}`));
    });

    // レビュー要のFAQをハイライト
    const reviewRequired = evaluationSummary.filter(s => s.complexity >= 3);
    if (reviewRequired.length > 0) {
      console.log('\n=== 要レビューFAQ ===');
      reviewRequired.forEach(faq => {
        console.log('\n---');
        console.log(`FAQ ID: ${faq.id}`);
        console.log(`質問: ${faq.question}`);
        console.log(`複雑度: ${faq.complexity}`);
        console.log(`理由: ${faq.reason}`);
      });
    }

  } catch (error) {
    console.error('評価中にエラーが発生しました:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトの実行
console.log('FAQ複雑度評価スクリプトを開始します...\n');
evaluateAllFaqs(); 
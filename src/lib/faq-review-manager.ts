import { PrismaClient } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.3
});

// 複雑度評価用のプロンプト
const complexityPrompt = PromptTemplate.fromTemplate(`
以下のFAQの複雑度を評価してください。

質問：
{question}

回答：
{answer}

以下の基準で1から3の数値で評価してください：
1: 基本的 - 単純な情報提供のみ
2: 中程度 - 複数の情報や条件を含む
3: 複雑 - 多くの条件分岐や専門的な情報を含む

出力形式：
数値のみを出力してください。
`);

// 品質チェック用のプロンプト
const qualityCheckPrompt = PromptTemplate.fromTemplate(`
以下のFAQの品質をチェックしてください。

質問：
{question}

回答：
{answer}

以下の点について評価し、問題がある場合は具体的な改善点を指摘してください：
1. 正確性 - 情報は正確か
2. 完全性 - 必要な情報が漏れていないか
3. 明確性 - 説明は分かりやすいか
4. 一貫性 - 用語や表現は統一されているか
5. 適切性 - 質問に適切に答えているか

出力形式：
{
  "hasIssues": true/false,
  "issues": [
    {
      "type": "正確性/完全性/明確性/一貫性/適切性",
      "description": "具体的な問題点",
      "suggestion": "改善案"
    }
  ]
}
`);

// クエリハッシュ生成関数
function generateQueryHash(text: string = ''): string {
  return createHash('sha256').update(text).digest('hex');
}

export class FaqReviewManager {
  // 複雑度の評価
  static async evaluateComplexity(question: string, answer: string): Promise<number> {
    const prompt = await complexityPrompt.format({
      question,
      answer
    });
    const response = await llm.predict(prompt);
    return parseInt(response.trim());
  }

  // 品質チェック
  static async checkQuality(question: string, answer: string): Promise<any> {
    const prompt = await qualityCheckPrompt.format({
      question,
      answer
    });
    const response = await llm.predict(prompt);
    return JSON.parse(response);
  }

  // レビュートリガーの確認
  static async checkReviewTriggers(faqId: number): Promise<{
    requiresReview: boolean;
    reason?: string;
  }> {
    // FAQの情報を取得
    const faq = await prisma.faqRaw.findUnique({
      where: { id: faqId }
    });

    if (!faq) {
      throw new Error(`FAQ not found: ${faqId}`);
    }

    // アクティブなトリガー条件を取得
    const triggers = await prisma.faqReviewTriggers.findMany({
      where: { isActive: true }
    });

    for (const trigger of triggers) {
      const threshold = trigger.threshold as any;

      switch (trigger.conditionType) {
        case 'complexity':
          if (faq.complexity >= threshold.min_level) {
            return {
              requiresReview: true,
              reason: `複雑度が高い (${faq.complexity})`
            };
          }
          break;

        case 'feedback':
          const timeframe = new Date();
          timeframe.setHours(timeframe.getHours() - threshold.timeframe_hours);
          
          // 期間内の否定的フィードバック数を確認
          const recentNegativeFeedback = await prisma.faqUsageStats.count({
            where: {
              faqId,
              success: false,
              usedAt: { gte: timeframe }
            }
          });

          if (recentNegativeFeedback >= threshold.negative_count) {
            return {
              requiresReview: true,
              reason: `否定的フィードバックが多い (${recentNegativeFeedback}件)`
            };
          }
          break;

        case 'usage_frequency':
          const timeframe2 = new Date();
          timeframe2.setDate(timeframe2.getDate() - threshold.timeframe_days);
          
          // 期間内の使用回数を確認
          const recentQueryCount = await prisma.faqUsageStats.count({
            where: {
              faqId,
              usedAt: { gte: timeframe2 }
            }
          });

          if (recentQueryCount >= threshold.min_queries) {
            return {
              requiresReview: true,
              reason: `使用頻度が高い (${recentQueryCount}回)`
            };
          }
          break;
      }
    }

    return { requiresReview: false };
  }

  // 使用統計の更新
  static async updateUsageStats(faqId: number, feedback?: 'positive' | 'negative'): Promise<void> {
    await prisma.faqUsageStats.create({
      data: {
        faqId,
        queryHash: generateQueryHash(),
        queryText: "",
        route: "review",
        latencyMs: 0,
        success: feedback === 'positive'
      }
    });

    // レビュートリガーの確認
    const { requiresReview, reason } = await this.checkReviewTriggers(faqId);
    if (requiresReview) {
      await prisma.faqRaw.update({
        where: { id: faqId },
        data: {
          requires_review: true,
          review_reason: reason
        }
      });
    }
  }

  // レビュー履歴の記録
  static async recordReview(
    faqId: number,
    originalAnswer: string,
    refinedAnswer: string,
    reviewType: string,
    reviewer?: string
  ): Promise<void> {
    await prisma.faqReviewHistory.create({
      data: {
        faqId,
        originalAnswer,
        refinedAnswer,
        reviewType,
        reviewer
      }
    });

    // レビュー完了後、requires_reviewフラグをリセット
    await prisma.faqRaw.update({
      where: { id: faqId },
      data: {
        requires_review: false,
        review_reason: null
      }
    });
  }
} 
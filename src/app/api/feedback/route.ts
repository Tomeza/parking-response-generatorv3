import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const { responseId, feedback } = await request.json();

    if (!responseId || typeof feedback !== 'boolean') {
      return NextResponse.json(
        { error: 'レスポンスIDとフィードバックの値が必要です' },
        { status: 400 }
      );
    }

    // レスポンスログのフィードバックを更新
    const updatedLog = await prisma.responseLog.update({
      where: { id: responseId },
      data: { feedback },
    });

    // フィードバックに基づいてナレッジの重みを更新
    if (updatedLog.knowledge_id) {
      const queryPattern = updatedLog.query.slice(0, 100); // クエリパターンを取得（最大100文字）
      
      // 既存のフィードバック重みを検索
      const existingWeight = await prisma.feedbackWeight.findFirst({
        where: {
          query_pattern: queryPattern,
          knowledge_id: updatedLog.knowledge_id,
        },
      });

      if (existingWeight) {
        // 既存の重みを更新
        await prisma.feedbackWeight.update({
          where: {
            query_pattern_knowledge_id: {
              query_pattern: queryPattern,
              knowledge_id: updatedLog.knowledge_id,
            }
          },
          data: {
            positive_count: feedback ? existingWeight.positive_count + 1 : existingWeight.positive_count,
            negative_count: !feedback ? existingWeight.negative_count + 1 : existingWeight.negative_count,
            weight: calculateNewWeight(
              existingWeight.weight,
              feedback,
              existingWeight.positive_count,
              existingWeight.negative_count
            ),
            last_updated: new Date(),
          },
        });
      } else {
        // 新しい重みを作成
        await prisma.feedbackWeight.create({
          data: {
            query_pattern: queryPattern,
            knowledge_id: updatedLog.knowledge_id,
            weight: feedback ? 1.2 : 0.8, // 初期重み
            positive_count: feedback ? 1 : 0,
            negative_count: feedback ? 0 : 1,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('フィードバック更新エラー:', error);
    return NextResponse.json(
      { error: 'フィードバックの更新中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * フィードバックに基づいて新しい重みを計算
 * @param currentWeight 現在の重み
 * @param isPositive ポジティブフィードバックかどうか
 * @param positiveCount ポジティブフィードバックの数
 * @param negativeCount ネガティブフィードバックの数
 * @returns 新しい重み
 */
function calculateNewWeight(
  currentWeight: number,
  isPositive: boolean,
  positiveCount: number,
  negativeCount: number
): number {
  const totalCount = positiveCount + negativeCount;
  const baseAdjustment = 0.1; // 基本調整値
  const confidenceFactor = Math.min(totalCount / 10, 1); // 信頼度係数（最大1）

  if (isPositive) {
    return currentWeight + (baseAdjustment * confidenceFactor);
  } else {
    return currentWeight - (baseAdjustment * confidenceFactor);
  }
} 
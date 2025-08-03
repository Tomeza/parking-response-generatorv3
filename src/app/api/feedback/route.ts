import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { routingLogId, isCorrect, correctionType, correctedValue, feedbackText } = await request.json();

    if (routingLogId === undefined || isCorrect === undefined) {
      return NextResponse.json(
        { error: 'routingLogId and isCorrect are required' },
        { status: 400 }
      );
    }

    const feedback = await prisma.feedbackLogs.create({
      data: {
        routing_log_id: routingLogId,
        is_correct: isCorrect,
        correction_type: correctionType || null,
        corrected_value: correctedValue || null,
        feedback_text: feedbackText || null,
        user_id: null // 将来的に認証から取得
      }
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
} 
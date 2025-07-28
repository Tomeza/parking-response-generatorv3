import { OpenAI } from "openai";
import { z } from "zod";

const categorySchema = z.object({
  category: z.enum(['予約', '送迎', '支払い', '設備', 'トラブル', 'その他']),
  confidence: z.number().min(0).max(1),
  reason: z.string()
});

const SYSTEM_PROMPT = `あなたはFAQのカテゴリ分類を行うエキスパートです。
駐車場予約サービスに関するFAQの質問と回答を分析し、最も適切なカテゴリを選択してください。

カテゴリは以下から選択してください：

1. 予約
   - 予約の作成・変更・キャンセル
   - 予約可能期間、締切時間
   - 予約の確認方法、予約番号
   - 複数日程の予約、定期予約

2. 送迎
   - 送迎サービスの利用方法
   - 定員制限、同乗者数
   - 対応可能な車種、サイズ
   - 送迎ルート、時間帯

3. 支払い
   - 料金体系、割引
   - 支払方法（現金、カード、電子マネー）
   - 領収書発行、請求書
   - 返金、キャンセル料

4. 設備
   - 駐車場の物理的設備（高さ制限、車止め）
   - EV充電設備、充電方式
   - 照明、防犯カメラ
   - トイレ、待合所

5. トラブル
   - 緊急時の連絡先、対応手順
   - 入出庫トラブル、機器故障
   - 事故、損傷、紛失
   - システム障害、アプリ不具合

6. その他
   - 上記カテゴリに明確に分類できない内容
   - 複数カテゴリに跨る一般的な質問
   - 新規サービスや特殊なケース

出力形式:
{
  "category": "選択したカテゴリ",
  "confidence": 0-1の数値,
  "reason": "なぜこのカテゴリが最適なのか、以下の点を含めて3行程度で説明してください：
            1. 質問の主要な意図や目的
            2. 回答内容の中心的なトピック
            3. 他のカテゴリと比較して、なぜこのカテゴリが最適か"
}

注意事項：
1. 複数のカテゴリに関連する場合は、質問の主要な意図を重視して判断してください
2. confidenceは以下の基準で判断してください：
   - 1.0: カテゴリが完全に明確で迷いがない
   - 0.9: 主要なカテゴリは明確だが、副次的な要素を含む
   - 0.8: 適切なカテゴリだが、他の選択肢も検討の余地がある
   - 0.7以下: カテゴリの判断に重要な迷いがある
3. confidence < 0.8の場合は人手でのレビューが必要になります`;

export interface CategoryClassificationResult {
  category: string;
  confidence: number;
  reason: string;
  shouldReview: boolean;
  reviewReason?: string;
}

export async function classifyFaqCategory(faq: { question: string; answer: string }): Promise<CategoryClassificationResult> {
  const openai = new OpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `
質問: ${faq.question}
回答: ${faq.answer}

上記のFAQを分析し、最適なカテゴリを選択してください。` }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI APIからの応答が空です');
    }

    const result = categorySchema.parse(JSON.parse(content));
    
    return {
      category: result.category,
      confidence: result.confidence,
      reason: result.reason,
      shouldReview: result.confidence < 0.8,
      reviewReason: result.confidence < 0.8 
        ? `低信頼度 (${(result.confidence * 100).toFixed(1)}%): ${result.reason}`
        : undefined
    };
  } catch (error) {
    console.error('カテゴリ分類エラー:', error);
    
    // Zodバリデーションエラーの場合は詳細を記録
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        category: 'その他',
        confidence: 0,
        reason: '分類スキーマ検証エラー',
        shouldReview: true,
        reviewReason: `スキーマ検証失敗: ${errorDetails}`
      };
    }

    // その他のエラーの場合
    return {
      category: 'その他',
      confidence: 0,
      reason: 'カテゴリ分類処理エラー',
      shouldReview: true,
      reviewReason: `処理エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
    };
  }
} 
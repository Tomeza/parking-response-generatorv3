import { OpenAI } from 'openai';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export interface FallbackResponse {
  response: string;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
}

export class FallbackGenerator {
  private readonly SAFETY_PROMPT = `
あなたは駐車場のカスタマーサポートAIです。
以下の安全ガイドラインを必ず守ってください：

1. **個人情報の保護**: 名前、電話番号、車両番号などの個人情報を絶対に収集・保存しない
2. **法的アドバイスの回避**: 法的な助言は行わず、専門家への相談を促す
3. **緊急時の適切な対応**: 事故や故障の場合は、安全確保を最優先に
4. **正確性の確保**: 不確実な情報は提供せず、確認が必要な場合はその旨を伝える
5. **丁寧な対応**: 常に丁寧で親切な口調を保つ

質問に対して適切で安全な回答を提供してください。
`;

  private readonly FALLBACK_PROMPT = `
駐車場に関する質問に対して、以下の方針で回答してください：

1. **情報が見つからない場合**:
   - 申し訳ございませんが、ご質問に対する具体的な情報が見つかりませんでした
   - 別の表現で質問していただくか、お電話でのお問い合わせをお勧めします

2. **確認が必要な場合**:
   - より詳しい情報をいただけますでしょうか
   - 具体的な状況をお教えください

3. **緊急時の場合**:
   - 安全を最優先に行動してください
   - 必要に応じて緊急連絡先をご案内します

4. **一般的な案内**:
   - 駐車場の基本情報（営業時間、料金体系など）
   - よくある質問への回答
   - お問い合わせ方法の案内

回答は必ず安全で、個人情報を保護し、法的リスクを避ける内容にしてください。
`;

  async generateFallbackResponse(
    query: string,
    analysis: any,
    context?: string
  ): Promise<FallbackResponse> {
    try {
      const systemPrompt = `${this.SAFETY_PROMPT}\n\n${this.FALLBACK_PROMPT}`;
      
      const userPrompt = `
質問: "${query}"
分析結果: ${JSON.stringify(analysis, null, 2)}
${context ? `コンテキスト: ${context}` : ''}

上記の質問に対して、安全で適切な回答を提供してください。
回答は日本語で、丁寧で親切な口調でお願いします。
`;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.3, // 低めの温度で一貫性を保つ
        max_tokens: 500
      });

      const generatedResponse = response.choices[0]?.message?.content || '';
      
      // 信頼度の推定（簡易版）
      const confidence = this.estimateConfidence(query, analysis, generatedResponse);
      
      // 推奨アクションの生成
      const suggestedActions = this.generateSuggestedActions(query, analysis);
      
      return {
        response: generatedResponse,
        confidence,
        reasoning: `Fallback response generated due to no exact template match. Analysis: ${analysis.category}/${analysis.intent}/${analysis.tone}`,
        suggestedActions
      };
    } catch (error) {
      console.error('Error generating fallback response:', error);
      
      // エラー時の安全なフォールバック
      return {
        response: "申し訳ございませんが、現在システムに問題が発生しております。お電話でのお問い合わせをお勧めいたします。",
        confidence: 0.1,
        reasoning: "Error in fallback generation - using safe default response",
        suggestedActions: ["電話でのお問い合わせ", "しばらく時間をおいて再度お試しください"]
      };
    }
  }

  private estimateConfidence(query: string, analysis: any, response: string): number {
    // 簡易的な信頼度推定
    let confidence = 0.5; // ベースライン
    
    // 分析結果の信頼度を反映
    if (analysis.confidence) {
      confidence = Math.min(confidence + analysis.confidence * 0.3, 0.9);
    }
    
    // レスポンスの長さを考慮
    if (response.length > 50 && response.length < 300) {
      confidence += 0.1;
    }
    
    // 安全キーワードの存在を確認
    const safetyKeywords = ['申し訳ございません', 'お問い合わせ', 'ご案内', 'お勧め'];
    const hasSafetyKeywords = safetyKeywords.some(keyword => response.includes(keyword));
    if (hasSafetyKeywords) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.9);
  }

  private generateSuggestedActions(query: string, analysis: any): string[] {
    const actions: string[] = [];
    
    // カテゴリに基づく推奨アクション
    switch (analysis.category) {
      case 'trouble':
        actions.push('緊急時の場合は安全を最優先に行動してください');
        actions.push('お電話でのお問い合わせをお勧めします');
        break;
      case 'reservation':
        actions.push('予約システムでの直接操作をお勧めします');
        actions.push('お電話での予約変更も可能です');
        break;
      case 'payment':
        actions.push('精算機での直接操作をお勧めします');
        actions.push('お電話でのお問い合わせも可能です');
        break;
      default:
        actions.push('お電話でのお問い合わせをお勧めします');
        actions.push('別の表現で質問していただくことも可能です');
    }
    
    return actions;
  }

  // 安全チェック関数
  validateResponse(response: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // 個人情報のチェック
    const personalInfoPatterns = [
      /\d{4}-\d{4}-\d{4}/, // 電話番号
      /[A-Z]{2,3}\s?\d{1,4}\s?[A-Z]{1,2}\s?\d{1,4}/, // 車両番号
      /[0-9]{7}/, // 7桁の数字（個人情報の可能性）
    ];
    
    personalInfoPatterns.forEach(pattern => {
      if (pattern.test(response)) {
        issues.push('個人情報が含まれている可能性があります');
      }
    });
    
    // 法的アドバイスのチェック
    const legalAdviceKeywords = ['法的', '法律', '訴訟', '賠償', '責任'];
    if (legalAdviceKeywords.some(keyword => response.includes(keyword))) {
      issues.push('法的アドバイスが含まれている可能性があります');
    }
    
    // 不適切な約束のチェック
    const inappropriatePromises = ['必ず', '絶対に', '確実に', '保証します'];
    if (inappropriatePromises.some(promise => response.includes(promise))) {
      issues.push('不適切な約束が含まれている可能性があります');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

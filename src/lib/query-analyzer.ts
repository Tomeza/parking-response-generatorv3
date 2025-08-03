import { OpenAI } from 'openai';

export interface QueryAnalysis {
  category: string;
  intent: string;
  tone: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
}

export class QueryAnalyzer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyze(query: string): Promise<QueryAnalysis> {
    const systemPrompt = `
あなたは駐車場サービスに関する質問の意図を正確に理解するエキスパートです。

以下の要素をJSON形式で抽出してください：

**カテゴリ（必須）:**
- reservation: 予約関連（予約作成、変更、確認、キャンセル）
- payment: 支払い関連（料金、支払い方法、請求書）
- shuttle: 送迎関連（送迎サービス、時間、場所）
- facility: 設備関連（充電器、屋根、バリアフリー）
- trouble: トラブル関連（事故、故障、苦情）
- other: その他（営業時間、問い合わせ等）

**意図（必須）:**
- create: 新規作成
- check: 確認・照会
- modify: 変更・修正
- cancel: キャンセル・削除
- report: 報告・通知
- inquiry: 問い合わせ

**トーン（必須）:**
- urgent: 緊急（即座の対応が必要）
- normal: 通常（一般的な対応）
- future: 将来（事前確認・準備）

**緊急度（必須）:**
- low: 低（1週間以内で対応可能）
- medium: 中（24時間以内で対応必要）
- high: 高（即座の対応が必要）

各判断には確信度（0-1）を付けてください。
判断理由も含めてください。

出力形式（JSON）：
{
  "category": "reservation",
  "intent": "check", 
  "tone": "normal",
  "urgency": "medium",
  "confidence": 0.95,
  "reasoning": "予約の確認を求めているため、reservation/check/normal/medium"
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `質問: ${query}` }
        ],
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return this.validateAndNormalizeAnalysis(analysis);
    } catch (error) {
      console.error('QueryAnalyzer error:', error);
      // フォールバック: 基本的なルールベース解析
      return this.fallbackAnalysis(query);
    }
  }

  private validateAndNormalizeAnalysis(analysis: any): QueryAnalysis {
    const validCategories = ['reservation', 'payment', 'shuttle', 'facility', 'trouble', 'access', 'vehicle', 'information', 'disclaimer', 'general', 'other'];
    const validIntents = ['create', 'check', 'modify', 'cancel', 'report', 'inquiry'];
    const validTones = ['urgent', 'normal', 'future'];
    const validUrgencies = ['low', 'medium', 'high'];

    return {
      category: validCategories.includes(analysis.category) ? analysis.category : 'other',
      intent: validIntents.includes(analysis.intent) ? analysis.intent : 'inquiry',
      tone: validTones.includes(analysis.tone) ? analysis.tone : 'normal',
      urgency: validUrgencies.includes(analysis.urgency) ? analysis.urgency : 'medium',
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      metadata: {
        reasoning: analysis.reasoning || '',
        originalQuery: analysis.originalQuery || '',
        timestamp: new Date().toISOString()
      }
    };
  }

  private fallbackAnalysis(query: string): QueryAnalysis {
    // 基本的なキーワードベースの解析
    const lowerQuery = query.toLowerCase();
    
    let category = 'other';
    if (lowerQuery.includes('予約') || lowerQuery.includes('reservation')) category = 'reservation';
    else if (lowerQuery.includes('支払い') || lowerQuery.includes('payment') || lowerQuery.includes('料金')) category = 'payment';
    else if (lowerQuery.includes('送迎') || lowerQuery.includes('shuttle')) category = 'shuttle';
    else if (lowerQuery.includes('設備') || lowerQuery.includes('facility')) category = 'facility';
    else if (lowerQuery.includes('トラブル') || lowerQuery.includes('trouble')) category = 'trouble';
    else if (lowerQuery.includes('アクセス') || lowerQuery.includes('access') || lowerQuery.includes('googlemap') || lowerQuery.includes('住所') || lowerQuery.includes('経路')) category = 'access';
    else if (lowerQuery.includes('車両') || lowerQuery.includes('vehicle') || lowerQuery.includes('車種') || lowerQuery.includes('鍵')) category = 'vehicle';
    else if (lowerQuery.includes('情報') || lowerQuery.includes('information') || lowerQuery.includes('記入') || lowerQuery.includes('個人情報')) category = 'information';
    else if (lowerQuery.includes('免責') || lowerQuery.includes('disclaimer') || lowerQuery.includes('責任') || lowerQuery.includes('補償')) category = 'disclaimer';

    let intent = 'inquiry';
    if (lowerQuery.includes('作成') || lowerQuery.includes('create') || lowerQuery.includes('必要')) intent = 'create';
    else if (lowerQuery.includes('確認') || lowerQuery.includes('check')) intent = 'check';
    else if (lowerQuery.includes('変更') || lowerQuery.includes('modify')) intent = 'modify';
    else if (lowerQuery.includes('キャンセル') || lowerQuery.includes('cancel')) intent = 'cancel';
    else if (lowerQuery.includes('報告') || lowerQuery.includes('report')) intent = 'report';

    let tone = 'normal';
    if (lowerQuery.includes('緊急') || lowerQuery.includes('urgent')) tone = 'urgent';
    else if (lowerQuery.includes('将来') || lowerQuery.includes('future')) tone = 'future';

    let urgency: 'low' | 'medium' | 'high' = 'medium';
    if (lowerQuery.includes('緊急') || lowerQuery.includes('urgent')) urgency = 'high';
    else if (lowerQuery.includes('将来') || lowerQuery.includes('future')) urgency = 'low';

    return {
      category,
      intent,
      tone,
      urgency,
      confidence: 0.3, // フォールバックなので低い信頼度
      metadata: {
        reasoning: 'Fallback keyword-based analysis',
        originalQuery: query,
        timestamp: new Date().toISOString()
      }
    };
  }
} 
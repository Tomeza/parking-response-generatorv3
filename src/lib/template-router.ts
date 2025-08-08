import { QueryAnalysis } from './query-analyzer';
import { prisma } from '@/lib/prisma';

export interface Template {
  id: number;
  title: string;
  content: string;
  category: string;
  intent: string;
  tone: string;
  variables: Record<string, any>;
  version: number;
  is_approved: boolean;
  created_at: Date;
  updated_at: Date;
  // Phase2: タグ情報を追加
  replyTypeTags?: string[];
  infoSourceTags?: string[];
  situationTags?: string[];
}

export interface RoutingResult {
  template: Template | null;
  confidence: number;
  fallbackUsed: boolean;
  processingTimeMs: number;
  reasoning: string;
  alternatives: Template[];
  // Phase2: 受け入れ回し機能
  needsHumanReview: boolean;
  reviewReason: string;
  suggestedActions: string[];
}

export class TemplateRouter {
  async route(query: string, analysis: QueryAnalysis): Promise<RoutingResult> {
    const startTime = Date.now();
    
    try {
      console.log('TemplateRouter: Starting routing for analysis:', analysis);
      
      // 1. 厳格なフィルタによる検索（設計思想の「芯」）
      let template = await this.findExactMatch(analysis);
      let reasoning = 'Exact match found';
      let needsHumanReview = false;
      let reviewReason = '';
      
      // 2. フィルタ緩和による検索
      if (!template) {
        console.log('TemplateRouter: No exact match, trying partial match');
        template = await this.findPartialMatch(analysis);
        reasoning = 'Partial match found';
        needsHumanReview = true;
        reviewReason = 'Partial match used - exact category/intent/tone combination not found';
      }
      
      // 3. 最終手段としてのベクトル検索
      if (!template) {
        console.log('TemplateRouter: No partial match, trying similar template');
        template = await this.findSimilarTemplate(analysis);
        reasoning = 'Similar template found via vector search';
        needsHumanReview = true;
        reviewReason = 'Fallback template used - no direct matches found';
      }
      
      const processingTimeMs = Date.now() - startTime;
      
      console.log('TemplateRouter: Final template found:', !!template);
      
      // 代替候補を取得
      const alternatives = await this.findAlternatives(analysis, template?.id);
      
      // 受け入れ回し判定（Phase2）
      const { needsReview, reason, actions } = this.determineReviewNeeds(analysis, template, alternatives);
      needsHumanReview = needsReview;
      reviewReason = reason;
      
      // ログ記録
      analysis.metadata = {
        ...analysis.metadata,
        originalQuery: query,
      };
      await this.logRouting(query, analysis, template, processingTimeMs, reasoning, needsHumanReview, reviewReason);
      
      return {
        template,
        confidence: this.calculateConfidence(analysis, template),
        fallbackUsed: !template,
        processingTimeMs,
        reasoning,
        alternatives,
        needsHumanReview,
        reviewReason,
        suggestedActions: actions
      };
    } catch (error) {
      console.error('TemplateRouter error:', error);
      return {
        template: null,
        confidence: 0,
        fallbackUsed: true,
        processingTimeMs: Date.now() - startTime,
        reasoning: 'Error occurred during routing',
        alternatives: [],
        needsHumanReview: true,
        reviewReason: 'System error occurred',
        suggestedActions: ['Check system logs', 'Verify database connection']
      };
    }
  }

  private determineReviewNeeds(
    analysis: QueryAnalysis, 
    template: Template | null, 
    alternatives: Template[]
  ): { needsReview: boolean; reason: string; actions: string[] } {
    const actions: string[] = [];
    let needsReview = false;
    let reason = '';

    // 1. 信頼度が低い場合（閾値を0.6に調整）
    if (analysis.confidence < 0.6) {
      needsReview = true;
      reason = 'Low confidence in query analysis';
      actions.push('Review query analysis accuracy');
      actions.push('Consider adding training data');
    }

    // 2. 厳格フィルタでマッチしなかった場合
    if (!template || template.category !== analysis.category || 
        template.intent !== analysis.intent || template.tone !== analysis.tone) {
      needsReview = true;
      reason = 'No exact template match found';
      actions.push('Review template coverage');
      actions.push('Consider creating new template');
    }

    // 3. 代替候補が少ない場合
    if (alternatives.length < 2) {
      needsReview = true;
      reason = 'Limited alternative templates available';
      actions.push('Expand template library');
      actions.push('Review category coverage');
    }

    // 4. 緊急度が高い場合（緊急・特殊タグのみ人間確認）
    if (analysis.urgency === 'high' && this.hasUrgentTags(template)) {
      needsReview = true;
      reason = 'High urgency query with urgent tags requires human review';
      actions.push('Immediate human intervention needed');
      actions.push('Escalate to support team');
    }

    // 5. 低リスク問い合わせの自動通過（新しいルール）
    if (this.isLowRiskQuery(analysis, template)) {
      needsReview = false;
      reason = 'Low risk query - auto approved';
    }

    return { needsReview, reason, actions };
  }

  private hasUrgentTags(template: Template | null): boolean {
    if (!template) return false;
    
    const urgentTags = ['緊急対応', '事故対応', '故障対応', 'セキュリティ'];
    const replyTags = template.replyTypeTags || [];
    const situationTags = template.situationTags || [];
    
    return [...replyTags, ...situationTags].some(tag => 
      urgentTags.some(urgent => tag.includes(urgent))
    );
  }

  private isLowRiskQuery(analysis: QueryAnalysis, template: Template | null): boolean {
    // 低リスク条件の定義
    const lowRiskConditions = [
      // 通常の問い合わせ
      analysis.tone === 'normal' && analysis.urgency === 'low',
      // 一般的な情報確認
      analysis.intent === 'check' && analysis.category !== 'trouble',
      // 標準的な対応タグ
      template && this.hasStandardTags(template)
    ];
    
    return lowRiskConditions.some(condition => condition);
  }

  private hasStandardTags(template: Template): boolean {
    const standardTags = ['標準対応', '簡潔回答', '通常対応'];
    const replyTags = template.replyTypeTags || [];
    const situationTags = template.situationTags || [];
    
    return [...replyTags, ...situationTags].some(tag => 
      standardTags.some(standard => tag.includes(standard))
    );
  }

  private async findExactMatch(analysis: QueryAnalysis): Promise<Template | null> {
    try {
      // analyzer の分類結果が undefined の場合は厳密一致をSKIP
      if (!analysis.category || !analysis.intent || !analysis.tone) {
        console.log('Exact match skipped: incomplete analysis');
        return null;
      }

      console.log('Searching for exact match with:', {
        category: analysis.category,
        intent: analysis.intent,
        tone: analysis.tone
      });

      const template = await prisma.templates.findFirst({
        where: {
          category: analysis.category,
          intent: analysis.intent,
          tone: analysis.tone,
          status: 'approved'
        },
        orderBy: [
          { usageLabel: 'desc' },
          { updated_at: 'desc' },
          { id: 'asc' }
        ]
      });

      console.log('Exact match result:', template ? `Found: ${template.title}` : 'Not found');

      return template as Template | null;
    } catch (error) {
      console.error('Error in findExactMatch:', error);
      return null;
    }
  }

  private async findPartialMatch(analysis: QueryAnalysis): Promise<Template | null> {
    // カテゴリと意図のみで検索
    const template = await prisma.templates.findFirst({
      where: {
        category: analysis.category,
        intent: analysis.intent,
        status: 'approved'
      },
      orderBy: [
        { usageLabel: 'desc' },
        { updated_at: 'desc' },
        { id: 'asc' }
      ]
    });

    if (!template) {
      // カテゴリのみで検索
      return await prisma.templates.findFirst({
        where: {
          category: analysis.category,
          status: 'approved'
        },
        orderBy: [
          { usageLabel: 'desc' },
          { updated_at: 'desc' },
          { id: 'asc' }
        ]
      }) as Template | null;
    }

    return template as Template;
  }

  private async findSimilarTemplate(analysis: QueryAnalysis): Promise<Template | null> {
    // ベクトル検索の実装（将来的に）
    // 現在は基本的なテンプレートを返す
    return await prisma.templates.findFirst({
      where: {
        status: 'approved'
      },
      orderBy: [
        { usageLabel: 'desc' },
        { updated_at: 'desc' },
        { id: 'asc' }
      ]
    }) as Template | null;
  }

  private async findAlternatives(analysis: QueryAnalysis, excludeId?: number): Promise<Template[]> {
    const alternatives = await prisma.templates.findMany({
      where: {
        category: analysis.category,
        status: 'approved',
        id: {
          not: excludeId
        }
      },
      take: 3,
      orderBy: [
        { usageLabel: 'desc' },
        { updated_at: 'desc' },
        { id: 'asc' }
      ]
    });

    return alternatives as Template[];
  }

  private calculateConfidence(analysis: QueryAnalysis, template: Template | null): number {
    if (!template) return 0;

    let confidence = analysis.confidence;

    // カテゴリ一致度
    if (template.category === analysis.category) {
      confidence += 0.3;
    }

    // 意図一致度
    if (template.intent === analysis.intent) {
      confidence += 0.3;
    }

    // トーン一致度
    if (template.tone === analysis.tone) {
      confidence += 0.2;
    }

    // テンプレートの品質（承認済み）
    if (template.is_approved) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private async logRouting(originalQuery: string, analysis: QueryAnalysis, template: Template | null, processingTimeMs: number, reasoning: string, needsHumanReview: boolean, reviewReason: string) {
    try {
      await prisma.routingLogs.create({
        data: {
          query_text: originalQuery ?? '',
          detected_category: analysis?.category ?? 'unknown',
          detected_intent: analysis?.intent ?? 'unknown',
          detected_tone: analysis?.tone ?? 'unknown',
          selected_template_id: template?.id || null,
          confidence_score: analysis?.confidence || 0,
          is_fallback: !template,
          processing_time_ms: processingTimeMs,
          session_id: 'test-session', // 将来的にセッション管理から取得
          user_id: null // 将来的に認証から取得
        }
      });
    } catch (error) {
      console.error('Failed to log routing:', error);
    }
  }
} 
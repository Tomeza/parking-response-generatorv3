import { QueryAnalysis } from './query-analyzer';
import { prisma } from './db';

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
}

export interface RoutingResult {
  template: Template | null;
  confidence: number;
  fallbackUsed: boolean;
  processingTimeMs: number;
  reasoning: string;
  alternatives: Template[];
}

export class TemplateRouter {
  async route(analysis: QueryAnalysis): Promise<RoutingResult> {
    const startTime = Date.now();
    
    try {
      console.log('TemplateRouter: Starting routing for analysis:', analysis);
      
      // 1. 厳格なフィルタによる検索（設計思想の「芯」）
      let template = await this.findExactMatch(analysis);
      let reasoning = 'Exact match found';
      
      // 2. フィルタ緩和による検索
      if (!template) {
        console.log('TemplateRouter: No exact match, trying partial match');
        template = await this.findPartialMatch(analysis);
        reasoning = 'Partial match found';
      }
      
      // 3. 最終手段としてのベクトル検索
      if (!template) {
        console.log('TemplateRouter: No partial match, trying similar template');
        template = await this.findSimilarTemplate(analysis);
        reasoning = 'Similar template found via vector search';
      }
      
      const processingTimeMs = Date.now() - startTime;
      
      console.log('TemplateRouter: Final template found:', !!template);
      
      // 代替候補を取得
      const alternatives = await this.findAlternatives(analysis, template?.id);
      
      // ログ記録
      await this.logRouting({
        analysis,
        template,
        processingTimeMs,
        reasoning
      });
      
      return {
        template,
        confidence: this.calculateConfidence(analysis, template),
        fallbackUsed: !template,
        processingTimeMs,
        reasoning,
        alternatives
      };
    } catch (error) {
      console.error('TemplateRouter error:', error);
      return {
        template: null,
        confidence: 0,
        fallbackUsed: true,
        processingTimeMs: Date.now() - startTime,
        reasoning: 'Error occurred during routing',
        alternatives: []
      };
    }
  }

  private async findExactMatch(analysis: QueryAnalysis): Promise<Template | null> {
    try {
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
          is_approved: true
        },
        orderBy: {
          version: 'desc'
        }
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
        is_approved: true
      },
      orderBy: {
        version: 'desc'
      }
    });

    if (!template) {
      // カテゴリのみで検索
      return await prisma.templates.findFirst({
        where: {
          category: analysis.category,
          is_approved: true
        },
        orderBy: {
          version: 'desc'
        }
      }) as Template | null;
    }

    return template as Template;
  }

  private async findSimilarTemplate(analysis: QueryAnalysis): Promise<Template | null> {
    // ベクトル検索の実装（将来的に）
    // 現在は基本的なテンプレートを返す
    return await prisma.templates.findFirst({
      where: {
        is_approved: true
      },
      orderBy: {
        version: 'desc'
      }
    }) as Template | null;
  }

  private async findAlternatives(analysis: QueryAnalysis, excludeId?: number): Promise<Template[]> {
    const alternatives = await prisma.templates.findMany({
      where: {
        category: analysis.category,
        is_approved: true,
        id: {
          not: excludeId
        }
      },
      take: 3,
      orderBy: {
        version: 'desc'
      }
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

  private async logRouting(params: {
    analysis: QueryAnalysis;
    template: Template | null;
    processingTimeMs: number;
    reasoning: string;
  }) {
    try {
      await prisma.routingLogs.create({
        data: {
          query_text: params.analysis.metadata.originalQuery || '',
          detected_category: params.analysis.category,
          detected_intent: params.analysis.intent,
          detected_tone: params.analysis.tone,
          selected_template_id: params.template?.id || null,
          confidence_score: params.analysis.confidence,
          is_fallback: !params.template,
          processing_time_ms: params.processingTimeMs,
          session_id: 'test-session', // 将来的にセッション管理から取得
          user_id: null // 将来的に認証から取得
        }
      });
    } catch (error) {
      console.error('Failed to log routing:', error);
    }
  }
} 
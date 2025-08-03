import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface Template {
  id: number;
  title: string;
  content: string;
  category: string;
  intent: string;
  tone: string;
  variables: Record<string, string>;
  version: number;
  is_approved: boolean;
  metadata?: any;
}

export interface RoutingResult {
  template: Template | null;
  confidence: number;
  fallbackUsed: boolean;
  processingTimeMs: number;
  reasoning: string;
  alternatives: Template[];
}

export class GranularTemplateRouter {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  async routeQuery(analysis: any): Promise<RoutingResult> {
    const startTime = Date.now();
    
    try {
      console.log('GranularTemplateRouter: Starting routing for analysis:', analysis);
      
      const { category, intent, tone } = analysis;
      
      // 1. 完全一致検索（カテゴリ+意図+トーン）
      let template = await this.findExactMatch(category, intent, tone);
      
      if (template) {
        const processingTime = Date.now() - startTime;
        return {
          template,
          confidence: 1.0,
          fallbackUsed: false,
          processingTimeMs: processingTime,
          reasoning: 'Exact match found',
          alternatives: await this.findAlternatives(category, intent, tone)
        };
      }
      
      // 2. 部分一致検索（カテゴリ+意図）
      template = await this.findPartialMatch(category, intent);
      
      if (template) {
        const processingTime = Date.now() - startTime;
        return {
          template,
          confidence: 0.8,
          fallbackUsed: false,
          processingTimeMs: processingTime,
          reasoning: 'Partial match found',
          alternatives: await this.findAlternatives(category, intent)
        };
      }
      
      // 3. カテゴリ一致検索
      template = await this.findCategoryMatch(category);
      
      if (template) {
        const processingTime = Date.now() - startTime;
        return {
          template,
          confidence: 0.6,
          fallbackUsed: false,
          processingTimeMs: processingTime,
          reasoning: 'Category match found',
          alternatives: await this.findAlternatives(category)
        };
      }
      
      // 4. 類似テンプレート検索（メタデータベース）
      template = await this.findSimilarTemplate(analysis);
      
      if (template) {
        const processingTime = Date.now() - startTime;
        return {
          template,
          confidence: 0.7,
          fallbackUsed: false,
          processingTimeMs: processingTime,
          reasoning: 'Similar template found',
          alternatives: await this.findAlternatives(category)
        };
      }
      
      // 5. フォールバック
      const processingTime = Date.now() - startTime;
      return {
        template: null,
        confidence: 0,
        fallbackUsed: true,
        processingTimeMs: processingTime,
        reasoning: 'No matching template found',
        alternatives: []
      };
      
    } catch (error) {
      console.error('GranularTemplateRouter error:', error);
      const processingTime = Date.now() - startTime;
      return {
        template: null,
        confidence: 0,
        fallbackUsed: true,
        processingTimeMs: processingTime,
        reasoning: `Error occurred during routing: ${error.message}`,
        alternatives: []
      };
    }
  }

  private async findExactMatch(category: string, intent: string, tone: string): Promise<Template | null> {
    try {
      console.log(`Searching for exact match with: { category: '${category}', intent: '${intent}', tone: '${tone}' }`);
      
      // 現場粒度テンプレートを優先（metadataがあるものを先に検索）
      const granularTemplate = await this.prisma.templates.findFirst({
        where: {
          category,
          intent,
          tone,
          is_approved: true,
          metadata: {
            not: null
          }
        },
        orderBy: {
          version: 'desc'
        }
      });
      
      if (granularTemplate) {
        console.log(`Granular template found: ${granularTemplate.title}`);
        return granularTemplate;
      }
      
      // 汎用テンプレートをフォールバック
      const genericTemplate = await this.prisma.templates.findFirst({
        where: {
          category,
          intent,
          tone,
          is_approved: true,
          metadata: null
        },
        orderBy: {
          version: 'desc'
        }
      });
      
      console.log(`Exact match result: ${genericTemplate ? `Found: ${genericTemplate.title}` : 'Not found'}`);
      return genericTemplate;
      
    } catch (error) {
      console.error('Error in findExactMatch:', error);
      return null;
    }
  }

  private async findPartialMatch(category: string, intent: string): Promise<Template | null> {
    try {
      console.log(`Searching for partial match with: { category: '${category}', intent: '${intent}' }`);
      
      const template = await this.prisma.templates.findFirst({
        where: {
          category,
          intent,
          is_approved: true
        },
        orderBy: {
          version: 'desc'
        }
      });
      
      console.log(`Partial match result: ${template ? `Found: ${template.title}` : 'Not found'}`);
      return template;
      
    } catch (error) {
      console.error('Error in findPartialMatch:', error);
      return null;
    }
  }

  private async findCategoryMatch(category: string): Promise<Template | null> {
    try {
      console.log(`Searching for category match with: { category: '${category}' }`);
      
      const template = await this.prisma.templates.findFirst({
        where: {
          category,
          is_approved: true
        },
        orderBy: {
          version: 'desc'
        }
      });
      
      console.log(`Category match result: ${template ? `Found: ${template.title}` : 'Not found'}`);
      return template;
      
    } catch (error) {
      console.error('Error in findCategoryMatch:', error);
      return null;
    }
  }

  private async findSimilarTemplate(analysis: any): Promise<Template | null> {
    try {
      // メタデータベースの類似検索
      const templates = await this.prisma.templates.findMany({
        where: {
          is_approved: true,
          metadata: {
            path: ['main_category'],
            equals: analysis.category
          }
        },
        take: 5,
        orderBy: {
          version: 'desc'
        }
      });
      
      if (templates.length > 0) {
        // 最も関連性の高いテンプレートを選択
        return templates[0];
      }
      
      return null;
      
    } catch (error) {
      console.error('Error in findSimilarTemplate:', error);
      return null;
    }
  }

  private async findAlternatives(category: string, intent?: string, tone?: string): Promise<Template[]> {
    try {
      const where: any = {
        category,
        is_approved: true
      };
      
      if (intent) where.intent = intent;
      if (tone) where.tone = tone;
      
      const alternatives = await this.prisma.templates.findMany({
        where,
        take: 3,
        orderBy: {
          version: 'desc'
        }
      });
      
      return alternatives;
      
    } catch (error) {
      console.error('Error in findAlternatives:', error);
      return [];
    }
  }
}

export const granularTemplateRouter = new GranularTemplateRouter(); 
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

export interface QueryAnalysis {
  category: string;
  intent: string;
  tone: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
}

interface CategoryRule {
  pos: string[];
  neg: string[];
  phr: string[];
  w: Record<string, number>;
}

interface GlobalConfig {
  stop: string[];
}

interface OverrideRule {
  if: string;
  and?: string;
  route: string;
}

interface IntentOverrideRule {
  if: string;
  route?: string;
  setIntent?: string;
}

interface ClassificationRules {
  [category: string]: CategoryRule | GlobalConfig | OverrideRule[] | IntentOverrideRule[];
}

interface ClassificationConfig {
  rules: ClassificationRules;
  tagBoost: Record<string, number>;
}

export class QueryAnalyzer {
  private openai: OpenAI;
  private classificationConfig: ClassificationConfig;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // 強化版カテゴリ判定ルールを読み込み
    this.classificationConfig = this.loadClassificationRules();
  }

  private loadClassificationRules(): ClassificationConfig {
    try {
      // 強化版ルールを優先、フォールバックで旧版
      const v2Path = path.join(process.cwd(), 'config', 'classify.v2.json');
      const v1Path = path.join(process.cwd(), 'config', 'classify.json');
      
      if (fs.existsSync(v2Path)) {
        const configData = fs.readFileSync(v2Path, 'utf-8');
        const rawConfig = JSON.parse(configData);
        
        const rules: ClassificationRules = {};
        const tagBoost: Record<string, number> = {};
        
        for (const [key, value] of Object.entries(rawConfig)) {
          if (key === '_tagBoost') {
            Object.assign(tagBoost, value);
          } else {
            rules[key] = value as CategoryRule;
          }
        }
        
        return { rules, tagBoost };
      } else if (fs.existsSync(v1Path)) {
        const configData = fs.readFileSync(v1Path, 'utf-8');
        const oldRules = JSON.parse(configData);
        // 旧版を新形式に変換
        const rules: ClassificationRules = {};
        for (const [category, keywords] of Object.entries(oldRules)) {
          if (Array.isArray(keywords)) {
            rules[category] = {
              pos: keywords,
              neg: [],
              phr: [],
              w: {}
            };
          }
        }
        return { rules, tagBoost: {} };
      }
      return { rules: {}, tagBoost: {} };
    } catch (error) {
      console.warn('⚠️ カテゴリ判定ルールの読み込みに失敗:', error);
      return { rules: {}, tagBoost: {} };
    }
  }

  async analyze(query: string): Promise<QueryAnalysis> {
    // 1. カテゴリ一次判定（強化版スコアリング）
    const primaryCategory = this.determinePrimaryCategory(query);
    
    // 2. LLMによる詳細分析
    const llmAnalysis = await this.performLLMAnalysis(query, primaryCategory);
    
    return llmAnalysis;
  }

  private determinePrimaryCategory(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // 1. Overrides を最初に評価
    const overrideResult = this.evaluateOverrides(lowerQuery);
    if (overrideResult) {
      return overrideResult;
    }
    
    // 2. Stopwords を除去
    const cleanedQuery = this.removeStopwords(lowerQuery);
    
    // 3. 通常のスコアリング
    const categoryScores: Record<string, number> = {};
    
    for (const [category, rule] of Object.entries(this.classificationConfig.rules)) {
      if (category.startsWith('_')) continue; // メタデータはスキップ
      
      // CategoryRule型かチェック
      if (!this.isCategoryRule(rule)) continue;
      
      let score = 0;
      
      // 1. 肯定語の重み付きスコア
      for (const keyword of rule.pos) {
        if (cleanedQuery.includes(keyword.toLowerCase())) {
          const weight = rule.w[keyword] || 1;
          score += weight;
        }
      }
      
      // 2. 否定語のペナルティ
      for (const keyword of rule.neg) {
        if (cleanedQuery.includes(keyword.toLowerCase())) {
          score -= 3; // 否定語は-3のペナルティ
        }
      }
      
      // 3. フレーズボーナス
      for (const phrase of rule.phr) {
        if (cleanedQuery.includes(phrase.toLowerCase())) {
          score += 3; // フレーズは+3のボーナス
        }
      }
      
      // 4. 早期確定チェック
      const posMatches = rule.pos.filter(k => cleanedQuery.includes(k.toLowerCase())).length;
      const negMatches = rule.neg.filter(k => cleanedQuery.includes(k.toLowerCase())).length;
      
      if (posMatches >= 2 && negMatches === 0) {
        score += 5; // 早期確定ボーナス
      }
      
      if (score > 0) {
        categoryScores[category] = score;
      }
    }
    
    // 最高スコアのカテゴリを返す（上書きルール適用）
    if (Object.keys(categoryScores).length > 0) {
      const bestCategory = this.resolveCategoryByScores(query, categoryScores);
      console.log(`Category resolution: ${query} -> ${bestCategory} (scores: ${JSON.stringify(categoryScores)})`);
      return bestCategory || 'other';
    }
    
    // デフォルトは'other'
    return 'other';
  }

  private resolveCategoryByScores(query: string, scores: Record<string, number>): string | undefined {
    const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const top = sorted[0];
    if (!top || top[1] <= 0) return undefined;
    let winner = top[0];

    // 料金×車両 → vehicle を優先（「車両の種類別料金」「軽自動車の料金」など）
    if (/(料金|価格|費用|支払|精算)/.test(query) && (/(車両|車種|軽自動車|外車|大型)/.test(query) || /種類別/.test(query))) {
      console.log(`  Override: ${query} -> vehicle (料金×車両)`);
      return 'vehicle';
    }
    // 設備キーワードがあれば facility を優先（「精算機の使い方」「充電器の利用」など）
    if (/(精算機|充電器|ゲート|防犯|カメラ|屋根|バリアフリー|設備)/.test(query)) {
      console.log(`  Override: ${query} -> facility (設備キーワード)`);
      return 'facility';
    }
    // 車両寸法・制限は vehicle を強制
    if (/(車両|車種|軽自動車|外車|大型)/.test(query) && /(高さ|車高|幅|重量|サイズ|寸法|制限|規格)/.test(query)) {
      console.log(`  Override: ${query} -> vehicle (車両寸法)`);
      return 'vehicle';
    }
    console.log(`  No override: ${query} -> ${winner}`);
    return winner;
  }

  private resolveIntent(query: string, category?: string): 'check'|'modify'|'inquiry'|'report'|'guide'|'warn'|'answer' {
    const q = query;

    // まず強い動作系
    if (/(変更|修正|訂正|更新)/.test(q)) return 'modify';
    if (/(報告|起きました|発生|紛失(しました)?|なくした|失くした|落とした|壊れた|破損)/.test(q)) return 'report';

    // カテゴリ別の例外（payment: 「のみ可能ですか」は案内寄り）
    if (category === 'payment' && /(のみ).*(可能ですか)/.test(q)) return 'inquiry';

    // 一般
    if (/(確認|可否|ありますか)/.test(q)) return 'check';
    if (/(可能ですか|できますか|教えて|方法|手順|使い方)/.test(q)) return 'inquiry';
    return 'inquiry';
  }

  private resolveTone(query: string, category?: string, intent?: string): 'normal'|'urgent' {
    const q = query;
    if ((category === 'trouble' || category === 'facility') && intent === 'report') {
      if (/(事故|けが|怪我|出られない|閉じ込め|火事|警報|ゲート.*開かない|緊急|至急|故障|トラブル|クレーム)/.test(q)) return 'urgent';
      if (/(紛失|なくした|失くした|落とした|破損|忘れ物)/.test(q)) return 'normal';
    }
    return 'normal';
  }

  private resolveUrgency(query: string, category?: string, intent?: string): 'low'|'medium'|'high' {
    const q = query;
    if ((category === 'trouble' || category === 'facility') && intent === 'report') {
      if (/(事故|けが|怪我|出られない|閉じ込め|火事|警報|ゲート.*開かない|緊急|至急|故障|トラブル|クレーム)/.test(q)) return 'high';
      if (/(紛失|なくした|失くした|落とした|破損|忘れ物)/.test(q)) return 'medium';
    }
    // 返金手続きは中程度の緊急度
    if (category === 'trouble' && intent === 'inquiry' && /(返金|返還|払い戻し)/.test(q)) return 'medium';
    return 'low';
  }

  private isCategoryRule(rule: any): rule is CategoryRule {
    return rule && 
           Array.isArray(rule.pos) && 
           Array.isArray(rule.neg) && 
           Array.isArray(rule.phr) && 
           typeof rule.w === 'object';
  }

  private evaluateOverrides(query: string): string | null {
    const overrides = this.classificationConfig.rules._overrides;
    if (!overrides || !Array.isArray(overrides)) return null;
    
    for (const override of overrides) {
      if (!this.isOverrideRule(override)) continue;
      
      const ifPattern = new RegExp(override.if, 'i');
      const ifMatch = ifPattern.test(query);
      
      if (override.and) {
        const andPattern = new RegExp(override.and, 'i');
        const andMatch = andPattern.test(query);
        if (ifMatch && andMatch) {
          return override.route;
        }
      } else if (ifMatch) {
        return override.route;
      }
    }
    
    return null;
  }

  private isOverrideRule(rule: any): rule is OverrideRule {
    return rule && typeof rule.if === 'string' && typeof rule.route === 'string';
  }

  private evaluateIntentOverrides(query: string): string | null {
    const intentOverrides = this.classificationConfig.rules._intent;
    if (!intentOverrides || !Array.isArray(intentOverrides)) return null;
    
    for (const override of intentOverrides) {
      if (!this.isIntentOverrideRule(override)) continue;
      
      const ifPattern = new RegExp(override.if, 'i');
      if (ifPattern.test(query)) {
        if (override.route) {
          return override.route.split('/')[1]; // "reservation/modify" -> "modify"
        } else if (override.setIntent) {
          return override.setIntent;
        }
      }
    }
    
    return null;
  }

  private isIntentOverrideRule(rule: any): rule is IntentOverrideRule {
    return rule && typeof rule.if === 'string' && (typeof rule.route === 'string' || typeof rule.setIntent === 'string');
  }

  private removeStopwords(query: string): string {
    const globalConfig = this.classificationConfig.rules._global;
    const stopwords = globalConfig && this.isGlobalConfig(globalConfig) ? globalConfig.stop : [];
    let cleanedQuery = query;
    
    for (const stopword of stopwords) {
      const pattern = new RegExp(stopword, 'gi');
      cleanedQuery = cleanedQuery.replace(pattern, '');
    }
    
    return cleanedQuery;
  }

  private isGlobalConfig(config: any): config is GlobalConfig {
    return config && Array.isArray(config.stop);
  }

  private stripFences(s: string): string {
    return s.replace(/```json|```/g, '').trim();
  }

  private sanitizeQuotes(s: string): string {
    return s.replace(/[""]/g, '"').replace(/['']/g, "'");
  }

  private extractJsonBlock(s: string): string {
    const t = this.sanitizeQuotes(this.stripFences(s));
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) return t.slice(start, end + 1);
    return t; // 最後の手段：そのまま
  }

  private safeParseJson(s: string): any | null {
    try {
      return JSON.parse(s);
    } catch {
      try { 
        return JSON.parse(this.extractJsonBlock(s)); 
      } catch { 
        return null; 
      }
    }
  }

  private async performLLMAnalysis(query: string, primaryCategory: string): Promise<QueryAnalysis> {
    // Intent overrides を先に評価
    const intentOverride = this.evaluateIntentOverrides(query);
    
    // ルールベースのintent判定（カテゴリ決定後に呼び出し）
    const ruleIntent = this.resolveIntent(query, primaryCategory);
    
    const systemPrompt = `
あなたは駐車場サービスに関する質問の意図を正確に理解するエキスパートです。

**重要**: カテゴリは既に一次判定で「${primaryCategory}」と決定されています。この判定を尊重し、他の要素を分析してください。

以下の要素をJSON形式で抽出してください：

**カテゴリ（必須）:** ${primaryCategory}（一次判定で決定済み）

**意図（必須）:**
- create: 新規作成（作成・申込・登録）
- check: 確認・照会（確認・ありますか・できますか・時間・料金）
- modify: 変更・修正（変更・修正・更新）
- cancel: キャンセル・削除（キャンセル・削除・解約）
- report: 報告・通知（報告・通知・事故・故障）
- inquiry: 問い合わせ（教えて・詳しく・方法・手順）

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
  "category": "${primaryCategory}",
  "intent": "${intentOverride || 'check'}", 
  "tone": "normal",
  "urgency": "medium",
  "confidence": 0.95,
  "reasoning": "分析結果に基づく判断"
}

**重要**: JSONのみを出力し、他の文字列は含めないでください。
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      const parsed = this.safeParseJson(content);
      if (!parsed) {
        return { category: primaryCategory, intent: 'inquiry', tone: 'normal', urgency: 'medium', confidence: 0.0, metadata: { reasoning: 'llm_parse_fallback', originalQuery: query, primaryCategory, timestamp: new Date().toISOString() } };
      }
      
      const analysis = parsed;
      
      // 上書きルールの適用
      const overriddenCategory = this.resolveCategoryByScores(query, { [primaryCategory]: 1 });
      if (overriddenCategory && overriddenCategory !== primaryCategory) {
        console.log(`  LLM Override: ${primaryCategory} -> ${overriddenCategory} for "${query}"`);
        analysis.category = overriddenCategory;
      }
      
      // ルールベースのintentを優先
      if (analysis.intent === 'inquiry' && ruleIntent !== 'inquiry') {
        analysis.intent = ruleIntent;
      }
      
      // トーンと緊急度の調整
      const finalCategory = overriddenCategory || primaryCategory;
      analysis.tone = this.resolveTone(query, finalCategory, analysis.intent);
      analysis.urgency = this.resolveUrgency(query, finalCategory, analysis.intent);
      
      const finalAnalysis = this.validateAndNormalizeAnalysis(analysis, finalCategory);
      finalAnalysis.metadata = {
        ...finalAnalysis.metadata,
        originalQuery: query,
      };
      return finalAnalysis;
    } catch (error) {
      console.warn('LLM analysis failed, using fallback:', error);
      return this.fallbackAnalysis(query, primaryCategory);
    }
  }

  private validateAndNormalizeAnalysis(analysis: any, primaryCategory: string): QueryAnalysis {
    const validCategories = ['reservation', 'payment', 'shuttle', 'facility', 'trouble', 'access', 'vehicle', 'information', 'disclaimer', 'general', 'other'];
    const validIntents = ['create', 'check', 'modify', 'cancel', 'report', 'inquiry'];
    const validTones = ['urgent', 'normal', 'future'];
    const validUrgencies = ['low', 'medium', 'high'];

    return {
      category: primaryCategory, // 一次判定を優先
      intent: validIntents.includes(analysis.intent) ? analysis.intent : 'inquiry',
      tone: validTones.includes(analysis.tone) ? analysis.tone : 'normal',
      urgency: validUrgencies.includes(analysis.urgency) ? analysis.urgency : 'medium',
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      metadata: {
        reasoning: analysis.reasoning || '',
        originalQuery: analysis.originalQuery || '',
        primaryCategory: primaryCategory,
        timestamp: new Date().toISOString()
      }
    };
  }

  private fallbackAnalysis(query: string, primaryCategory: string): QueryAnalysis {
    // 基本的なキーワードベースの解析
    const lowerQuery = query.toLowerCase();
    
    let intent = this.resolveIntent(query, primaryCategory);
    
    let tone = this.resolveTone(query, primaryCategory, intent);
    let urgency = this.resolveUrgency(query, primaryCategory, intent);

    return {
      category: primaryCategory,
      intent,
      tone,
      urgency,
      confidence: 0.3, // フォールバックなので低い信頼度
      metadata: {
        reasoning: 'Fallback keyword-based analysis',
        originalQuery: query,
        primaryCategory: primaryCategory,
        timestamp: new Date().toISOString()
      }
    };
  }

  async getCategoryScores(query: string): Promise<Record<string, number>> {
    const lowerQuery = query.toLowerCase();
    const categoryScores: Record<string, number> = {};
    
    for (const [category, rule] of Object.entries(this.classificationConfig.rules)) {
      if (category.startsWith('_')) continue;
      if (!this.isCategoryRule(rule)) continue;
      
      let score = 0;
      
      // 1. 肯定語の重み付きスコア
      for (const keyword of rule.pos) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          const weight = rule.w[keyword] || 1;
          score += weight;
        }
      }
      
      // 2. 否定語のペナルティ
      for (const keyword of rule.neg) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          score -= 3;
        }
      }
      
      // 3. フレーズボーナス
      for (const phrase of rule.phr) {
        if (lowerQuery.includes(phrase.toLowerCase())) {
          score += 3;
        }
      }
      
      // 4. 早期確定チェック
      const posMatches = rule.pos.filter(k => lowerQuery.includes(k.toLowerCase())).length;
      const negMatches = rule.neg.filter(k => lowerQuery.includes(k.toLowerCase())).length;
      
      if (posMatches >= 2 && negMatches === 0) {
        score += 5;
      }
      
      if (score > 0) {
        categoryScores[category] = score;
      }
    }
    
    return categoryScores;
  }

  async getHitKeywords(query: string): Promise<Record<string, Array<{type: string, word: string}>>> {
    const lowerQuery = query.toLowerCase();
    const hitKeywords: Record<string, Array<{type: string, word: string}>> = {};
    
    for (const [category, rule] of Object.entries(this.classificationConfig.rules)) {
      if (category.startsWith('_')) continue;
      if (!this.isCategoryRule(rule)) continue;
      
      const hits: Array<{type: string, word: string}> = [];
      
      // 肯定語のヒット
      for (const keyword of rule.pos) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          hits.push({ type: 'pos', word: keyword });
        }
      }
      
      // 否定語のヒット
      for (const keyword of rule.neg) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          hits.push({ type: 'neg', word: keyword });
        }
      }
      
      // フレーズのヒット
      for (const phrase of rule.phr) {
        if (lowerQuery.includes(phrase.toLowerCase())) {
          hits.push({ type: 'phr', word: phrase });
        }
      }
      
      if (hits.length > 0) {
        hitKeywords[category] = hits;
      }
    }
    
    return hitKeywords;
  }
} 
---
title: Implementation Revision - 設計思想に基づく実装修正案
description: 「芯」と「軸」の設計思想を反映した具体的な実装修正提案
author: AI Team
date: 2025-07-30
category: Implementation
tags:
  - revision
  - architecture
  - quality
  - routing
status: draft
---

# 設計思想に基づく実装修正案

## 1. データ構造の修正

### 1.1 テンプレート管理の強化

```sql
-- templates テーブル
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    intent TEXT NOT NULL,
    tone TEXT NOT NULL,
    variables JSONB,
    version INTEGER DEFAULT 1,
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- テンプレートの改訂履歴
CREATE TABLE template_revisions (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES templates(id),
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    changes_summary TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 ルーティング精度の計測

```sql
-- ルーティングログ
CREATE TABLE routing_logs (
    id SERIAL PRIMARY KEY,
    query_text TEXT NOT NULL,
    detected_category TEXT NOT NULL,
    detected_intent TEXT NOT NULL,
    detected_tone TEXT NOT NULL,
    selected_template_id INTEGER REFERENCES templates(id),
    confidence_score FLOAT,
    is_fallback BOOLEAN DEFAULT false,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT,
    user_id UUID REFERENCES auth.users(id)
);

-- フィードバックログ
CREATE TABLE feedback_logs (
    id SERIAL PRIMARY KEY,
    routing_log_id INTEGER REFERENCES routing_logs(id),
    is_correct BOOLEAN,
    correction_type TEXT, -- 'category', 'intent', 'tone', 'template'
    corrected_value TEXT,
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);
```

## 2. API層の修正

### 2.1 センシング精度の向上

```typescript
// src/lib/query-analyzer.ts
interface QueryAnalysis {
  category: string;
  intent: string;
  tone: string;
  confidence: number;
  metadata: Record<string, any>;
}

class QueryAnalyzer {
  async analyze(query: string): Promise<QueryAnalysis> {
    // LLMを使用した高精度な意図解析
    const analysis = await this.llm.analyze(query, {
      systemPrompt: `
        あなたはクエリの意図を正確に理解するエキスパートです。
        以下の要素を抽出してください：
        - カテゴリ（予約/キャンセル/変更/苦情/問い合わせ）
        - 意図（新規作成/確認/修正/削除/説明要求）
        - トーン（緊急/通常/将来）
        
        各判断には確信度（0-1）を付けてください。
        判断理由も含めてください。
      `
    });
    
    return this.validateAndNormalizeAnalysis(analysis);
  }
}
```

### 2.2 ルーティング精度の向上

```typescript
// src/lib/template-router.ts
interface RoutingResult {
  template: Template;
  confidence: number;
  fallbackUsed: boolean;
  processingTimeMs: number;
}

class TemplateRouter {
  async route(analysis: QueryAnalysis): Promise<RoutingResult> {
    const startTime = Date.now();
    
    // 1. 厳格なフィルタによる検索
    let template = await this.findExactMatch(analysis);
    
    // 2. フィルタ緩和による検索
    if (!template) {
      template = await this.findPartialMatch(analysis);
    }
    
    // 3. 最終手段としてのベクトル検索
    if (!template) {
      template = await this.findSimilarTemplate(analysis);
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    // ログ記録
    await this.logRouting({
      analysis,
      template,
      processingTimeMs
    });
    
    return {
      template,
      confidence: this.calculateConfidence(analysis, template),
      fallbackUsed: !template,
      processingTimeMs
    };
  }
}
```

## 3. UI/UX の修正

### 3.1 テンプレート管理画面

```typescript
// src/app/admin/templates/page.tsx
interface TemplateListProps {
  templates: Template[];
  onApprove: (id: number) => void;
  onRevise: (id: number) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  onApprove,
  onRevise
}) => {
  return (
    <div className="space-y-4">
      {templates.map(template => (
        <div key={template.id} className="border p-4 rounded">
          <div className="flex justify-between">
            <h3>{template.title}</h3>
            <div className="space-x-2">
              {!template.is_approved && (
                <button onClick={() => onApprove(template.id)}>
                  承認
                </button>
              )}
              <button onClick={() => onRevise(template.id)}>
                改訂
              </button>
            </div>
          </div>
          <div className="mt-2">
            <span className="badge">{template.category}</span>
            <span className="badge">{template.intent}</span>
            <span className="badge">{template.tone}</span>
          </div>
          <pre className="mt-2">{template.content}</pre>
        </div>
      ))}
    </div>
  );
};
```

### 3.2 ルーティング結果の表示と補正UI

```typescript
// src/app/search/components/RoutingResult.tsx
interface RoutingResultProps {
  result: RoutingResult;
  onFeedback: (feedback: Feedback) => void;
}

const RoutingResult: React.FC<RoutingResultProps> = ({
  result,
  onFeedback
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3>選択されたテンプレート</h3>
          <div className="text-sm text-gray-500">
            信頼度: {result.confidence * 100}%
            {result.fallbackUsed && (
              <span className="ml-2 text-yellow-500">
                ベクトル検索使用
              </span>
            )}
          </div>
        </div>
        <button onClick={() => onFeedback({
          isCorrect: false,
          type: 'template'
        })}>
          別のテンプレートを提案
        </button>
      </div>
      
      <div className="border p-4 rounded">
        <pre>{result.template.content}</pre>
      </div>
      
      <div className="flex space-x-4">
        <button onClick={() => onFeedback({
          isCorrect: true
        })}>
          ✅ 正しい
        </button>
        <button onClick={() => onFeedback({
          isCorrect: false,
          type: 'category'
        })}>
          カテゴリが違う
        </button>
        <button onClick={() => onFeedback({
          isCorrect: false,
          type: 'intent'
        })}>
          意図が違う
        </button>
      </div>
    </div>
  );
};
```

## 4. 運用フローの修正

### 4.1 テンプレート承認フロー

1. テンプレート作成者が新規テンプレートを登録
2. 承認者がレビュー（カテゴリ、意図、トーンの妥当性確認）
3. 承認後にのみ本番環境で使用可能
4. 改訂時は新バージョンとして保存し、再度承認プロセスを経る

### 4.2 品質モニタリング

1. 週次でルーティングログを分析
   - 直撃率（厳格フィルタでのマッチ率）
   - 補正率（フィードバックによる修正率）
   - レイテンシ（P95, P99）
   
2. 月次でテンプレート棚卸し
   - 使用頻度の低いテンプレートの見直し
   - カテゴリ/意図の分類体系の見直し
   - 新規テンプレート追加の検討

### 4.3 改善サイクル

1. ログ分析による問題検出
2. テンプレート改訂または新規作成
3. 承認プロセス
4. デプロイと効果測定
5. フィードバックの収集と分析

## 5. 実装スケジュール

### Phase 1: データ構造の整備（2週間）
- [ ] テーブル設計の修正
- [ ] マイグレーションスクリプトの作成
- [ ] 既存データの移行

### Phase 2: API層の実装（3週間）
- [ ] QueryAnalyzer の実装
- [ ] TemplateRouter の実装
- [ ] ログ機構の実装

### Phase 3: UI/UX の実装（2週間）
- [ ] 管理画面の実装
- [ ] フィードバックUIの実装
- [ ] ログ閲覧/分析画面の実装

### Phase 4: 運用フローの確立（1週間）
- [ ] 承認フローの確認と調整
- [ ] モニタリングダッシュボードの作成
- [ ] 運用マニュアルの作成

## 6. リスクと対策

### 6.1 技術的リスク

1. **LLMの応答時間による遅延**
   - 対策: クエリ結果のキャッシュ
   - 対策: バッチ処理での事前解析

2. **ベクトル検索のスケーリング**
   - 対策: インデックス最適化
   - 対策: キャッシュ層の導入

### 6.2 運用リスク

1. **承認プロセスのボトルネック**
   - 対策: 承認者の複数化
   - 対策: 軽微な修正の承認フロー簡略化

2. **分類基準の揺れ**
   - 対策: 明確な判断基準のドキュメント化
   - 対策: 定期的な基準見直しと調整

## 7. 成功指標

1. **直撃率**
   - 目標: 80%以上
   - 計測: 厳格フィルタでのマッチ率

2. **補正率**
   - 目標: 10%以下
   - 計測: フィードバックによる修正率

3. **レイテンシ**
   - 目標: P95 < 1000ms
   - 計測: ルーティング完了までの時間

4. **品質スコア**
   - 目標: 90%以上
   - 計測: フィードバックの正解率 
'use client';

import { useState } from 'react';

interface AnalysisResult {
  query: string;
  analysis: {
    category: string;
    intent: string;
    tone: string;
    confidence: number;
    urgency: string;
    metadata: Record<string, any>;
  };
  routing: {
    template: any;
    confidence: number;
    fallbackUsed: boolean;
    processingTimeMs: number;
    reasoning: string;
    alternatives: any[];
  };
}

export default function TestAIPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFeedbackSubmitted(false);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (isCorrect: boolean, correctionType?: string, correctedValue?: string) => {
    if (!result) return;

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          routingLogId: result.routing.processingTimeMs, // 簡易的なID（実際はrouting_logsのID）
          isCorrect,
          correctionType,
          correctedValue,
          feedbackText: `User feedback: ${isCorrect ? 'correct' : 'incorrect'}`
        }),
      });

      setFeedbackSubmitted(true);
    } catch (err) {
      console.error('Feedback submission failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">
          AIルーティングテスト
        </h1>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="mb-4">
            <label htmlFor="query" className="block text-sm font-medium text-gray-300 mb-2">
              テストクエリ
            </label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-gray-800 text-gray-100"
              rows={3}
              placeholder="例: 駐車場の予約を確認したい"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? '解析中...' : '解析実行'}
          </button>
        </form>

        {error && (
          <div className="mb-8 p-4 bg-red-900 border border-red-700 rounded-md">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-600">
              <h2 className="text-xl font-semibold mb-4 text-gray-100">解析結果</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">カテゴリ</h3>
                  <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.analysis.category}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">意図</h3>
                  <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.analysis.intent}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">トーン</h3>
                  <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.analysis.tone}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">緊急度</h3>
                  <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.analysis.urgency}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">信頼度</h3>
                  <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{(result.analysis.confidence * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">処理時間</h3>
                  <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.routing.processingTimeMs}ms</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-600">
              <h2 className="text-xl font-semibold mb-4 text-gray-100">ルーティング結果</h2>
              <div className="mb-4">
                <h3 className="font-medium text-gray-300 mb-2">推論</h3>
                <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.routing.reasoning}</p>
              </div>
              <div className="mb-4">
                <h3 className="font-medium text-gray-300 mb-2">フォールバック使用</h3>
                <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.routing.fallbackUsed ? 'はい' : 'いいえ'}</p>
              </div>
              {result.routing.template && (
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">選択されたテンプレート</h3>
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-medium text-gray-100">{result.routing.template.title}</h4>
                    <p className="text-sm text-gray-300 mt-2">{result.routing.template.content}</p>
                  </div>
                </div>
              )}
            </div>

            {result.analysis.metadata.reasoning && (
              <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-600">
                <h2 className="text-xl font-semibold mb-4 text-gray-100">解析理由</h2>
                <p className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-100">{result.analysis.metadata.reasoning}</p>
              </div>
            )}

            {/* フィードバックセクション */}
            <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-600">
              <h2 className="text-xl font-semibold mb-4 text-gray-100">フィードバック</h2>
              {!feedbackSubmitted ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">この解析結果は正しいですか？</p>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => handleFeedback(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      ✅ 正しい
                    </button>
                    <button
                      onClick={() => handleFeedback(false)}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                      ❌ 間違い
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-green-400">
                  ✅ フィードバックを送信しました。ありがとうございます。
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
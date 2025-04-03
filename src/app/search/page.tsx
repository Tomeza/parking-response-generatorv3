'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchResult } from '@/lib/common-types';

interface SearchResponse {
  response: string;
  responseId: number;
  score: number;
  knowledge_id: number;
  question: string;
  steps: Array<{
    step: string;
    content: any;
  }>;
  total_results: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/query?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search');
      }

      setSearchResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">検索テスト</h1>
      
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="検索キーワードを入力..."
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? '検索中...' : '検索'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-500 mt-2">{error}</div>
        )}
      </div>

      {searchResponse && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">検索結果</h2>
            <div className="prose max-w-none">
              <div className="bg-gray-50 p-4 rounded mb-4">
                <div className="font-medium text-gray-700">応答:</div>
                <div className="mt-2 whitespace-pre-wrap">{searchResponse.response}</div>
              </div>
              
              <div className="text-sm text-gray-600">
                <div>検索スコア: {searchResponse.score.toFixed(3)}</div>
                <div>関連結果数: {searchResponse.total_results}件</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">処理ステップ</h3>
            <div className="space-y-4">
              {searchResponse.steps.map((step, index) => (
                <div key={index} className="border-b pb-4">
                  <div className="font-medium text-gray-700 mb-2">{step.step}</div>
                  <div className="text-sm text-gray-600">
                    <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded">
                      {JSON.stringify(step.content, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!searchResponse && !loading && (
        <div className="text-gray-500 text-center mt-8">
          検索キーワードを入力してください
        </div>
      )}

      {loading && (
        <div className="text-center mt-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-500"></div>
          <div className="mt-2 text-gray-600">検索中...</div>
        </div>
      )}
    </div>
  );
} 
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search');
      }

      setResults(data.results || []);
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

      <div>
        <h2 className="text-xl font-semibold mb-2">検索結果 ({results?.length || 0}件)</h2>
        
        {results?.length > 0 ? (
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.id} className="border p-4 rounded">
                <div className="font-medium">ID: {result.id}</div>
                <div className="text-sm text-gray-500">
                  カテゴリ: {result.main_category} &gt; {result.sub_category} &gt; {result.detail_category}
                </div>
                <div className="mt-2">
                  <div className="font-semibold">質問:</div>
                  <div>{result.question}</div>
                </div>
                <div className="mt-2">
                  <div className="font-semibold">回答:</div>
                  <div>{result.answer}</div>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  関連性スコア: {result.relevance}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">
            {loading ? '検索中...' : '検索結果がありません'}
          </div>
        )}
      </div>
    </div>
  );
} 
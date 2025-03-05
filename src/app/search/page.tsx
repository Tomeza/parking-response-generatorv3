'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  id: number;
  question: string;
  answer: string;
  main_category: string;
  sub_category: string;
  detail_category?: string;
  tags: string[];
  score: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 500);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('検索中にエラーが発生しました');
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索中にエラーが発生しました');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 検索クエリが変更されたら自動的に検索を実行
  useEffect(() => {
    handleSearch(debouncedQuery);
  }, [debouncedQuery]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ナレッジベース検索</h1>
      
      <div className="mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="検索キーワードを入力..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading && (
        <div className="text-center py-4">
          <p>検索中...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {results.length > 0 ? (
        <div className="space-y-6">
          {results.map((result) => (
            <div
              key={result.id}
              className="bg-white shadow rounded-lg p-6"
            >
              <h2 className="text-xl font-semibold mb-2">{result.question}</h2>
              <p className="text-gray-600 mb-4">{result.answer}</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {result.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="text-sm text-gray-500">
                <span>{result.main_category}</span>
                {' > '}
                <span>{result.sub_category}</span>
                {result.detail_category && (
                  <>
                    {' > '}
                    <span>{result.detail_category}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : query && !isLoading ? (
        <p className="text-center py-4 text-gray-600">
          検索結果が見つかりませんでした
        </p>
      ) : null}
    </div>
  );
} 
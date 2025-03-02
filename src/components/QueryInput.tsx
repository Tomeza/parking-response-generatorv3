'use client';

import { useState } from 'react';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export default function QueryInput({ onSubmit, isLoading }: QueryInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query);
    }
  };

  return (
    <div className="w-full mb-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="query" className="block text-sm font-medium mb-2">
            問い合わせ内容
          </label>
          <textarea
            id="query"
            name="query"
            rows={5}
            maxLength={500}
            placeholder="問い合わせを入力してください"
            className="w-full p-3 border rounded-lg bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {query.length}/500文字
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? '生成中...' : '生成'}
          </button>
        </div>
      </form>
    </div>
  );
} 
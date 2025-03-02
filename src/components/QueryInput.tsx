'use client';

import { useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

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
    <div className="card w-full mb-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="query" className="block text-sm font-medium text-gray-200">
              問い合わせ内容
            </label>
            <span className="text-xs text-gray-400">
              {query.length}/500文字
            </span>
          </div>
          <div className="relative">
            <textarea
              id="query"
              name="query"
              rows={6}
              maxLength={500}
              placeholder="例: 駐車場の料金はいくらですか？ 障害者用の駐車スペースはありますか？"
              className="input focus:ring-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />
            {query.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-300"
                aria-label="クリア"
              >
                ×
              </button>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            具体的な問い合わせ内容を入力してください。日付や場所などの詳細情報も含めるとより適切な回答が得られます。
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="btn btn-primary flex items-center space-x-2"
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>生成中...</span>
              </>
            ) : (
              <>
                <span>生成</span>
                <PaperAirplaneIcon className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 
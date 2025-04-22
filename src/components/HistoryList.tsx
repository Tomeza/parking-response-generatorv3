'use client';

import { useState, useEffect } from 'react';

interface HistoryItem {
  id: number;
  query: string;
  response: string;
  createdAt: string;
  knowledgeId?: number;
  knowledgeInfo?: {
    id: number;
    main_category?: string;
    sub_category?: string;
  } | null;
}

export function HistoryList({ onSelect = () => {} }: { onSelect?: (text: string) => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/history?limit=10');
        
        if (!response.ok) {
          throw new Error('履歴の取得に失敗しました');
        }
        
        const data = await response.json();
        setHistory(data.items);
      } catch (err) {
        console.error('履歴取得エラー:', err);
        setError('履歴の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleSelect = (id: number, query: string) => {
    setSelectedId(id);
    onSelect(query);
  };

  if (loading) {
    return <div className="text-gray-400 text-center py-4">読み込み中...</div>;
  }

  if (error) {
    return <div className="text-red-400 text-center py-4">{error}</div>;
  }

  if (history.length === 0) {
    return <div className="text-gray-400 text-center py-4">履歴がありません</div>;
  }

  return (
    <div className="space-y-2">
      {history.map((item) => (
        <div 
          key={item.id}
          className={`bg-gray-700 p-3 rounded hover:bg-gray-600 cursor-pointer ${
            selectedId === item.id ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => handleSelect(item.id, item.query)}
        >
          <div className="text-gray-400 text-sm">{new Date(item.createdAt).toLocaleString('ja-JP')}</div>
          <div className="mt-1 text-white">{item.query}</div>
          {item.knowledgeInfo && (
            <div className="text-xs text-gray-400 mt-1">
              {item.knowledgeInfo.main_category}
              {item.knowledgeInfo.sub_category ? ` > ${item.knowledgeInfo.sub_category}` : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 
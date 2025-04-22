'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

type ResponseLog = {
  id: number;
  query: string;
  response: string;
  used_knowledge_ids: number[];
  missing_tags: string[];
  missing_alerts: string[];
  feedback: boolean | null;
  created_at: string;
  knowledge: {
    id: number;
    question: string | null;
    answer: string;
    main_category: string | null;
    sub_category: string | null;
    detail_category: string | null;
  } | null;
};

type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function ResponseHistory() {
  const [logs, setLogs] = useState<ResponseLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });

      const response = await fetch(`/api/admin/response-history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch response history');

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch response history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, search, startDate, endDate]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (loading) return <div className="text-white text-center py-4">Loading...</div>;
  if (error) return <div className="text-red-500 text-center py-4">{error}</div>;

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="検索キーワード"
          className="flex-1 px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
        >
          検索
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-white">
          <thead>
            <tr className="bg-gray-900">
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                日時
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                質問
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                回答
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                使用ナレッジ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                フィードバック
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-900">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                  {format(new Date(log.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                </td>
                <td className="px-6 py-4 text-sm text-white">{log.query}</td>
                <td className="px-6 py-4 text-sm text-white">{log.response}</td>
                <td className="px-6 py-4 text-sm text-white">
                  {log.knowledge ? (
                    <div>
                      <div>ID: {log.knowledge.id}</div>
                      <div>カテゴリ: {log.knowledge.main_category} / {log.knowledge.sub_category}</div>
                    </div>
                  ) : (
                    'なし'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {log.feedback === null ? (
                    <span className="text-gray-400">未評価</span>
                  ) : log.feedback ? (
                    <span className="text-green-400">👍</span>
                  ) : (
                    <span className="text-red-400">👎</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`px-3 py-1 rounded ${
              page === pagination.page
                ? 'bg-white text-black'
                : 'bg-transparent border border-white text-white hover:bg-gray-900'
            }`}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  );
} 
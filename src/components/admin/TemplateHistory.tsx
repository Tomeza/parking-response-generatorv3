'use client';

import { useEffect, useState } from 'react';
import { StatusChangeForm } from './StatusChangeForm';

interface HistoryEntry {
  id: string;
  old_status: string;
  new_status: string;
  comment: string;
  created_by: string;
  created_at: string;
  user_details?: {
    email: string;
    role: string;
  };
}

interface TemplateHistoryProps {
  templateId: string;
}

export function TemplateHistory({ templateId }: TemplateHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchHistory();
  }, [templateId, page]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/templates/${templateId}/approval-history?page=${page}&pageSize=10`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('履歴の取得に失敗しました');
      }

      const data = await response.json();
      if (data.success) {
        setHistory(data.data.history);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        throw new Error(data.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    // ステータス変更後に履歴を再取得
    await fetchHistory();
  };

  if (loading) {
    return <div className="flex justify-center p-8">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
        エラー: {error}
      </div>
    );
  }

  const statusLabels = {
    draft: '下書き',
    approved: '承認済み',
    archived: 'アーカイブ'
  };

  return (
    <div className="space-y-6">
      <StatusChangeForm templateId={templateId} onStatusChange={handleStatusChange} />
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                日時
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                変更前
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                変更後
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                コメント
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                担当者
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((entry) => (
              <tr key={entry.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(entry.created_at).toLocaleString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {statusLabels[entry.old_status as keyof typeof statusLabels]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {statusLabels[entry.new_status as keyof typeof statusLabels]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {entry.comment}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {entry.user_details?.email || entry.created_by}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-md disabled:opacity-50"
          >
            前へ
          </button>
          <span className="px-4 py-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-md disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
} 
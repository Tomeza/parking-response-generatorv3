import { useState, useEffect } from 'react';

interface ApprovalHistoryEntry {
  id: string;
  template_id: string;
  old_status: string;
  new_status: string;
  comment: string;
  approved_by: string;
  created_at: string;
}

interface PaginationMetadata {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface ApprovalHistoryProps {
  templateId: string;
  onError?: (error: Error) => void;
}

const statusLabels = {
  draft: '下書き',
  pending: '承認待ち',
  approved: '承認済み',
  archived: 'アーカイブ'
};

export default function ApprovalHistory({ templateId, onError }: ApprovalHistoryProps) {
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async (page = 1) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/templates/${templateId}/approval-history?page=${page}&per_page=10`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        throw new Error('履歴の取得に失敗しました');
      }

      const data = await response.json();
      setHistory(data.data);
      setPagination(data.pagination);
    } catch (err) {
      if (err instanceof Error && onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [templateId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">承認履歴</h2>
      </div>

      <div className="divide-y divide-gray-200">
        {history.map(entry => (
          <div key={entry.id} className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {entry.approved_by}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(entry.created_at).toLocaleString('ja-JP')}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-700">
                ステータスを
                <span className="font-medium">{statusLabels[entry.old_status as keyof typeof statusLabels]}</span>
                から
                <span className="font-medium">{statusLabels[entry.new_status as keyof typeof statusLabels]}</span>
                に変更
              </p>
              {entry.comment && (
                <p className="mt-1 text-sm text-gray-500">
                  {entry.comment}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {pagination && (pagination.total_pages > 1) && (
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => fetchHistory(pagination.current_page - 1)}
            disabled={!pagination.has_previous}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            前のページ
          </button>
          <span className="text-sm text-gray-700">
            {pagination.current_page} / {pagination.total_pages} ページ
          </span>
          <button
            onClick={() => fetchHistory(pagination.current_page + 1)}
            disabled={!pagination.has_next}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            次のページ
          </button>
        </div>
      )}
    </div>
  );
} 
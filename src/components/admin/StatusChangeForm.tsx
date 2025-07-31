'use client';

import { useState } from 'react';
import { useAuth } from '../../app/admin/hooks/useAuth';

interface StatusChangeFormProps {
  templateId: string;
  onStatusChange: () => void;
}

type Status = 'draft' | 'approved' | 'archived';

const statusOptions = [
  { value: 'draft', label: '下書き' },
  { value: 'approved', label: '承認済み' },
  { value: 'archived', label: 'アーカイブ' }
] as const;

export function StatusChangeForm({ templateId, onStatusChange }: StatusChangeFormProps) {
  const [status, setStatus] = useState<Status>('draft');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // 権限チェック（承認者または管理者のみ表示）
  const canChangeStatus = user?.role === 'approver' || user?.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canChangeStatus) {
      setError('ステータス変更の権限がありません');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/templates/${templateId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          comment
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'ステータス変更に失敗しました');
      }

      // フォームをリセット
      setComment('');
      
      // 親コンポーネントに変更を通知
      onStatusChange();

    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (!canChangeStatus) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            ステータス
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={loading}
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
            コメント
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            rows={3}
            placeholder="ステータス変更の理由を入力してください"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`
              inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white
              ${loading
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }
            `}
          >
            {loading ? '処理中...' : 'ステータスを変更'}
          </button>
        </div>
      </div>
    </form>
  );
} 
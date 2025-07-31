import { useState } from 'react';

interface ApprovalFlowProps {
  templateId: string;
  currentStatus: 'draft' | 'pending' | 'approved' | 'archived';
  userRole: 'user' | 'editor' | 'approver' | 'admin';
  onStatusChange: (newStatus: string, comment: string) => Promise<void>;
}

const statusTransitions = {
  draft: ['pending'],
  pending: ['approved', 'draft'],
  approved: ['archived'],
  archived: ['draft']
};

const statusLabels = {
  draft: '下書き',
  pending: '承認待ち',
  approved: '承認済み',
  archived: 'アーカイブ'
};

// ロールに応じた承認権限を定義
const getApprovalPermissions = (userRole: string, currentStatus: string) => {
  switch (userRole) {
    case 'user':
      return {
        canSubmitForApproval: false,
        canApprove: false,
        canReject: false,
        canArchive: false,
      };
    case 'editor':
      return {
        canSubmitForApproval: currentStatus === 'draft',
        canApprove: false,
        canReject: false,
        canArchive: false,
      };
    case 'approver':
      return {
        canSubmitForApproval: currentStatus === 'draft',
        canApprove: currentStatus === 'pending',
        canReject: currentStatus === 'pending',
        canArchive: false,
      };
    case 'admin':
      return {
        canSubmitForApproval: true,
        canApprove: true,
        canReject: true,
        canArchive: true,
      };
    default:
      return {
        canSubmitForApproval: false,
        canApprove: false,
        canReject: false,
        canArchive: false,
      };
  }
};

export default function ApprovalFlow({ templateId, currentStatus, userRole, onStatusChange }: ApprovalFlowProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTransitions = statusTransitions[currentStatus] || [];
  const permissions = getApprovalPermissions(userRole, currentStatus);

  const handleSubmit = async (newStatus: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onStatusChange(newStatus, comment);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '承認ステータスの更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">承認フロー</h2>
        <p className="mt-1 text-sm text-gray-500">
          現在のステータス: <span className="font-medium">{statusLabels[currentStatus]}</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          ユーザーロール: <span className="font-medium">{userRole}</span>
        </p>
      </div>

      <div className="mb-6">
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
          コメント
        </label>
        <textarea
          id="comment"
          rows={4}
          className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="ステータス変更の理由や備考を入力してください"
        />
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {/* 承認待ちに提出 - 編集者以上 */}
        {permissions.canSubmitForApproval && availableTransitions.includes('pending') && (
          <button
            onClick={() => handleSubmit('pending')}
            disabled={isSubmitting}
            className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            承認待ちに提出
          </button>
        )}
        
        {/* 承認 - 承認者以上 */}
        {permissions.canApprove && availableTransitions.includes('approved') && (
          <button
            onClick={() => handleSubmit('approved')}
            disabled={isSubmitting}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            承認
          </button>
        )}
        
        {/* 却下（下書きに戻す）- 承認者以上 */}
        {permissions.canReject && availableTransitions.includes('draft') && (
          <button
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting}
            className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            却下
          </button>
        )}
        
        {/* アーカイブ - 管理者のみ */}
        {permissions.canArchive && availableTransitions.includes('archived') && (
          <button
            onClick={() => handleSubmit('archived')}
            disabled={isSubmitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            アーカイブ
          </button>
        )}
        
        {/* 権限がない場合のメッセージ */}
        {!permissions.canSubmitForApproval && !permissions.canApprove && !permissions.canReject && !permissions.canArchive && (
          <span className="text-sm text-gray-500">
            このステータスでの操作権限がありません
          </span>
        )}
      </div>
    </div>
  );
} 
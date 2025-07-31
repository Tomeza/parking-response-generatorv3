import { useState } from 'react';

interface Template {
  id: string;
  category: string;
  intent: string;
  tone: string;
  body: string;
  status: 'draft' | 'pending' | 'approved' | 'archived';
  created_at: string;
  updated_at: string;
}

interface TemplateListProps {
  templates: Template[];
  userRole: 'user' | 'editor' | 'approver' | 'admin';
  onTemplateSelect?: (templateId: string) => void;
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  archived: 'bg-red-100 text-red-800',
};

const statusLabels = {
  draft: '下書き',
  pending: '承認待ち',
  approved: '承認済み',
  archived: 'アーカイブ',
};

// ロールに応じた操作権限を定義
const getRolePermissions = (userRole: string, templateStatus: string) => {
  switch (userRole) {
    case 'user':
      return {
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canViewHistory: false,
      };
    case 'editor':
      return {
        canEdit: templateStatus === 'draft',
        canDelete: false,
        canApprove: false,
        canViewHistory: false,
      };
    case 'approver':
      return {
        canEdit: templateStatus === 'draft',
        canDelete: false,
        canApprove: templateStatus === 'pending',
        canViewHistory: true,
      };
    case 'admin':
      return {
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canViewHistory: true,
      };
    default:
      return {
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canViewHistory: false,
      };
  }
};

export default function TemplateList({ templates, userRole, onTemplateSelect }: TemplateListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.intent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['all', ...new Set(templates.map(t => t.category))];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* フィルターとサーチ */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'すべてのカテゴリー' : category}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="テンプレートを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2"
          />
        </div>
      </div>

      {/* テンプレート一覧 */}
      <div className="grid gap-6">
        {filteredTemplates.map(template => {
          const permissions = getRolePermissions(userRole, template.status);
          
          return (
            <div
              key={template.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              onClick={() => onTemplateSelect?.(template.id)}
              role="button"
              tabIndex={0}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">
                    {template.category}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[template.status]}`}>
                    {statusLabels[template.status]}
                  </span>
                  {/* ロール表示 */}
                  <span className="text-xs text-gray-500">
                    ({userRole})
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  最終更新: {new Date(template.updated_at).toLocaleString('ja-JP')}
                </div>
              </div>
              <div className="mb-4">
                <h3 className="mb-2 text-lg font-medium">{template.intent}</h3>
                <p className="whitespace-pre-wrap text-gray-600">{template.body}</p>
              </div>
              <div className="flex items-center justify-end gap-3">
                {/* 編集ボタン - 権限に応じて表示 */}
                {permissions.canEdit && (
                  <button
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      /* 編集ハンドラー */
                    }}
                  >
                    編集
                  </button>
                )}
                
                {/* 削除ボタン - 管理者のみ */}
                {permissions.canDelete && (
                  <button
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      /* 削除ハンドラー */
                    }}
                  >
                    削除
                  </button>
                )}
                
                {/* 承認フローボタン - 権限に応じて表示 */}
                {permissions.canApprove && (
                  <button
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTemplateSelect?.(template.id);
                    }}
                  >
                    承認フロー
                  </button>
                )}
                
                {/* 履歴ボタン - 権限に応じて表示 */}
                {permissions.canViewHistory && (
                  <button
                    className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTemplateSelect?.(template.id);
                    }}
                  >
                    履歴
                  </button>
                )}
                
                {/* 権限がない場合のメッセージ */}
                {!permissions.canEdit && !permissions.canDelete && !permissions.canApprove && !permissions.canViewHistory && (
                  <span className="text-sm text-gray-500">
                    閲覧のみ
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 
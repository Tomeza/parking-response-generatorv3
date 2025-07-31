'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TemplateList from '@/components/templates/TemplateList';
import ApprovalFlow from '@/components/templates/ApprovalFlow';
import ApprovalHistory from '@/components/templates/ApprovalHistory';

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

interface User {
  id: string;
  email: string;
  user_metadata: {
    role?: 'user' | 'editor' | 'approver' | 'admin';
  };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('No session found, redirecting to login');
          router.push('/auth/login?redirect=/templates');
          return;
        }
        setIsAuthenticated(true);
        setUser(session.user as User);
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/auth/login?redirect=/templates');
      }
    };

    checkAuth();
  }, [router]);

  // テンプレート一覧を取得
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching templates...');
        const response = await fetch('/api/templates');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error:', errorText);
          throw new Error('テンプレートの取得に失敗しました');
        }
        
        const data = await response.json();
        console.log('Templates data:', data);
        setTemplates(data.templates || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [isAuthenticated]);

  const handleStatusChange = async (newStatus: string, comment: string) => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch(`/api/templates/${selectedTemplate}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, comment }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ステータスの更新に失敗しました');
      }

      // 成功時は一覧を再取得
      const templatesResponse = await fetch('/api/templates');
      if (templatesResponse.ok) {
        const data = await templatesResponse.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  };

  // 一時的にロールを固定
  const userRole = 'admin';

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">認証中...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">テンプレートを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">エラーが発生しました</h2>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">テンプレート管理</h1>
              <p className="mt-2 text-sm text-gray-600">
                テンプレートの作成、編集、承認フローの管理を行います。
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">ログイン中: {user?.email || 'test@example.com'}</p>
              <p className="text-sm font-medium text-indigo-600">
                ロール: 管理者
              </p>
            </div>
          </div>
        </div>

        {/* ロール別の権限表示 */}
        <div className="mb-6 rounded-lg bg-blue-50 p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">現在の権限</h3>
          <div className="text-sm text-blue-700">
            <p>• 全テンプレートの閲覧・編集・削除・承認操作</p>
          </div>
        </div>

        {/* デバッグ情報 */}
        <div className="mb-6 rounded-lg bg-yellow-50 p-4">
          <h3 className="text-sm font-medium text-yellow-900 mb-2">デバッグ情報</h3>
          <div className="text-sm text-yellow-700">
            <p>テンプレート数: {templates.length}</p>
            <p>選択中テンプレート: {selectedTemplate || 'なし'}</p>
            <p>認証状態: {isAuthenticated ? '認証済み' : '未認証'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TemplateList
              templates={templates}
              userRole={userRole}
              onTemplateSelect={(templateId) => setSelectedTemplate(templateId)}
            />
          </div>
          <div className="space-y-8">
            {selectedTemplate && (
              <>
                <ApprovalFlow
                  templateId={selectedTemplate}
                  currentStatus="draft"
                  userRole={userRole}
                  onStatusChange={handleStatusChange}
                />
                <ApprovalHistory
                  templateId={selectedTemplate}
                  onError={(error) => console.error('Error fetching history:', error)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
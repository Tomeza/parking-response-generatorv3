'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TemplateList from '@/components/templates/TemplateList';
import ApprovalFlow from '@/components/templates/ApprovalFlow';
import ApprovalHistory from '@/components/templates/ApprovalHistory';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [userRole, setUserRole] = useState('admin');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data: templatesData, error: templatesError } = await supabase
          .from('templates')
          .select('*')
          .order('created_at', { ascending: false });

        if (templatesError) {
          setError('テンプレートの取得に失敗しました');
          setLoading(false);
          return;
        }

        setTemplates(templatesData || []);
        setLoading(false);
      } catch (err) {
        setError('予期せぬエラーが発生しました');
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [supabase]);

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
      const { data: templatesData, error: templatesError } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (!templatesError) {
        setTemplates(templatesData || []);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        return;
      }
      
      // ログアウト後はログインページにリダイレクト
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <button
            onClick={() => router.push('/auth/login?redirect=/templates')}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            ログインページに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              テンプレート管理
            </h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                ユーザー: {userRole}
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
              >
                ログアウト
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TemplateList 
                templates={templates} 
                userRole={userRole as 'user' | 'editor' | 'approver' | 'admin'}
                onTemplateSelect={setSelectedTemplate}
              />
            </div>
            <div className="space-y-6">
              {selectedTemplate && (
                <>
                  <ApprovalFlow 
                    templateId={selectedTemplate}
                    currentStatus="draft"
                    userRole={userRole as 'user' | 'editor' | 'approver' | 'admin'}
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
    </div>
  );
} 
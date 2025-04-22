'use client';

import { useState } from 'react';
import { AdminTabs } from './components/AdminTabs';
import KnowledgeList from './components/KnowledgeList';
import TagList from './components/TagList';
import ResponseHistory from './components/ResponseHistory';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'tags' | 'history'>('knowledge');

  return (
    <main className="min-h-screen p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">管理画面</h1>
        <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          生成画面に戻る
        </a>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="mt-6">
          {activeTab === 'knowledge' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">ナレッジ一覧</h2>
                <a
                  href="/admin/knowledge/new"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  新規作成
                </a>
              </div>
              <KnowledgeList />
            </div>
          )}
          
          {activeTab === 'tags' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">タグ管理</h2>
              <TagList />
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">返信履歴</h2>
              <ResponseHistory />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import KnowledgeList from './components/KnowledgeList';
import TagList from './components/TagList';

type Tab = {
  id: string;
  label: string;
};

const tabs: Tab[] = [
  { id: 'history', label: '回答履歴' },
  { id: 'knowledge', label: 'ナレッジ管理' },
  { id: 'tags', label: 'タグ管理' },
  { id: 'settings', label: 'システム設定' }
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>(tabs[0].id);
  const [displayMode, setDisplayMode] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="min-h-screen bg-black">
      <h1 className="text-white text-2xl p-4">管理パネル</h1>
      
      <div className="border-b border-white">
        <Link href="/" className="text-purple-400 p-4 inline-block">
          Parking Response Generator
        </Link>
        <span className="float-right p-4 text-white">管理画面</span>
      </div>

      <div className="p-4">
        <div className="inline-block">
          <button
            onClick={() => setDisplayMode('desktop')}
            className={`border border-white px-4 py-1 ${
              displayMode === 'desktop' ? 'bg-white text-black' : 'text-white'
            }`}
          >
            デスクトップ表示
          </button>
          <button
            onClick={() => setDisplayMode('mobile')}
            className={`border border-white px-4 py-1 border-l-0 ${
              displayMode === 'mobile' ? 'bg-white text-black' : 'text-white'
            }`}
          >
            モバイル表示
          </button>
        </div>

        <table className="w-full border-collapse mt-4">
          <thead>
            <tr>
              {tabs.map((tab, index) => (
                <th
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    border border-white p-2 cursor-pointer
                    ${activeTab === tab.id ? 'bg-white text-black' : 'text-white'}
                  `}
                >
                  {tab.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>

        {activeTab === 'history' && (
          <div className="border border-white border-t-0">
            <div className="text-white text-xl p-4 border-b border-white">回答履歴</div>
            <table className="w-full border-collapse text-white">
              <thead>
                <tr>
                  <th className="border-b border-white p-4 text-left font-normal">日時</th>
                  <th className="border-b border-white p-4 text-left font-normal">質問</th>
                  <th className="border-b border-white p-4 text-left font-normal">回答</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-4 border-b border-white">2025-02-25 14:30</td>
                  <td className="p-4 border-b border-white">11月1日に出発して11月6日朝帰国です...</td>
                  <td className="p-4 border-b border-white">データ取得中...</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-white">2025-02-25 14:15</td>
                  <td className="p-4 border-b border-white">予約方法を教えてください</td>
                  <td className="p-4 border-b border-white">データ取得中...</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="border border-white border-t-0 text-white">
            <div className="text-xl p-4 border-b border-white">ナレッジ管理</div>
            <div className="p-4">
              <KnowledgeList />
            </div>
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="border border-white border-t-0 text-white">
            <div className="text-xl p-4 border-b border-white">タグ管理</div>
            <div className="p-4">
              <TagList />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="border border-white border-t-0 text-white">
            <div className="text-xl p-4 border-b border-white">システム設定</div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block mb-2">API設定</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
                  placeholder="APIキーを入力"
                />
              </div>
              <div>
                <label className="block mb-2">データベース設定</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
                  placeholder="接続文字列を入力"
                />
              </div>
              <button className="w-full px-4 py-2 bg-white text-black">
                設定を保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

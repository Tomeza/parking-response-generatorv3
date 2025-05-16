'use client';

import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function ResponseTabs() {
  const [activeTab, setActiveTab] = useState('response');

  const tabs: Tab[] = [
    {
      id: 'response',
      label: '回答',
      content: (
        <div className="p-4">
          <textarea
            className="w-full h-48 p-3 text-gray-800 bg-white border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="生成された回答がここに表示されます..."
            readOnly
          />
        </div>
      ),
    },
    {
      id: 'history',
      label: '履歴',
      content: (
        <div className="p-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm text-gray-500">2024/03/20 15:30</div>
              <div className="text-xs text-gray-400">ID: 123</div>
            </div>
            <div className="text-gray-800 text-sm">
              申し訳ございません。国際線をご利用のお客様は、当駐車場をご利用いただけません。
              近隣の国際線専用駐車場をご案内させていただきますので、お手数ですが再度お問い合わせください。
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-gray-50 rounded">
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-[300px]">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
} 
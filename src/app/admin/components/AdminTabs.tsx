interface AdminTabsProps {
  activeTab: 'knowledge' | 'tags' | 'history';
  onTabChange: (tab: 'knowledge' | 'tags' | 'history') => void;
}

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  const tabs = [
    { id: 'knowledge', label: 'ナレッジ管理' },
    { id: 'tags', label: 'タグ管理' },
    { id: 'history', label: '返信履歴' },
    { id: 'usage', label: '使用統計' }
  ] as const;

  return (
    <div className="flex space-x-1 bg-gray-700 p-1 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id as 'knowledge' | 'tags' | 'history')}
          className={`
            flex-1 px-4 py-2 text-sm font-medium rounded-md
            ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-600'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

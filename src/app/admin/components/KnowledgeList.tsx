'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Tag = {
  id: number;
  tag_name: string;
  description: string | null;
};

type Knowledge = {
  id: number;
  main_category: string | null;
  sub_category: string | null;
  detail_category: string | null;
  question: string | null;
  answer: string;
  is_template: boolean;
  usage: string | null;
  note: string | null;
  issue: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
};

type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function KnowledgeList() {
  const router = useRouter();
  const [knowledgeList, setKnowledgeList] = useState<Knowledge[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKnowledgeList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (search) {
        queryParams.append('search', search);
      }
      
      if (category) {
        queryParams.append('category', category);
      }
      
      const response = await fetch(`/api/knowledge?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge data');
      }
      
      const data = await response.json();
      setKnowledgeList(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching knowledge:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeList();
  }, [pagination.page, pagination.limit]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchKnowledgeList();
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleEdit = (id: number) => {
    router.push(`/admin/knowledge/${id}`);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このナレッジを削除してもよろしいですか？')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete knowledge');
      }
      
      fetchKnowledgeList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error deleting knowledge:', err);
    }
  };

  return (
    <div className="text-white">
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="カテゴリ..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
          />
        </div>
        <div className="flex-none">
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-white text-black"
          >
            検索
          </button>
        </div>
        <div className="flex-none">
          <button
            onClick={() => router.push('/admin/knowledge/new')}
            className="px-4 py-2 bg-purple-600 text-white"
          >
            新規作成
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          <p className="mt-2">読み込み中...</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-white p-2 text-left">ID</th>
                  <th className="border border-white p-2 text-left">カテゴリ</th>
                  <th className="border border-white p-2 text-left">質問</th>
                  <th className="border border-white p-2 text-left">回答</th>
                  <th className="border border-white p-2 text-left">タグ</th>
                  <th className="border border-white p-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {knowledgeList.length > 0 ? (
                  knowledgeList.map((knowledge) => (
                    <tr key={knowledge.id}>
                      <td className="border border-white p-2">{knowledge.id}</td>
                      <td className="border border-white p-2">
                        {knowledge.main_category && (
                          <div>{knowledge.main_category}</div>
                        )}
                        {knowledge.sub_category && (
                          <div>{knowledge.sub_category}</div>
                        )}
                        {knowledge.detail_category && (
                          <div>{knowledge.detail_category}</div>
                        )}
                      </td>
                      <td className="border border-white p-2">
                        {knowledge.question || '-'}
                      </td>
                      <td className="border border-white p-2">
                        {knowledge.answer.length > 100
                          ? `${knowledge.answer.substring(0, 100)}...`
                          : knowledge.answer}
                      </td>
                      <td className="border border-white p-2">
                        <div className="flex flex-wrap gap-1">
                          {knowledge.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="bg-gray-700 px-2 py-1 text-xs rounded"
                            >
                              {tag.tag_name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="border border-white p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(knowledge.id)}
                            className="bg-blue-600 text-white px-2 py-1 text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(knowledge.id)}
                            className="bg-red-600 text-white px-2 py-1 text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="border border-white p-4 text-center">
                      データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                  className={`px-3 py-1 border border-white ${
                    pagination.page === 1 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  &laquo;
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className={`px-3 py-1 border border-white ${
                    pagination.page === 1 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  &lt;
                </button>
                
                <span className="px-3 py-1 border border-white bg-white text-black">
                  {pagination.page} / {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className={`px-3 py-1 border border-white ${
                    pagination.page === pagination.totalPages ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  &gt;
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages}
                  className={`px-3 py-1 border border-white ${
                    pagination.page === pagination.totalPages ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 
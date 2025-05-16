'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {knowledgeList.map((item) => (
        <div key={item.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600">
          <Link href={`/admin/knowledge/${item.id}`} className="block">
            <h3 className="text-lg font-medium text-white mb-2">{item.question || '-'}</h3>
            <p className="text-gray-300 text-sm line-clamp-2 mb-4">{item.answer.length > 100 ? `${item.answer.substring(0, 100)}...` : item.answer}</p>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded"
                >
                  {tag.tag_name}
                </span>
              ))}
            </div>
            <div className="mt-4 text-xs text-gray-400">
              最終更新: {new Date(item.updatedAt).toLocaleString('ja-JP')}
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
} 
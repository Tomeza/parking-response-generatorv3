'use client';

import { useState, useEffect } from 'react';
import TagForm from './TagForm';

type TagSynonym = {
  id: number;
  tag_id: number;
  synonym: string;
};

type Tag = {
  id: number;
  tag_name: string;
  description: string | null;
  tag_synonyms: TagSynonym[];
};

export default function TagList() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const fetchTags = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      
      if (search) {
        queryParams.append('search', search);
      }
      
      const response = await fetch(`/api/tags?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      
      const data = await response.json();
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching tags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleSearch = () => {
    fetchTags();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このタグを削除してもよろしいですか？')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete tag');
      }
      
      fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error deleting tag:', err);
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTag(null);
  };

  const handleFormSubmit = () => {
    fetchTags();
    setShowForm(false);
    setEditingTag(null);
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
            onClick={() => setShowForm(true)}
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

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <TagForm
              tag={editingTag}
              onClose={handleFormClose}
              onSubmit={handleFormSubmit}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          <p className="mt-2">読み込み中...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-white p-2 text-left">ID</th>
                <th className="border border-white p-2 text-left">タグ名</th>
                <th className="border border-white p-2 text-left">説明</th>
                <th className="border border-white p-2 text-left">シノニム</th>
                <th className="border border-white p-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <tr key={tag.id}>
                    <td className="border border-white p-2">{tag.id}</td>
                    <td className="border border-white p-2">{tag.tag_name}</td>
                    <td className="border border-white p-2">{tag.description || '-'}</td>
                    <td className="border border-white p-2">
                      <div className="flex flex-wrap gap-1">
                        {tag.tag_synonyms.map((synonym) => (
                          <span
                            key={synonym.id}
                            className="bg-gray-700 px-2 py-1 text-xs rounded"
                          >
                            {synonym.synonym}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="border border-white p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(tag)}
                          className="bg-blue-600 text-white px-2 py-1 text-sm"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(tag.id)}
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
                  <td colSpan={5} className="border border-white p-4 text-center">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 
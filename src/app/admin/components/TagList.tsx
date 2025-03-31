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
  count: number;
};

export default function TagList() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState('');

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

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName }),
      });

      if (!res.ok) throw new Error('Failed to add tag');

      const newTag = await res.json();
      setTags([...tags, newTag]);
      setNewTagName('');
    } catch (error) {
      console.error('Error adding tag:', error);
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
      <div className="flex gap-2">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="新しいタグ名"
          className="flex-1 bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={handleAddTag}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          追加
        </button>
      </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <div key={tag.id} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-white">{tag.tag_name}</span>
                <span className="text-gray-400 text-sm">{tag.count}件</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 
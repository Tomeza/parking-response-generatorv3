'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Tag = {
  id: number;
  tag_name: string;
  description: string | null;
};

type KnowledgeFormData = {
  main_category: string;
  sub_category: string;
  detail_category: string;
  question: string;
  answer: string;
  is_template: boolean;
  usage: string;
  note: string;
  issue: string;
  tags: number[];
};

type KnowledgeFormProps = {
  knowledgeId?: number;
};

export default function KnowledgeForm({ knowledgeId }: KnowledgeFormProps) {
  const router = useRouter();
  const isEditMode = !!knowledgeId;
  
  const [formData, setFormData] = useState<KnowledgeFormData>({
    main_category: '',
    sub_category: '',
    detail_category: '',
    question: '',
    answer: '',
    is_template: false,
    usage: '',
    note: '',
    issue: '',
    tags: []
  });
  
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags');
        
        if (!response.ok) {
          throw new Error('Failed to fetch tags');
        }
        
        const data = await response.json();
        setAvailableTags(data);
      } catch (err) {
        console.error('Error fetching tags:', err);
        setError('タグの取得に失敗しました');
      }
    };
    
    const fetchKnowledge = async () => {
      if (!isEditMode) {
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/knowledge/${knowledgeId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch knowledge');
        }
        
        const data = await response.json();
        
        setFormData({
          main_category: data.main_category || '',
          sub_category: data.sub_category || '',
          detail_category: data.detail_category || '',
          question: data.question || '',
          answer: data.answer || '',
          is_template: data.is_template || false,
          usage: data.usage || '',
          note: data.note || '',
          issue: data.issue || '',
          tags: data.tags.map((tag: Tag) => tag.id)
        });
      } catch (err) {
        console.error('Error fetching knowledge:', err);
        setError('ナレッジの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    Promise.all([fetchTags(), fetchKnowledge()]);
  }, [isEditMode, knowledgeId]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleTagChange = (tagId: number) => {
    setFormData(prev => {
      const tagIndex = prev.tags.indexOf(tagId);
      
      if (tagIndex === -1) {
        // タグを追加
        return { ...prev, tags: [...prev.tags, tagId] };
      } else {
        // タグを削除
        return {
          ...prev,
          tags: prev.tags.filter(id => id !== tagId)
        };
      }
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      
      const url = isEditMode
        ? `/api/knowledge/${knowledgeId}`
        : '/api/knowledge';
      
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save knowledge');
      }
      
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error saving knowledge:', err);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="text-white text-center p-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        <p className="mt-2">読み込み中...</p>
      </div>
    );
  }
  
  return (
    <div className="text-white">
      <h2 className="text-xl mb-4">
        {isEditMode ? 'ナレッジを編集' : 'ナレッジを作成'}
      </h2>
      
      {error && (
        <div className="bg-red-600 text-white p-4 mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block mb-1">メインカテゴリ</label>
            <input
              type="text"
              name="main_category"
              value={formData.main_category}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block mb-1">サブカテゴリ</label>
            <input
              type="text"
              name="sub_category"
              value={formData.sub_category}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block mb-1">詳細カテゴリ</label>
            <input
              type="text"
              name="detail_category"
              value={formData.detail_category}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
            />
          </div>
        </div>
        
        <div>
          <label className="block mb-1">質問</label>
          <textarea
            name="question"
            value={formData.question}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
          />
        </div>
        
        <div>
          <label className="block mb-1">回答</label>
          <textarea
            name="answer"
            value={formData.answer}
            onChange={handleChange}
            rows={6}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">用途</label>
            <input
              type="text"
              name="usage"
              value={formData.usage}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
            />
          </div>
          
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="is_template"
                checked={formData.is_template}
                onChange={handleCheckboxChange}
                className="mr-2"
              />
              テンプレートとして使用
            </label>
          </div>
        </div>
        
        <div>
          <label className="block mb-1">備考</label>
          <textarea
            name="note"
            value={formData.note}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
          />
        </div>
        
        <div>
          <label className="block mb-1">課題</label>
          <textarea
            name="issue"
            value={formData.issue}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none"
          />
        </div>
        
        <div>
          <label className="block mb-1">タグ</label>
          <div className="flex flex-wrap gap-2 p-4 border border-white">
            {availableTags.map(tag => (
              <label key={tag.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.tags.includes(tag.id)}
                  onChange={() => handleTagChange(tag.id)}
                  className="mr-1"
                />
                <span>{tag.tag_name}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 bg-white text-black ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="px-4 py-2 border border-white text-white"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
} 
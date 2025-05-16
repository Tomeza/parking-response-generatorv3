'use client';

import { useState, useEffect } from 'react';

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

type TagFormProps = {
  tag: Tag | null;
  onClose: () => void;
  onSubmit: () => void;
};

export default function TagForm({ tag, onClose, onSubmit }: TagFormProps) {
  const isEditMode = !!tag;
  
  const [formData, setFormData] = useState({
    tag_name: '',
    description: '',
    synonyms: [] as string[]
  });
  
  const [newSynonym, setNewSynonym] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (tag) {
      setFormData({
        tag_name: tag.tag_name,
        description: tag.description || '',
        synonyms: tag.tag_synonyms.map(s => s.synonym)
      });
    }
  }, [tag]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAddSynonym = () => {
    if (!newSynonym.trim()) return;
    
    if (formData.synonyms.includes(newSynonym.trim())) {
      setError('同じシノニムが既に存在します');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      synonyms: [...prev.synonyms, newSynonym.trim()]
    }));
    
    setNewSynonym('');
    setError(null);
  };
  
  const handleRemoveSynonym = (index: number) => {
    setFormData(prev => ({
      ...prev,
      synonyms: prev.synonyms.filter((_, i) => i !== index)
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tag_name.trim()) {
      setError('タグ名は必須です');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const url = isEditMode
        ? `/api/tags/${tag.id}`
        : '/api/tags';
      
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save tag');
      }
      
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error saving tag:', err);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl text-white">
          {isEditMode ? 'タグを編集' : 'タグを作成'}
        </h2>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300"
        >
          ✕
        </button>
      </div>
      
      {error && (
        <div className="bg-red-600 text-white p-4 mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 text-white">タグ名</label>
          <input
            type="text"
            name="tag_name"
            value={formData.tag_name}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none text-white"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1 text-white">説明</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 bg-transparent border border-white focus:outline-none text-white"
          />
        </div>
        
        <div>
          <label className="block mb-1 text-white">シノニム</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newSynonym}
              onChange={(e) => setNewSynonym(e.target.value)}
              className="flex-1 px-4 py-2 bg-transparent border border-white focus:outline-none text-white"
              placeholder="新しいシノニム"
            />
            <button
              type="button"
              onClick={handleAddSynonym}
              className="px-4 py-2 bg-blue-600 text-white"
            >
              追加
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 p-4 border border-white">
            {formData.synonyms.length > 0 ? (
              formData.synonyms.map((synonym, index) => (
                <div
                  key={index}
                  className="bg-gray-700 px-2 py-1 text-sm rounded flex items-center text-white"
                >
                  <span>{synonym}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSynonym(index)}
                    className="ml-2 text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <div className="text-gray-400">シノニムがありません</div>
            )}
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
            onClick={onClose}
            className="px-4 py-2 border border-white text-white"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
} 
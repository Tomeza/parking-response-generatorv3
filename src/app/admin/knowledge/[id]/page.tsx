'use client';

import { useParams } from 'next/navigation';
import KnowledgeForm from '../../components/KnowledgeForm';
import Link from 'next/link';

export default function EditKnowledgePage() {
  const params = useParams();
  const knowledgeId = params.id === 'new' ? undefined : parseInt(params.id as string);
  
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="mb-4">
        <Link href="/admin" className="text-purple-400 hover:underline">
          ← 管理画面に戻る
        </Link>
      </div>
      
      <KnowledgeForm knowledgeId={knowledgeId} />
    </div>
  );
} 
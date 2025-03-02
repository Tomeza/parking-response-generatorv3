'use client';

import { useState } from 'react';
import QueryInput from '@/components/QueryInput';
import ProcessSteps from '@/components/ProcessSteps';
import ResponseDisplay from '@/components/ResponseDisplay';

interface Step {
  step: string;
  content: any;
}

interface QueryResponse {
  response: string;
  steps: Step[];
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  const handleSubmit = async (queryText: string) => {
    setQuery(queryText);
    setIsLoading(true);
    
    try {
      const res = await fetch(`/api/query?q=${encodeURIComponent(queryText)}`);
      
      if (!res.ok) {
        throw new Error('API request failed');
      }
      
      const data: QueryResponse = await res.json();
      setResponse(data.response);
      setSteps(data.steps);
    } catch (error) {
      console.error('Error fetching response:', error);
      setResponse('エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!response) return;
    
    setIsRefining(true);
    
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_response: response,
          tone: 'formal',
        }),
      });
      
      if (!res.ok) {
        throw new Error('API request failed');
      }
      
      const data = await res.json();
      setResponse(data.refined_response);
    } catch (error) {
      console.error('Error refining response:', error);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-8">駐車場問い合わせ返信メール作成</h1>
      
      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-6">
        {/* 左ペイン: 入力と生成過程 */}
        <div className="w-full md:w-1/2 space-y-6">
          <QueryInput onSubmit={handleSubmit} isLoading={isLoading} />
          <ProcessSteps steps={steps} isLoading={isLoading} />
        </div>
        
        {/* 右ペイン: 返信文表示 */}
        <div className="w-full md:w-1/2">
          <ResponseDisplay
            response={response}
            isLoading={isLoading}
            onRefine={handleRefine}
            isRefining={isRefining}
          />
        </div>
      </div>
    </main>
  );
}

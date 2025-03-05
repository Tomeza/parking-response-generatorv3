'use client';

import { useState } from 'react';
import QueryInput from '@/components/QueryInput';
import ResponseDisplay from '@/components/ResponseDisplay';
import ProcessSteps from '@/components/ProcessSteps';

export default function Home() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<number | null>(null);
  const [steps, setSteps] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  const handleSubmit = async (inputQuery: string) => {
    setQuery(inputQuery);
    setIsLoading(true);
    setResponse(null);
    setResponseId(null);
    setSteps(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: inputQuery }),
      });

      if (!res.ok) {
        throw new Error('API request failed');
      }

      const data = await res.json();
      setResponse(data.response);
      setResponseId(data.responseId);
      
      // Process steps data transformation
      if (data.steps) {
        const transformedSteps = [];
        
        // Alert words step
        if (data.steps.alertWords && data.steps.alertWords.length > 0) {
          transformedSteps.push({
            id: 'alert-words',
            title: 'アラートワード検出',
            description: '問い合わせ内容から注意すべきワードを検出しました',
            type: 'alert',
            content: {
              alertWords: data.steps.alertWords
            }
          });
        }
        
        // Knowledge step
        if (data.steps.knowledge && data.steps.knowledge.length > 0) {
          transformedSteps.push({
            id: 'knowledge-base',
            title: 'ナレッジベース参照',
            description: '関連する情報をナレッジベースから取得しました',
            type: 'knowledge',
            content: {
              knowledge: data.steps.knowledge
            }
          });
        }
        
        // Suggestions step
        if (data.steps.suggestions && data.steps.suggestions.length > 0) {
          transformedSteps.push({
            id: 'suggestions',
            title: '改善提案',
            description: '返信内容の改善点を提案します',
            type: 'suggestion',
            content: {
              suggestions: data.steps.suggestions
            }
          });
        }
        
        setSteps(transformedSteps);
      }
    } catch (error) {
      console.error('Error:', error);
      setResponse('エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  // フィードバック送信処理
  const handleFeedback = async (isPositive: boolean) => {
    if (!responseId) return;
    
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responseId, isPositive }),
      });

      if (!res.ok) {
        throw new Error('Feedback API request failed');
      }
      
      // フィードバック送信成功の処理は ResponseDisplay コンポーネント内で行う
    } catch (error) {
      console.error('Feedback Error:', error);
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
        body: JSON.stringify({ text: response }),
      });

      if (!res.ok) {
        throw new Error('API request failed');
      }

      const data = await res.json();
      setResponse(data.refinedText);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <QueryInput onSubmit={handleSubmit} isLoading={isLoading} />
          
          {steps && steps.length > 0 && (
            <div className="mt-6">
              <ProcessSteps steps={steps} isLoading={isLoading} />
            </div>
          )}
        </div>
        
        <div className="lg:col-span-2">
          <ResponseDisplay 
            response={response} 
            isLoading={isLoading} 
            onRefine={handleRefine}
            isRefining={isRefining}
            onFeedback={handleFeedback}
            hasResponseId={responseId !== null}
          />
        </div>
      </div>
    </div>
  );
}

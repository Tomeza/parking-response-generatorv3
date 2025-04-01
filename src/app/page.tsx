'use client';

import { useState, useEffect } from 'react';
import { ProcessSteps } from '@/components/ProcessSteps';
import { ResponseArea } from '@/components/ResponseArea';
import { HistoryList } from '@/components/HistoryList';
import { HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/outline';

// ResponseLogの型定義を追加
interface ResponseLog {
  id: number;
  query: string;
  response: string | null;
  response_count: number;
  created_at: Date;
}

// formatDateToJapanese関数を追加
function formatDateToJapanese(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResponse, setGeneratedResponse] = useState('');
  const [refinedResponse, setRefinedResponse] = useState('');
  const [generationSteps, setGenerationSteps] = useState<any[] | null>(null);
  const [responseId, setResponseId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [responseLogs, setResponseLogs] = useState<ResponseLog[]>([]);
  const [isManualRefining, setIsManualRefining] = useState(false);
  const [error, setError] = useState('');

  // 履歴データを取得する関数
  const fetchResponseLogs = async () => {
    try {
      const response = await fetch('/api/response-logs');
      if (!response.ok) {
        throw new Error('履歴の取得に失敗しました');
      }
      const data = await response.json();
      setResponseLogs(data);
    } catch (error) {
      console.error('履歴の取得中にエラーが発生しました:', error);
    }
  };

  // コンポーネントのマウント時に履歴を取得
  useEffect(() => {
    fetchResponseLogs();
  }, []);

  // デバッグ用のログ
  useEffect(() => {
    console.log('Template Response:', generatedResponse);
    console.log('AI Refined Response:', refinedResponse);
    console.log('Steps:', generationSteps);
  }, [generatedResponse, refinedResponse, generationSteps]);

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    
    setIsGenerating(true);
    setGeneratedResponse('');
    setRefinedResponse('');
    setGenerationSteps(null);
    setResponseId(null);
    setFeedback(null);
    setError('');
    
    try {
      console.log('Generating response for:', inputText);
      const res = await fetch(`/api/query?q=${encodeURIComponent(inputText)}`);
      const data = await res.json();
      
      console.log('API response:', data);
      
      setGeneratedResponse(data.response || '');
      setGenerationSteps(data.steps || []);
      setResponseId(data.responseId || null);
      
    } catch (error) {
      console.error('Error generating response:', error);
      setError('回答の生成中にエラーが発生しました。');
    } finally {
      setIsGenerating(false);
    }
  };

  // フィードバック送信処理
  const sendFeedback = async (isPositive: boolean) => {
    if (!responseId || isSendingFeedback) return;
    
    setIsSendingFeedback(true);
    try {
      const res = await fetch(`/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseId,
          feedback: isPositive,
        }),
      });
      
      if (res.ok) {
        setFeedback(isPositive);
        console.log(`Feedback sent: ${isPositive ? 'positive' : 'negative'}`);
      } else {
        console.error('Failed to send feedback');
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
    } finally {
      setIsSendingFeedback(false);
    }
  };

  // 問い合わせ例を簡単に入力できるようにする
  const applyExample = (example: string) => {
    setInputText(example);
    // 自動生成の呼び出しを削除
    // setTimeout(() => {
    //   handleGenerate();
    // }, 100);
  };

  const handleManualRefine = async () => {
    if (!generatedResponse || isManualRefining || isGenerating) return;

    setIsManualRefining(true);
    setRefinedResponse(''); // Clear previous refined response
    setError(''); // Clear previous errors

    try {
      const refineRes = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ original_response: generatedResponse, tone: 'formal' }),
      });

      if (!refineRes.ok) {
        const errorData = await refineRes.json().catch(() => ({ error: 'サーバーエラーが発生しました。' }));
        console.error('Refinement API error:', refineRes.status, errorData);
        setError(`AI清書処理中にエラーが発生しました。(HTTP ${refineRes.status}) ${errorData.error || ''}`);
        setRefinedResponse('');
        return;
      }

      const data = await refineRes.json();

      if (data.refined_response) {
        setRefinedResponse(data.refined_response);
      } else {
        console.error('Refinement API response missing data:', data);
        setError('AI清書処理は成功しましたが、予期せぬ形式の応答を受け取りました。');
        setRefinedResponse('');
      }
    } catch (err) {
      console.error('Failed to fetch refinement:', err);
      setError('AI清書処理の呼び出し中にネットワークエラーが発生しました。');
      setRefinedResponse('');
    } finally {
      setIsManualRefining(false);
    }
  };

  return (
    <main className="min-h-screen p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">駐車場問い合わせ 返信生成</h1>
        <a href="/admin" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">管理画面</a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左カラム: 入力エリア */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-32 bg-gray-700 text-white rounded p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="問い合わせを入力してください（最大500文字）"
              maxLength={500}
            />
            <div className="flex flex-wrap justify-between gap-2 mt-4">
              <div className="flex gap-2">
                <button 
                  onClick={() => applyExample("国際線の利用は可能ですか？")}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
                >
                  国際線
                </button>
                <button 
                  onClick={() => applyExample("予約方法を教えてください")}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
                >
                  予約
                </button>
                <button 
                  onClick={() => applyExample("外車の駐車は可能ですか？")}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
                >
                  外車
                </button>
              </div>
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || isManualRefining || !inputText.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isGenerating ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
          
          {/* 生成過程を常に表示する */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-4">生成過程</h3>
            {generationSteps && generationSteps.length > 0 ? (
              <ProcessSteps steps={generationSteps} />
            ) : (
              <p className="text-gray-400">生成ボタンを押すと、ここに生成過程が表示されます</p>
            )}
          </div>
        </div>

        {/* 中央カラム: テンプレート方式の回答 */}
        <div className="lg:col-span-4">
          <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">テンプレート方式</h2>
            </div>
            <div className="flex-grow">
              <ResponseArea title="" text={generatedResponse} loading={isGenerating} />
            </div>
            {generatedResponse && (
              <div className="mt-4 text-right flex-shrink-0">
                <button 
                  onClick={handleManualRefine}
                  disabled={isManualRefining || isGenerating} 
                  className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                >
                  {isManualRefining ? 'AI清書中...' : 'AI清書を実行'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右カラム: AI清書方式の回答 */}
        <div className="lg:col-span-5">
          <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">AI清書方式</h2>
            </div>
            <div className="flex-grow">
              <ResponseArea 
                title="【整えた回答】" 
                text={refinedResponse.startsWith('【整えた回答】') 
                        ? refinedResponse.substring('【整えた回答】'.length).trim() 
                        : refinedResponse}
                loading={isManualRefining} 
              />
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-900 border border-red-700 rounded flex-shrink-0">
                <p className="text-sm text-red-100">{error}</p>
              </div>
            )}
            <div className="mt-4 text-sm text-gray-400 flex-shrink-0">
              AI清書方式は、テンプレートベースの回答をより自然な文章に整形して、情報の整理と読みやすさを向上させます。
            </div>
          </div>
        </div>
      </div>

      {/* 履歴表示部分 */}
      {responseLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">最近の検索履歴</h2>
          <div className="space-y-4">
            {responseLogs.map((log) => (
              <div key={log.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {log.query}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDateToJapanese(new Date(log.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {log.response_count} 件の回答
                    </span>
                  </div>
                </div>
                {log.response && (
                  <div className="mt-2 text-sm text-gray-600">
                    {log.response}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

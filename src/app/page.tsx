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
  const [isRefining, setIsRefining] = useState(false);
  const [generatedResponse, setGeneratedResponse] = useState('');
  const [refinedResponse, setRefinedResponse] = useState('');
  const [generationSteps, setGenerationSteps] = useState<any[] | null>(null);
  const [responseId, setResponseId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [responseLogs, setResponseLogs] = useState<ResponseLog[]>([]);

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
    setIsRefining(true);
    setFeedback(null); // リセット
    setRefinedResponse(''); // リセット
    
    try {
      console.log('Generating response for:', inputText);
      const res = await fetch(`/api/query?q=${encodeURIComponent(inputText)}`);
      const data = await res.json();
      
      console.log('API response:', data);
      
      setGeneratedResponse(data.response || '');
      setGenerationSteps(data.steps || []);
      setResponseId(data.responseId || null);
      
      // 元の回答を得たらAI清書を実行
      if (data.response) {
        try {
          // 使用された知識ベースIDを取得 - usedKnowledgeIdsか、stepsから抽出
          let usedKnowledgeIds = [];
          
          // APIからusedKnowledgeIdsが直接返されている場合はそれを使用
          if (data.usedKnowledgeIds && Array.isArray(data.usedKnowledgeIds)) {
            usedKnowledgeIds = data.usedKnowledgeIds;
          } 
          // そうでない場合は、stepsからナレッジ情報を抽出
          else if (data.steps && data.steps.length > 1) {
            const knowledgeStep = data.steps.find((step: any) => step.step === "ナレッジ検索");
            if (knowledgeStep && knowledgeStep.content && knowledgeStep.content.used) {
              usedKnowledgeIds = knowledgeStep.content.used.map((item: any) => item.id);
            }
          }
          
          console.log('Using knowledge IDs for refinement:', usedKnowledgeIds);
          
          const refineRes = await fetch('/api/refine', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              original_response: data.response,
              tone: 'formal',
              knowledge_ids: usedKnowledgeIds
            }),
          });
          
          const refineData = await refineRes.json();
          console.log('Refined response:', refineData);
          
          if (refineRes.ok && refineData.refined_response) {
            setRefinedResponse(refineData.refined_response);
          } else {
            console.error('Refinement failed:', refineData.error || `Status: ${refineRes.status}`);
            setRefinedResponse('AIによる清書に失敗しました。外部APIのエラーが発生した可能性があります。');
          }
        } catch (refineError) {
          console.error('Error refining response:', refineError);
          setRefinedResponse('AIによる清書中にエラーが発生しました。');
        } finally {
          setIsRefining(false);
        }
      } else {
        setIsRefining(false);
      }
    } catch (error) {
      console.error('Error generating response:', error);
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
                disabled={isGenerating || !inputText.trim()} 
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
          <div className="bg-gray-800 rounded-lg p-4 h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">テンプレート方式</h2>
              
              {generatedResponse && responseId && (
                <div className="flex gap-2">
                  <button
                    onClick={() => sendFeedback(true)}
                    disabled={isSendingFeedback || feedback !== null}
                    className={`p-2 rounded ${
                      feedback === true 
                        ? 'bg-green-700 text-white' 
                        : 'bg-gray-600 hover:bg-gray-500 text-white'
                    } disabled:opacity-50`}
                    title="良い回答"
                  >
                    <HandThumbUpIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => sendFeedback(false)}
                    disabled={isSendingFeedback || feedback !== null}
                    className={`p-2 rounded ${
                      feedback === false 
                        ? 'bg-red-700 text-white' 
                        : 'bg-gray-600 hover:bg-gray-500 text-white'
                    } disabled:opacity-50`}
                    title="改善が必要"
                  >
                    <HandThumbDownIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            <ResponseArea text={generatedResponse} />
            
            {feedback !== null && (
              <div className={`mt-4 p-2 rounded text-center text-sm ${
                feedback ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'
              }`}>
                {feedback 
                  ? 'フィードバックありがとうございます。この回答は良い評価として記録されました。' 
                  : 'フィードバックありがとうございます。この回答は改善点として記録されました。'
                }
              </div>
            )}
          </div>
        </div>

        {/* 右カラム: AI清書方式の回答 */}
        <div className="lg:col-span-5">
          <div className="bg-gray-800 rounded-lg p-4 h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">AI清書方式</h2>
              {isRefining && <div className="text-blue-400 text-sm">清書中...</div>}
            </div>
            <ResponseArea text={refinedResponse} />
            <div className="mt-4 text-sm text-gray-400">
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

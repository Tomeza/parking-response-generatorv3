'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

interface StepProps {
  title: string;
  content: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

function Step({ title, content, isOpen, onToggle }: StepProps) {
  return (
    <div className="bg-[#1d2737] rounded-lg overflow-hidden mb-2 border border-[#394861]">
      <button
        className="w-full px-4 py-3 flex justify-between items-center text-white hover:bg-[#2d3748]"
        onClick={onToggle}
      >
        <span>{title}</span>
        <ChevronDownIcon
          className={`w-5 h-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-[#2d3748] text-gray-300">
          {content}
        </div>
      )}
    </div>
  );
}

interface DateInfo {
  date: string;
  type: string;
}

interface KnowledgeItem {
  id: number;
  answer: string;
}

export function ProcessSteps({ steps = [] }: { steps?: any[] }) {
  const [openStep, setOpenStep] = useState<number | null>(0); // 最初のステップを開いておく
  
  useEffect(() => {
    console.log("ProcessSteps received steps:", steps);
    
    // デバッグ: 複雑なデータ構造を検証
    if (steps && steps.length > 0) {
      // アラートの検出をデバッグ
      const alertStep = steps.find(step => step.step === "アラートワード検出");
      if (alertStep) {
        console.log("Alert step content:", alertStep.content);
      }
      
      // ナレッジ検索結果をデバッグ
      const knowledgeStep = steps.find(step => step.step === "ナレッジ検索");
      if (knowledgeStep) {
        console.log("Knowledge step content:", knowledgeStep.content);
        if (knowledgeStep.content && knowledgeStep.content.used) {
          console.log("Used knowledge items:", knowledgeStep.content.used.length);
        }
      }
    }
    
    // 新しいデータが来たら最初のステップを開く
    if (steps && steps.length > 0) {
      setOpenStep(0);
    }
  }, [steps]);

  // 空の場合はnullを返す
  if (!steps || steps.length === 0) {
    return null;
  }

  // アラートワード検出のレンダリング
  const renderAlertWordStep = (content: any) => {
    if (!content) return <p>データがありません</p>;
    
    return (
      <div className="space-y-3">
        <div>
          <h4 className="font-medium mb-1">検出されたアラートワード:</h4>
          {Object.keys(content.detected || {}).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.keys(content.detected).map(word => (
                <span key={word} className="px-2 py-1 bg-yellow-800 text-yellow-200 rounded text-xs">
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">なし</p>
          )}
        </div>
        
        {content.dates && content.dates.length > 0 && (
          <div>
            <h4 className="font-medium mb-1">検出された日付:</h4>
            <div className="space-y-1">
              {content.dates.map((date: DateInfo, idx: number) => (
                <div key={idx} className="flex items-center">
                  <span className="text-sm">{date.date}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    date.type.includes('繁忙期') ? 'bg-red-800 text-red-200' : 'bg-green-800 text-green-200'
                  }`}>
                    {date.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ナレッジ検索結果のレンダリング
  const renderKnowledgeStep = (content: any) => {
    if (!content) return <p>データがありません</p>;
    
    return (
      <div className="space-y-3">
        <div>
          <h4 className="font-medium mb-1">使用されたナレッジ:</h4>
          {content.used && content.used.length > 0 ? (
            <div className="space-y-2">
              {content.used.map((item: KnowledgeItem) => (
                <div key={item.id} className="bg-gray-700 p-2 rounded text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-400">ID: {item.id}</span>
                  </div>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">使用されたナレッジはありません</p>
          )}
        </div>
        
        {content.missing && content.missing.length > 0 && (
          <div>
            <h4 className="font-medium mb-1">不足しているタグ:</h4>
            <div className="flex flex-wrap gap-2">
              {content.missing.map((tag: string, idx: number) => (
                <span key={idx} className="px-2 py-1 bg-red-800 text-red-200 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // トレース情報のレンダリング
  const renderTraceStep = (content: any) => {
    if (!content) return <p>データがありません</p>;
    
    return (
      <div className="space-y-3">
        <div className="flex items-center">
          <span className="font-medium mr-2">ステータス:</span>
          <span className={`px-2 py-1 rounded text-xs ${
            content.success ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'
          }`}>
            {content.success ? '成功' : '失敗'}
          </span>
        </div>
        
        {content.suggestions && content.suggestions.length > 0 && (
          <div>
            <h4 className="font-medium mb-1">提案:</h4>
            <ul className="list-disc pl-5 space-y-1">
              {content.suggestions.map((suggestion: string, idx: number) => (
                <li key={idx} className="text-sm">{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // テンプレート適用情報のレンダリング
  const renderTemplateStep = (content: any) => {
    if (!content) return <p>データがありません</p>;
    
    return (
      <div className="space-y-3">
        <div>
          <h4 className="font-medium mb-1">使用テンプレート:</h4>
          <div className="bg-gray-700 p-2 rounded text-sm">
            <p>{content.template}</p>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-1">理由:</h4>
          <p className="text-sm">{content.reason}</p>
        </div>
      </div>
    );
  };

  // ステップの内容に応じたレンダリング
  const renderStepContent = (step: any) => {
    // ステップデータがないか、不正な形式の場合はJSON表示
    if (!step || !step.content) {
      return <pre className="whitespace-pre-wrap">{JSON.stringify(step, null, 2)}</pre>;
    }
    
    // ステップの種類に応じてレンダリング
    switch (step.step) {
      case 'アラートワード検出':
        return renderAlertWordStep(step.content);
      case 'ナレッジ検索':
        return renderKnowledgeStep(step.content);
      case 'トレース':
        return renderTraceStep(step.content);
      case 'テンプレート適用':
        return renderTemplateStep(step.content);
      default:
        return (
          <pre className="whitespace-pre-wrap text-sm bg-[#1a202c] p-2 rounded overflow-auto max-h-[300px]">
            {JSON.stringify(step.content, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <Step
          key={index}
          title={`ステップ${index + 1}: ${step.step || '不明なステップ'}`}
          content={renderStepContent(step)}
          isOpen={openStep === index}
          onToggle={() => setOpenStep(openStep === index ? null : index)}
        />
      ))}
    </div>
  );
} 
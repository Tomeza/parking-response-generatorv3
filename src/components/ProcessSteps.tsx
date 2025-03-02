'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface StepContent {
  [key: string]: any;
}

interface Step {
  step: string;
  content: StepContent;
}

interface ProcessStepsProps {
  steps: Step[] | null;
  isLoading: boolean;
}

export default function ProcessSteps({ steps, isLoading }: ProcessStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);

  // ステップが更新されたら、アニメーション用の表示ステップを更新
  useEffect(() => {
    if (steps) {
      const showSteps = () => {
        const newVisibleSteps: number[] = [];
        steps.forEach((_, index) => {
          setTimeout(() => {
            setVisibleSteps(prev => [...prev, index]);
          }, index * 500); // 500msごとにステップを表示
        });
        return newVisibleSteps;
      };
      
      setVisibleSteps([]);
      showSteps();
    }
  }, [steps]);

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  if (isLoading) {
    return (
      <div className="w-full mt-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-24 bg-gray-700 rounded"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-24 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-4 space-y-4">
      {steps.map((step, index) => (
        <div
          key={index}
          className={`bg-gray-800 rounded-lg p-4 border border-gray-700 transition-opacity duration-500 ${
            visibleSteps.includes(index) ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => toggleStep(index)}
          >
            <h3 className="text-lg font-medium">
              ステップ{index + 1}: {step.step}
            </h3>
            {expandedSteps[index] ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </div>
          
          {expandedSteps[index] && (
            <div className="mt-4 text-sm">
              {step.step === 'アラートワード検出' && (
                <div className="space-y-2">
                  <h4 className="font-medium">検出されたアラートワード:</h4>
                  {Object.keys(step.content.detected).length > 0 ? (
                    <ul className="list-disc list-inside">
                      {Object.keys(step.content.detected).map((word) => (
                        <li key={word} className="text-blue-400">{word}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">検出されたアラートワードはありません</p>
                  )}
                  
                  {step.content.dates && step.content.dates.length > 0 && (
                    <>
                      <h4 className="font-medium mt-3">検出された日付:</h4>
                      <ul className="list-disc list-inside">
                        {step.content.dates.map((dateInfo: any, i: number) => (
                          <li key={i} className="text-yellow-400">
                            {dateInfo.date}: {dateInfo.type} - {dateInfo.description}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  
                  <h4 className="font-medium mt-3">不足しているアラートワード:</h4>
                  {step.content.missing.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {step.content.missing.map((word: string) => (
                        <li key={word} className="text-gray-400">{word}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">不足しているアラートワードはありません</p>
                  )}
                </div>
              )}
              
              {step.step === 'ナレッジ検索' && (
                <div className="space-y-2">
                  <h4 className="font-medium">使用されたナレッジ:</h4>
                  {step.content.used.length > 0 ? (
                    <div className="space-y-2">
                      {step.content.used.map((knowledge: any) => (
                        <div key={knowledge.id} className="bg-gray-700 p-2 rounded">
                          <p className="text-xs text-gray-400">ID: {knowledge.id} | カテゴリ: {knowledge.category}</p>
                          <p className="mt-1">{knowledge.answer}</p>
                          {knowledge.tags && knowledge.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {knowledge.tags.map((tag: string) => (
                                <span key={tag} className="bg-blue-900 text-xs px-2 py-1 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">使用されたナレッジはありません</p>
                  )}
                  
                  <h4 className="font-medium mt-3">不足しているタグ:</h4>
                  {step.content.missing.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {step.content.missing.map((tag: string) => (
                        <span key={tag} className="bg-gray-700 text-xs px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">不足しているタグはありません</p>
                  )}
                </div>
              )}
              
              {step.step === 'トレース' && (
                <div className="space-y-2">
                  <h4 className="font-medium">ステータス:</h4>
                  <p className={step.content.success ? 'text-green-400' : 'text-red-400'}>
                    {step.content.success ? '成功' : '失敗'}
                  </p>
                  
                  <h4 className="font-medium mt-3">改善提案:</h4>
                  {step.content.suggestions.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {step.content.suggestions.map((suggestion: string, i: number) => (
                        <li key={i} className="text-yellow-400">{suggestion}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">改善提案はありません</p>
                  )}
                </div>
              )}
              
              {step.step === 'テンプレート適用' && (
                <div className="space-y-2">
                  <h4 className="font-medium">適用理由:</h4>
                  <p className="text-gray-300">{step.content.reason}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 
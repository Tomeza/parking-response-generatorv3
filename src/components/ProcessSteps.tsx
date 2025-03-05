'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ExclamationTriangleIcon, LightBulbIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

export interface ProcessStep {
  id: string;
  title: string;
  description: string;
  type: 'alert' | 'knowledge' | 'suggestion';
  content: any;
}

interface ProcessStepsProps {
  steps: ProcessStep[] | null;
  isLoading: boolean;
}

export default function ProcessSteps({ steps, isLoading }: ProcessStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [visibleSteps, setVisibleSteps] = useState<number>(0);

  useEffect(() => {
    if (steps && steps.length > 0) {
      // Reset expanded steps when new steps come in
      setExpandedSteps({});
      
      // Animate steps appearing one by one
      let count = 0;
      const interval = setInterval(() => {
        if (count < steps.length) {
          count++;
          setVisibleSteps(count);
        } else {
          clearInterval(interval);
        }
      }, 300);
      
      return () => clearInterval(interval);
    } else {
      setVisibleSteps(0);
    }
  }, [steps]);

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (isLoading) {
    return (
      <div className="card w-full animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-gray-700 rounded-lg p-4">
              <div className="h-5 bg-gray-700 rounded w-1/2 mb-3"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return null;
  }

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />;
      case 'knowledge':
        return <DocumentTextIcon className="h-5 w-5 text-blue-500" />;
      case 'suggestion':
        return <LightBulbIcon className="h-5 w-5 text-green-500" />;
      default:
        return null;
    }
  };

  const getStepBorderColor = (type: string) => {
    switch (type) {
      case 'alert':
        return 'border-amber-900/50';
      case 'knowledge':
        return 'border-blue-900/50';
      case 'suggestion':
        return 'border-green-900/50';
      default:
        return 'border-gray-700';
    }
  };

  const getStepBgColor = (type: string) => {
    switch (type) {
      case 'alert':
        return 'bg-amber-950/30';
      case 'knowledge':
        return 'bg-blue-950/30';
      case 'suggestion':
        return 'bg-green-950/30';
      default:
        return '';
    }
  };

  return (
    <div className="card w-full">
      <h2 className="text-lg font-medium text-gray-200 mb-4">処理ステップ</h2>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`border rounded-lg overflow-hidden transition-all duration-300 ease-in-out ${
              getStepBorderColor(step.type)
            } ${getStepBgColor(step.type)} ${
              index < visibleSteps ? 'opacity-100 transform-none' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: `${index * 150}ms` }}
          >
            <div 
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => toggleStep(step.id)}
            >
              <div className="flex items-center space-x-3">
                {getStepIcon(step.type)}
                <div>
                  <h3 className="font-medium text-gray-200">{step.title}</h3>
                  <p className="text-sm text-gray-400">{step.description}</p>
                </div>
              </div>
              <ChevronDownIcon 
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  expandedSteps[step.id] ? 'transform rotate-180' : ''
                }`} 
              />
            </div>
            
            {expandedSteps[step.id] && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-800">
                {step.type === 'alert' && step.content.alertWords && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300 mb-2">検出された注意ワード:</p>
                    <div className="flex flex-wrap gap-2">
                      {step.content.alertWords.map((word: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-amber-900/30 text-amber-300 text-xs rounded-full">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {step.type === 'knowledge' && step.content.knowledge && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300 mb-2">使用されたナレッジ:</p>
                    <div className="space-y-3">
                      {step.content.knowledge.map((k: any, i: number) => (
                        <div key={i} className="bg-gray-800 p-3 rounded-md">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                              {k.tags?.join(', ') || 'タグなし'}
                            </span>
                            <span className="text-xs text-gray-400">ID: {k.id}</span>
                          </div>
                          <p className="text-sm text-gray-300">{k.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {step.type === 'suggestion' && step.content.suggestions && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300 mb-2">改善のための提案:</p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-2">
                      {step.content.suggestions.map((suggestion: string, i: number) => (
                        <li key={i}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 
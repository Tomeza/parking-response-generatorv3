'use client';

import { useState, useEffect } from 'react';
import { ClipboardIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

export function ResponseArea({ text = '' }: { text?: string }) {
  const [copied, setCopied] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refinedText, setRefinedText] = useState('');

  // テキストが変更されたら、洗練されたテキストをリセット
  useEffect(() => {
    setRefinedText('');
  }, [text]);

  // デバッグ用のログ
  useEffect(() => {
    console.log('ResponseArea received text:', text);
  }, [text]);

  const handleCopy = async () => {
    const textToCopy = refinedText || text;
    if (!textToCopy) return;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleRefine = async () => {
    if (!text || isRefining) return;
    
    setIsRefining(true);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_response: text,
          tone: 'formal'
        }),
      });
      
      const data = await res.json();
      
      if (data.refined_response) {
        setRefinedText(data.refined_response);
      } else if (data.error) {
        console.error('Refinement error:', data.error);
      }
    } catch (err) {
      console.error('Failed to refine text:', err);
    } finally {
      setIsRefining(false);
    }
  };

  const displayText = refinedText || text;

  return (
    <div className="relative">
      <div className="bg-[#2d3748] rounded p-4 min-h-[200px] border border-[#394861]">
        {displayText ? (
          <p className="text-white whitespace-pre-wrap">{displayText}</p>
        ) : (
          <p className="text-gray-400">返信はここに表示されます</p>
        )}
      </div>
      
      {text && (
        <div className="absolute top-2 right-2 flex space-x-2">
          <button
            onClick={handleRefine}
            disabled={isRefining || !!refinedText}
            className={`p-2 bg-gray-600 text-white rounded hover:bg-gray-500 ${
              isRefining ? 'opacity-50 cursor-wait' : refinedText ? 'bg-green-700' : ''
            }`}
            aria-label="AIで清書"
            title="AIで文章を洗練させる"
          >
            <SparklesIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            aria-label="コピー"
            title="クリップボードにコピー"
          >
            {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
          </button>
        </div>
      )}
      
      {isRefining && (
        <div className="absolute inset-0 bg-[#2d3748] bg-opacity-70 flex items-center justify-center">
          <div className="text-white">
            AIが回答を清書しています...
          </div>
        </div>
      )}
    </div>
  );
} 
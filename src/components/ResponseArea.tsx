'use client';

import { useState, useEffect } from 'react';
// Remove unused icons
// import { ClipboardIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

// Define props interface
interface ResponseAreaProps {
  title?: string;
  text?: string;
  loading?: boolean;
}

export function ResponseArea({ title = '', text = '', loading = false }: ResponseAreaProps) {
  // Remove unused states
  // const [copied, setCopied] = useState(false);
  // const [isRefining, setIsRefining] = useState(false);
  // const [refinedText, setRefinedText] = useState('');

  // Remove unused useEffect
  // useEffect(() => {
  //   setRefinedText('');
  // }, [text]);

  // Debug log for received props
  useEffect(() => {
    console.log('ResponseArea received props:', { title, text, loading });
  }, [title, text, loading]);

  // Remove handleCopy function
  // const handleCopy = async () => { ... };

  // Remove handleRefine function
  // const handleRefine = async () => { ... };

  // Use text prop directly
  const displayText = text;

  return (
    <div className="relative h-full flex flex-col"> {/* Ensure component takes full height */}
      {title && <h3 className="text-lg font-medium text-white mb-2">{title}</h3>} {/* Display title if provided */}
      <div className={`relative bg-[#2d3748] rounded p-4 flex-grow border border-[#394861] ${loading ? 'min-h-[200px]' : ''}`}> {/* Adjust height based on loading */}
        {/* Display loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-[#2d3748] bg-opacity-80 flex items-center justify-center z-10 rounded">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              処理中...
            </div>
          </div>
        )}
        {/* Display text or placeholder */}
        <div className={`transition-opacity duration-300 ${loading ? 'opacity-30' : 'opacity-100'}`}>
          {displayText ? (
            <p className="text-white whitespace-pre-wrap">{displayText}</p>
          ) : (
            <p className="text-gray-400">返信はここに表示されます</p>
          )}
        </div>
      </div>

      {/* Remove button container */}
      {/* {text && ( ... )} */}

      {/* Remove refining overlay (now handled by loading prop) */}
      {/* {isRefining && ( ... )} */}
    </div>
  );
} 
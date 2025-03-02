'use client';

import { useState } from 'react';
import { ClipboardDocumentIcon, EnvelopeIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { generateMailtoLink } from '@/lib/utils';

interface ResponseDisplayProps {
  response: string | null;
  isLoading: boolean;
  onRefine: () => void;
  isRefining: boolean;
}

export default function ResponseDisplay({
  response,
  isLoading,
  onRefine,
  isRefining
}: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showMailConfirm, setShowMailConfirm] = useState(false);

  const handleCopy = async () => {
    if (response) {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMail = () => {
    setShowMailConfirm(true);
  };

  const confirmMail = () => {
    if (response) {
      const mailtoLink = generateMailtoLink(
        '',
        '駐車場のお問い合わせについて',
        response
      );
      window.location.href = mailtoLink;
      setShowMailConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card w-full h-full min-h-[400px] animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-700 rounded w-4/6"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="card w-full h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8">
        <div className="bg-blue-900/20 p-6 rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium mb-2">返信文が表示されます</h3>
        <p className="text-gray-400 max-w-md">
          左側の入力フォームに問い合わせ内容を入力して「生成」ボタンをクリックすると、ここに最適な返信文が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="card w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-200">生成された返信</h2>
        <div className="flex space-x-2">
          <button
            onClick={onRefine}
            disabled={isRefining}
            className="btn btn-accent flex items-center space-x-1 py-1 px-3 text-sm"
            title="AIを使って文章を自然な日本語に清書します"
          >
            <SparklesIcon className="h-4 w-4" />
            <span>{isRefining ? 'AI清書中...' : 'AIで清書'}</span>
          </button>
          <button
            onClick={handleCopy}
            className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700 transition-colors"
            title="クリップボードにコピー"
          >
            <ClipboardDocumentIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleMail}
            className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700 transition-colors"
            title="メールで送信"
          >
            <EnvelopeIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-gray-900 p-5 rounded-lg whitespace-pre-wrap border border-gray-800 min-h-[300px] text-gray-200 leading-relaxed">
        {response}
      </div>

      {copied && (
        <div className="mt-3 flex items-center text-green-400 text-sm fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          クリップボードにコピーしました
        </div>
      )}

      {showMailConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md border border-gray-700 shadow-xl">
            <h3 className="text-lg font-medium mb-4 text-gray-200">メール送信の確認</h3>
            <p className="mb-6 text-gray-300">
              デフォルトのメールクライアントが起動します。よろしいですか？
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMailConfirm(false)}
                className="btn btn-secondary"
              >
                キャンセル
              </button>
              <button
                onClick={confirmMail}
                className="btn btn-primary"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
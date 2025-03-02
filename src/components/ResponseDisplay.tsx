'use client';

import { useState } from 'react';
import { ClipboardDocumentIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
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
      <div className="w-full h-full min-h-[300px] bg-gray-800 rounded-lg p-4 border border-gray-700 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="w-full h-full min-h-[300px] bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-center">
        <p className="text-gray-400 text-center">
          問い合わせを入力して「生成」ボタンをクリックすると、ここに返信文が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">生成された返信</h2>
        <div className="flex space-x-2">
          <button
            onClick={onRefine}
            disabled={isRefining}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {isRefining ? 'AI清書中...' : 'AIで清書'}
          </button>
          <button
            onClick={handleCopy}
            className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700"
            title="コピー"
          >
            <ClipboardDocumentIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleMail}
            className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700"
            title="メール送信"
          >
            <EnvelopeIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-gray-900 p-4 rounded-lg whitespace-pre-wrap">
        {response}
      </div>

      {copied && (
        <div className="mt-2 text-green-400 text-sm">
          クリップボードにコピーしました
        </div>
      )}

      {showMailConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-lg font-medium mb-4">メール送信の確認</h3>
            <p className="mb-4">
              デフォルトのメールクライアントが起動します。よろしいですか？
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMailConfirm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={confirmMail}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
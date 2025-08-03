import React from 'react';
import { Template, RoutingResult } from '@/lib/template-router';

interface RoutingResultProps {
  result: RoutingResult;
  onFeedback: (feedback: {
    isCorrect: boolean;
    type?: 'category' | 'intent' | 'tone' | 'template';
    correctedValue?: string;
    feedbackText?: string;
  }) => void;
  onReviewAction: (action: string) => void;
}

export const RoutingResult: React.FC<RoutingResultProps> = ({
  result,
  onFeedback,
  onReviewAction
}) => {
  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      {/* ヘッダー情報 */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            選択されたテンプレート
          </h3>
          <div className="text-sm text-gray-500 mt-1">
            信頼度: {(result.confidence * 100).toFixed(1)}%
            {result.fallbackUsed && (
              <span className="ml-2 text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                ベクトル検索使用
              </span>
            )}
          </div>
        </div>
        
        {/* 受け入れ回し警告 */}
        {result.needsHumanReview && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="ml-2 text-sm font-medium text-red-800">
                人間の確認が必要
              </span>
            </div>
            <p className="mt-1 text-sm text-red-700">
              {result.reviewReason}
            </p>
          </div>
        )}
      </div>

      {/* テンプレート内容 */}
      {result.template && (
        <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
          <div className="mb-3">
            <h4 className="font-medium text-gray-900">{result.template.title}</h4>
            <div className="flex gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {result.template.category}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {result.template.intent}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {result.template.tone}
              </span>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white p-3 rounded border">
            {result.template.content}
          </pre>
        </div>
      )}

      {/* 処理情報 */}
      <div className="text-sm text-gray-600">
        <p>処理時間: {result.processingTimeMs}ms</p>
        <p>理由: {result.reasoning}</p>
      </div>

      {/* 受け入れ回しアクション */}
      {result.needsHumanReview && result.suggestedActions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="font-medium text-blue-900 mb-2">推奨アクション</h4>
          <div className="space-y-2">
            {result.suggestedActions.map((action, index) => (
              <button
                key={index}
                onClick={() => onReviewAction(action)}
                className="block w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 rounded transition-colors"
              >
                • {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 代替候補 */}
      {result.alternatives.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">代替候補</h4>
          <div className="space-y-2">
            {result.alternatives.slice(0, 3).map((alt) => (
              <div key={alt.id} className="border border-gray-200 rounded p-3 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium text-sm">{alt.title}</h5>
                    <div className="flex gap-1 mt-1">
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {alt.category}
                      </span>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {alt.intent}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onFeedback({
                      isCorrect: false,
                      type: 'template',
                      correctedValue: alt.id.toString()
                    })}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    このテンプレートを使用
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* フィードバックボタン */}
      <div className="flex flex-wrap gap-3 pt-4 border-t">
        <button
          onClick={() => onFeedback({ isCorrect: true })}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          ✅ 正しい
        </button>
        <button
          onClick={() => onFeedback({
            isCorrect: false,
            type: 'category'
          })}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
        >
          カテゴリが違う
        </button>
        <button
          onClick={() => onFeedback({
            isCorrect: false,
            type: 'intent'
          })}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
        >
          意図が違う
        </button>
        <button
          onClick={() => onFeedback({
            isCorrect: false,
            type: 'tone'
          })}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          トーンが違う
        </button>
      </div>
    </div>
  );
}; 
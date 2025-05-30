/**
 * LangChain LLM Client
 * OpenAIとAnthropicのLLMを統一的に扱うためのクライアント
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * LLMクライアントファクトリー
 */
export function createLLMClient(config: LLMConfig): BaseChatModel {
  const { provider, model, temperature = 0.7, maxTokens = 1000 } = config;

  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: model || 'gpt-3.5-turbo',
        temperature,
        maxTokens,
      });

    case 'anthropic':
      return new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: model || 'claude-3-haiku-20240307',
        temperature,
        maxTokens,
      });

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * デフォルトLLMインスタンスを取得（遅延初期化）
 */
export function getDefaultLLM(): BaseChatModel {
  return createLLMClient({
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    temperature: 0.7,
    maxTokens: 1000
  });
}

/**
 * OpenAI GPTインスタンスを取得（遅延初期化）
 */
export function getOpenAILLM(): BaseChatModel {
  return createLLMClient({
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000
  });
}

// 後方互換性のため、関数として提供
export const defaultLLM = getDefaultLLM;
export const openaiLLM = getOpenAILLM; 
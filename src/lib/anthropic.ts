import Anthropic from '@anthropic-ai/sdk';
import { SearchResult } from './common-types';
import kuromoji, { Tokenizer, IpadicFeatures } from 'kuromoji';

// Anthropic APIクライアントの初期化
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

let tokenizerInstance: Tokenizer<IpadicFeatures> | null = null;
const tokenizerReady = new Promise<Tokenizer<IpadicFeatures> | null>((resolve) => {
  if (tokenizerInstance) {
    resolve(tokenizerInstance);
    return;
  }
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, tokenizer) => {
    if (err) {
      console.error('Kuromoji build error in anthropic.ts:', err);
      resolve(null);
    } else {
      console.log('Kuromoji tokenizer ready in anthropic.ts.');
      tokenizerInstance = tokenizer;
      resolve(tokenizerInstance);
    }
  });
});

const INTENT_RULES = [
  { intent: 'reservation_method', keywords: ['予約', '方法'] },
  { intent: 'cancellation', keywords: ['キャンセル', '取り消し'] },
  { intent: 'status_check', keywords: ['完了', '確認'] },
];

const VALID_POS_FOR_INTENT = ['名詞', '動詞'];

// 回答の清書を行う関数
export async function refineResponse(
  originalResponse: string, 
  tone: 'formal' | 'casual' = 'formal',
  knowledgeIds?: number[]
) {
  try {
    let prompt = `あなたは駐車場の問い合わせに回答する担当者です。以下の【元の回答】を、より自然で丁寧な日本語に整えてください。
情報の追加や削除は行わず、提供された情報のみを使用してください。

【元の回答】
${originalResponse}`;

    if (knowledgeIds && knowledgeIds.length > 0) {
      prompt += `\n\n【参照された知識ベースID】: ${knowledgeIds.join(', ')}`;
    }

    const stream = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Changed to Haiku
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      stream: true, // Enabled streaming
    });

    let refinedText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        refinedText += event.delta.text;
      }
    }

    if (refinedText.trim()) {
      return refinedText;
    }
    return originalResponse; // if streaming returned empty or only whitespace

  } catch (error) {
    console.error('Anthropic API error in refineResponse:', error);
    return originalResponse;
  }
}

// 従来のLLMによる分析処理を別関数に切り出し
async function callAnthropicForQueryAnalysis(query: string): Promise<string | null> {
  try {
    const prompt = `以下の駐車場に関する問い合わせを分析し、重要なキーワードや意図を抽出してください。
JSONフォーマットのみで返してください。説明文や前置きは一切不要です。

【問い合わせ】
${query}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      try {
        // More robust JSON extraction
        const textContent = content.text;
        const firstBrace = textContent.indexOf('{');
        const lastBrace = textContent.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonString = textContent.substring(firstBrace, lastBrace + 1);
          try {
            const llmResult = JSON.parse(jsonString);
            llmResult.source = 'llm-based';
            return JSON.stringify(llmResult);
          } catch (parseError) {
            console.error('Failed to parse extracted JSON string in callAnthropicForQueryAnalysis:', jsonString, parseError);
            // Fallback if the extracted string is not valid JSON
            return JSON.stringify({ raw_text: textContent, source: 'llm-based-invalid-json-extraction' });
          }
        } else {
          // JSON braces not found or in wrong order
          console.error('LLM response did not contain a valid JSON structure (no braces found) in callAnthropicForQueryAnalysis:', textContent);
          return JSON.stringify({ raw_text: textContent, source: 'llm-based-no-json-braces' });
        }
      } catch (e) { // Catch errors from indexOf/lastIndexOf or other unexpected issues
        console.error('Error during JSON extraction logic in callAnthropicForQueryAnalysis:', content.text, e);
        return JSON.stringify({ raw_text: content.text, source: 'llm-based-extraction-error' });
      }
    }
    return null;
  } catch (error) {
    console.error('Anthropic API error in callAnthropicForQueryAnalysis:', error);
    return null;
  }
}

// 問い合わせ分析を行う関数
export async function analyzeQuery(query: string): Promise<string | null> {
  const tokenizer = await tokenizerReady;
  if (!tokenizer) {
    console.warn('Kuromoji not available in analyzeQuery, falling back to LLM.');
    // LLMフォールバック (従来のHaiku呼び出し)
    return callAnthropicForQueryAnalysis(query);
  }

  const tokens = tokenizer.tokenize(query);
  const queryKeywords = tokens
    .filter(token => VALID_POS_FOR_INTENT.some(pos => token.pos.startsWith(pos)))
    .map(token => token.basic_form === '*' ? token.surface_form : token.basic_form)
    .filter((term): term is string => term !== null && term.length > 0);
  
  const uniqueQueryKeywords = [...new Set(queryKeywords)];
  console.log(`Rule-based analyzeQuery - Extracted keywords: ${uniqueQueryKeywords.join(', ')}`);

  let matchedIntent: string | null = null;

  for (const rule of INTENT_RULES) {
    // rule.keywords の全ての単語が uniqueQueryKeywords に含まれているかチェック
    const allKeywordsMatch = rule.keywords.every(keyword => uniqueQueryKeywords.includes(keyword));
    if (allKeywordsMatch) {
      matchedIntent = rule.intent;
      console.log(`Rule-based analyzeQuery - Matched intent: ${matchedIntent}`);
      break; // 最初に見つかったルールを採用
    }
  }

  if (matchedIntent) {
    return JSON.stringify({
      intent: matchedIntent,
      keywords: uniqueQueryKeywords,
      source: 'rule-based'
    });
  } else {
    console.log('Rule-based analyzeQuery - No rule matched. Skipping LLM fallback for speed test and returning empty analysis.');
    // return callAnthropicForQueryAnalysis(query); // LLMフォールバックを一時的にコメントアウト
    return JSON.stringify({ intent: null, keywords: uniqueQueryKeywords, source: 'rule-based-no-match-skipped-llm' }); // ダミーの戻り値
  }
}

// 新しい関数: 検索結果の再ランク付け
export async function rerankResults(
  query: string,
  results: SearchResult[] // 上位3件の結果を受け取る想定
): Promise<SearchResult[]> {
  if (!results || results.length === 0) {
    return [];
  }
  if (results.length === 1) {
    return results; // 候補が1つならそのまま返す
  }

  // --- LLMによる再ランキング処理をコメントアウト ---
  console.log('Skipping LLM rerank. Returning the first result from the initial search.');
  return results.slice(0, 1); // 常に最初の候補を返す
  // --- ここまで ---

  /*  元のLLM呼び出しロジック
  try {
    // LLMに渡すプロンプトを作成
    let prompt = `あなたは駐車場の問い合わせに回答する担当者です。以下のユーザーの質問に対して、提示された${results.length}つのナレッジ候補の中から、最も網羅的で的確な回答を1つだけ選んでください。選択したナレッジのIDのみを返してください。

【ユーザーの質問】
${query}

【ナレッジ候補】
`;
    results.forEach((result, index) => {
      prompt += `候補${index + 1} (ID: ${result.id}):
質問: ${result.question}
回答: ${result.answer}

`;
    });

    prompt += `【指示】
上記${results.length}つの候補の中から、ユーザーの質問に最も適切に答えているナレッジのID番号（例: 123）だけを返してください。他のテキストは含めないでください。`;

    // Anthropic APIを呼び出し (モデルはSonnetのまま、ストリーミングを有効化)
    const stream = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Changed from Sonnet to Haiku
      max_tokens: 10, // IDだけなので短いトークン数で十分
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: true, // ストリーミングを有効化
    });

    let selectedIdStr = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        selectedIdStr += event.delta.text;
      }
    }

    const selectedId = parseInt(selectedIdStr.trim(), 10);

    if (!isNaN(selectedId)) {
      const selectedResult = results.find(r => r.id === selectedId);
      if (selectedResult) {
        console.log(`LLM Rerank selected ID (streamed): ${selectedId}`);
        return [selectedResult]; 
      } else {
        console.warn('LLM reranked to an ID not in the original top results (streamed). Returning original top 1.');
        return results.slice(0, 1);
      }
    } else {
       console.warn('LLM did not return a valid ID number (streamed). Returning original top 1.');
       return results.slice(0, 1);
    }

  } catch (error) {
    console.error('Anthropic rerank error (streamed):', error);
    return results.slice(0, 1); // エラー時は最初の候補を返す
  }
  */
}

export default anthropic; 
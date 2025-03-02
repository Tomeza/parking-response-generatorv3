import Anthropic from '@anthropic-ai/sdk';

// Anthropic APIクライアントの初期化
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// 回答の清書を行う関数
export async function refineResponse(originalResponse: string, tone: 'formal' | 'casual' = 'formal') {
  try {
    const prompt = `あなたは駐車場の問い合わせに回答する担当者です。以下の回答を、より自然で丁寧な日本語に整えてください。
複数の情報源からの情報が不自然につながっている場合は、自然な文の流れになるよう調整してください。
ただし、情報の追加や削除は行わないでください。提供された情報のみを使用してください。

【元の回答】
${originalResponse}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    // content[0]がTextBlockの場合のみtextプロパティにアクセス
    const content = message.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return originalResponse;
  } catch (error) {
    console.error('Anthropic API error:', error);
    return originalResponse;
  }
}

// 問い合わせ分析を行う関数
export async function analyzeQuery(query: string) {
  try {
    const prompt = `以下の駐車場に関する問い合わせを分析し、重要なキーワードや意図を抽出してください。
JSONフォーマットで返してください。

【問い合わせ】
${query}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    // content[0]がTextBlockの場合のみtextプロパティにアクセス
    const content = message.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return null;
  } catch (error) {
    console.error('Anthropic API error:', error);
    return null;
  }
}

export default anthropic; 
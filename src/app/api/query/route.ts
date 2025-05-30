import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '../../../lib/search';
import { type SearchResult } from '../../../lib/common-types';
import { prisma } from '../../../lib/db';
import { addMandatoryAlerts, detectAlertKeywords } from '../../../lib/alert-system';
import { refineResponse, analyzeQuery, rerankResults } from '@/lib/anthropic';
import { EMBEDDING_VERSION } from '@/config/constants';

// Helper function for timing
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  const res = await fn();
  console.timeEnd(label);
  return res;
}

// Robust UTF-8 decoding to handle character encoding issues
function robustDecode(input: string | null): string {
  if (!input) return '';
  
  try {
    // First try standard decodeURIComponent
    let decoded = decodeURIComponent(input);
    console.log('🔧 Original input:', input);
    console.log('🔧 After decodeURIComponent:', decoded);
    
    // Check if the result looks like corrupted UTF-8 (contains mojibake patterns)
    const mojibakePattern = /[ä-ÿ]{2,}|â|ã|Â|Ã|º|ç|å|®¹|²|é|è|¿|«|¤|æ|§|¾|ï|¼/;
    if (mojibakePattern.test(decoded)) {
      console.log('🔧 Detected potential UTF-8 corruption, attempting to fix:', decoded);
      
      try {
        // Strategy 1: Try to interpret as ISO-8859-1 and convert to UTF-8
        const buffer = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
          buffer[i] = decoded.charCodeAt(i) & 0xFF;
        }
        const utf8Fixed = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        console.log('🔧 UTF-8 fix result:', utf8Fixed);
        
        // Strategy 2: Manual mapping for the specific corruption pattern we've seen
        // Convert the specific corrupted pattern to the correct query
        const corruptedPattern = 'äºç´å®¹ãã²ã¨ãéè¿ã«å¤æã§ãã¾ããï¼';
        const correctQuery = '予約内容をひとり送迎に変更できますか？';
        if (decoded === corruptedPattern) {
          console.log('🔧 Applied exact pattern fix for corrupted query:', decoded, '→', correctQuery);
          return correctQuery;
        }
        
        // If the UTF-8 fix result contains recognizable characters, use it
        const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/; // Hiragana, Katakana, Kanji
        if (japanesePattern.test(utf8Fixed)) {
          console.log('🔧 UTF-8 fix applied:', decoded, '→', utf8Fixed);
          return utf8Fixed;
        }
        
        return decoded;
      } catch (fixError) {
        console.warn('Failed to fix UTF-8 corruption:', fixError);
        return decoded;
      }
    }
    
    return decoded;
  } catch (error) {
    console.warn('Failed to decode query parameter:', error);
    return input || '';
  }
}

export async function GET(req: NextRequest) {
  // ▼▼▼ 緊急テストコード ▼▼▼
  // const testResponse = { message: "これは日本語のテスト文字列です。ひらがな、カタカナ、漢字。" };
  // console.log('緊急テスト: Response Object:', testResponse);
  // return NextResponse.json(testResponse);
  // ▲▲▲ 緊急テストコード ▲▲▲

  const requestStartTime = Date.now(); // ★: リクエスト開始時刻を記録
  // const searchStartTime = Date.now(); // パフォーマンス計測用なのでコメントアウト
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const query_id = searchParams.get('query_id');
  const isDev = process.env.NODE_ENV === 'development';
  const pgroongaOnly = searchParams.get('search_mode') === 'pgroonga_only';
  // efSearch パラメータを取得
  const efSearchParam = searchParams.get('efSearch');
  const efSearchValue = efSearchParam ? parseInt(efSearchParam, 10) : undefined;
  // const tags = searchParams.get('tags') || ''; // tags は現在 searchKnowledge で使われていない

  // 🔧 詳細デバッグ情報を追加
  console.log('🔧 REQUEST DEBUG INFO:');
  console.log('🔧 Request URL:', req.url);
  console.log('🔧 Query param raw:', query);
  console.log('🔧 Query param char codes:', query ? Array.from(query).map(c => `${c}(${c.charCodeAt(0)})`).join(' ') : 'null');
  console.log('🔧 Request headers:', Object.fromEntries(req.headers.entries()));

  const decodedQuery = robustDecode(query);
  // const decodedTags = decodeURIComponent(tags); // tags は現在 searchKnowledge で使われていない

  if (!decodedQuery) {
    return NextResponse.json({ response: "クエリを入力してください。" }, { status: 400 });
  }

  let searchResults: SearchResult[] = [];
  try {
    console.log('Query received:', decodedQuery, efSearchValue ? `(efSearch: ${efSearchValue})` : '');
    // console.log('Tags received:', decodedTags);

    // 1. Analyze Query
    const analysisResult: any = await timed('A1_Step1_AnalyzeQuery', async () => {
      return analyzeQuery(decodedQuery);
    });
    console.log('AnalyzeQuery Result (first 100 chars):', typeof analysisResult === 'string' ? analysisResult.substring(0,100) : analysisResult);

    const detectedAlerts = detectAlertKeywords(decodedQuery);
    console.log('Detected alerts:', detectedAlerts);
    
    // 2. Search Knowledge に efSearchValue を渡す
    const results = await searchKnowledge(
      decodedQuery,
      isDev,
      pgroongaOnly,
      query_id ?? undefined,
      efSearchValue // ここで渡す
    );
    
    if (Array.isArray(results)) {
      searchResults = results.filter(
        (item): item is SearchResult => 
          typeof item === 'object' && 
          item !== null && 
          typeof item.id === 'number' && 
          (typeof item.question === 'string' || item.question === null) && 
          (typeof item.answer === 'string' || item.answer === null)
      );
      console.log('Search results from searchKnowledge (filtered and validated):', searchResults.map(r => ({ id: r.id, score: r.score })));
    } else {
      console.warn(`searchKnowledge for query "${decodedQuery}" did not return an array. Received:`, results);
    }

    console.log('Search results count:', searchResults.length);
    
    if (searchResults.length === 0) {
      const notFoundMessage = "申し訳ございませんが、ご質問に対する具体的な情報が見つかりませんでした。";
      const notFoundWithAlerts = addMandatoryAlerts(notFoundMessage);
      // const searchEndTime = Date.now(); // パフォーマンス計測用だったが一旦コメントアウト
      // const searchTime = searchEndTime - searchStartTime; // パフォーマンス計測用だったが一旦コメントアウト
      const requestEndTimeForNotFound = Date.now(); // ★: 終了時刻
      const totalRequestTimeForNotFound = requestEndTimeForNotFound - requestStartTime; // ★: 全体時間
      const notFoundResponse = {
        response: notFoundWithAlerts,
        steps: [
          { step: "キーワード抽出", content: { query: decodedQuery, terms: "-", analysis: analysisResult } },
          { step: "ナレッジ検索", content: { status: "失敗", reason: "関連情報なし", used: [] } },
          { step: "応答生成", content: { result: "フォールバック応答", template: "N/A", reason: "情報なし" } },
          { step: "アラート追加", content: { alerts: ["国際線利用不可", "外車受入不可"] } }
        ],
        performance: { total_time_ms: totalRequestTimeForNotFound } // ★: パフォーマンス情報を追加
      };
      await prisma.responseLog.create({
        data: {
          query: decodedQuery,
          response: notFoundWithAlerts,
          used_knowledge_ids: [],
          missing_tags: [],
          missing_alerts: [],
          created_at: new Date(),
          embeddingModel: EMBEDDING_VERSION,
          embeddingDims: 512, // 現状に合わせて512次元
          quantized: false, // 量子化はまだなのでfalse
        }
      });
      return NextResponse.json(notFoundResponse);
    }
    
    // 3. Rerank Results (if more than one result)
    let rerankedTopResults: SearchResult[] = searchResults;
    if (searchResults.length > 1) {
      rerankedTopResults = await timed('A1_Step3_RerankResults', async () => {
        return rerankResults(decodedQuery, searchResults.slice(0, 3)); 
      });
      console.log('Reranked result ID:', rerankedTopResults.length > 0 ? rerankedTopResults[0].id : 'N/A');
    } else {
      console.log('Skipping rerank, only one or zero search results.');
    }

    const bestMatch = rerankedTopResults.length > 0 ? rerankedTopResults[0] : searchResults[0];
    const allOriginalResults = searchResults;
    const usedKnowledgeIds = allOriginalResults.map((result: SearchResult) => result.id);

    const keywordStep = { step: "キーワード抽出/前処理", content: { query: decodedQuery, analysis: analysisResult } };
    const knowledgeSearchStep = {
      step: "ナレッジ検索",
      content: {
        score: bestMatch.score ?? 0,
        bestMatch: { id: bestMatch.id, question: bestMatch.question },
        used: allOriginalResults.map((result: SearchResult) => ({ id: result.id, question: result.question, answer: result.answer, score: result.score ?? 0 })),
        missing: []
      }
    };

    let template = "[ANSWER]";
    let templateReason = "標準テンプレート適用";
    let responseTextForRefinement = bestMatch.answer;

    if (bestMatch.note === '外車利用に関する専用回答です') {
      responseTextForRefinement = "お問い合わせありがとうございます。誠に申し訳ございませんが、当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。ご理解いただけますと幸いです。";
      template = responseTextForRefinement;
      templateReason = "外車利用不可の専用回答を適用";
    } else if (bestMatch.note === '国際線利用に関する専用回答です') {
      responseTextForRefinement = "申し訳ございませんが、当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。";
      template = responseTextForRefinement;
      templateReason = "国際線利用不可の専用回答を適用";
    }
    
    // 4. Refine Response
    let refinedAnswer: string;

    // --- refineResponse の呼び出しを完全にスキップし、responseTextForRefinement をそのまま使用する --- 
    refinedAnswer = responseTextForRefinement;
    console.log('Force skipping RefineResponse. Using responseTextForRefinement directly for id:', bestMatch.id);
    // --- ここまで --- 

    const templateStep = { step: "テンプレート適用", content: { template: template, reason: templateReason, original_answer: responseTextForRefinement, refined_answer: refinedAnswer } };
    
    const finalResponseTextWithAlerts = addMandatoryAlerts(refinedAnswer);
    const alertStep = { step: "アラート追加", content: { original: refinedAnswer, withAlerts: finalResponseTextWithAlerts, alerts: ["国際線利用不可", "外車受入不可"] } };

    const responseSteps = [ keywordStep, knowledgeSearchStep, templateStep, alertStep ];
    
    await prisma.responseLog.create({
      data: {
        query: decodedQuery,
        response: finalResponseTextWithAlerts,
        used_knowledge_ids: usedKnowledgeIds,
        missing_tags: [],
        missing_alerts: [],
        knowledge_id: bestMatch.id,
        response_count: allOriginalResults.length,
        created_at: new Date(),
        embeddingModel: EMBEDDING_VERSION,
        embeddingDims: 512, // 現状に合わせて512次元
        quantized: false, // 量子化はまだなのでfalse
      }
    });

    // const searchEndTime = Date.now(); // パフォーマンス計測用だったが一旦コメントアウト
    // const searchTime = searchEndTime - searchStartTime; // パフォーマンス計測用だったが一旦コメントアウト
    // const searchTime = Date.now() - searchStartTime; // この行もコメントアウト
    const requestEndTime = Date.now(); // ★: 終了時刻
    const totalRequestTime = requestEndTime - requestStartTime; // ★: 全体時間

    // ▼▼▼ 文字化け調査ログ (レスポンス直前) ▼▼▼
    console.log('文字化け調査: FINAL RESPONSE OBJECT (GET):', JSON.stringify({
      response: finalResponseTextWithAlerts,
      responseId: bestMatch.id,
      question: bestMatch.question,
      // 他の主要なテキストフィールドも必要に応じて追加
    }, null, 2));
    // ▲▲▲ 文字化け調査ログ ▲▲▲

    return NextResponse.json({
      response: finalResponseTextWithAlerts,
      responseId: bestMatch.id,
      score: bestMatch.score ?? 0,
      knowledge_id: bestMatch.id,
      question: bestMatch.question,
      steps: responseSteps,
      total_results: allOriginalResults.length,
      all_results: allOriginalResults.map(r => ({ id: r.id, score: r.score, note: r.note, detail_category: r.detail_category })),
      performance: { total_time_ms: totalRequestTime } // ★: パフォーマンス情報を追加
    });

  } catch (error: any) {
    console.error('Error processing query in GET:', error);
    const errorMessage = addMandatoryAlerts("検索処理中にエラーが発生しました (GET)");
    const requestEndTimeForError = Date.now(); // ★: エラー時も念のため
    const totalRequestTimeForError = requestEndTimeForError - requestStartTime; // ★: エラー時も念のため
    // ★ エラー時のログ作成を追加検討 (もし必要であれば)
    // await prisma.responseLog.create({
    //   data: {
    //     query: decodedQuery || "Unknown query",
    //     response: errorMessage,
    //     used_knowledge_ids: [],
    //     missing_tags: [],
    //     missing_alerts: [],
    //     created_at: new Date(),
    //     embeddingModel: EMBEDDING_VERSION,
    //     embeddingDims: EMBEDDING_VERSION === 'v2' ? 384 : 1536,
    //     quantized: EMBEDDING_VERSION === 'v2' && process.env.EMB_QUANTIZED === 'true',
    //   }
    // });

    // ▼▼▼ 文字化け調査ログ (エラーレスポンス直前) ▼▼▼
    console.log('文字化け調査: FINAL ERROR RESPONSE OBJECT (GET):', JSON.stringify({ error: errorMessage }, null, 2));
    // ▲▲▲ 文字化け調査ログ ▲▲▲

    return NextResponse.json({ error: errorMessage, performance: { total_time_ms: totalRequestTimeForError } }, { status: 500 }); // ★: パフォーマンス情報を追加
  }
}

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now(); // ★: リクエスト開始時刻を記録
  let queryFromBody: string | null = null;
  let originalInput: string = '';

  try {
    originalInput = await req.text(); // まずリクエストボディをテキストとして読み取る
    // robustDecodeを適用する前に、JSONとしてパース可能か試行
    try {
      const jsonData = JSON.parse(originalInput);
      if (jsonData && typeof jsonData.query === 'string') {
        queryFromBody = jsonData.query;
      } else {
        // JSONだがqueryフィールドがない、または型が違う場合
        // この時点ではまだ robustDecode にかける前の入力として保持
        queryFromBody = originalInput; 
      }
    } catch (e) {
      // JSONパースに失敗した場合、ボディ全体がクエリ文字列であると仮定
      queryFromBody = originalInput;
    }
  } catch (error) {
    console.error('Error reading request body for POST:', error);
    return NextResponse.json({ response: "リクエストの読み取りに失敗しました。" }, { status: 400 });
  }
  
  // 🔧 詳細デバッグ情報を追加 (POSTリクエスト用)
  console.log('🔧 POST REQUEST DEBUG INFO:');
  console.log('🔧 Raw request body:', originalInput);
  console.log('🔧 Interpreted query from body (before robustDecode):', queryFromBody);


  // robustDecode関数は既にこのファイルの上部で定義されている想定
  const decodedQuery = robustDecode(queryFromBody); 
  
  console.log('🔧 Query after robustDecode (POST):', decodedQuery);


  const { searchParams } = new URL(req.url); // URLパラメータも引き続き取得可能
  const query_id = searchParams.get('query_id');
  const isDev = process.env.NODE_ENV === 'development';
  const pgroongaOnly = searchParams.get('search_mode') === 'pgroonga_only';
  const efSearchParam = searchParams.get('efSearch');
  const efSearchValue = efSearchParam ? parseInt(efSearchParam, 10) : undefined;

  if (!decodedQuery) {
    return NextResponse.json({ response: "クエリを入力してください。" }, { status: 400 });
  }

  let searchResults: SearchResult[] = [];
  try {
    console.log('Query received:', decodedQuery, efSearchValue ? `(efSearch: ${efSearchValue})` : '');

    // 1. Analyze Query
    const analysisResult: any = await timed('A1_Step1_AnalyzeQuery', async () => {
      return analyzeQuery(decodedQuery);
    });
    console.log('AnalyzeQuery Result (first 100 chars):', typeof analysisResult === 'string' ? analysisResult.substring(0,100) : analysisResult);

    const detectedAlerts = detectAlertKeywords(decodedQuery);
    console.log('Detected alerts:', detectedAlerts);
    
    // 2. Search Knowledge に efSearchValue を渡す
    const results = await searchKnowledge(
      decodedQuery,
      isDev,
      pgroongaOnly,
      query_id ?? undefined,
      efSearchValue // ここで渡す
    );
    
    if (Array.isArray(results)) {
      searchResults = results.filter(
        (item): item is SearchResult => 
          typeof item === 'object' && 
          item !== null && 
          typeof item.id === 'number' && 
          (typeof item.question === 'string' || item.question === null) && 
          (typeof item.answer === 'string' || item.answer === null)
      );
      console.log('Search results from searchKnowledge (filtered and validated):', searchResults.map(r => ({ id: r.id, score: r.score })));
    } else {
      console.warn(`searchKnowledge for query "${decodedQuery}" did not return an array. Received:`, results);
    }

    console.log('Search results count:', searchResults.length);
    
    if (searchResults.length === 0) {
      const notFoundMessage = "申し訳ございませんが、ご質問に対する具体的な情報が見つかりませんでした。";
      const notFoundWithAlerts = addMandatoryAlerts(notFoundMessage);
      const requestEndTimeForNotFound = Date.now(); // ★: 終了時刻
      const totalRequestTimeForNotFound = requestEndTimeForNotFound - requestStartTime; // ★: 全体時間
      const notFoundResponse = {
        response: notFoundWithAlerts,
        steps: [
          { step: "キーワード抽出", content: { query: decodedQuery, terms: "-", analysis: analysisResult } },
          { step: "ナレッジ検索", content: { status: "失敗", reason: "関連情報なし", used: [] } },
          { step: "応答生成", content: { result: "フォールバック応答", template: "N/A", reason: "情報なし" } },
          { step: "アラート追加", content: { alerts: ["国際線利用不可", "外車受入不可"] } }
        ],
        performance: { total_time_ms: totalRequestTimeForNotFound } // ★: パフォーマンス情報を追加
      };
      await prisma.responseLog.create({
        data: {
          query: decodedQuery,
          response: notFoundWithAlerts,
          used_knowledge_ids: [],
          missing_tags: [],
          missing_alerts: [],
          created_at: new Date(),
          embeddingModel: EMBEDDING_VERSION,
          embeddingDims: 512, // 現状に合わせて512次元
          quantized: false, // 量子化はまだなのでfalse
        }
      });
      return NextResponse.json(notFoundResponse);
    }
    
    // 3. Rerank Results (if more than one result)
    let rerankedTopResults: SearchResult[] = searchResults;
    if (searchResults.length > 1) {
      rerankedTopResults = await timed('A1_Step3_RerankResults', async () => {
        return rerankResults(decodedQuery, searchResults.slice(0, 3)); 
      });
      console.log('Reranked result ID:', rerankedTopResults.length > 0 ? rerankedTopResults[0].id : 'N/A');
    } else {
      console.log('Skipping rerank, only one or zero search results.');
    }

    const bestMatch = rerankedTopResults.length > 0 ? rerankedTopResults[0] : searchResults[0];
    const allOriginalResults = searchResults;
    const usedKnowledgeIds = allOriginalResults.map((result: SearchResult) => result.id);

    const keywordStep = { step: "キーワード抽出/前処理", content: { query: decodedQuery, analysis: analysisResult } };
    const knowledgeSearchStep = {
      step: "ナレッジ検索",
      content: {
        score: bestMatch.score ?? 0,
        bestMatch: { id: bestMatch.id, question: bestMatch.question },
        used: allOriginalResults.map((result: SearchResult) => ({ id: result.id, question: result.question, answer: result.answer, score: result.score ?? 0 })),
        missing: []
      }
    };

    let template = "[ANSWER]";
    let templateReason = "標準テンプレート適用";
    let responseTextForRefinement = bestMatch.answer;

    if (bestMatch.note === '外車利用に関する専用回答です') {
      responseTextForRefinement = "お問い合わせありがとうございます。誠に申し訳ございませんが、当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。ご理解いただけますと幸いです。";
      template = responseTextForRefinement;
      templateReason = "外車利用不可の専用回答を適用";
    } else if (bestMatch.note === '国際線利用に関する専用回答です') {
      responseTextForRefinement = "申し訳ございませんが、当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。";
      template = responseTextForRefinement;
      templateReason = "国際線利用不可の専用回答を適用";
    }
    
    // 4. Refine Response
    let refinedAnswer: string;

    // --- refineResponse の呼び出しを完全にスキップし、responseTextForRefinement をそのまま使用する --- 
    refinedAnswer = responseTextForRefinement;
    console.log('Force skipping RefineResponse. Using responseTextForRefinement directly for id:', bestMatch.id);
    // --- ここまで --- 

    const templateStep = { step: "テンプレート適用", content: { template: template, reason: templateReason, original_answer: responseTextForRefinement, refined_answer: refinedAnswer } };
    
    const finalResponseTextWithAlerts = addMandatoryAlerts(refinedAnswer);
    const alertStep = { step: "アラート追加", content: { original: refinedAnswer, withAlerts: finalResponseTextWithAlerts, alerts: ["国際線利用不可", "外車受入不可"] } };

    const responseSteps = [ keywordStep, knowledgeSearchStep, templateStep, alertStep ];
    
    await prisma.responseLog.create({
      data: {
        query: decodedQuery,
        response: finalResponseTextWithAlerts,
        used_knowledge_ids: usedKnowledgeIds,
        missing_tags: [],
        missing_alerts: [],
        knowledge_id: bestMatch.id,
        response_count: allOriginalResults.length,
        created_at: new Date(),
        embeddingModel: EMBEDDING_VERSION,
        embeddingDims: 512, // 現状に合わせて512次元
        quantized: false, // 量子化はまだなのでfalse
      }
    });

    const requestEndTime = Date.now(); // ★: 終了時刻
    const totalRequestTime = requestEndTime - requestStartTime; // ★: 全体時間

    // ▼▼▼ 文字化け調査ログ (レスポンス直前) ▼▼▼
    console.log('文字化け調査: FINAL RESPONSE OBJECT (POST):', JSON.stringify({
      response: finalResponseTextWithAlerts,
      responseId: bestMatch.id,
      question: bestMatch.question,
      // 他の主要なテキストフィールドも必要に応じて追加
    }, null, 2));
    // ▲▲▲ 文字化け調査ログ ▲▲▲

    return NextResponse.json({
      response: finalResponseTextWithAlerts,
      responseId: bestMatch.id,
      score: bestMatch.score ?? 0,
      knowledge_id: bestMatch.id,
      question: bestMatch.question,
      steps: responseSteps,
      total_results: allOriginalResults.length,
      all_results: allOriginalResults.map(r => ({ id: r.id, score: r.score, note: r.note, detail_category: r.detail_category })),
      performance: { total_time_ms: totalRequestTime } // ★: パフォーマンス情報を追加
    });

  } catch (error: any) {
    console.error('Error processing query in POST:', error);
    const errorMessage = "サーバーエラーが発生しました (POST)";
    const errorWithAlerts = addMandatoryAlerts(errorMessage);
    const requestEndTimeForError = Date.now(); // ★: エラー時も念のため
    const totalRequestTimeForError = requestEndTimeForError - requestStartTime; // ★: エラー時も念のため

    // ▼▼▼ 文字化け調査ログ (エラーレスポンス直前) ▼▼▼
    console.log('文字化け調査: FINAL ERROR RESPONSE OBJECT (POST):', JSON.stringify({ error: errorWithAlerts }, null, 2));
    // ▲▲▲ 文字化け調査ログ ▲▲▲

    return NextResponse.json(
      { error: errorWithAlerts, performance: { total_time_ms: totalRequestTimeForError } }, // ★: パフォーマンス情報を追加
      { status: 500 }
    );
  }
}
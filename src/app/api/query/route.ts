import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '../../../lib/search';
import { type SearchResult } from '../../../lib/common-types';
import { prisma } from '../../../lib/db';
import { addMandatoryAlerts, detectAlertKeywords } from '../../../lib/alert-system';
import { refineResponse, analyzeQuery, rerankResults } from '@/lib/anthropic';

// Helper function for timing
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  const res = await fn();
  console.timeEnd(label);
  return res;
}

export async function GET(req: NextRequest) {
  const requestStartTime = Date.now(); // ★: リクエスト開始時刻を記録
  // const searchStartTime = Date.now(); // パフォーマンス計測用なのでコメントアウト
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const query_id = searchParams.get('query_id');
  const isDev = process.env.NODE_ENV === 'development';
  const pgroongaOnly = searchParams.get('search_mode') === 'pgroonga_only';
  // const tags = searchParams.get('tags') || ''; // tags は現在 searchKnowledge で使われていない

  const decodedQuery = decodeURIComponent(query || '');
  // const decodedTags = decodeURIComponent(tags); // tags は現在 searchKnowledge で使われていない

  if (!decodedQuery) {
    return NextResponse.json({ response: "クエリを入力してください。" }, { status: 400 });
  }

  let searchResults: SearchResult[] = [];
  try {
    console.log('Query received:', decodedQuery);
    // console.log('Tags received:', decodedTags);

    // 1. Analyze Query
    const analysisResult: any = await timed('A1_Step1_AnalyzeQuery', async () => {
      return analyzeQuery(decodedQuery);
    });
    console.log('AnalyzeQuery Result (first 100 chars):', typeof analysisResult === 'string' ? analysisResult.substring(0,100) : analysisResult);

    const detectedAlerts = detectAlertKeywords(decodedQuery);
    console.log('Detected alerts:', detectedAlerts);
    
    // 2. Search Knowledge
    const results = await searchKnowledge(decodedQuery, isDev, pgroongaOnly, query_id ?? undefined);
    
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
        data: { query: decodedQuery, response: notFoundWithAlerts, used_knowledge_ids: [], missing_tags: [], missing_alerts: [], created_at: new Date() }
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
        missing_tags: [], missing_alerts: [],
        knowledge_id: bestMatch.id,
        response_count: allOriginalResults.length,
        created_at: new Date()
      }
    });

    // const searchEndTime = Date.now(); // パフォーマンス計測用だったが一旦コメントアウト
    // const searchTime = searchEndTime - searchStartTime; // パフォーマンス計測用だったが一旦コメントアウト
    // const searchTime = Date.now() - searchStartTime; // この行もコメントアウト
    const requestEndTime = Date.now(); // ★: 終了時刻
    const totalRequestTime = requestEndTime - requestStartTime; // ★: 全体時間
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
    return NextResponse.json({ error: errorMessage, performance: { total_time_ms: totalRequestTimeForError } }, { status: 500 }); // ★: パフォーマンス情報を追加
  }
}

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now(); // ★: リクエスト開始時刻を記録
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'クエリが指定されていません' },
        { status: 400 }
      );
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/query?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      console.error('Fetch to GET endpoint failed:', res.status, await res.text());
      throw new Error(`API call to GET /api/query failed with status ${res.status}`);
    }
    const data = await res.json();
    
    // POSTではGETの結果をそのまま返すので、GET側でperformanceが付与されていればそれが使われる
    // 必要であれば、ここでも別途 requestEndTime を記録して performance を上書きまたは追加する
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error processing POST query:', error);
    const errorMessage = "サーバーエラーが発生しました (POST)";
    const errorWithAlerts = addMandatoryAlerts(errorMessage);
    const requestEndTimeForError = Date.now(); // ★: エラー時も念のため
    const totalRequestTimeForError = requestEndTimeForError - requestStartTime; // ★: エラー時も念のため
    return NextResponse.json(
      { error: errorWithAlerts, performance: { total_time_ms: totalRequestTimeForError } }, // ★: パフォーマンス情報を追加
      { status: 500 }
    );
  }
}
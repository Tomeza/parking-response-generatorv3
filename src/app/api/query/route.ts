import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '../../../lib/search';
import { type SearchResult } from '../../../lib/common-types';
import { prisma } from '../../../lib/db';
import { addMandatoryAlerts, detectAlertKeywords } from '../../../lib/alert-system';
import { refineResponse, analyzeQuery, rerankResults } from '@/lib/anthropic';
import { ENABLE_SHADOW_ROUTING, ENABLE_CANARY_ROUTING, CANARY_PERCENTAGE, SHADOW_HEADER, CANARY_HEADER } from '@/config/flags';

// Helper function for timing
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  const res = await fn();
  console.timeEnd(label);
  return res;
}

// Shadow/Canary制御関数
function shouldEnableShadowMode(request: NextRequest): boolean {
  return ENABLE_SHADOW_ROUTING && request.headers.get(SHADOW_HEADER) === 'true';
}

function shouldEnableCanaryMode(request: NextRequest): boolean {
  if (!ENABLE_CANARY_ROUTING) return false;
  
  // ヘッダーベースの制御
  if (request.headers.get(CANARY_HEADER) === 'true') return true;
  
  // パーセンテージベースの制御
  const userId = request.headers.get('x-user-id') || 'default';
  const hash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return (hash % 100) < CANARY_PERCENTAGE;
}

// Shadow/Canary用ログ関数
async function logShadowRouting(query: string, analysis: any, template: any, response: any) {
  try {
    await prisma.routingLogs.create({
      data: {
        query_text: query,
        detected_category: analysis.category,
        detected_intent: analysis.intent,
        detected_tone: analysis.tone,
        selected_template_id: template?.id || null,
        confidence_score: analysis.confidence || 0,
        is_fallback: false,
        processing_time_ms: 0,
        session_id: 'shadow',
        user_id: 'shadow'
      }
    });
  } catch (error) {
    console.error('Shadow logging error:', error);
  }
}

export async function GET(request: NextRequest) {
  const searchStartTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const tags = searchParams.get('tags') || '';

  const decodedQuery = decodeURIComponent(query);
  const decodedTags = decodeURIComponent(tags);

  if (!decodedQuery) {
    return NextResponse.json(
      { error: '検索クエリが指定されていません' },
      { status: 400 }
    );
  }

  // Shadow/Canary制御
  const isShadowMode = shouldEnableShadowMode(request);
  const isCanaryMode = shouldEnableCanaryMode(request);

  try {
    console.log('Query received:', decodedQuery);
    console.log('Tags received:', decodedTags);
    console.log('Routing mode:', isShadowMode ? 'SHADOW' : isCanaryMode ? 'CANARY' : 'PRODUCTION');

    // 1. Analyze Query
    const analysisResult: any = await timed('A1_Step1_AnalyzeQuery', async () => {
      return analyzeQuery(decodedQuery);
    });
    console.log('AnalyzeQuery Result (first 100 chars):', typeof analysisResult === 'string' ? analysisResult.substring(0,100) : analysisResult);

    const detectedAlerts = detectAlertKeywords(decodedQuery);
    console.log('Detected alerts:', detectedAlerts);
    
    // 2. Search Knowledge
    let searchResults: SearchResult[] = [];
    try {
      const rawResults = await timed('A1_Step2_SearchKnowledge', async () => {
        return searchKnowledge(decodedQuery, decodedTags);
      });
      if (Array.isArray(rawResults)) {
        searchResults = rawResults.filter(
            (item): item is SearchResult => 
                typeof item === 'object' && 
                item !== null && 
                typeof item.id === 'number' && 
                typeof item.answer === 'string'
        );
        console.log('Search results from searchKnowledge (already sorted):', searchResults.map(r => ({ id: r.id, score: r.score })));
      } else {
        console.warn(`searchKnowledge for query "${decodedQuery}" with tags "${decodedTags}" did not return an array. Received:`, rawResults);
      }
    } catch(searchError) {
      console.error(`Error during searchKnowledge for query "${decodedQuery}" with tags "${decodedTags}":`, searchError);
    }

    console.log('Search results count:', searchResults.length);
    
    if (searchResults.length === 0) {
      const notFoundMessage = "申し訳ございませんが、ご質問に対する具体的な情報が見つかりませんでした。";
      const notFoundWithAlerts = addMandatoryAlerts(notFoundMessage);
      const searchTime = Date.now() - searchStartTime;
      const notFoundResponse = {
        response: notFoundWithAlerts,
        steps: [
          { step: "キーワード抽出", content: { query: decodedQuery, terms: "-", analysis: analysisResult } },
          { step: "ナレッジ検索", content: { status: "失敗", reason: "関連情報なし", used: [] } },
          { step: "応答生成", content: { result: "フォールバック応答", template: "N/A", reason: "情報なし" } },
          { step: "アラート追加", content: { alerts: ["国際線利用不可", "外車受入不可"] } }
        ],
        performance: { total_time_ms: searchTime }
      };
      
      // Shadow modeの場合はログのみ記録
      if (isShadowMode) {
        await logShadowRouting(decodedQuery, analysisResult, null, notFoundResponse);
        return NextResponse.json({ message: 'Shadow mode - no response to user' });
      }
      
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

    const searchTime = Date.now() - searchStartTime;
    return NextResponse.json({
      response: finalResponseTextWithAlerts,
      responseId: bestMatch.id,
      score: bestMatch.score ?? 0,
      knowledge_id: bestMatch.id,
      question: bestMatch.question,
      steps: responseSteps,
      total_results: allOriginalResults.length,
      all_results: allOriginalResults.map(r => ({ id: r.id, score: r.score, note: r.note, detail_category: r.detail_category })),
      performance: { total_time_ms: searchTime }
    });

  } catch (error: any) {
    console.error('Error processing query in GET:', error);
    const errorMessage = addMandatoryAlerts("検索処理中にエラーが発生しました (GET)");
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error processing POST query:', error);
    const errorMessage = "サーバーエラーが発生しました (POST)";
    const errorWithAlerts = addMandatoryAlerts(errorMessage);
    return NextResponse.json(
      { error: errorWithAlerts },
      { status: 500 }
    );
  }
}
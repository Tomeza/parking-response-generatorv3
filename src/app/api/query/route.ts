import { NextRequest, NextResponse } from 'next/server';
// 古い検索関数を削除
// import { searchKnowledge } from '@/lib/search';
// 新しい最適化された検索関数をインポート
// import { optimizedSearch, type OptimizedSearchResult } from '@/lib/optimize-search.js';
// ★★★ 修正: searchKnowledge をインポート ★★★
// import { searchKnowledge, type SearchResult } from '@/lib/search'; 
// ★★★ 修正: searchKnowledge と SearchResult を正しいパスからインポート ★★★
import { searchKnowledge } from '@/lib/search'; 
import { type SearchResult } from '@/lib/common-types';
import { prisma } from '@/lib/db';

// Removed unused mockResponse, reservationResponse, reservationChangeResponse variables
// Removed unused isBusinessHoursQuery and getBusinessHoursFallbackResponse functions

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const tags = searchParams.get('tags') || ''; // tags パラメータを取得

  // クエリとタグをデコード (念のため)
  const decodedQuery = decodeURIComponent(query);
  const decodedTags = decodeURIComponent(tags);

  if (!decodedQuery) {
    return NextResponse.json(
      { error: '検索クエリが指定されていません' },
      { status: 400 }
    );
  }

  try {
    console.log('Query received:', decodedQuery);
    console.log('Tags received:', decodedTags); // タグのログを追加
    
    let searchResults: SearchResult[] = []; 
    try {
        // searchKnowledge に decodedTags を渡す
        const rawResults = await searchKnowledge(decodedQuery, decodedTags); 
        if (Array.isArray(rawResults)) {
            // SearchResult型に合わせてフィルタリング
            searchResults = rawResults.filter(
                (item): item is SearchResult => 
                    typeof item === 'object' && 
                    item !== null && 
                    typeof item.id === 'number' && 
                    typeof item.answer === 'string'
            );
            
            // ★★★ 修正: 不要な再ソート処理を削除 ★★★
            // searchResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); 
            // ★★★ 修正: ログのタイトルを変更 (既にソート済みであることを示す) ★★★
            console.log('Search results from searchKnowledge (already sorted):', searchResults.map(r => ({ id: r.id, score: r.score })));
        } else {
            // ★★★ 修正: searchKnowledge を使うようにログメッセージを更新 ★★★
            console.warn(`searchKnowledge for query "${decodedQuery}" with tags "${decodedTags}" did not return an array. Received:`, rawResults);
        }
    } catch(searchError) {
        console.error(`Error during searchKnowledge for query "${decodedQuery}" with tags "${decodedTags}":`, searchError); // ログにタグ情報追加
        // Keep searchResults as empty array
    }

    console.log('Search results count:', searchResults.length);
    
    if (searchResults.length === 0) { // Check based on the potentially filtered results
      const notFoundResponse = {
        response: "申し訳ございませんが、ご質問に対する具体的な情報が見つかりませんでした。",
        steps: [
          { step: "キーワード抽出", content: { query: decodedQuery, terms: "-" } },
          { step: "ナレッジ検索", content: { status: "失敗", reason: "関連情報なし", used: [] } },
          { step: "応答生成", content: { result: "フォールバック応答", template: "N/A", reason: "情報なし" } }
        ]
      };

      // レスポンスをログに保存
      await prisma.responseLog.create({
        data: {
          query: decodedQuery,
          response: notFoundResponse.response,
          used_knowledge_ids: [],
          missing_tags: [],
          missing_alerts: [],
          created_at: new Date()
        }
      });

      return NextResponse.json(notFoundResponse);
    }
    
    const bestMatch = searchResults[0];
    const allResults = searchResults;
    const usedKnowledgeIds = allResults.map((result: SearchResult) => result.id);

    // キーワード抽出ステップ
    const keywordStep = {
      step: "キーワード抽出/前処理",
      content: { query: decodedQuery }
    };

    // ナレッジ検索ステップ
    const knowledgeSearchStep = {
      step: "ナレッジ検索",
      content: {
        score: bestMatch.score ?? 0,
        bestMatch: { id: bestMatch.id, question: bestMatch.question },
        used: allResults.map((result: SearchResult) => ({ 
          id: result.id, 
          question: result.question, 
          answer: result.answer, 
          score: result.score ?? 0
        })),
        missing: []
      }
    };

    // テンプレート適用ステップ
    let template = "[ANSWER]";
    let templateReason = "標準テンプレート適用";
    let finalResponseText = bestMatch.answer;

    if (bestMatch.note === '外車利用に関する専用回答です') {
      finalResponseText = "お問い合わせありがとうございます。誠に申し訳ございませんが、当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。ご理解いただけますと幸いです。";
      template = finalResponseText;
      templateReason = "外車利用不可の専用回答を適用";
    } else if (bestMatch.note === '国際線利用に関する専用回答です') {
      finalResponseText = "申し訳ございませんが、当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。";
      template = finalResponseText;
      templateReason = "国際線利用不可の専用回答を適用";
    } else if (!template.includes("[ANSWER]")) {
      // templateが[ANSWER]を含まない場合は、replaceをスキップ
    } else if (finalResponseText) {
      finalResponseText = template.replace("[ANSWER]", finalResponseText);
    }

    const templateStep = {
      step: "テンプレート適用",
      content: {
        template: template,
        reason: templateReason
      }
    };

    const responseSteps = [
      keywordStep,
      knowledgeSearchStep,
      templateStep,
    ];
    
    // レスポンスログを1回だけ保存
    await prisma.responseLog.create({
      data: {
        query: decodedQuery,
        response: finalResponseText,
        used_knowledge_ids: usedKnowledgeIds,
        missing_tags: [],
        missing_alerts: [],
        knowledge_id: bestMatch.id,
        response_count: searchResults.length,
        created_at: new Date()
      }
    });

    return NextResponse.json({
      response: finalResponseText,
      responseId: bestMatch.id,
      score: bestMatch.score ?? 0,
      knowledge_id: bestMatch.id,
      question: bestMatch.question,
      steps: responseSteps,
      total_results: searchResults.length,
      all_results: allResults.map(r => ({
        id: r.id,
        score: r.score,
        note: r.note,
        detail_category: r.detail_category
      }))
    });

  } catch (error: any) {
    console.error('Error processing query:', error);
    
    // エラー時のレスポンスログ保存
    try {
      await prisma.responseLog.create({
        data: {
          query: decodedQuery,
          response: "検索処理中にエラーが発生しました",
          used_knowledge_ids: [],
          missing_tags: [],
          missing_alerts: [],
          created_at: new Date()
        }
      });
    } catch (logError) {
      console.error('Error saving error response log:', logError);
    }

    return NextResponse.json(
      { 
        error: '検索処理中にエラーが発生しました', 
        details: error.message,
        steps: [
          { step: "エラー発生", content: { error: error.message } }
        ]
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'クエリが指定されていません' },
        { status: 400 }
      );
    }

    // GETエンドポイントと同様に処理
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/query?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    return NextResponse.json({ answer: data.response });
  } catch (error) {
    console.error('Error processing query:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
} 
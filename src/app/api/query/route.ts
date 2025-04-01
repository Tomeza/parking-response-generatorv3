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

  if (!query) {
    return NextResponse.json(
      { error: '検索クエリが指定されていません' },
      { status: 400 }
    );
  }

  try {
    console.log('Query received:', query);
    
    // ★★★ 修正: SearchResult 型を使用 ★★★
    let searchResults: SearchResult[] = []; 
    try {
        // ★★★ 修正: searchKnowledge を呼び出す ★★★
        const rawResults = await searchKnowledge(query); 
        if (Array.isArray(rawResults)) {
            // ★★★ 修正: SearchResult 型に合わせてフィルタリング ★★★
            searchResults = rawResults.filter(
                (item): item is SearchResult => 
                    typeof item === 'object' && 
                    item !== null && 
                    typeof item.id === 'number' && 
                    typeof item.answer === 'string'
                    // score や search_method は SearchResult には必須ではないためチェックを削除
                    // search_vector も SearchResult には不要
            );
        } else {
            // ★★★ 修正: searchKnowledge を使うようにログメッセージを更新 ★★★
            console.warn(`searchKnowledge for query "${query}" did not return an array. Received:`, rawResults);
        }
    } catch(searchError) {
        // ★★★ 修正: searchKnowledge を使うようにログメッセージを更新 ★★★
        console.error(`Error during searchKnowledge for query "${query}":`, searchError);
        // Keep searchResults as empty array
    }

    console.log('Search results count:', searchResults.length);
    
    if (searchResults.length === 0) { // Check based on the potentially filtered results
      const notFoundResponse = {
        response: "申し訳ございませんが、ご質問に対する具体的な情報が見つかりませんでした。",
        steps: [
          { step: "キーワード抽出", content: { query: query, terms: "-" } },
          { step: "ナレッジ検索", content: { status: "失敗", reason: "関連情報なし", used: [] } },
          { step: "応答生成", content: { result: "フォールバック応答", template: "N/A", reason: "情報なし" } }
        ]
      };

      // レスポンスをログに保存
      await prisma.responseLog.create({
        data: {
          query: query,
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
    // ★★★ 修正: SearchResult 型を使用 ★★★
    const usedKnowledgeIds = allResults.map((result: SearchResult) => result.id);

    // ★★★ ログ保存 (変更なし) ★★★
    await prisma.responseLog.create({
      data: {
        query: query,
        response: bestMatch.answer, // Ensure bestMatch has an answer property
        used_knowledge_ids: usedKnowledgeIds,
        missing_tags: [],
        missing_alerts: [],
        knowledge_id: bestMatch.id, // Ensure bestMatch has an id property
        created_at: new Date()
      }
    });

    // ★★★ フロントエンド表示用に steps 配列を再構築 ★★★

    // 1. キーワード抽出ステップ (変更なし)
    const keywordStep = {
      step: "キーワード抽出/前処理",
      content: { query: query /*, keyTerms: keyTerms */ }
    };

    // 2. ナレッジ検索ステップ (used情報を SearchResult に合わせて変更)
    const knowledgeSearchStep = {
      step: "ナレッジ検索",
      content: {
        // ★★★ 修正: search_method がないため削除、score を Optional に ★★★
        // method: bestMatch.search_method, 
        score: bestMatch.score ?? 0, // score が undefined の場合は 0 を使う
        bestMatch: { id: bestMatch.id, question: bestMatch.question },
        // ★★★ 使用されたナレッジの詳細リスト (SearchResult に合わせて変更) ★★★
        used: allResults.map((result: SearchResult) => ({ 
          id: result.id, 
          question: result.question, 
          answer: result.answer, 
          score: result.score ?? 0, // score が undefined の場合は 0 を使う
          // search_method がないため削除
          // search_method: result.search_method 
        })),
        missing: [] // 不足タグは現状空
      }
    };

    // 3. テンプレート適用ステップ と 最終回答テキストの決定
    let template = "[ANSWER]";
    let templateReason = "標準テンプレート適用";
    let finalResponseText = bestMatch.answer; // ★★★ デフォルトは bestMatch の回答 ★★★

    // ★★★ 修正: bestMatch.note に基づいて専用回答を生成 ★★★
    if (bestMatch.note === '外車利用に関する専用回答です') {
      finalResponseText = "お問い合わせありがとうございます。誠に申し訳ございませんが、当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。ご理解いただけますと幸いです。";
      template = finalResponseText; // テンプレート適用なし
      templateReason = "外車利用不可の専用回答を適用";
    } else if (bestMatch.note === '国際線利用に関する専用回答です') { // ★★★ ID判定を削除し、noteのみで判定 ★★★
      // finalResponseText = `申し訳ございませんが、${bestMatch.answer} 当駐車場は国内線ご利用のお客様専用となっております。`;
      // ★★★ 修正: 固定テキストに変更し、重複を解消 + 補足を追加 ★★★
      finalResponseText = "申し訳ございませんが、当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。";
      template = finalResponseText; // テンプレート適用なし
      templateReason = "国際線利用不可の専用回答を適用"; // ★★★ (ID:4)を削除 ★★★
    } else if (!template.includes("[ANSWER]")) {
        // templateが[ANSWER]を含まない場合（例えば専用回答が直接設定された場合）は、replaceをスキップ
    } else if (finalResponseText) {
      // 通常のナレッジが見つかった場合、テンプレートを適用
      finalResponseText = template.replace("[ANSWER]", finalResponseText);
    }
    // ★★★ 修正ここまで ★★★

    const templateStep = {
      step: "テンプレート適用",
      content: {
        template: template,
        reason: templateReason
      }
    };

    // 以前の形式に近い steps 配列を作成
    const responseSteps = [
      keywordStep,
      knowledgeSearchStep,
      templateStep,
    ];
    
    await prisma.responseLog.create({
      data: {
        query: query,
        response: finalResponseText,
        used_knowledge_ids: usedKnowledgeIds,
        missing_tags: [],
        missing_alerts: [],
        knowledge_id: bestMatch.id,
        created_at: new Date()
      }
    });

    return NextResponse.json({
      response: finalResponseText,
      responseId: bestMatch.id,
      // ★★★ 修正: search_method がないので削除 ★★★
      // search_method: bestMatch.search_method,
      score: bestMatch.score ?? 0, // score が undefined の場合は 0 を使う
      knowledge_id: bestMatch.id,
      question: bestMatch.question,
      steps: responseSteps 
    });

  } catch (error: any) {
    console.error('Error processing query:', error);
    return NextResponse.json(
      { error: '検索処理中にエラーが発生しました', details: error.message },
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
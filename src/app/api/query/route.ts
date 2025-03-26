import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '@/lib/search';
import { prisma } from '@/lib/db';

// モックデータ
const mockResponse = {
  response: "申し訳ございません。当駐車場は国際線ご利用のお客様向けのサービスは提供しておりません。国内線ご利用のお客様のみご利用いただけます。ご理解のほどよろしくお願いいたします。",
  steps: [
    {
      step: "アラートワード検出",
      content: {
        detected: {
          "国際線利用": true
        },
        missing: ["空き状況"],
        dates: [
          {
            date: "2025-11-06",
            type: "通常営業日"
          }
        ]
      }
    },
    {
      step: "ナレッジ検索",
      content: {
        used: [
          {
            id: 2,
            answer: "当駐車場は国際線ご利用のお客様向けのサービスは提供しておりません。国内線ご利用のお客様のみご利用いただけます。"
          }
        ],
        missing: ["空き状況"]
      }
    },
    {
      step: "トレース",
      content: {
        success: true,
        missing: 1,
        suggestions: ["空き状況タグの追加"]
      }
    },
    {
      step: "テンプレート適用",
      content: {
        template: "申し訳ございません。[ANSWER]ご理解のほどよろしくお願いいたします。",
        reason: "国際線アラート検出による謝罪テンプレート適用"
      }
    }
  ]
};

// 予約に関するモックデータ
const reservationResponse = {
  response: "当駐車場では、ウェブサイトからオンライン予約が可能です。トップページの「予約する」ボタンをクリックし、日時と必要情報を入力してください。",
  steps: [
    {
      step: "アラートワード検出",
      content: {
        detected: {
          "予約": true
        },
        missing: [],
        dates: []
      }
    },
    {
      step: "ナレッジ検索",
      content: {
        used: [
          {
            id: 5,
            answer: "当駐車場では、ウェブサイトからオンライン予約が可能です。トップページの「予約する」ボタンをクリックし、日時と必要情報を入力してください。"
          }
        ],
        missing: []
      }
    },
    {
      step: "トレース",
      content: {
        success: true,
        missing: 0,
        suggestions: []
      }
    },
    {
      step: "テンプレート適用",
      content: {
        template: "[ANSWER]",
        reason: "標準テンプレート適用"
      }
    }
  ]
};

// 予約変更に関するモックデータ
const reservationChangeResponse = {
  response: "予約内容の変更について、以下の通りご案内いたします。\n\n1. 予約日付の変更について：\n   - 申し訳ございませんが、予約日付の変更はできません\n   - 日付を変更したい場合は、一度キャンセルを行い、再度ネットから新しい日付で予約を行う必要があります\n   - なお、希望する日が満車の場合は予約できませんのでご注意ください\n\n2. 送迎サービスの変更について：\n   - 送迎サービスの内容変更（例：通常送迎から「ひとり送迎」への変更）は可能です\n   - 変更の際は、直接メールまたはお電話でご連絡ください\n   - 送迎車両は1台につき最大5名（お子様を含む）まで乗車可能です\n   - 「ひとり送迎」に変更する場合、他の方の同乗はできません\n\n3. 利用便や車種の変更について：\n   - 利用便や車種の変更は可能です\n   - 変更の際は、直接メールまたはお電話でご連絡ください\n   - 車種変更の際は、当駐車場で受け入れ可能な車種であることをご確認ください\n\n※国際線への変更は一切受け付けておりません。\n\nご不明な点がございましたら、お気軽にお問い合わせください。",
  steps: [
    {
      step: "アラートワード検出",
      content: {
        detected: {
          "予約変更": true
        },
        missing: [],
        dates: []
      }
    },
    {
      step: "ナレッジ検索",
      content: {
        used: [
          {
            id: 6,
            answer: "予約内容の変更について、以下の通りご案内いたします。\n\n1. 予約日付の変更について：\n   - 申し訳ございませんが、予約日付の変更はできません\n   - 日付を変更したい場合は、一度キャンセルを行い、再度ネットから新しい日付で予約を行う必要があります\n   - なお、希望する日が満車の場合は予約できませんのでご注意ください\n\n2. 送迎サービスの変更について：\n   - 送迎サービスの内容変更（例：通常送迎から「ひとり送迎」への変更）は可能です\n   - 変更の際は、直接メールまたはお電話でご連絡ください\n   - 送迎車両は1台につき最大5名（お子様を含む）まで乗車可能です\n   - 「ひとり送迎」に変更する場合、他の方の同乗はできません\n\n3. 利用便や車種の変更について：\n   - 利用便や車種の変更は可能です\n   - 変更の際は、直接メールまたはお電話でご連絡ください\n   - 車種変更の際は、当駐車場で受け入れ可能な車種であることをご確認ください\n\n※国際線への変更は一切受け付けておりません。\n\nご不明な点がございましたら、お気軽にお問い合わせください。"
          }
        ],
        missing: []
      }
    },
    {
      step: "トレース",
      content: {
        success: true,
        missing: 0,
        suggestions: []
      }
    },
    {
      step: "テンプレート適用",
      content: {
        template: "[ANSWER]",
        reason: "標準テンプレート適用"
      }
    }
  ]
};

// searchKnowledgeの結果から営業時間関連のキーワードを検出する関数
function isBusinessHoursQuery(query: string, keyTerms: string[]): boolean {
  const businessHoursKeywords = [
    '営業時間', '営業', '開店', '閉店', '営業日', '休業日', '深夜', '24時間',
    '何時から', '何時まで', '利用時間', '駐車時間', '営業開始', '営業終了'
  ];

  // クエリ自体に営業時間関連のキーワードが含まれているかチェック
  if (businessHoursKeywords.some(keyword => query.includes(keyword))) {
    return true;
  }

  // 抽出されたキーターム内に営業時間関連のキーワードが含まれているかチェック
  if (keyTerms.some(term => businessHoursKeywords.some(keyword => term.includes(keyword)))) {
    return true;
  }

  return false;
}

// 営業時間のフォールバック応答を生成する関数
function getBusinessHoursFallbackResponse(): string {
  return `
お問い合わせいただきありがとうございます。

当駐車場の営業時間についてのご案内です：

営業時間: 午前5時から深夜24時まで（24時間営業）
※一部のサービスカウンターは9:00～18:00の営業となります。

・入出庫手続きは24時間いつでも可能です。
・深夜の入出庫もスタッフが常駐しておりますのでご安心ください。
・車両の預け入れは5:00～22:00が最も混雑が少なくスムーズです。

なお、年末年始や特定の連休期間は大変混み合いますので、事前のご予約をお勧めいたします。

その他のご質問やご不明な点がございましたら、お気軽にお問い合わせください。
  `.trim();
}

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
    
    // 実際のナレッジベースから検索
    const searchResults = await searchKnowledge(query);
    console.log('Search results count:', searchResults.length);
    console.log('Search results first item:', searchResults[0]);
    
    if (!searchResults || searchResults.length === 0) {
      const notFoundResponse = {
        response: "申し訳ございませんが、ご質問に対する具体的な情報が見つかりませんでした。",
        stepDetails: {
          alertWordDetection: "アラートワードは検出されませんでした。",
          knowledgeSearch: "知識ベースに関連する情報がありませんでした。",
          templateApplication: "テンプレートはなく、フォールバック応答を生成しました。"
        }
      };

      // 営業時間関連のクエリであれば、営業時間の専用フォールバックを用意
      if (isBusinessHoursQuery(query, [])) {
        notFoundResponse.response = getBusinessHoursFallbackResponse();
        notFoundResponse.stepDetails.knowledgeSearch = "営業時間に関する検索でしたが、直接一致する情報が見つからなかったため、営業時間の一般情報で応答しました。";
      }

      // レスポンスをログに保存
      await prisma.responseLog.create({
        data: {
          query: query,
          response: notFoundResponse.response,
          used_knowledge_ids: [],
          missing_tags: [],
          created_at: new Date()
        }
      });

      return NextResponse.json(notFoundResponse);
    }
    
    // 検索結果に基づいてレスポンスを構築
    const bestMatch = searchResults[0];
    let usedKnowledgeIds = searchResults.slice(0, 3).map(result => result.id);
    
    // 複数の回答を適切に組み合わせる処理
    let responseText = '';
    
    // 国際線に関するクエリかどうかを判断
    const isInternationalQuery = query.includes('国際線');
    
    // 国際線クエリに対する特別処理
    if (isInternationalQuery) {
      // 国際線関連のナレッジを優先
      const internationalResults = searchResults.filter(result => 
        (result.detail_category === '国際線') || 
        (result.question && result.question.includes('国際線')) ||
        (result.main_category === '利用制限')
      );
      
      if (internationalResults.length > 0) {
        // 国際線関連の回答を優先的に使用
        responseText = internationalResults[0].answer;
        usedKnowledgeIds = internationalResults.slice(0, 2).map(result => result.id);
      } else {
        // 通常のベストマッチを使用
        responseText = bestMatch.answer;
      }
    } else if (searchResults.length >= 2 && 
              ((searchResults[0]?.final_score ?? 0) > 0.8) && 
              ((searchResults[1]?.final_score ?? 0) > 0.7)) {
      // 複数の高スコア回答を組み合わせる場合
      const primaryAnswer = searchResults[0]?.answer ?? '';
      const secondaryAnswer = searchResults[1]?.answer ?? '';
      
      // 回答が短い場合または補完的な内容の場合は組み合わせる
      if (primaryAnswer.length < 100 || !primaryAnswer.includes(secondaryAnswer.substring(0, 20))) {
        responseText = `${primaryAnswer} ${secondaryAnswer}`;
      } else {
        responseText = primaryAnswer;
      }
    } else {
      // 単一の回答を使用
      responseText = bestMatch.answer;
    }
    
    // アラート検出結果
    const detectedAlerts: Record<string, boolean> = {};
    const alertWords = ['国際線', '予約', 'キャンセル', '返金', '変更', '混雑', '満車', '外車', '大型車', '輸入車', 'サイズ超過', 'BMW', 'ベンツ', 'アウディ', 'レクサス'];
    alertWords.forEach(word => {
      if (query.includes(word)) {
        detectedAlerts[word] = true;
      }
    });

    // 不足タグ
    const missingTags: string[] = [];
    
    // 日付情報
    const dates: any[] = [];
    const hasBusyPeriod = false;
    
    // テンプレート選択
    let template = "[ANSWER]";
    let templateReason = "標準テンプレート適用";
    
    // 国際線クエリの場合は謝罪テンプレート
    if (isInternationalQuery) {
      template = "申し訳ございません。[ANSWER]ご理解のほどよろしくお願いいたします。";
      templateReason = "国際線アラート検出による謝罪テンプレート適用";
    } 
    // キャンセル関連のクエリの場合
    else if (query.includes('キャンセル')) {
      
      // キャンセル関連のナレッジを優先順位付けして抽出
      const cancelRelatedResults = searchResults
        .filter(result => 
          (result.detail_category === 'キャンセル') || 
          (result.sub_category === 'キャンセル') ||
          (result.sub_category === 'キャンセル料') ||
          (result.detail_category === '基本方針' && result.question?.includes('キャンセル'))
        )
        .sort((a, b) => {
          // キャンセル料に関する質問の場合、料金情報を含む回答を優先
          if (query.includes('キャンセル料') || query.includes('料金')) {
            const aHasFee = a.answer?.includes('円') || a.answer?.includes('料金');
            const bHasFee = b.answer?.includes('円') || b.answer?.includes('料金');
            if (aHasFee && !bHasFee) return -1;
            if (!aHasFee && bHasFee) return 1;
          }
          // それ以外の場合は、より詳細なカテゴリの回答を優先
          return (b.detail_category?.length || 0) - (a.detail_category?.length || 0);
        });

      if (cancelRelatedResults.length > 0) {
        // 複数の回答を組み合わせる必要があるか判断
        const firstResult = cancelRelatedResults[0];
        const secondResult = cancelRelatedResults[1];
        
        if (cancelRelatedResults.length > 1 && 
            ((firstResult?.final_score ?? 0) > 0.7) && 
            ((secondResult?.final_score ?? 0) > 0.6)) {
          // 主要な回答と補足的な回答を組み合わせる
          const primaryAnswer = firstResult?.answer ?? '';
          const secondaryAnswer = secondResult?.answer ?? '';
          
          // 回答の重複を避けながら組み合わせる
          if (!primaryAnswer?.includes(secondaryAnswer?.substring(0, 20))) {
            responseText = `${primaryAnswer} また、${secondaryAnswer}`;
          } else {
            responseText = primaryAnswer;
          }
        } else {
          responseText = firstResult?.answer ?? '';
        }
        
        // 使用したナレッジIDを更新
        usedKnowledgeIds = cancelRelatedResults.slice(0, 2).map(result => result.id);
        
        // キャンセルに特化したテンプレートを適用
        if (query.includes('キャンセル料') || query.includes('料金')) {
          template = "[ANSWER]なお、キャンセルに関してご不明な点がございましたら、お気軽にお問い合わせください。";
          templateReason = "キャンセル料金関連クエリに対するテンプレート適用";
        } else {
          template = "[ANSWER]キャンセルに関する詳細は、予約時にご確認いただけます。";
          templateReason = "一般的なキャンセル関連クエリに対するテンプレート適用";
        }
      }
    }
    // その他のアラートがある場合
    else if (Object.keys(detectedAlerts).length > 0) {
      // 予約関連のアラート
      if ('予約' in detectedAlerts || 'キャンセル' in detectedAlerts || '変更' in detectedAlerts) {
        template = "[ANSWER]ご不明点がございましたら、お気軽にお問い合わせください。";
        templateReason = "予約関連アラート検出によるテンプレート適用";
      }
      // 混雑関連のアラート
      else if ('混雑' in detectedAlerts || '満車' in detectedAlerts || hasBusyPeriod) {
        template = "[ANSWER]ご予約はお早めにお願いいたします。";
        templateReason = "混雑アラート検出によるテンプレート適用";
      }
      // 外車関連のアラート
      else if ('外車' in detectedAlerts || 'BMW' in detectedAlerts || 'ベンツ' in detectedAlerts || 'アウディ' in detectedAlerts || 'レクサス' in detectedAlerts || '輸入車' in detectedAlerts) {
        template = "[ANSWER]当駐車場では補償の都合上、外車や大型高級車の駐車はお受けしておりませんのでご了承ください。";
        templateReason = "外車アラート検出によるテンプレート適用";
      }
      // 大型車関連のアラート
      else if ('大型車' in detectedAlerts || 'サイズ超過' in detectedAlerts || '大型' in detectedAlerts) {
        template = "[ANSWER]お車のサイズを確認の上、大型車に該当する場合は追加料金が発生いたしますのでご了承ください。";
        templateReason = "大型車アラート検出によるテンプレート適用";
      }
    }
    
    // 予約変更関連のクエリの場合
    if (query.includes('予約変更') || 
        query.includes('予約の変更') || 
        query.includes('予約内容の変更') || 
        query.includes('予約の修正') || 
        query.includes('予約の更新') || 
        query.includes('予約の訂正') ||
        query.includes('送迎変更') ||
        query.includes('車種変更') ||
        query.includes('利用便変更') ||
        query.includes('日付変更')) {
      
      // 予約変更関連のナレッジを優先順位付けして抽出
      const changeRelatedResults = searchResults
        .filter(result => 
          (result.detail_category === '予約変更') || 
          (result.sub_category === '予約変更') ||
          (result.main_category === '予約関連' && result.question?.includes('変更'))
        )
        .sort((a, b) => {
          // より詳細なカテゴリの回答を優先
          return (b.detail_category?.length || 0) - (a.detail_category?.length || 0);
        });

      if (changeRelatedResults.length > 0) {
        // 複数の回答を組み合わせる必要があるか判断
        const firstResult = changeRelatedResults[0];
        const secondResult = changeRelatedResults[1];
        
        if (changeRelatedResults.length > 1 && 
            ((firstResult?.final_score ?? 0) > 0.7) && 
            ((secondResult?.final_score ?? 0) > 0.6)) {
          // 主要な回答と補足的な回答を組み合わせる
          const primaryAnswer = firstResult?.answer ?? '';
          const secondaryAnswer = secondResult?.answer ?? '';
          
          // 回答の重複を避けながら組み合わせる
          if (!primaryAnswer?.includes(secondaryAnswer?.substring(0, 20))) {
            responseText = `${primaryAnswer} また、${secondaryAnswer}`;
          } else {
            responseText = primaryAnswer;
          }
        } else {
          responseText = firstResult?.answer ?? '';
        }
        
        // 使用したナレッジIDを更新
        usedKnowledgeIds = changeRelatedResults.slice(0, 2).map(result => result.id);
        
        // 予約変更に特化したテンプレートを適用
        template = "[ANSWER]予約変更に関する詳細は、お気軽にお問い合わせください。";
        templateReason = "予約変更関連クエリに対するテンプレート適用";
      }
    }
    
    // 最終的な回答文を生成
    const finalResponse = template.replace("[ANSWER]", responseText);
    
    // 使用したナレッジの整形
    const usedKnowledge = searchResults.slice(0, Math.min(3, searchResults.length)).map(result => ({
      id: result.id,
      answer: result.answer
    }));
    
    // レスポンスの構築
    const response = {
      response: finalResponse,
      responseId: bestMatch.id, // IDも追加
      usedKnowledgeIds: usedKnowledgeIds, // 使用したナレッジIDを明示的に返す
      steps: [
        {
          step: "アラートワード検出",
          content: {
            detected: detectedAlerts,
            missing: [],
            dates: dates.map(date => ({
              date: typeof date === 'object' && date.toISOString ? date.toISOString().split('T')[0] : '不明',
              type: "通常営業日"
            }))
          }
        },
        {
          step: "ナレッジ検索",
          content: {
            used: usedKnowledge,
            missing: missingTags
          }
        },
        {
          step: "トレース",
          content: {
            success: usedKnowledge.length > 0,
            missing: missingTags.length,
            suggestions: []
          }
        },
        {
          step: "テンプレート適用",
          content: {
            template: template,
            reason: templateReason
          }
        }
      ]
    };
    
    // レスポンスログに記録
    await prisma.responseLog.create({
      data: {
        query,
        response: finalResponse,
        used_knowledge_ids: usedKnowledgeIds,
        missing_tags: missingTags,
        missing_alerts: [],
        feedback: null,
        knowledge_id: bestMatch.id
      }
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating response:', error);
    return NextResponse.json(
      { error: '返信の生成中にエラーが発生しました' },
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
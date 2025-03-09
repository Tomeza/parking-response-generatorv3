import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

// モックデータ
const mockKnowledge = [
  {
    id: 1,
    main_category: '予約',
    sub_category: '予約方法',
    detail_category: 'オンライン予約',
    question: '予約方法を教えてください',
    answer: '当駐車場では、ウェブサイトからオンライン予約が可能です。トップページの「予約する」ボタンをクリックし、日時と必要情報を入力してください。',
    is_template: true,
    usage: '一般',
    note: '',
    issue: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [
      { id: 1, tag_name: '予約', description: '予約に関する質問' },
      { id: 2, tag_name: 'オンライン', description: 'オンラインサービスに関する質問' }
    ]
  },
  {
    id: 2,
    main_category: '料金',
    sub_category: '通常料金',
    detail_category: '時間料金',
    question: '駐車場の料金はいくらですか？',
    answer: '当駐車場の料金は、平日は1時間300円、土日祝日は1時間400円となっております。また、一日最大料金は平日1,500円、土日祝日2,000円です。',
    is_template: true,
    usage: '一般',
    note: '',
    issue: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [
      { id: 3, tag_name: '料金', description: '料金に関する質問' }
    ]
  },
  {
    id: 3,
    main_category: '営業時間',
    sub_category: '通常営業',
    detail_category: '',
    question: '営業時間を教えてください',
    answer: '当駐車場は24時間営業しております。年中無休で利用可能です。',
    is_template: true,
    usage: '一般',
    note: '',
    issue: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [
      { id: 4, tag_name: '営業時間', description: '営業時間に関する質問' }
    ]
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    
    // 検索条件でフィルタリング
    let filteredData = [...mockKnowledge];
    
    if (search) {
      filteredData = filteredData.filter(item => 
        (item.question && item.question.toLowerCase().includes(search.toLowerCase())) ||
        item.answer.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (category) {
      filteredData = filteredData.filter(item => 
        (item.main_category && item.main_category.toLowerCase().includes(category.toLowerCase())) ||
        (item.sub_category && item.sub_category.toLowerCase().includes(category.toLowerCase())) ||
        (item.detail_category && item.detail_category.toLowerCase().includes(category.toLowerCase()))
      );
    }
    
    // ページネーション
    const total = filteredData.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    
    return NextResponse.json({
      data: paginatedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // 新しいIDを生成
    const newId = mockKnowledge.length > 0 ? Math.max(...mockKnowledge.map(k => k.id)) + 1 : 1;
    
    // 新しいナレッジを作成
    const newKnowledge = {
      id: newId,
      main_category: data.main_category || '',
      sub_category: data.sub_category || '',
      detail_category: data.detail_category || '',
      question: data.question || '',
      answer: data.answer || '',
      is_template: data.is_template || false,
      usage: data.usage || '',
      note: data.note || '',
      issue: data.issue || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: data.tags ? data.tags.map((tagId: number) => {
        // タグIDからタグを検索（実際のアプリではデータベースから取得）
        return { id: tagId, tag_name: `タグ${tagId}`, description: null };
      }) : []
    };
    
    // モックデータに追加（実際のアプリではデータベースに保存）
    mockKnowledge.push(newKnowledge);
    
    return NextResponse.json(newKnowledge);
  } catch (error) {
    console.error('Error creating knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge' },
      { status: 500 }
    );
  }
} 
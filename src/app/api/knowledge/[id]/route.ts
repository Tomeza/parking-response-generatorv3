import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

// モックデータ（src/app/api/knowledge/route.tsと同じデータを使用）
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    // IDでナレッジを検索
    const knowledge = mockKnowledge.find(k => k.id === id);
    
    if (!knowledge) {
      return NextResponse.json(
        { error: 'Knowledge not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(knowledge);
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const data = await request.json();
    
    // IDでナレッジを検索
    const knowledgeIndex = mockKnowledge.findIndex(k => k.id === id);
    
    if (knowledgeIndex === -1) {
      return NextResponse.json(
        { error: 'Knowledge not found' },
        { status: 404 }
      );
    }
    
    // ナレッジを更新
    const updatedKnowledge = {
      ...mockKnowledge[knowledgeIndex],
      main_category: data.main_category || mockKnowledge[knowledgeIndex].main_category,
      sub_category: data.sub_category || mockKnowledge[knowledgeIndex].sub_category,
      detail_category: data.detail_category || mockKnowledge[knowledgeIndex].detail_category,
      question: data.question || mockKnowledge[knowledgeIndex].question,
      answer: data.answer || mockKnowledge[knowledgeIndex].answer,
      is_template: data.is_template !== undefined ? data.is_template : mockKnowledge[knowledgeIndex].is_template,
      usage: data.usage || mockKnowledge[knowledgeIndex].usage,
      note: data.note || mockKnowledge[knowledgeIndex].note,
      issue: data.issue || mockKnowledge[knowledgeIndex].issue,
      updatedAt: new Date().toISOString(),
      tags: data.tags ? data.tags.map((tagId: number) => {
        // タグIDからタグを検索（実際のアプリではデータベースから取得）
        return { id: tagId, tag_name: `タグ${tagId}`, description: null };
      }) : mockKnowledge[knowledgeIndex].tags
    };
    
    // モックデータを更新
    mockKnowledge[knowledgeIndex] = updatedKnowledge;
    
    return NextResponse.json(updatedKnowledge);
  } catch (error) {
    console.error('Error updating knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    // IDでナレッジを検索
    const knowledgeIndex = mockKnowledge.findIndex(k => k.id === id);
    
    if (knowledgeIndex === -1) {
      return NextResponse.json(
        { error: 'Knowledge not found' },
        { status: 404 }
      );
    }
    
    // モックデータから削除
    mockKnowledge.splice(knowledgeIndex, 1);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge' },
      { status: 500 }
    );
  }
} 
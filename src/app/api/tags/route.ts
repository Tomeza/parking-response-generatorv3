export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

// モックデータ
const mockTags = [
  {
    id: 1,
    tag_name: '予約',
    description: '予約に関する質問',
    tag_synonyms: [
      { id: 1, tag_id: 1, synonym: '予約方法' },
      { id: 2, tag_id: 1, synonym: 'リザーブ' }
    ]
  },
  {
    id: 2,
    tag_name: 'オンライン',
    description: 'オンラインサービスに関する質問',
    tag_synonyms: [
      { id: 3, tag_id: 2, synonym: 'ウェブ' },
      { id: 4, tag_id: 2, synonym: 'インターネット' }
    ]
  },
  {
    id: 3,
    tag_name: '料金',
    description: '料金に関する質問',
    tag_synonyms: [
      { id: 5, tag_id: 3, synonym: '価格' },
      { id: 6, tag_id: 3, synonym: 'コスト' }
    ]
  },
  {
    id: 4,
    tag_name: '営業時間',
    description: '営業時間に関する質問',
    tag_synonyms: [
      { id: 7, tag_id: 4, synonym: '開店時間' },
      { id: 8, tag_id: 4, synonym: '閉店時間' }
    ]
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    
    let filteredTags = [...mockTags];
    
    if (search) {
      filteredTags = filteredTags.filter(tag => 
        tag.tag_name.toLowerCase().includes(search.toLowerCase()) ||
        (tag.description && tag.description.toLowerCase().includes(search.toLowerCase())) ||
        tag.tag_synonyms.some(synonym => synonym.synonym.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    return NextResponse.json(filteredTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { tag_name, description, synonyms } = data;
    
    // タグ名が既に存在するか確認
    const existingTag = mockTags.find(tag => tag.tag_name === tag_name);
    
    if (existingTag) {
      return NextResponse.json(
        { error: 'Tag name already exists' },
        { status: 400 }
      );
    }
    
    // 新しいIDを生成
    const newId = mockTags.length > 0 ? Math.max(...mockTags.map(t => t.id)) + 1 : 1;
    
    // 新しいタグを作成
    const newTag = {
      id: newId,
      tag_name,
      description: description || null,
      tag_synonyms: []
    };
    
    // シノニムがあれば追加
    if (synonyms && synonyms.length > 0) {
      let synonymId = 1;
      // 既存のシノニムの最大IDを取得
      mockTags.forEach(tag => {
        if (tag.tag_synonyms.length > 0) {
          const maxId = Math.max(...tag.tag_synonyms.map(s => s.id));
          if (maxId >= synonymId) {
            synonymId = maxId + 1;
          }
        }
      });
      
      // シノニムを追加
      newTag.tag_synonyms = synonyms.map((synonym: string) => ({
        id: synonymId++,
        tag_id: newId,
        synonym
      }));
    }
    
    // モックデータに追加
    mockTags.push(newTag);
    
    return NextResponse.json(newTag);
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
} 
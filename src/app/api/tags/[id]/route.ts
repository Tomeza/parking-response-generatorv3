import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

// モックデータ（src/app/api/tags/route.tsと同じデータを使用）
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    // IDでタグを検索
    const tag = mockTags.find(t => t.id === id);
    
    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error fetching tag:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tag' },
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
    const { tag_name, description, synonyms } = data;
    
    // IDでタグを検索
    const tagIndex = mockTags.findIndex(t => t.id === id);
    
    if (tagIndex === -1) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }
    
    // タグ名が変更される場合、重複チェック
    if (tag_name !== mockTags[tagIndex].tag_name) {
      const duplicateTag = mockTags.find(t => t.tag_name === tag_name);
      
      if (duplicateTag) {
        return NextResponse.json(
          { error: 'Tag name already exists' },
          { status: 400 }
        );
      }
    }
    
    // タグを更新
    const updatedTag = {
      ...mockTags[tagIndex],
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
      updatedTag.tag_synonyms = synonyms.map((synonym: string) => ({
        id: synonymId++,
        tag_id: id,
        synonym
      }));
    }
    
    // モックデータを更新
    mockTags[tagIndex] = updatedTag;
    
    return NextResponse.json(updatedTag);
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { error: 'Failed to update tag' },
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
    
    // IDでタグを検索
    const tagIndex = mockTags.findIndex(t => t.id === id);
    
    if (tagIndex === -1) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }
    
    // タグが使用されているか確認（実際のアプリではデータベースで確認）
    // ここではモックデータなので、常に使用されていないと仮定
    
    // モックデータから削除
    mockTags.splice(tagIndex, 1);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
} 
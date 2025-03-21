import { NextResponse } from 'next/server';
import { searchKnowledge } from '@/lib/search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    // デコードされたクエリをログに出力
    console.log('検索クエリ (raw):', query);
    
    // クエリのエンコーディングを確認
    const encodedQuery = encodeURIComponent(query);
    const decodedQuery = decodeURIComponent(encodedQuery);
    console.log('検索クエリ (encoded):', encodedQuery);
    console.log('検索クエリ (decoded):', decodedQuery);
    
    // バッファに変換してエンコーディングを確認
    const buffer = Buffer.from(query);
    console.log('検索クエリ (buffer):', buffer.toString('hex'));
    
    // 正規化されたクエリを使用
    const normalizedQuery = decodedQuery.normalize('NFC');
    console.log('検索クエリ (normalized):', normalizedQuery);
    
    const results = await searchKnowledge(normalizedQuery);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to search knowledge' }, { status: 500 });
  }
} 
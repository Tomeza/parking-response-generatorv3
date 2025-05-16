import { NextRequest, NextResponse } from 'next/server';
import { getSearchMetrics, clearSearchCache } from '@/lib/search';

/**
 * 検索メトリクスを取得するGETエンドポイント
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reset = searchParams.get('reset') === 'true';

    // キャッシュリセットが要求された場合
    if (reset) {
      clearSearchCache();
      return NextResponse.json({
        success: true,
        message: '検索キャッシュをリセットしました',
        metrics: getSearchMetrics(),
        timestamp: new Date().toISOString()
      });
    }

    // 現在のメトリクスを取得
    const metrics = getSearchMetrics();

    // メトリクスに追加情報を付与
    const enhancedMetrics = {
      ...metrics,
      cache_hit_rate: metrics.totalSearches > 0 
        ? (metrics.cacheHits / metrics.totalSearches * 100).toFixed(2) + '%' 
        : '0.00%',
      average_time_formatted: metrics.averageSearchTime.toFixed(2) + 'ms',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      metrics: enhancedMetrics
    });
  } catch (error) {
    console.error('Error retrieving search metrics:', error);
    return NextResponse.json(
      { error: 'メトリクス取得中にエラーが発生しました', success: false },
      { status: 500 }
    );
  }
}

/**
 * 検索メトリクスをリセットするPOSTエンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reset_cache } = body;

    if (reset_cache) {
      clearSearchCache();
    }

    return NextResponse.json({
      success: true,
      message: reset_cache ? 'キャッシュをリセットしました' : 'アクションが実行されました',
      metrics: getSearchMetrics(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing metrics action:', error);
    return NextResponse.json(
      { error: 'メトリクス操作中にエラーが発生しました', success: false },
      { status: 500 }
    );
  }
} 
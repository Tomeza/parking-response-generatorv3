/**
 * Basic Integration Tests
 * Simple tests that verify core functionality without external dependencies
 */

import { HybridRetriever } from '../../src/lib/hybrid-retriever';
// import { redis } from '../../src/lib/hybrid-retriever'; // トップレベルのエクスポートは不要に

describe('Basic Integration Tests', () => {
  let retrieverInstanceForCleanup: HybridRetriever | null = null;

  it('should be able to import core modules', async () => {
    // Test that we can import our main modules without errors
    const { HybridRetriever: Cls } = await import('../../src/lib/hybrid-retriever');
    
    expect(Cls).toBeDefined();
    expect(typeof Cls).toBe('function');
  });

  it('should be able to create HybridRetriever instance', () => {
    // このテストでインスタンスを生成し、クリーンアップ対象として保持
    retrieverInstanceForCleanup = new HybridRetriever({
      topK: 5,
      efSearchValue: 30,
      isDev: false, // CIではisDev: falseを推奨
      // supabaseClient: mockSupabaseClient, // 実際のインテグレーションテストではモックしないか、テスト用DBを使う
    });
    
    expect(retrieverInstanceForCleanup).toBeInstanceOf(HybridRetriever);
  });

  it('should have proper environment setup', () => {
    // Verify that Jest is working properly
    expect(process.env.NODE_ENV).toBeDefined();
    expect(typeof jest).toBe('object');
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });

  it('should handle async operations', async () => {
    // Test basic async functionality
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    const start = Date.now();
    await delay(10);
    const end = Date.now();
    
    expect(end - start).toBeGreaterThanOrEqual(10);
  });

  afterAll(async () => {
    // retrieverインスタンスが作成されていればcleanupを呼ぶ
    if (retrieverInstanceForCleanup && typeof retrieverInstanceForCleanup.cleanup === 'function') {
      await retrieverInstanceForCleanup.cleanup();
    }
    // await redis.quit(); // トップレベルのredisインスタンスを直接操作する代わりに、retriever経由でクリーンアップ
  });
}); 
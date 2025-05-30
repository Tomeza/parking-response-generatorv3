/**
 * Basic Integration Tests
 * Simple tests that verify core functionality without external dependencies
 */

describe('Basic Integration Tests', () => {
  it('should be able to import core modules', async () => {
    // Test that we can import our main modules without errors
    const { HybridRetriever } = await import('../../src/lib/hybrid-retriever');
    
    expect(HybridRetriever).toBeDefined();
    expect(typeof HybridRetriever).toBe('function');
  });

  it('should be able to create HybridRetriever instance', () => {
    // This test doesn't require database connection
    const { HybridRetriever } = require('../../src/lib/hybrid-retriever');
    
    const retriever = new HybridRetriever({
      topK: 5,
      efSearchValue: 30,
      isDev: true
    });
    
    expect(retriever).toBeInstanceOf(HybridRetriever);
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
}); 
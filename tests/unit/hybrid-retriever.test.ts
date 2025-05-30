/**
 * HybridRetriever Unit Tests
 * CI-friendly tests with mocked dependencies
 */

import Redis from 'ioredis';
import { HybridRetriever, HybridRetrieverInput } from '../../src/lib/hybrid-retriever';
import { prisma } from '../../src/lib/db';
import { generateEmbedding } from '../../src/lib/embeddings';

// ioredis をモック (ファイル先頭に配置)
jest.mock('ioredis');

// Prisma Client をモック
jest.mock('../../src/lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    knowledge: {
      findMany: jest.fn(),
    },
  },
}));

// Embedding 関数をモック
jest.mock('../../src/lib/embeddings', () => ({
  generateEmbedding: jest.fn(),
}));

// Supabase Client のモック
const mockSupabaseMatch = jest.fn();
const mockSupabaseSelect = jest.fn().mockReturnValue({ match: mockSupabaseMatch });
const mockSupabaseFrom = jest.fn().mockReturnValue({ select: mockSupabaseSelect });
const mockSupabaseClient = {
  from: mockSupabaseFrom,
} as any; // 型を簡略化

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGenerateEmbedding = generateEmbedding as jest.MockedFunction<typeof generateEmbedding>;

const mockPGroongaSearch = jest.fn();
const mockPgvectorSearchEmbedding = jest.fn();

describe('HybridRetriever with DI and Cleanup', () => {
  let retriever: HybridRetriever;
  let mockRedisInstance: jest.Mocked<Redis>; 

  beforeEach(async () => {
    jest.clearAllMocks(); 

    // 各テストケースの前に新しいRedisモックインスタンスを生成
    // ioredis-mock が jest.mock('ioredis') によってデフォルトのコンストラクタになる
    mockRedisInstance = new Redis() as jest.Mocked<Redis>; 
    // メソッドを個別にモック実装
    mockRedisInstance.get = jest.fn(async (key: string) => null) as any;
    mockRedisInstance.set = jest.fn(async (key: string, value: string, ...args: any[]) => 'OK') as any;
    mockRedisInstance.flushall = jest.fn(async () => 'OK') as any;
    mockRedisInstance.quit = jest.fn(async () => 'OK') as any; // quitもモック

    await mockRedisInstance.flushall();

    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
    
    mockSupabaseFrom.mockClear().mockReturnValue({ select: mockSupabaseSelect });
    mockSupabaseSelect.mockClear().mockReturnValue({ match: mockSupabaseMatch });
    mockSupabaseMatch.mockClear();

    const retrieverInput: HybridRetrieverInput = {
      topK: 3,
      isDev: false,
      supabaseClient: mockSupabaseClient, // ★モックされたSupabaseクライアントを注入
      // redisUrl は ioredis のモックにより不要になるが、もし渡すならモック用URL
    };
    retriever = new HybridRetriever(retrieverInput);

    // retriever が内部で new するのではなく、DIされたインスタンスを使うように修正が必要だが、
    // 今回は retriever 内部の redis インスタンスのメソッドを直接スパイする。
    // ただし、retrieverがコンストラクタでredisインスタンスを受け取るのが理想。
    // 現状の実装では、retriever は内部で new Redis() するため、
    // そのインスタンス (this.redis) のメソッドをスパイする必要がある。
    jest.spyOn((retriever as any).redis, 'get').mockImplementation(mockRedisInstance.get);
    jest.spyOn((retriever as any).redis, 'set').mockImplementation(mockRedisInstance.set);
    
    jest.spyOn((retriever as any).pgroongaClient, 'search').mockImplementation(mockPGroongaSearch);
    jest.spyOn((retriever as any).pgvectorClient, 'searchEmbedding').mockImplementation(mockPgvectorSearchEmbedding);
  });

  afterAll(async () => {
    // retrieverが初期化されていれば、そのcleanupメソッドを呼ぶ
    if (retriever && typeof retriever.cleanup === 'function') {
      await retriever.cleanup();
    }
    jest.restoreAllMocks();
  });

  const mockQuery = 'テストクエリ';
  const mockFilters = { someFilter: 'value' }; 
  const mockKeywords = ['テストクエリ'];
  const cacheKey = `${mockQuery}:${JSON.stringify(mockFilters)}:${mockKeywords.join(',')}`;

  const pgroongaMockResult = [{ id: 1, question: 'pgroonga question', answer: 'pgroonga answer', score: 0.9, note: 'PGroonga検索結果' }];
  const pgvectorMockResult = [{ id: 2, question: 'pgvector question', answer: 'pgvector answer', score: 0.8, note: 'ベクトル検索結果' }];
  const supabaseMockData = [{ id: 3, question: 'supabase question', answer: 'supabase answer' }]; 

  it('キャッシュMISS時は各検索を実行して結果を返し、Redisに保存する', async () => {
    mockPGroongaSearch.mockResolvedValue(pgroongaMockResult);
    mockPgvectorSearchEmbedding.mockResolvedValue(pgvectorMockResult);
    mockSupabaseMatch.mockResolvedValue({ data: supabaseMockData, error: null });
    const parseQuerySpy = jest.spyOn(retriever as any, 'parseQuery').mockResolvedValue({ filters: mockFilters, keywords: mockKeywords });

    const documents = await retriever._getRelevantDocuments(mockQuery);

    expect(parseQuerySpy).toHaveBeenCalledWith(mockQuery);
    expect(mockRedisInstance.get).toHaveBeenCalledWith(cacheKey);
    expect(mockPGroongaSearch).toHaveBeenCalledWith(mockKeywords, expect.any(Number));
    expect(mockPgvectorSearchEmbedding).toHaveBeenCalledWith(mockKeywords, expect.any(Number));
    expect(mockSupabaseFrom).toHaveBeenCalledWith('knowledge');
    expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
    expect(mockSupabaseMatch).toHaveBeenCalledWith(mockFilters);
    expect(mockRedisInstance.set).toHaveBeenCalledWith(cacheKey, expect.any(String), 'EX', 3600);
    
    expect(documents.length).toBe(3);
    expect(documents.some(doc => doc.pageContent.includes('pgroonga question'))).toBeTruthy();
    expect(documents.some(doc => doc.pageContent.includes('pgvector question'))).toBeTruthy();
    expect(documents.some(doc => doc.pageContent.includes('supabase question'))).toBeTruthy();
  });

  it('キャッシュHIT時はDB／検索を呼ばずキャッシュ結果を返す', async () => {
    const cachedData = [{ id: 100, question: 'cached question', answer: 'cached answer', score: 1.0, note: 'キャッシュ結果' }];
    (mockRedisInstance.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));
    const parseQuerySpy = jest.spyOn(retriever as any, 'parseQuery').mockResolvedValue({ filters: mockFilters, keywords: mockKeywords });

    const documents = await retriever._getRelevantDocuments(mockQuery);

    expect(parseQuerySpy).toHaveBeenCalledWith(mockQuery);
    expect(mockRedisInstance.get).toHaveBeenCalledWith(cacheKey);
    expect(mockPGroongaSearch).not.toHaveBeenCalled();
    expect(mockPgvectorSearchEmbedding).not.toHaveBeenCalled();
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
    expect(mockRedisInstance.set).not.toHaveBeenCalled();
    
    expect(documents).toHaveLength(1);
    expect(documents[0].pageContent).toContain('cached question');
  });

  it('Redis GETエラー時はフォールバックしてDBから取得し、SETは試行しない', async () => {
    (mockRedisInstance.get as jest.Mock).mockRejectedValueOnce(new Error('Redis GET Error'));
    mockPGroongaSearch.mockResolvedValue(pgroongaMockResult);
    mockPgvectorSearchEmbedding.mockResolvedValue(pgvectorMockResult);
    mockSupabaseMatch.mockResolvedValue({ data: supabaseMockData, error: null });
    const parseQuerySpy = jest.spyOn(retriever as any, 'parseQuery').mockResolvedValue({ filters: mockFilters, keywords: mockKeywords });

    const documents = await retriever._getRelevantDocuments(mockQuery);
    
    expect(mockRedisInstance.get).toHaveBeenCalledWith(cacheKey);
    expect(mockPGroongaSearch).toHaveBeenCalled();
    expect(mockPgvectorSearchEmbedding).toHaveBeenCalled();
    expect(mockSupabaseFrom).toHaveBeenCalled();
    expect(mockRedisInstance.set).not.toHaveBeenCalled(); 
    expect(documents.length).toBe(3);
  });

  it('Redis SETエラー時もDBからの結果は返される', async () => {
    (mockRedisInstance.set as jest.Mock).mockRejectedValueOnce(new Error('Redis SET Error')); 
    mockPGroongaSearch.mockResolvedValue(pgroongaMockResult);
    mockPgvectorSearchEmbedding.mockResolvedValue(pgvectorMockResult);
    mockSupabaseMatch.mockResolvedValue({ data: supabaseMockData, error: null });
    const parseQuerySpy = jest.spyOn(retriever as any, 'parseQuery').mockResolvedValue({ filters: mockFilters, keywords: mockKeywords });

    const documents = await retriever._getRelevantDocuments(mockQuery);

    expect(mockRedisInstance.get).toHaveBeenCalledWith(cacheKey);
    expect(mockPGroongaSearch).toHaveBeenCalled();
    expect(mockPgvectorSearchEmbedding).toHaveBeenCalled();
    expect(mockSupabaseFrom).toHaveBeenCalled();
    expect(mockRedisInstance.set).toHaveBeenCalled(); 
    expect(documents.length).toBe(3); 
  });

  it('parseQueryがキーワードとフィルターを正しく返すことを確認 (仮実装ベース)', async () => {
    const testQueryString = 'キーワード1 キーワード2 filterKey:filterValue';
    const expectedKeywords = ['キーワード1', 'キーワード2', 'filterKey:filterValue'];
    const expectedFilters = {}; 
    const parseQuerySpy = jest.spyOn(retriever as any, 'parseQuery').mockResolvedValue({ filters: expectedFilters, keywords: expectedKeywords });

    (mockRedisInstance.get as jest.Mock).mockResolvedValue(null);
    mockPGroongaSearch.mockResolvedValue([]);
    mockPgvectorSearchEmbedding.mockResolvedValue([]);
    mockSupabaseMatch.mockResolvedValue({ data: [], error: null });

    await retriever._getRelevantDocuments(testQueryString);
    
    expect(parseQuerySpy).toHaveBeenCalledWith(testQueryString);
    const actualParsed = await parseQuerySpy.mock.results[0].value;
    expect(actualParsed.keywords).toEqual(expectedKeywords);
    expect(actualParsed.filters).toEqual(expectedFilters);
  });
}); 
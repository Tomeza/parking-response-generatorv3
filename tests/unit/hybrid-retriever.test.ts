/**
 * HybridRetriever Unit Tests
 * CI-friendly tests with mocked dependencies
 */

import { HybridRetriever } from '../../src/lib/hybrid-retriever';

// Mock dependencies
jest.mock('../../src/lib/embeddings', () => ({
  generateEmbedding: jest.fn()
}));

jest.mock('../../src/lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    knowledge: {
      findMany: jest.fn()
    }
  }
}));

import { generateEmbedding } from '../../src/lib/embeddings';
import { prisma } from '../../src/lib/db';

// Properly type the mocked prisma
const mockPrisma = prisma as jest.Mocked<{
  $queryRaw: jest.MockedFunction<any>;
  $executeRawUnsafe: jest.MockedFunction<any>;
  knowledge: {
    findMany: jest.MockedFunction<any>;
  };
}>;

const mockGenerateEmbedding = generateEmbedding as jest.MockedFunction<typeof generateEmbedding>;

describe('HybridRetriever', () => {
  let retriever: HybridRetriever;

  beforeEach(() => {
    // Completely reset all mocks
    jest.resetAllMocks();
    
    // Set default mock implementations
    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
    
    retriever = new HybridRetriever({
      topK: 5,
      efSearchValue: 30,
      isDev: false
    });
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      const defaultRetriever = new HybridRetriever();
      expect(defaultRetriever).toBeInstanceOf(HybridRetriever);
    });

    it('should initialize with custom values', () => {
      const customRetriever = new HybridRetriever({
        topK: 10,
        efSearchValue: 50,
        isDev: true
      });
      expect(customRetriever).toBeInstanceOf(HybridRetriever);
    });
  });

  describe('_getRelevantDocuments', () => {
    it('should retrieve and fuse results successfully', async () => {
      const mockPGroongaResults = [
        {
          id: 1,
          main_category: 'test',
          sub_category: null,
          detail_category: null,
          question: 'Test question 1',
          answer: 'Test answer 1',
          is_template: false,
          usage: null,
          note: null,
          issue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          score: 0.9
        }
      ];

      const mockVectorResults = [
        {
          id: 2,
          main_category: 'test',
          sub_category: null,
          detail_category: null,
          question: 'Test question 2',
          answer: 'Test answer 2',
          is_template: false,
          usage: null,
          note: null,
          issue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          similarity: 0.85
        }
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockPGroongaResults)
        .mockResolvedValueOnce(mockVectorResults);

      const query = 'test query';
      const documents = await retriever._getRelevantDocuments(query);

      expect(documents.length).toBeGreaterThan(0);
      expect(documents[0].pageContent).toContain('質問:');
      expect(documents[0].pageContent).toContain('回答:');
      expect(documents[0].metadata.id).toBeDefined();
    });

    it('should handle empty results gracefully', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // Empty PGroonga results
        .mockResolvedValueOnce([]); // Empty vector results

      const query = 'test query';
      const documents = await retriever._getRelevantDocuments(query);

      expect(documents).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
      mockPrisma.knowledge.findMany.mockRejectedValue(new Error('Fallback error'));

      const query = 'test query';
      const documents = await retriever._getRelevantDocuments(query);

      expect(documents).toHaveLength(0);
    });

    it('should handle embedding generation failure', async () => {
      mockGenerateEmbedding.mockResolvedValue(null);
      
      const mockPGroongaResults = [
        {
          id: 1,
          main_category: 'test',
          sub_category: null,
          detail_category: null,
          question: 'Test question',
          answer: 'Test answer',
          is_template: false,
          usage: null,
          note: null,
          issue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          score: 0.9
        }
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockPGroongaResults)
        .mockResolvedValueOnce([]); // Empty vector results due to embedding failure

      const query = 'test query';
      const documents = await retriever._getRelevantDocuments(query);

      expect(documents.length).toBeGreaterThan(0); // Should still have PGroonga results
    });
  });

  describe('Document Formatting', () => {
    it('should format page content correctly', async () => {
      const mockResult = {
        id: 1,
        main_category: 'Main',
        sub_category: 'Sub',
        detail_category: 'Detail',
        question: 'Test question?',
        answer: 'Test answer.',
        is_template: false,
        usage: null,
        note: null,
        issue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        score: 0.9
      };

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([mockResult])
        .mockResolvedValueOnce([]);

      const query = 'test query';
      const documents = await retriever._getRelevantDocuments(query);

      expect(documents).toHaveLength(1);
      expect(documents[0].pageContent).toContain('質問: Test question?');
      expect(documents[0].pageContent).toContain('回答: Test answer.');
      expect(documents[0].pageContent).toContain('カテゴリ: Main > Sub > Detail');
    });

    it('should handle missing categories gracefully', async () => {
      const mockResult = {
        id: 1,
        main_category: null,
        sub_category: null,
        detail_category: null,
        question: 'Test question?',
        answer: 'Test answer.',
        is_template: false,
        usage: null,
        note: null,
        issue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        score: 0.9
      };

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([mockResult])
        .mockResolvedValueOnce([]);

      const query = 'test query';
      const documents = await retriever._getRelevantDocuments(query);

      expect(documents).toHaveLength(1);
      expect(documents[0].pageContent).not.toContain('カテゴリ:');
    });
  });

  describe('Error Handling', () => {
    it('should handle various error scenarios', async () => {
      // Test that the system doesn't crash on errors
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Test error'));
      mockGenerateEmbedding.mockRejectedValue(new Error('Embedding error'));

      const query = 'test query';
      
      // Should not throw an error
      await expect(retriever._getRelevantDocuments(query)).resolves.toBeDefined();
    });
  });
}); 
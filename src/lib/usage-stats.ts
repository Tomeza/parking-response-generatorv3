import { createHash } from 'crypto';
import { prisma } from './prisma';

export interface FaqUsageData {
  faqId: number;
  queryText: string;
  success: boolean;
  route: 'hybrid_csv' | 'hybrid_json';
  latencyMs: number;
  userId?: string;
  sessionId?: string;
}

/**
 * Normalizes a query text by removing extra spaces and converting to lowercase
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Generates a hash for the normalized query text
 */
function generateQueryHash(queryText: string): string {
  const normalized = normalizeQuery(queryText);
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Records a FAQ usage event in the database
 */
export async function recordFaqUsage(data: FaqUsageData) {
  const queryHash = generateQueryHash(data.queryText);
  
  try {
    await prisma.faqUsageStats.create({
      data: {
        faq_id: data.faqId,
        query_hash: queryHash,
        query_text: data.queryText,
        success: data.success,
        route: data.route,
        latency_ms: data.latencyMs,
        user_id: data.userId,
        session_id: data.sessionId,
      }
    });
  } catch (error) {
    console.error('Failed to record FAQ usage:', error);
    // Don't throw - we don't want usage tracking to break the main flow
  }
}

export interface RouteStats {
  route: string;
  count: number;
  successRate: number;
}

export interface OverallUsageStats {
  totalQueries: number;
  overallSuccessRate: number;
  p95LatencyMs: number;
  routeStats: RouteStats[];
}

export async function getOverallUsageStats(): Promise<OverallUsageStats> {
  const [
    totalQueries,
    successRate,
    routeStats,
    p95Latency
  ] = await Promise.all([
    // Total number of queries
    prisma.faqUsageStats.count(),

    // Overall success rate
    prisma.faqUsageStats.aggregate({
      _avg: {
        latencyMs: true
      }
    }),

    // Usage by route
    prisma.faqUsageStats.groupBy({
      by: ['route'],
      _count: true,
      _avg: {
        latencyMs: true
      }
    }),

    // P95 latency
    prisma.faqUsageStats.aggregate({
      _max: {
        latencyMs: true
      },
      where: {
        latencyMs: {
          lte: {
            // Subquery to get P95 latency threshold
            all: prisma.faqUsageStats.aggregate({
              _max: {
                latencyMs: true
              },
              orderBy: {
                latencyMs: 'desc'
              },
              take: Math.floor(await prisma.faqUsageStats.count() * 0.95)
            }).latencyMs
          }
        }
      }
    })
  ]);

  return {
    totalQueries,
    overallSuccessRate: successRate._avg.latencyMs ? successRate._avg.latencyMs * 100 : 0,
    routeStats: routeStats.map(stat => ({
      route: stat.route,
      count: stat._count,
      successRate: stat._avg.latencyMs ? stat._avg.latencyMs * 100 : 0
    })),
    p95LatencyMs: p95Latency._max.latencyMs || 0
  };
}

export async function getFaqUsageStats(faqId: number) {
  const [
    totalUsage,
    successCount,
    recentUsage,
    avgLatency
  ] = await Promise.all([
    // Total usage count
    prisma.faqUsageStats.count({
      where: { faqId }
    }),

    // Successful usage count
    prisma.faqUsageStats.count({
      where: { 
        faqId,
        success: true
      }
    }),

    // Recent usage (last 30 days)
    prisma.faqUsageStats.count({
      where: {
        faqId,
        usedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),

    // Average latency
    prisma.faqUsageStats.aggregate({
      where: { faqId },
      _avg: {
        latencyMs: true
      }
    })
  ]);

  return {
    totalUsage,
    successCount,
    successRate: totalUsage > 0 ? (successCount / totalUsage) * 100 : 0,
    recentUsage,
    avgLatencyMs: avgLatency._avg.latencyMs || 0
  };
} 
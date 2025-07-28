import { format } from 'date-fns';
import { writeFile } from 'fs/promises';
import path from 'path';
import { getOverallUsageStats } from '../src/lib/usage-stats';

interface RouteComparison {
  route: string;
  queries: number;
  successRate: number;
}

interface UsageReport {
  date: string;
  totalQueries: number;
  successRate: number;
  p95LatencyMs: number;
  routeComparison: RouteComparison[];
  recommendations: {
    type: 'success_rate' | 'latency' | 'category_balance' | 'review_required';
    severity: 'info' | 'warning' | 'error';
    message: string;
  }[];
}

async function generateUsageReport(): Promise<void> {
  try {
    const stats = await getOverallUsageStats();
    
    const report: UsageReport = {
      date: format(new Date(), 'yyyy-MM-dd'),
      totalQueries: stats.totalQueries,
      successRate: stats.overallSuccessRate,
      p95LatencyMs: stats.p95LatencyMs,
      routeComparison: stats.routeStats.map(stat => ({
        route: stat.route,
        queries: stat.count,
        successRate: stat.successRate
      })),
      recommendations: []
    };

    // 成功率のチェック
    if (stats.overallSuccessRate < 90) {
      report.recommendations.push({
        type: 'success_rate',
        severity: 'error',
        message: `成功率が90%を下回っています (${stats.overallSuccessRate.toFixed(1)}%)。FAQ内容の見直しを検討してください。`
      });
    } else if (stats.overallSuccessRate < 95) {
      report.recommendations.push({
        type: 'success_rate',
        severity: 'warning',
        message: `成功率が95%を下回っています (${stats.overallSuccessRate.toFixed(1)}%)。改善の余地があります。`
      });
    }

    // レイテンシのチェック
    if (stats.p95LatencyMs > 2000) {
      report.recommendations.push({
        type: 'latency',
        severity: 'error',
        message: `P95レイテンシが2秒を超えています (${stats.p95LatencyMs}ms)。パフォーマンスの改善が必要です。`
      });
    } else if (stats.p95LatencyMs > 1500) {
      report.recommendations.push({
        type: 'latency',
        severity: 'warning',
        message: `P95レイテンシが1.5秒を超えています (${stats.p95LatencyMs}ms)。パフォーマンスの改善を検討してください。`
      });
    }

    // ルート間の成功率の差異チェック
    const successRates = report.routeComparison.map(route => route.successRate);
    const maxDiff = Math.max(...successRates) - Math.min(...successRates);
    if (maxDiff > 10) {
      report.recommendations.push({
        type: 'category_balance',
        severity: 'warning',
        message: `ルート間の成功率に10%以上の差があります。各ルートの精度を確認してください。`
      });
    }

    // レポートの保存
    const reportDir = path.join(process.cwd(), 'test-results');
    const reportPath = path.join(reportDir, `usage-report-${report.date}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    // CIでの判定
    const hasError = report.recommendations.some(rec => rec.severity === 'error');
    if (hasError) {
      console.error('Usage statistics check failed:');
      report.recommendations
        .filter(rec => rec.severity === 'error')
        .forEach(rec => console.error(`- ${rec.message}`));
      process.exit(1);
    }

    const hasWarning = report.recommendations.some(rec => rec.severity === 'warning');
    if (hasWarning) {
      console.warn('Usage statistics check has warnings:');
      report.recommendations
        .filter(rec => rec.severity === 'warning')
        .forEach(rec => console.warn(`- ${rec.message}`));
    }

    console.log('Usage statistics check completed successfully');
    console.log(`Report saved to: ${reportPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to generate usage report:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  generateUsageReport().catch(console.error);
} 
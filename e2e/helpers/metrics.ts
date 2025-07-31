import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';

interface PerformanceMetrics {
  initialLoadTime: number;
  avgResponseTime: number;
  memoryUsage: number;
  timestamp: string;
}

export async function collectMetrics(page: Page): Promise<PerformanceMetrics> {
  // ページロード時間の計測
  const navigationTiming = await page.evaluate(() => {
    const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      loadTime: timing.loadEventEnd - timing.navigationStart,
    };
  });

  // APIレスポンス時間の計測
  const apiTimings = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource')
      .filter(entry => entry.name.includes('/api/'));
    const total = resources.reduce((sum, entry) => sum + entry.duration, 0);
    return {
      avgResponseTime: resources.length ? total / resources.length : 0
    };
  });

  // メモリ使用量の計測
  const memoryInfo = await page.evaluate(() => ({
    jsHeapSize: performance.memory?.usedJSHeapSize || 0
  }));

  const metrics: PerformanceMetrics = {
    initialLoadTime: navigationTiming.loadTime,
    avgResponseTime: apiTimings.avgResponseTime,
    memoryUsage: memoryInfo.jsHeapSize,
    timestamp: new Date().toISOString()
  };

  // 結果をJSONファイルに保存
  const reportDir = path.join(process.cwd(), 'playwright-report');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(reportDir, 'metrics.json'),
    JSON.stringify(metrics, null, 2)
  );

  return metrics;
}

export function formatMetricsReport(metrics: PerformanceMetrics): string {
  return `
Performance Test Results (${metrics.timestamp})
=============================================

Initial Page Load Time: ${metrics.initialLoadTime.toFixed(2)}ms
Average API Response Time: ${metrics.avgResponseTime.toFixed(2)}ms
Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB

Thresholds
----------
- Page Load: ${metrics.initialLoadTime < 3000 ? '✅' : '❌'} (Target: <3000ms)
- API Response: ${metrics.avgResponseTime < 1000 ? '✅' : '❌'} (Target: <1000ms)
- Memory: ${metrics.memoryUsage < 50 * 1024 * 1024 ? '✅' : '❌'} (Target: <50MB)
  `.trim();
}

export async function reportMetricsToGitHub(metrics: PerformanceMetrics): Promise<void> {
  if (process.env.GITHUB_STEP_SUMMARY) {
    const report = formatMetricsReport(metrics);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }
} 
import { Suspense } from 'react';
import UsageStats from '../components/UsageStats';
import { getOverallUsageStats, getFaqUsageStats } from '@/lib/usage-stats';

export default async function UsagePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">FAQ Usage Statistics</h1>
      
      <div className="bg-white rounded-lg shadow">
        <Suspense fallback={<div>Loading statistics...</div>}>
          <UsageStats />
        </Suspense>
      </div>
    </div>
  );
} 
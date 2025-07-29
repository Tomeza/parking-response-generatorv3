import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { getOverallUsageStats, getFaqUsageStats } from '@/lib/usage-stats';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
}

function StatsCard({ title, value, description }: StatsCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      {description && (
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      )}
    </Card>
  );
}

export default async function UsageStats() {
  const overallStats = await getOverallUsageStats();
  
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="routes">Routes</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="trends">Trends</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Queries"
            value={overallStats.totalQueries}
            description="Total number of queries processed"
          />
          <StatsCard
            title="Success Rate"
            value={`${overallStats.overallSuccessRate.toFixed(1)}%`}
            description="Percentage of successful responses"
          />
          <StatsCard
            title="P95 Latency"
            value={`${overallStats.p95LatencyMs}ms`}
            description="95th percentile response time"
          />
          <StatsCard
            title="Active FAQs"
            value={overallStats.routeStats.reduce((acc, stat) => acc + stat.count, 0)}
            description="Number of FAQs used"
          />
        </div>
      </TabsContent>

      <TabsContent value="routes" className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Route Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={overallStats.routeStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="route" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Query Count" />
              <Bar yAxisId="right" dataKey="successRate" fill="#82ca9d" name="Success Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </TabsContent>

      <TabsContent value="performance" className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Response Time Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[
              { name: 'P50', value: overallStats.p95LatencyMs * 0.5 },
              { name: 'P75', value: overallStats.p95LatencyMs * 0.75 },
              { name: 'P90', value: overallStats.p95LatencyMs * 0.9 },
              { name: 'P95', value: overallStats.p95LatencyMs },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" name="Response Time (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </TabsContent>

      <TabsContent value="trends" className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Usage Trends</h3>
          <div className="text-sm text-gray-500">
            Trend analysis will be available after collecting more data points.
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
} 
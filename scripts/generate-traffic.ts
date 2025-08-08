#!/usr/bin/env tsx

import { config } from 'dotenv';

config();

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface TrafficConfig {
  shadowPercentage: number;
  canaryPercentage: number;
  requestsPerSecond: number;
  durationMinutes: number;
  burstMode: boolean;
}

interface TestQuery {
  query: string;
  category: string;
  intent: string;
  tone: string;
}

const EXTENDED_TEST_QUERIES: TestQuery[] = [
  // 基本問い合わせ
  { query: "駐車場の住所を教えてください", category: "access", intent: "inquiry", tone: "normal" },
  { query: "営業時間は何時から何時までですか", category: "access", intent: "inquiry", tone: "normal" },
  { query: "料金はいくらですか", category: "payment", intent: "inquiry", tone: "normal" },
  { query: "支払い方法を教えてください", category: "payment", intent: "inquiry", tone: "normal" },
  
  // 予約関連
  { query: "予約をしたい", category: "reservation", intent: "inquiry", tone: "normal" },
  { query: "予約をキャンセルしたい", category: "reservation", intent: "cancel", tone: "normal" },
  { query: "予約を変更したい", category: "reservation", intent: "modify", tone: "normal" },
  { query: "予約状況を確認したい", category: "reservation", intent: "check", tone: "normal" },
  
  // 送迎サービス
  { query: "送迎サービスの時間を教えてください", category: "shuttle", intent: "inquiry", tone: "normal" },
  { query: "送迎バスは何時発ですか", category: "shuttle", intent: "inquiry", tone: "normal" },
  { query: "送迎サービスは予約が必要ですか", category: "shuttle", intent: "inquiry", tone: "normal" },
  
  // トラブル・緊急
  { query: "車の故障で出られません", category: "trouble", intent: "report", tone: "urgent" },
  { query: "事故が起きました", category: "trouble", intent: "report", tone: "urgent" },
  { query: "車が動きません", category: "trouble", intent: "report", tone: "urgent" },
  { query: "鍵をなくしました", category: "trouble", intent: "report", tone: "normal" },
  
  // フォールバック想定
  { query: "返金して", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "事故", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "警察", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "個人情報", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "国際線", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "キャンセルと変更", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "定員オーバー", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "満車含む期間", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "カード使える？", category: "unknown", intent: "unknown", tone: "normal" },
  { query: "道に迷った", category: "unknown", intent: "unknown", tone: "normal" },
  
  // 境界ケース
  { query: "設備と支払いについて", category: "access", intent: "inquiry", tone: "normal" },
  { query: "車両と料金の関係", category: "payment", intent: "inquiry", tone: "normal" },
  { query: "深夜5時の営業", category: "access", intent: "inquiry", tone: "normal" },
  { query: "24時30分の利用", category: "access", intent: "inquiry", tone: "normal" },
  { query: "満車の期間内1日", category: "reservation", intent: "inquiry", tone: "normal" }
];

async function makeRequest(query: string, headers: Record<string, string> = {}) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/query?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}`,
        processingTime
      };
    }

    const data = await response.json();
    return {
      success: true,
      status: response.status,
      data,
      processingTime,
      isShadow: headers['X-Route-Shadow'] === 'true',
      isCanary: headers['X-Route-Canary'] === 'true'
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      processingTime: endTime - startTime
    };
  }
}

function getRandomQuery(): TestQuery {
  return EXTENDED_TEST_QUERIES[Math.floor(Math.random() * EXTENDED_TEST_QUERIES.length)];
}

function shouldUseShadow(config: TrafficConfig): boolean {
  return Math.random() * 100 < config.shadowPercentage;
}

function shouldUseCanary(config: TrafficConfig): boolean {
  return Math.random() * 100 < config.canaryPercentage;
}

async function generateTraffic(config: TrafficConfig) {
  console.log('🚀 疑似トラフィック生成開始');
  console.log(`📊 設定: Shadow ${config.shadowPercentage}%, Canary ${config.canaryPercentage}%`);
  console.log(`⚡ レート: ${config.requestsPerSecond} req/s, 期間: ${config.durationMinutes}分`);
  console.log(`💥 バーストモード: ${config.burstMode ? 'ON' : 'OFF'}\n`);

  const startTime = Date.now();
  const endTime = startTime + (config.durationMinutes * 60 * 1000);
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let shadowRequests = 0;
  let canaryRequests = 0;
  let fallbackRequests = 0;
  const processingTimes: number[] = [];
  const errors: string[] = [];

  const interval = config.burstMode ? 0 : 1000 / config.requestsPerSecond;

  while (Date.now() < endTime) {
    const query = getRandomQuery();
    let headers: Record<string, string> = {};

    // Shadow/Canary判定
    if (shouldUseShadow(config)) {
      headers['X-Route-Shadow'] = 'true';
      shadowRequests++;
    } else if (shouldUseCanary(config)) {
      headers['X-Route-Canary'] = 'true';
      canaryRequests++;
    }

    const result = await makeRequest(query.query, headers);
    totalRequests++;
    processingTimes.push(result.processingTime);

    if (result.success) {
      successfulRequests++;
      if (result.data?.is_fallback) {
        fallbackRequests++;
      }
    } else {
      errors.push(result.error || 'Unknown error');
    }

    // 進捗表示
    if (totalRequests % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = totalRequests / elapsed;
      const successRate = (successfulRequests / totalRequests * 100).toFixed(1);
      const fallbackRate = (fallbackRequests / totalRequests * 100).toFixed(1);
      
      console.log(`📈 進捗: ${totalRequests}件 (${rate.toFixed(1)} req/s) - 成功率: ${successRate}%, Fallback: ${fallbackRate}%`);
    }

    // バーストモードでない場合は間隔を空ける
    if (!config.burstMode && interval > 0) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  // 結果サマリー
  const totalTime = (Date.now() - startTime) / 1000;
  const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
  const p95ProcessingTime = processingTimes.sort((a, b) => a - b)[Math.floor(processingTimes.length * 0.95)];

  console.log('\n🎉 トラフィック生成完了！');
  console.log('='.repeat(50));
  console.log(`📊 総リクエスト: ${totalRequests}`);
  console.log(`✅ 成功: ${successfulRequests} (${(successfulRequests / totalRequests * 100).toFixed(1)}%)`);
  console.log(`👻 Shadow: ${shadowRequests} (${(shadowRequests / totalRequests * 100).toFixed(1)}%)`);
  console.log(`🟡 Canary: ${canaryRequests} (${(canaryRequests / totalRequests * 100).toFixed(1)}%)`);
  console.log(`🔄 Fallback: ${fallbackRequests} (${(fallbackRequests / totalRequests * 100).toFixed(1)}%)`);
  console.log(`⏱️  平均処理時間: ${avgProcessingTime.toFixed(1)}ms`);
  console.log(`📈 P95処理時間: ${p95ProcessingTime.toFixed(1)}ms`);
  console.log(`🚨 エラー: ${errors.length}件`);
  
  if (errors.length > 0) {
    console.log('\n❌ エラー詳細:');
    errors.slice(0, 5).forEach(error => console.log(`   - ${error}`));
    if (errors.length > 5) {
      console.log(`   ... 他 ${errors.length - 5}件`);
    }
  }

  // アラート判定
  const fallbackRate = fallbackRequests / totalRequests * 100;
  const errorRate = errors.length / totalRequests * 100;
  
  if (fallbackRate > 2) {
    console.log('\n🚨 アラート: Fallback率が2%を超えています！');
  }
  if (p95ProcessingTime > 600) {
    console.log('\n🚨 アラート: P95処理時間が600msを超えています！');
  }
  if (errorRate > 0.5) {
    console.log('\n🚨 アラート: エラー率が0.5%を超えています！');
  }

  return {
    totalRequests,
    successfulRequests,
    shadowRequests,
    canaryRequests,
    fallbackRequests,
    avgProcessingTime,
    p95ProcessingTime,
    errors: errors.length
  };
}

// 段階投入シナリオ
async function runStagedDeployment() {
  console.log('🎯 段階投入シナリオ開始\n');

  const stages = [
    { name: 'Shadow-1', shadow: 5, canary: 0, duration: 2, rps: 2 },
    { name: 'Shadow-2', shadow: 20, canary: 0, duration: 2, rps: 5 },
    { name: 'Canary-1', shadow: 0, canary: 1, duration: 2, rps: 3 },
    { name: 'Canary-2', shadow: 0, canary: 5, duration: 2, rps: 5 }
  ];

  for (const stage of stages) {
    console.log(`\n🔄 ${stage.name} 開始 (${stage.duration}分間)`);
    
    const result = await generateTraffic({
      shadowPercentage: stage.shadow,
      canaryPercentage: stage.canary,
      requestsPerSecond: stage.rps,
      durationMinutes: stage.duration,
      burstMode: false
    });

    // ゲート判定
    const fallbackRate = result.fallbackRequests / result.totalRequests * 100;
    const isHealthy = fallbackRate <= 1 && result.p95ProcessingTime <= 400 && result.errors === 0;

    console.log(`\n${isHealthy ? '✅' : '❌'} ${stage.name} 結果: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    if (!isHealthy) {
      console.log('🛑 段階投入を停止します');
      break;
    }

    console.log('⏳ 次の段階に進みます...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機
  }
}

// メイン実行
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--staged')) {
    await runStagedDeployment();
  } else if (args.includes('--burst')) {
    await generateTraffic({
      shadowPercentage: 20,
      canaryPercentage: 0,
      requestsPerSecond: 10,
      durationMinutes: 1,
      burstMode: true
    });
  } else {
    // デフォルト: Shadow 5% で2分間
    await generateTraffic({
      shadowPercentage: 5,
      canaryPercentage: 0,
      requestsPerSecond: 3,
      durationMinutes: 2,
      burstMode: false
    });
  }
}

// ES module 対応
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 
#!/usr/bin/env node

/**
 * Supabase MCPサーバーのテストスクリプト
 * 基本的な接続とツール実行をテストします
 */

// 環境変数ファイルを読み込み
require('dotenv').config({ path: '.env.local' });

const { spawn } = require('child_process');
const path = require('path');

async function testMCPServer() {
  console.log('🚀 Supabase MCPサーバーのテストを開始します...');

  // 環境変数の確認（Service Role Keyを使用）
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 必要な環境変数が設定されていません:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.log('\n📝 .env.localファイルに以下の設定を追加してください:');
    console.log('SUPABASE_URL=your_supabase_url_here');
    console.log('SUPABASE_ANON_KEY=your_supabase_anon_key_here');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
    console.log('\n🔗 Service Role Keyの取得方法:');
    console.log('1. Supabaseダッシュボード → Project Settings → API');
    console.log('2. service_role key をコピー');
    console.log('\n⚠️  注意: Service Role Keyは強力な権限を持ちます。安全に管理してください。');
    process.exit(1);
  }

  console.log('✅ 環境変数が正しく設定されています');
  console.log(`📍 SUPABASE_URL: ${process.env.SUPABASE_URL}`);
  console.log(`🔑 SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...`);
  console.log(`🛡️  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);

  try {
    // MCPサーバーを起動（Service Role KeyをACCESS_TOKENとして使用）
    console.log('📡 MCPサーバーを起動中...');
    
    const mcpServer = spawn('npx', [
      '@supabase/mcp-server-supabase',
      '--read-only'
    ], {
      env: {
        ...process.env,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        // MCPサーバーはSUPABASE_ACCESS_TOKENを期待するので、Service Role Keyを設定
        SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // サーバーの出力を監視
    mcpServer.stdout.on('data', (data) => {
      console.log('📤 MCPサーバー出力:', data.toString());
    });

    mcpServer.stderr.on('data', (data) => {
      console.error('❌ MCPサーバーエラー:', data.toString());
    });

    mcpServer.on('close', (code) => {
      console.log(`🔚 MCPサーバーが終了しました (コード: ${code})`);
    });

    // 基本的なテストメッセージを送信
    const testMessage = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    };

    console.log('📨 テストメッセージを送信:', JSON.stringify(testMessage));
    mcpServer.stdin.write(JSON.stringify(testMessage) + '\n');

    // 5秒後にサーバーを終了
    setTimeout(() => {
      console.log('⏰ テスト完了。サーバーを終了します...');
      mcpServer.kill();
    }, 5000);

  } catch (error) {
    console.error('❌ MCPサーバーテストでエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
  testMCPServer();
}

module.exports = { testMCPServer }; 
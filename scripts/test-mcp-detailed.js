#!/usr/bin/env node

/**
 * Supabase MCPサーバーの詳細テストスクリプト
 * 複数のツールをテストし、実際のSQL実行も確認します
 */

// 環境変数ファイルを読み込み
require('dotenv').config({ path: '.env.local' });

const { spawn } = require('child_process');

async function testMCPServerDetailed() {
  console.log('🚀 Supabase MCPサーバーの詳細テストを開始します...');

  // 環境変数の確認
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 必要な環境変数が設定されていません:', missingVars);
    process.exit(1);
  }

  console.log('✅ 環境変数が正しく設定されています');

  try {
    // MCPサーバーを起動
    console.log('📡 MCPサーバーを起動中...');
    
    const mcpServer = spawn('npm', [
      'run',
      'mcp:start',
      '--', // This tells npm to pass subsequent arguments to the script
      '--access-token',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ], {
      env: {
        ...process.env,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let messageId = 0;
    const responses = [];

    // サーバーの出力を監視
    mcpServer.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          responses.push(response);
          console.log('📤 MCPサーバー応答:', JSON.stringify(response, null, 2));
        } catch (error) {
          console.log('📤 MCPサーバー出力:', line);
        }
      }
    });

    mcpServer.stderr.on('data', (data) => {
      console.error('❌ MCPサーバーエラー:', data.toString());
    });

    // 初期化待機
    await new Promise(resolve => setTimeout(resolve, 2000));

    // テスト1: ツールリストの取得
    console.log('\n🔧 テスト1: 利用可能なツールのリストを取得');
    const toolsListMessage = {
      jsonrpc: "2.0",
      id: ++messageId,
      method: "tools/list",
      params: {}
    };
    
    mcpServer.stdin.write(JSON.stringify(toolsListMessage) + '\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // テスト2: テーブル一覧の取得
    console.log('\n📋 テスト2: テーブル一覧を取得');
    const listTablesMessage = {
      jsonrpc: "2.0",
      id: ++messageId,
      method: "tools/call",
      params: {
        name: "list_tables",
        arguments: {}
      }
    };
    
    mcpServer.stdin.write(JSON.stringify(listTablesMessage) + '\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // テスト3: 簡単なSQLクエリの実行
    console.log('\n🗃️  テスト3: 簡単なSQLクエリを実行');
    const sqlQueryMessage = {
      jsonrpc: "2.0",
      id: ++messageId,
      method: "tools/call",
      params: {
        name: "execute_sql",
        arguments: {
          query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5;"
        }
      }
    };
    
    mcpServer.stdin.write(JSON.stringify(sqlQueryMessage) + '\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 結果の確認
    console.log('\n📊 テスト結果の確認:');
    console.log(`受信した応答数: ${responses.length}`);
    
    if (responses.length > 0) {
      console.log('✅ MCPサーバーとの通信が成功しました！');
      
      // ツールリストの確認
      const toolsResponse = responses.find(r => r.result && r.result.tools);
      if (toolsResponse) {
        console.log('\n🔧 利用可能なツール:');
        toolsResponse.result.tools.forEach(tool => {
          console.log(`  - ${tool.name}: ${tool.description}`);
        });
      }
    } else {
      console.log('⚠️  応答が受信されませんでした。');
    }

    // サーバーを終了
    console.log('\n⏰ テスト完了。サーバーを終了します...');
    mcpServer.kill();

  } catch (error) {
    console.error('❌ MCPサーバーテストでエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
  testMCPServerDetailed();
}

module.exports = { testMCPServerDetailed }; 
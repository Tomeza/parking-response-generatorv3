/**
 * Supabase MCP Client
 * LangChainとSupabase MCPサーバーを統合するためのクライアント
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPMessage {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export class SupabaseMCPClient extends EventEmitter {
  private mcpProcess: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();

  constructor(
    private supabaseUrl: string,
    private supabaseAnonKey: string,
    private supabaseServiceRoleKey: string,
    private readOnly: boolean = true
  ) {
    super();
  }

  /**
   * MCPサーバーを起動
   */
  async start(): Promise<void> {
    if (this.mcpProcess) {
      throw new Error('MCPサーバーは既に起動しています');
    }

    console.log('🚀 Supabase MCPサーバーを起動中...');

    const args = ['@supabase/mcp-server-supabase'];
    if (this.readOnly) {
      args.push('--read-only');
    }

    this.mcpProcess = spawn('npx', args, {
      env: {
        ...process.env,
        SUPABASE_URL: this.supabaseUrl,
        SUPABASE_ANON_KEY: this.supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: this.supabaseServiceRoleKey
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 出力の処理
    this.mcpProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        try {
          const response: MCPResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          console.log('📤 MCPサーバー出力:', line);
        }
      }
    });

    this.mcpProcess.stderr?.on('data', (data) => {
      console.error('❌ MCPサーバーエラー:', data.toString());
    });

    this.mcpProcess.on('close', (code) => {
      console.log(`🔚 MCPサーバーが終了しました (コード: ${code})`);
      this.mcpProcess = null;
      this.emit('close', code);
    });

    this.mcpProcess.on('error', (error) => {
      console.error('❌ MCPサーバープロセスエラー:', error);
      this.emit('error', error);
    });

    // 初期化完了まで少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * MCPサーバーを停止
   */
  async stop(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
  }

  /**
   * 利用可能なツールのリストを取得
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest('tools/list', {});
    return response.tools || [];
  }

  /**
   * SQLクエリを実行
   */
  async executeSQL(query: string): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name: 'execute_sql',
      arguments: {
        query: query
      }
    });
    return response.content;
  }

  /**
   * テーブル一覧を取得
   */
  async listTables(): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name: 'list_tables',
      arguments: {}
    });
    return response.content;
  }

  /**
   * MCPサーバーにリクエストを送信
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.mcpProcess) {
      throw new Error('MCPサーバーが起動していません');
    }

    const id = ++this.messageId;
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const messageStr = JSON.stringify(message) + '\n';
      this.mcpProcess!.stdin?.write(messageStr);

      // タイムアウト設定（30秒）
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCPリクエストがタイムアウトしました'));
        }
      }, 30000);
    });
  }

  /**
   * MCPサーバーからのレスポンスを処理
   */
  private handleResponse(response: MCPResponse): void {
    const { id, result, error } = response;
    const pending = this.pendingRequests.get(id);

    if (pending) {
      this.pendingRequests.delete(id);

      if (error) {
        pending.reject(new Error(`MCP Error: ${error.message}`));
      } else {
        pending.resolve(result);
      }
    }
  }
}

/**
 * MCPクライアントのシングルトンインスタンス
 */
let mcpClientInstance: SupabaseMCPClient | null = null;

export function getMCPClient(): SupabaseMCPClient {
  if (!mcpClientInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    mcpClientInstance = new SupabaseMCPClient(supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, true);
  }

  return mcpClientInstance;
} 
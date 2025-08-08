import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();
const env = process.env.NODE_ENV || 'development';

// Next.js と同等の優先順位（後ろが優先）
const candidates = [
  '.env',
  `.env.${env}`,
  '.env.local',
  `.env.${env}.local`,
];

const loaded = [];
for (const rel of candidates) {
  const p = path.join(cwd, rel);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
    loaded.push(rel);
  }
}

// 値の取得（NEXT_PUBLIC を優先）
const supaUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const openai = process.env.OPENAI_API_KEY || '';
const anthropic = process.env.ANTHROPIC_API_KEY || '';
const databaseUrl = process.env.DATABASE_URL || '';

// セキュリティガイドに基づくマスキング関数
const mask = (s) => {
  if (!s) return '(empty)';
  if (s.length <= 10) return s.slice(0, 3) + '…';
  return s.slice(0, 10) + '…';
};

console.log(`Loaded env files: ${loaded.join(', ') || '(none)'}`);
console.log(`✅ SUPABASE_URL for ${env}: ${supaUrl || '(empty)'}`);
console.log(`✅ OPENAI_API_KEY: ${mask(openai)}`);
console.log(`✅ ANTHROPIC_API_KEY: ${mask(anthropic)}`);
console.log(`✅ DATABASE_URL: ${mask(databaseUrl)}`);

// 本番環境でのセキュリティチェック（セキュリティガイド準拠）
if (env === 'production') {
  let hasError = false;
  
  // 1. ローカルURLのチェック
  if (/localhost|127\.0\.0\.1/.test(supaUrl)) {
    console.error(`❌ Production build with local SUPABASE URL: ${supaUrl}`);
    hasError = true;
  }
  
  // 2. APIキーの存在チェック
  if (!openai && !anthropic) {
    console.error('❌ Production build without API keys');
    hasError = true;
  }
  
  // 3. データベースURLのセキュリティチェック
  if (databaseUrl && /localhost|127\.0\.0\.1/.test(databaseUrl)) {
    console.error('❌ Production build with local DATABASE_URL');
    hasError = true;
  }
  
  // 4. 環境変数の露出チェック（クライアントサイド）
  const clientExposedKeys = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 
    'DATABASE_URL',
    'SERVICE_ROLE_KEY'
  ];
  
  for (const key of clientExposedKeys) {
    if (process.env[`NEXT_PUBLIC_${key}`]) {
      console.error(`❌ Production build with exposed API key: NEXT_PUBLIC_${key}`);
      hasError = true;
    }
  }
  
  // 5. Supabase URL形式チェック
  if (supaUrl && !supaUrl.startsWith('https://') || !supaUrl.includes('supabase.co')) {
    console.error(`❌ Production build with invalid Supabase URL format: ${supaUrl}`);
    hasError = true;
  }
  
  // 6. Service role key の露出チェック（長いキーがNEXT_PUBLICに紛れていないか）
  const allEnvKeys = Object.keys(process.env);
  const suspiciousKeys = allEnvKeys.filter(key => 
    key.startsWith('NEXT_PUBLIC_') && 
    process.env[key] && 
    process.env[key].length > 100 &&
    (process.env[key].includes('eyJ') || process.env[key].includes('sk-')) &&
    !key.includes('ANON_KEY') // ANON_KEYは正常な公開キー
  );
  
  if (suspiciousKeys.length > 0) {
    console.error(`❌ Production build with suspicious long keys in NEXT_PUBLIC_: ${suspiciousKeys.join(', ')}`);
    hasError = true;
  }
  
  if (hasError) {
    console.error('❌ Production security check failed');
    process.exit(1);
  }
  
  console.log('✅ Production security check passed');
}

// 開発環境での警告
if (env === 'development') {
  if (!openai && !anthropic) {
    console.warn('⚠️  Development without API keys - some features may not work');
  }
  
  if (!supaUrl) {
    console.warn('⚠️  Development without SUPABASE_URL - some features may not work');
  }
  
  // 開発環境でのセキュリティ警告
  if (process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
    console.warn('⚠️  Development with exposed API keys - ensure these are not committed');
  }
}

console.log(`✅ Environment check completed for ${env}`); 
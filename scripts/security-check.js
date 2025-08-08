import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数の読み込み
dotenv.config();

const cwd = process.cwd();
const env = process.env.NODE_ENV || 'development';

console.log('🔒 Security Check for Parking Response Generator');
console.log('==============================================');

// 1. 環境変数の露出チェック
console.log('\n1. Environment Variables Security Check');
console.log('----------------------------------------');

const sensitiveKeys = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
  'SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

let exposedKeys = [];
for (const key of sensitiveKeys) {
  if (process.env[`NEXT_PUBLIC_${key}`]) {
    exposedKeys.push(`NEXT_PUBLIC_${key}`);
  }
}

if (exposedKeys.length > 0) {
  console.error('❌ Exposed sensitive keys to client-side:');
  exposedKeys.forEach(key => console.error(`   - ${key}`));
} else {
  console.log('✅ No sensitive keys exposed to client-side');
}

// 2. ローカルURLチェック
console.log('\n2. Local URL Security Check');
console.log('----------------------------');

const urlsToCheck = [
  { name: 'SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL },
  { name: 'DATABASE_URL', value: process.env.DATABASE_URL }
];

let localUrls = [];
for (const { name, value } of urlsToCheck) {
  if (value && /localhost|127\.0\.0\.1/.test(value)) {
    localUrls.push({ name, value });
  }
}

if (localUrls.length > 0) {
  console.error('❌ Local URLs detected:');
  localUrls.forEach(({ name, value }) => console.error(`   - ${name}: ${value}`));
} else {
  console.log('✅ No local URLs detected');
}

// 3. APIキーの存在チェック
console.log('\n3. API Keys Availability Check');
console.log('--------------------------------');

const openai = process.env.OPENAI_API_KEY;
const anthropic = process.env.ANTHROPIC_API_KEY;

if (!openai && !anthropic) {
  console.error('❌ No API keys configured');
} else {
  console.log('✅ API keys are configured');
  if (openai) console.log('   - OpenAI API Key: Available');
  if (anthropic) console.log('   - Anthropic API Key: Available');
}

// 4. ファイルセキュリティチェック
console.log('\n4. File Security Check');
console.log('----------------------');

const sensitiveFiles = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development'
];

let foundSensitiveFiles = [];
for (const file of sensitiveFiles) {
  const filePath = path.join(cwd, file);
  if (fs.existsSync(filePath)) {
    foundSensitiveFiles.push(file);
  }
}

if (foundSensitiveFiles.length > 0) {
  console.log('⚠️  Sensitive files found:');
  foundSensitiveFiles.forEach(file => console.log(`   - ${file}`));
  console.log('   Make sure these files are in .gitignore');
} else {
  console.log('✅ No sensitive files found in root directory');
}

// 5. Git履歴チェック（簡易版）
console.log('\n5. Git History Security Check');
console.log('-------------------------------');

try {
  const { execSync } = await import('child_process');
  const gitLog = execSync('git log --oneline -10', { encoding: 'utf8' });
  
  const sensitivePatterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /sk-ant-[a-zA-Z0-9]{20,}/,
    /postgres:\/\/[^@]+@[^:]+:\d+\/[^?]+/
  ];
  
  let foundSecrets = [];
  for (const pattern of sensitivePatterns) {
    if (pattern.test(gitLog)) {
      foundSecrets.push(pattern.source);
    }
  }
  
  if (foundSecrets.length > 0) {
    console.error('❌ Potential secrets found in recent git history');
    console.error('   Consider using git filter-repo to clean history');
  } else {
    console.log('✅ No obvious secrets in recent git history');
  }
} catch (error) {
  console.log('⚠️  Could not check git history (not a git repository or git not available)');
}

// 6. 本番環境の追加チェック
if (env === 'production') {
  console.log('\n6. Production Environment Additional Checks');
  console.log('--------------------------------------------');
  
  // デバッグモードのチェック
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ NODE_ENV is not set to production');
  } else {
    console.log('✅ NODE_ENV is correctly set to production');
  }
  
  // 本番用URLのチェック
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (supaUrl && !/localhost|127\.0\.0\.1/.test(supaUrl)) {
    console.log('✅ Using production Supabase URL');
  } else {
    console.error('❌ Using local Supabase URL in production');
  }
}

// 総合結果
console.log('\n==============================================');
console.log('🔒 Security Check Summary');
console.log('==============================================');

const errors = [];
if (exposedKeys.length > 0) errors.push('Exposed sensitive keys');
if (localUrls.length > 0) errors.push('Local URLs detected');
if (!openai && !anthropic) errors.push('No API keys configured');

if (errors.length > 0) {
  console.error('❌ Security issues found:');
  errors.forEach(error => console.error(`   - ${error}`));
  console.error('\nPlease fix these issues before deployment.');
  process.exit(1);
} else {
  console.log('✅ All security checks passed');
  console.log('Your application is ready for deployment.');
} 
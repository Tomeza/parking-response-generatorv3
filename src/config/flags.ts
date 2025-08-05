/**
 * Feature Flags
 * 
 * 注意：
 * - フラグは必ずサーバーサイドでのみ使用（NEXT_PUBLIC_は付けない）
 * - 環境変数で制御（.env で設定）
 */

export const USE_DB_TEMPLATES = process.env.USE_DB_TEMPLATES === 'true';

// Phase3 Shadow/Canary 用フラグ
export const ENABLE_SHADOW_ROUTING = process.env.ENABLE_SHADOW_ROUTING === 'true';
export const ENABLE_CANARY_ROUTING = process.env.ENABLE_CANARY_ROUTING === 'true';
export const CANARY_PERCENTAGE = parseInt(process.env.CANARY_PERCENTAGE || '5', 10);

// ヘッダーベースの制御
export const SHADOW_HEADER = 'X-Route-Shadow';
export const CANARY_HEADER = 'X-Route-Canary'; 
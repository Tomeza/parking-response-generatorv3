/**
 * Feature Flags
 * 
 * 注意：
 * - フラグは必ずサーバーサイドでのみ使用（NEXT_PUBLIC_は付けない）
 * - 環境変数で制御（.env で設定）
 */

export const USE_DB_TEMPLATES = process.env.USE_DB_TEMPLATES === 'true'; 
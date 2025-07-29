/**
 * Router出力をテンプレートクエリに変換するAdapter
 */

export type RouterOutput = {
  category: 'Billing' | 'Complaint' | 'Request';
  intent: 'due_date' | 'overcharge' | 'payment_method' | 'other';
  urgency?: 'high' | 'low';
  language?: 'ja' | 'en';
};

export type TemplateQuery = {
  category: string;
  intent?: string;
  language: string;
};

/**
 * Router出力をテンプレートクエリに変換
 * 
 * @param r RouterOutput - ルーティング結果
 * @returns TemplateQuery - テンプレート検索用クエリパラメータ
 */
export const mapRouterToQuery = (r: RouterOutput): TemplateQuery => ({
  category: r.category,
  intent: r.intent === 'other' ? undefined : r.intent,
  language: r.language ?? 'ja',
}); 
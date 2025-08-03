import { USE_DB_TEMPLATES } from "@/config/flags";
import type { TemplateQuery } from "@/utils/mapRouterToQuery";

export interface Template {
  id: string;
  category: string;
  intent?: string;
  importance: number;
  frequency: number;
  tone?: string;
  style?: string;
  language: string;
  variables?: Record<string, unknown>;
  body: string;
  version?: string;
  approved: boolean;
}

/**
 * Edge Function経由でテンプレートを取得
 * 
 * @param q TemplateQuery - 検索条件
 * @param accessToken string - ユーザーのアクセストークン
 * @returns Promise<{ candidates: Template[] }> - 候補テンプレート（最大3件）
 */
export async function fetchTemplates(
  q: TemplateQuery,
  accessToken: string
): Promise<{ candidates: Template[] } | null> {
  if (!USE_DB_TEMPLATES) return null;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL}/get-templates`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(q),
    }
  );

  if (!res.ok) {
    throw new Error(`get-templates failed: ${await res.text()}`);
  }

  return res.json();
} 
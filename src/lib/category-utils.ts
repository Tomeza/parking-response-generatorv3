export interface CategoryKeywords {
  mainCategory: string;
  keywords: string[];
  subCategories?: {
    name: string;
    keywords: string[];
  }[];
}

export interface DetectedCategory {
  mainCategory: string;
  subCategory?: string;
  matchCount: number;
  relevance: number;
}

// カテゴリとキーワードの定義
export const categoryKeywords: CategoryKeywords[] = [
  {
    mainCategory: "利用の流れ",
    keywords: ["予約方法", "来場時", "帰着時", "送迎時", "精算時", "鍵管理", "必要物"],
    subCategories: [
      {
        name: "予約方法",
        keywords: ["予約", "予約する", "予約の仕方", "予約手順"]
      },
      {
        name: "来場時",
        keywords: ["来場", "到着", "入場", "駐車"]
      },
      {
        name: "帰着時",
        keywords: ["帰着", "出発", "退場", "返却"]
      }
    ]
  },
  {
    mainCategory: "予約関連",
    keywords: ["予約条件", "予約時間", "予約確認", "キャンセル", "変更", "満車", "空き状況"],
    subCategories: [
      {
        name: "予約条件",
        keywords: ["条件", "制限", "制約", "ルール"]
      },
      {
        name: "キャンセル",
        keywords: ["キャンセル", "解約", "変更", "修正"]
      }
    ]
  },
  {
    mainCategory: "車両関連",
    keywords: ["車種", "サイズ制限", "高さ制限", "鍵管理", "車両情報", "レクサス", "外車"],
    subCategories: [
      {
        name: "車種制限",
        keywords: ["車種", "外車", "高級車", "制限"]
      },
      {
        name: "サイズ制限",
        keywords: ["サイズ", "大きさ", "高さ", "幅"]
      }
    ]
  },
  {
    mainCategory: "送迎関連",
    keywords: ["時間", "所要時間", "制限事項", "案内", "待ち時間", "定員", "人数制限"],
    subCategories: [
      {
        name: "送迎時間",
        keywords: ["時間", "所要時間", "待ち時間", "運行"]
      },
      {
        name: "定員制限",
        keywords: ["定員", "人数", "制限", "乗車"]
      }
    ]
  },
  {
    mainCategory: "料金関連",
    keywords: ["割引", "支払方法", "領収書", "キャンセル料", "追加料金", "精算時"],
    subCategories: [
      {
        name: "料金体系",
        keywords: ["料金", "費用", "価格", "割引"]
      },
      {
        name: "支払方法",
        keywords: ["支払い", "支払方法", "精算", "決済"]
      }
    ]
  }
];

/**
 * 問い合わせ文からカテゴリを検出する
 * @param query 検索クエリ
 * @returns 検出されたカテゴリの配列
 */
export function detectCategories(query: string): DetectedCategory[] {
  const detected: DetectedCategory[] = [];

  categoryKeywords.forEach(category => {
    let matchCount = 0;
    let subCategoryMatch: { name: string; count: number } | undefined;

    // メインカテゴリのキーワードマッチング
    category.keywords.forEach(keyword => {
      if (query.includes(keyword)) {
        matchCount++;
      }
    });

    // サブカテゴリのキーワードマッチング
    if (category.subCategories) {
      category.subCategories.forEach(sub => {
        let subMatchCount = 0;
        sub.keywords.forEach(keyword => {
          if (query.includes(keyword)) {
            subMatchCount++;
          }
        });

        if (subMatchCount > 0 && (!subCategoryMatch || subMatchCount > subCategoryMatch.count)) {
          subCategoryMatch = { name: sub.name, count: subMatchCount };
        }
      });
    }

    // 関連度の計算（キーワードマッチ数に基づく）
    const relevance = matchCount / category.keywords.length;

    if (matchCount > 0) {
      detected.push({
        mainCategory: category.mainCategory,
        subCategory: subCategoryMatch?.name,
        matchCount,
        relevance
      });
    }
  });

  // 関連度順にソート
  return detected.sort((a, b) => b.relevance - a.relevance);
}

/**
 * 最も関連性の高いカテゴリを取得する
 * @param categories 検出されたカテゴリの配列
 * @returns 最も関連性の高いカテゴリ
 */
export function getMostRelevantCategory(categories: DetectedCategory[]): DetectedCategory | null {
  return categories.length > 0 ? categories[0] : null;
}

/**
 * カテゴリの関連性を判定する
 * @param category カテゴリ情報
 * @returns 関連性の判定結果
 */
export function evaluateCategoryRelevance(category: DetectedCategory): {
  isHighRelevance: boolean;
  isMediumRelevance: boolean;
  isLowRelevance: boolean;
} {
  return {
    isHighRelevance: category.relevance >= 0.7,
    isMediumRelevance: category.relevance >= 0.4 && category.relevance < 0.7,
    isLowRelevance: category.relevance < 0.4
  };
} 
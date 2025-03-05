export type UsageType = '◯' | '△' | '✖️';

export interface AlertWord {
  pattern: RegExp;
  tag: string;
  priority: number;
  usage: UsageType;
  description?: string;
}

export interface DetectedAlert {
  word: string;
  tag: string;
  priority: number;
  usage: UsageType;
  description?: string;
}

// アラートワードの定義
export const alertWords: AlertWord[] = [
  {
    pattern: /国際線|インターナショナル|朝帰国|海外/g,
    tag: "国際線",
    priority: 10,
    usage: "✖️",
    description: "国際線利用は不可"
  },
  {
    pattern: /レクサス|外車|BMW|ベンツ|アウディ|高級車/g,
    tag: "受入不可車種",
    priority: 9,
    usage: "✖️",
    description: "高級車・外車は受入不可"
  },
  {
    pattern: /満車|空き|空いている日/g,
    tag: "予約条件",
    priority: 8,
    usage: "✖️",
    description: "予約条件に関する重要キーワード"
  },
  {
    pattern: /定員|(\d+)名|人数制限|5名/g,
    tag: "定員制限",
    priority: 7,
    usage: "◯",
    description: "定員制限に関する情報"
  },
  {
    pattern: /繁忙期|混雑期間|ピーク時/g,
    tag: "繁忙期",
    priority: 6,
    usage: "△",
    description: "繁忙期に関する情報"
  },
  {
    pattern: /キャンセル|解約|予約変更/g,
    tag: "キャンセル関連",
    priority: 5,
    usage: "◯",
    description: "キャンセル・予約変更に関する情報"
  },
  {
    pattern: /送迎|シャトル|バス/g,
    tag: "送迎関連",
    priority: 4,
    usage: "◯",
    description: "送迎サービスに関する情報"
  },
  {
    pattern: /料金|費用|支払い|精算/g,
    tag: "料金関連",
    priority: 3,
    usage: "◯",
    description: "料金・支払いに関する情報"
  }
];

/**
 * 問い合わせ文からアラートワードを検出する
 * @param query 検索クエリ
 * @returns 検出されたアラートの配列
 */
export function detectAlertWords(query: string): DetectedAlert[] {
  const detected: DetectedAlert[] = [];

  alertWords.forEach(alert => {
    const matches = query.match(alert.pattern);
    if (matches) {
      matches.forEach(match => {
        detected.push({
          word: match,
          tag: alert.tag,
          priority: alert.priority,
          usage: alert.usage,
          description: alert.description
        });
      });
    }
  });

  // 優先度順にソート
  return detected.sort((a, b) => b.priority - a.priority);
}

/**
 * アラートの重要度を判定する
 * @param alerts 検出されたアラートの配列
 * @returns 重要度の高いアラートの配列
 */
export function getHighPriorityAlerts(alerts: DetectedAlert[]): DetectedAlert[] {
  return alerts.filter(alert => alert.priority >= 8);
}

/**
 * アラートの使用可否を判定する
 * @param alerts 検出されたアラートの配列
 * @returns 使用可否の判定結果
 */
export function checkAlertUsage(alerts: DetectedAlert[]): {
  hasCriticalAlerts: boolean;
  hasWarningAlerts: boolean;
  criticalAlerts: DetectedAlert[];
  warningAlerts: DetectedAlert[];
} {
  const criticalAlerts = alerts.filter(alert => alert.usage === "✖️");
  const warningAlerts = alerts.filter(alert => alert.usage === "△");

  return {
    hasCriticalAlerts: criticalAlerts.length > 0,
    hasWarningAlerts: warningAlerts.length > 0,
    criticalAlerts,
    warningAlerts
  };
} 
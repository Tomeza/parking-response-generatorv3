/**
 * アラート・警告メッセージシステム
 * すべての応答に特定の注意喚起を追加するためのユーティリティ
 */

// 注意喚起の種類
export enum AlertType {
  INTERNATIONAL_FLIGHT = 'international_flight',
  LUXURY_CAR = 'luxury_car',
  BUSY_PERIOD = 'busy_period',
  RESERVATION_CHANGE = 'reservation_change',
  MAX_PASSENGERS = 'max_passengers'
}

// 注意喚起メッセージの定義
const alertMessages = {
  [AlertType.INTERNATIONAL_FLIGHT]: 
    '※重要: 当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。',
  
  [AlertType.LUXURY_CAR]: 
    '※重要: 当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。',
    
  [AlertType.BUSY_PERIOD]:
    '※お知らせ: 繁忙期（GW、お盆、年末年始）は満車になりやすいため、早めのご予約をお勧めいたします。',
    
  [AlertType.RESERVATION_CHANGE]:
    '※ご注意: 予約変更は利用日の3日前までとなります。それ以降の変更はキャンセル扱いとなりキャンセル料が発生いたします。',
    
  [AlertType.MAX_PASSENGERS]:
    '※ご注意: 送迎車の乗車人数は、運転手を除き最大4名様までとなります。5名様以上の場合は複数回に分けての送迎となります。'
};

// アラートの優先順位 (高いほど優先度が高い)
const alertPriority: Record<AlertType, number> = {
  [AlertType.INTERNATIONAL_FLIGHT]: 5,
  [AlertType.LUXURY_CAR]: 4,
  [AlertType.BUSY_PERIOD]: 3, 
  [AlertType.RESERVATION_CHANGE]: 2,
  [AlertType.MAX_PASSENGERS]: 1
};

/**
 * 指定されたアラートタイプに基づいて注意喚起メッセージを取得する
 */
export function getAlertMessage(alertType: AlertType): string {
  return alertMessages[alertType] || '';
}

/**
 * アラートの優先度を取得する
 */
export function getAlertPriority(alertType: AlertType): number {
  return alertPriority[alertType] || 0;
}

/**
 * 応答テキストに必須の注意喚起を追加する
 * @param responseText 元の応答テキスト
 * @param detectedAlerts 検出されたアラート（指定がない場合はデフォルトアラート）
 * @returns 注意喚起が追加された応答テキスト
 */
export function addMandatoryAlerts(responseText: string, detectedAlerts?: AlertType[]): string {
  // 追加するアラートを格納する配列
  const alertsToAdd: string[] = [];
  
  // 検出されたアラートが指定されている場合はそれを使用、そうでなければデフォルトアラート
  const alerts = detectedAlerts || [AlertType.INTERNATIONAL_FLIGHT, AlertType.LUXURY_CAR];
  
  // 各アラートについて、既に含まれていなければ追加
  for (const alert of alerts) {
    const alertMessage = getAlertMessage(alert);
    
    // メッセージの一部が既に応答テキストに含まれているかチェック
    if (!alertMessage || responseContainsAlertMessage(responseText, alertMessage)) {
      continue;
    }
    
    alertsToAdd.push(alertMessage);
  }
  
  // アラートがない場合は元のテキストをそのまま返す
  if (alertsToAdd.length === 0) {
    return responseText;
  }
  
  // 優先度順にソート
  alertsToAdd.sort((a, b) => {
    const alertTypeA = getAlertTypeFromMessage(a);
    const alertTypeB = getAlertTypeFromMessage(b);
    return getAlertPriority(alertTypeB) - getAlertPriority(alertTypeA);
  });
  
  // アラートを追加
  return `${responseText}\n\n${alertsToAdd.join('\n\n')}`;
}

/**
 * アラートメッセージからアラートタイプを特定する
 */
function getAlertTypeFromMessage(message: string): AlertType {
  for (const [type, msg] of Object.entries(alertMessages)) {
    if (msg === message) {
      return type as AlertType;
    }
  }
  return AlertType.INTERNATIONAL_FLIGHT; // デフォルト
}

/**
 * レスポンステキストがアラートメッセージの主要部分を含んでいるかチェック
 */
function responseContainsAlertMessage(responseText: string, alertMessage: string): boolean {
  // アラートメッセージの特徴的な部分を抽出
  const significantParts = extractSignificantParts(alertMessage);
  
  // いずれかの特徴的な部分が応答テキストに含まれていればtrue
  return significantParts.some(part => responseText.includes(part));
}

/**
 * アラートメッセージから特徴的な部分を抽出
 */
function extractSignificantParts(alertMessage: string): string[] {
  if (alertMessage.includes('国内線ご利用のお客様専用')) {
    return ['国内線ご利用のお客様専用', '国際線ターミナルへの送迎'];
  }
  
  if (alertMessage.includes('全外車')) {
    return ['全外車', 'レクサス全車種', '場内保険の対象外'];
  }
  
  if (alertMessage.includes('繁忙期')) {
    return ['繁忙期', 'GW、お盆、年末年始', '満車になりやすい'];
  }
  
  if (alertMessage.includes('予約変更は利用日の3日前まで')) {
    return ['予約変更は利用日の3日前まで', 'キャンセル料が発生'];
  }
  
  if (alertMessage.includes('送迎車の乗車人数')) {
    return ['送迎車の乗車人数', '最大4名様まで', '複数回に分けての送迎'];
  }
  
  // デフォルトは元のメッセージをそのまま返す
  return [alertMessage];
}

/**
 * クエリ内に特定のアラートキーワードが含まれているかをチェック
 * @param query 検索クエリ
 * @returns 検出されたアラートタイプの配列
 */
export function detectAlertKeywords(query: string): AlertType[] {
  const detectedAlerts: AlertType[] = [];
  const normalizedQuery = query.toLowerCase();
  
  // 国際線関連のキーワード
  const internationalKeywords = ['国際線', '国際便', 'インターナショナル', '国際ターミナル', '国際空港', '海外便'];
  if (internationalKeywords.some(keyword => normalizedQuery.includes(keyword))) {
    detectedAlerts.push(AlertType.INTERNATIONAL_FLIGHT);
  }
  
  // 外車関連のキーワード
  const luxuryCarKeywords = ['外車', '輸入車', 'レクサス', 'bmw', 'ベンツ', 'アウディ', '外国車', '高級車'];
  if (luxuryCarKeywords.some(keyword => normalizedQuery.includes(keyword))) {
    detectedAlerts.push(AlertType.LUXURY_CAR);
  }
  
  // 繁忙期関連のキーワード
  const busyPeriodKeywords = ['繁忙期', 'お盆', '年末年始', 'ゴールデンウィーク', 'gw', '連休', '混雑期'];
  if (busyPeriodKeywords.some(keyword => normalizedQuery.includes(keyword))) {
    detectedAlerts.push(AlertType.BUSY_PERIOD);
  }
  
  // 予約変更関連のキーワード
  const reservationChangeKeywords = ['予約変更', '予約の変更', '予約を変更', '変更期限'];
  if (reservationChangeKeywords.some(keyword => normalizedQuery.includes(keyword)) ||
      (normalizedQuery.includes('予約') && normalizedQuery.includes('変更'))) {
    detectedAlerts.push(AlertType.RESERVATION_CHANGE);
  }
  
  // 乗車人数関連のキーワード
  const passengerKeywords = ['乗車人数', '人数制限', '何人まで', '5人', '6人', '大人数', '団体'];
  if (passengerKeywords.some(keyword => normalizedQuery.includes(keyword)) ||
      (normalizedQuery.includes('送迎') && 
       (normalizedQuery.includes('人数') || normalizedQuery.includes('人まで')))) {
    detectedAlerts.push(AlertType.MAX_PASSENGERS);
  }
  
  return detectedAlerts;
} 
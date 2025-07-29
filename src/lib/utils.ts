import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// 日付を日本語フォーマットに変換する関数
export function formatJapaneseDate(date: Date): string {
  return format(date, 'yyyy年MM月dd日(E)', { locale: ja });
}

// 日付を検出する関数
export function detectDates(text: string): Date[] {
  const dates: Date[] = [];
  
  // YYYY/MM/DD または YYYY-MM-DD 形式
  const standardDatePattern = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g;
  let match;
  
  while ((match = standardDatePattern.exec(text)) !== null) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // JavaScriptの月は0-11
    const day = parseInt(match[3]);
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      dates.push(date);
    }
  }
  
  // YYYY年MM月DD日 形式
  const japaneseDatePattern = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
  
  while ((match = japaneseDatePattern.exec(text)) !== null) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      dates.push(date);
    }
  }
  
  // MM月DD日 形式（今年と仮定）
  const monthDayPattern = /(\d{1,2})月(\d{1,2})日/g;
  
  while ((match = monthDayPattern.exec(text)) !== null) {
    const currentYear = new Date().getFullYear();
    const month = parseInt(match[1]) - 1;
    const day = parseInt(match[2]);
    
    const date = new Date(currentYear, month, day);
    if (!isNaN(date.getTime())) {
      dates.push(date);
    }
  }
  
  return dates;
}

// テキストからアラートワードを検出する関数
export function detectAlertWords(text: string, alertWords: { word: string; priority: number }[]): { word: string; priority: number }[] {
  const detectedAlerts: { word: string; priority: number }[] = [];
  
  for (const alert of alertWords) {
    const regex = new RegExp(alert.word, 'i');
    if (regex.test(text)) {
      detectedAlerts.push(alert);
    }
  }
  
  // 優先度順にソート
  return detectedAlerts.sort((a, b) => a.priority - b.priority);
}

// テキストをハイライトする関数
export function highlightText(text: string, words: string[]): string {
  let highlightedText = text;
  
  for (const word of words) {
    const regex = new RegExp(`(${word})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
  }
  
  return highlightedText;
}

// メール送信用のmailtoリンクを生成する関数
export function generateMailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// 文字列を省略する関数
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

// 日本語の形態素解析用の簡易関数（実際の実装ではMeCabなどを使用）
export function tokenizeJapanese(text: string): string[] {
  // 簡易的な実装：スペース、句読点で分割
  return text
    .replace(/[、。！？]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
} 

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
} 
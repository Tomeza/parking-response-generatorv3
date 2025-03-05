import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

// 日付文字列をDate型に変換する関数
function parseJapaneseDate(dateStr: string, year: number): Date {
  // "２月８日" → "2024-02-08" の形式に変換
  const normalized = dateStr
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[年月日]/g, '-')
    .trim();
  
  const [month, day] = normalized.split('-').filter(s => s);
  return new Date(year, parseInt(month) - 1, parseInt(day));
}

// 繁忙期データを登録する関数
async function registerBusyPeriods(input: string, year: number) {
  // 入力を行に分割
  const lines = input.split('\n').filter(line => line.trim());
  
  // 既存の該当年のデータを削除
  await prisma.busyPeriod.deleteMany({
    where: { year }
  });
  
  // 期間のペアを抽出
  const periods = lines.flatMap(line => {
    const pairs = line.split('、');
    return pairs.map(pair => {
      const [start, end] = pair.split('〜');
      if (!start || !end) return null;
      
      return {
        startDate: parseJapaneseDate(start, year),
        endDate: parseJapaneseDate(end, year),
        year
      };
    }).filter((p): p is { startDate: Date; endDate: Date; year: number } => p !== null);
  });
  
  // データベースに登録
  for (const period of periods) {
    await prisma.busyPeriod.create({
      data: period
    });
  }
  
  console.log(`${periods.length}件の繁忙期データを登録しました`);
}

// 繁忙期データを表示する関数
async function displayBusyPeriods(year: number) {
  const periods = await prisma.busyPeriod.findMany({
    where: { year },
    orderBy: { startDate: 'asc' }
  });
  
  console.log(`\n${year}年の繁忙期データ:`);
  periods.forEach(period => {
    console.log(`${period.startDate.toLocaleDateString('ja-JP')} 〜 ${period.endDate.toLocaleDateString('ja-JP')}`);
  });
}

// メイン処理
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    // 年度の入力
    const year = await new Promise<number>(resolve => {
      rl.question('対象年度を入力してください（例: 2024）: ', answer => {
        resolve(parseInt(answer));
      });
    });
    
    // 繁忙期データの入力
    console.log('\n繁忙期データを入力してください（入力終了は空行で Enter）:');
    let input = '';
    
    await new Promise<void>(resolve => {
      rl.on('line', line => {
        if (line.trim() === '') {
          resolve();
        } else {
          input += line + '\n';
        }
      });
    });
    
    await registerBusyPeriods(input.trim(), year);
    await displayBusyPeriods(year);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main(); 
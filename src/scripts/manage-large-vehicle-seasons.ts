import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

// 日付文字列をDate型に変換する関数
function parseJapaneseDate(dateStr: string, year: number, currentMonth?: number): Date {
  // "２月８日" → "2024-02-08" の形式に変換
  const normalized = dateStr
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[年月]/g, '-')
    .replace(/日/g, '')
    .trim();
  
  let month: number;
  let day: number;
  
  if (normalized.includes('-')) {
    // 月日両方ある場合（例: "2-8"）
    [month, day] = normalized.split('-').filter(s => s).map(s => parseInt(s, 10));
  } else {
    // 日だけの場合（例: "8"）
    if (!currentMonth) {
      throw new Error(`Month is required for date: ${dateStr}`);
    }
    month = currentMonth;
    day = parseInt(normalized, 10);
  }
  
  if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  
  return date;
}

// 大型車シーズンデータを登録する関数
async function registerLargeVehicleSeasons(input: string, year: number) {
  // 入力を行に分割
  const lines = input.split('\n').filter(line => line.trim());
  
  // 既存の該当年のデータを削除
  await prisma.largeVehicleSeason.deleteMany({
    where: { year }
  });
  
  // 期間のペアを抽出
  const periods = lines.flatMap(line => {
    const pairs = line.split('、');
    return pairs.map(pair => {
      try {
        const [startStr, endStr] = pair.split('〜');
        if (!startStr || !endStr) {
          console.error(`Invalid period format: ${pair}`);
          return null;
        }
        
        // 開始日から月を取得
        const startMatch = startStr.match(/(\d+)月/);
        if (!startMatch) {
          console.error(`Cannot extract month from: ${startStr}`);
          return null;
        }
        const currentMonth = parseInt(startMatch[1], 10);
        
        return {
          startDate: parseJapaneseDate(startStr, year),
          endDate: parseJapaneseDate(endStr, year, currentMonth),
          year
        };
      } catch (error) {
        console.error(`Error parsing period: ${pair}`, error);
        return null;
      }
    }).filter((p): p is { startDate: Date; endDate: Date; year: number } => p !== null);
  });
  
  if (periods.length === 0) {
    console.error('No valid periods found');
    return;
  }
  
  // データベースに登録
  for (const period of periods) {
    try {
      await prisma.largeVehicleSeason.create({
        data: period
      });
      console.log(`登録成功: ${period.startDate.toLocaleDateString('ja-JP')} 〜 ${period.endDate.toLocaleDateString('ja-JP')}`);
    } catch (error) {
      console.error('登録エラー:', error);
    }
  }
  
  console.log(`${periods.length}件の大型車シーズンデータを登録しました`);
}

// 大型車シーズンデータを表示する関数
async function displayLargeVehicleSeasons(year: number) {
  const periods = await prisma.largeVehicleSeason.findMany({
    where: { year },
    orderBy: { startDate: 'asc' }
  });
  
  console.log(`\n${year}年の大型車シーズンデータ:`);
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
    
    // 大型車シーズンデータの入力
    console.log('\n大型車シーズンデータを入力してください（入力終了は空行で Enter）:');
    console.log('例: 4月1日〜5月31日、7月15日〜8月31日、10月1日〜11月30日');
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
    
    await registerLargeVehicleSeasons(input.trim(), year);
    await displayLargeVehicleSeasons(year);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main(); 
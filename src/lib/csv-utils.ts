import fs from 'fs';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';

// CSVの列定義
export interface KnowledgeCSV {
  main_category: string;
  sub_category: string;
  detail_category?: string;
  question: string;
  answer: string;
  tags?: string;
  is_template?: boolean;
  usage?: string;
  note?: string;
  issue?: string;
}

// CSVファイルを読み込む関数
export async function readCSV(filePath: string): Promise<KnowledgeCSV[]> {
  const records: KnowledgeCSV[] = [];
  
  const parser = fs
    .createReadStream(filePath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // BOM付きUTF-8に対応
      relax_quotes: true, // クォートの扱いを緩和
      relax_column_count: true, // カラム数の不一致を許容
      quote: '"', // ダブルクォートを使用
      escape: '"', // エスケープ文字もダブルクォート
      delimiter: ',', // 区切り文字はカンマ
    }));

  for await (const record of parser) {
    // boolean値の変換
    if (record.is_template !== undefined) {
      record.is_template = record.is_template.toLowerCase() === 'true';
    }
    
    // 空文字列をnullに変換
    Object.keys(record).forEach(key => {
      if (record[key] === '') {
        record[key] = null;
      }
    });

    records.push(record as KnowledgeCSV);
  }

  return records;
}

// CSVデータをバリデーションする関数
export function validateCSVRecord(record: KnowledgeCSV): string[] {
  const errors: string[] = [];

  // 必須フィールドのチェック
  if (!record.main_category) errors.push('main_category is required');
  if (!record.sub_category) errors.push('sub_category is required');
  if (!record.question) errors.push('question is required');
  if (!record.answer) errors.push('answer is required');

  // 文字列長のチェック
  if (record.question.length > 1000) errors.push('question is too long (max 1000 chars)');
  if (record.answer.length > 5000) errors.push('answer is too long (max 5000 chars)');

  return errors;
}

// タグ文字列をパースする関数
export function parseTags(tagString?: string): string[] {
  if (!tagString) return [];
  return tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
}

// CSVデータをデータベースにインポートする関数
export async function importCSVToDatabase(
  records: KnowledgeCSV[],
  prisma: PrismaClient,
  batchSize: number = 100
): Promise<{ success: number; errors: number; errorDetails: any[] }> {
  let success = 0;
  let errors = 0;
  const errorDetails: any[] = [];

  // バッチ処理用の配列を初期化
  let batch: KnowledgeCSV[] = [];

  for (const record of records) {
    // バリデーションチェック
    const validationErrors = validateCSVRecord(record);
    if (validationErrors.length > 0) {
      errors++;
      errorDetails.push({
        record,
        errors: validationErrors
      });
      continue;
    }

    batch.push(record);

    // バッチサイズに達したらデータベースに挿入
    if (batch.length >= batchSize) {
      try {
        await processBatch(batch, prisma);
        success += batch.length;
      } catch (error: any) {
        errors += batch.length;
        errorDetails.push({
          batch,
          error: error?.message || 'Unknown error'
        });
      }
      batch = [];
    }
  }

  // 残りのバッチを処理
  if (batch.length > 0) {
    try {
      await processBatch(batch, prisma);
      success += batch.length;
    } catch (error: any) {
      errors += batch.length;
      errorDetails.push({
        batch,
        error: error?.message || 'Unknown error'
      });
    }
  }

  return { success, errors, errorDetails };
}

// バッチ処理を行う関数
async function processBatch(batch: KnowledgeCSV[], prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    for (const record of batch) {
      const tags = parseTags(record.tags);

      // Knowledgeレコードを作成または更新
      await tx.knowledge.create({
        data: {
          main_category: record.main_category,
          sub_category: record.sub_category,
          detail_category: record.detail_category,
          question: record.question,
          answer: record.answer,
          is_template: record.is_template ?? false,
          usage: record.usage,
          note: record.note,
          issue: record.issue,
          // タグの関連付け
          knowledge_tags: {
            create: tags.map(tagName => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: {
                    name: tagName,
                    description: `${tagName}に関する情報`
                  }
                }
              }
            }))
          }
        }
      });
    }
  });
} 
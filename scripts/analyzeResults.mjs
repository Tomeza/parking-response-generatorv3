// scripts/analyzeResults.mjs
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url'; // For ES Modules __dirname equivalent

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const prisma = new PrismaClient();
  
  const resultsDir = path.resolve(__dirname, '../tests/test_results/');
  let inputFile = '';

  // Find the latest CSV file
  try {
    const files = fs.readdirSync(resultsDir);
    const csvFiles = files
      .filter(file => /^embedding_performance_test_.*\.csv$/.test(file))
      .map(file => ({
        name: file,
        time: fs.statSync(path.join(resultsDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (csvFiles.length === 0) {
      console.error(`No CSV files found in ${resultsDir} matching the pattern embedding_performance_test_*.csv`);
      process.exit(1);
    }
    inputFile = path.join(resultsDir, csvFiles[0].name);
    console.log(`Processing CSV file: ${inputFile}`);
  } catch (err) {
    console.error(`Error accessing or finding CSV files in ${resultsDir}:`, err);
    process.exit(1);
  }

  const outputFile = path.resolve(resultsDir, 'analysis_with_content.json');
  const rows = [];

  // ① CSV読込
  fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (r) => rows.push(r))
    .on('end', async () => {
      try {
        // ② 各行についてKnowledgeテーブルからQ/Aをフェッチ
        for (const r of rows) {
          const top1Id = r.top1_Id && !isNaN(Number(r.top1_Id)) ? Number(r.top1_Id) : null;
          let top5 = [];
          try {
            top5 = r.top5_Ids_Similarities ? JSON.parse(r.top5_Ids_Similarities) : [];
          } catch (e) {
            console.warn(`Could not parse top5_Ids_Similarities for a row: ${r.top5_Ids_Similarities}`, e);
          }
          // Ensure groundTruth_Id is read and converted to Number or null
          const gtId = r.groundTruth_Id && !isNaN(Number(r.groundTruth_Id)) && r.groundTruth_Id.trim() !== '' ? Number(r.groundTruth_Id) : null;

          // Top-1 Q/A
          if (top1Id) {
            const top1 = await prisma.knowledge.findUnique({
              where: { id: top1Id },
              select: { question: true, answer: true }
            });
            r.top1_question = top1?.question;
            r.top1_answer   = top1?.answer;
          } else {
            r.top1_question = null;
            r.top1_answer   = null;
          }

          // Top-5 Q/A
          r.top5_content = [];
          if (Array.isArray(top5)) {
            for (const item of top5) {
              if (item.id && !isNaN(Number(item.id))) {
                const k = await prisma.knowledge.findUnique({
                  where: { id: Number(item.id) },
                  select: { question: true, answer: true }
                });
                r.top5_content.push({ id: Number(item.id), similarity: item.similarity, question: k?.question, answer: k?.answer });
              }
            }
          }
          
          // Ground-truth Q/A
          if (gtId) {
            const gt = await prisma.knowledge.findUnique({
              where: { id: gtId },
              select: { question: true, answer: true }
            });
            r.gt_question = gt?.question;
            r.gt_answer   = gt?.answer;
          } else {
            r.gt_question = null;
            r.gt_answer = null;
          }
        }

        // ③ JSONとして保存
        fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2), 'utf-8');
        console.log(`✅ 出力完了: ${outputFile}`);
      
      } catch (processingError) {
        console.error('Error during data processing and fetching from DB:', processingError);
      } finally {
        await prisma.$disconnect();
      }
    })
    .on('error', (readError) => {
        console.error('Error reading CSV file:', readError);
        prisma.$disconnect(); // Ensure disconnect on read error as well
    });
}

main().catch((e) => {
  console.error('Unhandled error in main:', e);
  prisma.$disconnect().catch(disconnectError => { // Attempt to disconnect on main error
    console.error('Error disconnecting Prisma on main error:', disconnectError);
  });
  process.exit(1);
}); 
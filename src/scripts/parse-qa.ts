import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QAPair {
  questions: string[];
  answer: string;
  mainCategory?: string;
  subCategory?: string;
  detailCategory?: string;
  isTemplate?: boolean;
  usage?: string;
  note?: string;
  issue?: string;
}

/**
 * QA01.txtをパースして、質問グループと回答を抽出する
 */
async function parseQAFile(filePath: string): Promise<QAPair[]> {
  // ファイルを読み込む
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // QAPairの配列を初期化
  const qaPairs: QAPair[] = [];
  
  // 正規表現で Q: と A: ブロックを抽出
  const regex = /Q:\s*([\s\S]*?)(?=A:)\s*A:\s*([\s\S]*?)(?=(?:Q:|$))/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const questionBlock = match[1].trim();
    const answerBlock = match[2].trim();
    
    // 質問ブロックを改行で分割
    const questions = questionBlock
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .map(q => q.replace(/^["「]|["」]$/g, '')); // 「」や""を削除
    
    // 回答を整形
    const answer = answerBlock.replace(/^["「]|["」]$/g, ''); // 「」や""を削除
    
    // カテゴリを推測（例として、キーワードベースで簡易的に分類）
    let mainCategory = '一般';
    let subCategory = '未分類';
    let detailCategory = '';
    
    // キーワードからカテゴリを推測
    if (questionBlock.includes('予約') || questionBlock.includes('申し込み')) {
      mainCategory = '予約関連';
      if (questionBlock.includes('変更')) {
        subCategory = '予約変更';
      } else if (questionBlock.includes('キャンセル')) {
        subCategory = 'キャンセル';
      } else {
        subCategory = '申込方法';
      }
    } else if (questionBlock.includes('送迎') || questionBlock.includes('空港')) {
      mainCategory = '送迎関連';
      if (questionBlock.includes('時間')) {
        subCategory = '時間';
        detailCategory = '所要時間';
      } else if (questionBlock.includes('人数')) {
        subCategory = '人数';
        detailCategory = '定員';
      }
    } else if (questionBlock.includes('国際線')) {
      mainCategory = '利用制限';
      subCategory = '利用範囲';
      detailCategory = '国際線';
    }
    
    // QAPairを作成
    const qaPair: QAPair = {
      questions,
      answer,
      mainCategory,
      subCategory,
      detailCategory,
      isTemplate: false,
      usage: '◯',
      note: '',
      issue: ''
    };
    
    qaPairs.push(qaPair);
  }
  
  return qaPairs;
}

/**
 * QAPairをデータベースに登録する
 */
async function importQAToDatabase(qaPairs: QAPair[]): Promise<void> {
  console.log(`${qaPairs.length}件のQAペアを処理します...`);
  
  for (const qaPair of qaPairs) {
    // 主となる質問（最初の質問）
    const mainQuestion = qaPair.questions[0];
    
    // Knowledge テーブルに登録
    const knowledge = await prisma.knowledge.create({
      data: {
        main_category: qaPair.mainCategory || '一般',
        sub_category: qaPair.subCategory || '未分類',
        detail_category: qaPair.detailCategory || '',
        question: mainQuestion,
        answer: qaPair.answer,
        is_template: qaPair.isTemplate || false,
        usage: qaPair.usage || '◯',
        note: qaPair.note || '',
        issue: qaPair.issue || ''
      }
    });
    
    console.log(`ナレッジを作成しました: ID=${knowledge.id}, Q="${mainQuestion.substring(0, 30)}..."`);
    
    // 質問バリエーションがある場合は、QuestionVariation テーブルに登録
    if (qaPair.questions.length > 1) {
      for (let i = 1; i < qaPair.questions.length; i++) {
        // KnowledgeQuestionVariation テーブルが存在する場合
        try {
          await prisma.$executeRaw`
            INSERT INTO "KnowledgeQuestionVariation" ("knowledge_id", "variation")
            VALUES (${knowledge.id}, ${qaPair.questions[i]})
          `;
          console.log(`質問バリエーションを追加しました: "${qaPair.questions[i].substring(0, 30)}..."`);
        } catch (e) {
          console.warn(`質問バリエーションの登録に失敗しました: ${e}`);
          // KnowledgeQuestionVariation テーブルが存在しない場合はスキップ
        }
      }
    }
  }
}

/**
 * メイン関数
 */
async function main() {
  try {
    const filePath = path.join(__dirname, '../../data/QA01.txt');
    
    // QAファイルをパース
    const qaPairs = await parseQAFile(filePath);
    console.log(`${qaPairs.length}件のQAペアを抽出しました`);
    
    // DBに登録
    await importQAToDatabase(qaPairs);
    
    console.log('QAデータのインポートが完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトの実行
main(); 
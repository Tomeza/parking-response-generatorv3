/**
 * 検索精度向上のための最適化スクリプト
 * 
 * このスクリプトは以下の改善をテストします：
 * 1. search_vectorの更新トリガーの改善
 * 2. 日付検出・繁忙期チェック機能
 * 3. タグ検索機能の統合
 */

import { PrismaClient, Knowledge } from '@prisma/client';
import { searchKnowledge } from '../lib/search';
import { extractDatesFromText, checkBusyPeriods, formatDateToJapanese } from '../lib/date-utils';
import { searchKnowledgeByTags } from '../lib/tag-search';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

interface SearchResult extends Knowledge {
  rank?: number;
  ts_score?: number;
  sim_score?: number;
  tag_score?: number;
  category_score?: number;
  final_score?: number;
  relevance?: number;
}

interface SearchResponse {
  results: SearchResult[];
  allResults: SearchResult[];
  keyTerms: string[];
  synonymExpanded: string[];
  dates?: Date[];
  busyPeriods?: any[];
  hasBusyPeriod: boolean;
}

interface TagSearchResult extends Knowledge {
  relevance: number;
}

// テスト用のクエリ
const TEST_QUERIES = [
  'オンライン予約はできますか？',
  '駐車場の料金について教えてください',
  '11月3日に利用したいのですが空きはありますか',
  'レクサスは駐車できますか',
  '国際線利用で朝帰国予定です',
  '5人乗りの車で行きたいのですが',
  '繁忙期の予約について',
  '予約のキャンセル方法を教えてください',
  '送迎バスの時間を知りたいです',
  '支払い方法は何がありますか'
];

/**
 * search_vectorの更新トリガーを改善する関数
 */
async function improveSearchVectorTrigger() {
  console.log('search_vectorの更新トリガーを改善します...');
  
  try {
    // 既存のトリガーを削除
    await prisma.$executeRaw`DROP TRIGGER IF EXISTS knowledge_vector_update ON "Knowledge"`;
    await prisma.$executeRaw`DROP FUNCTION IF EXISTS knowledge_search_trigger()`;
    
    // 改善されたトリガー関数を作成
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION knowledge_search_trigger() RETURNS trigger AS $$
      BEGIN
        -- 基本的な重み付きベクトル
        NEW.search_vector = 
          setweight(to_tsvector('japanese', COALESCE(NEW.question, '')), 'A') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.answer, '')), 'B') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.main_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.sub_category, '')), 'C') ||
          setweight(to_tsvector('japanese', COALESCE(NEW.detail_category, '')), 'C');
        
        -- 重要な単語を個別に追加（特に「オンライン」「駐車場」などの検出を改善）
        -- 質問と回答から重要な単語を抽出して追加
        IF NEW.question IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.question, ''), '[\\s,.。、]+', ' ', 'g')), 'A');
        END IF;
        
        IF NEW.answer IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.answer, ''), '[\\s,.。、]+', ' ', 'g')), 'B');
        END IF;
        
        -- カテゴリ情報を強化
        IF NEW.main_category IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.main_category, ''), '[\\s,.。、]+', ' ', 'g')), 'C');
        END IF;
        
        IF NEW.sub_category IS NOT NULL THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', regexp_replace(COALESCE(NEW.sub_category, ''), '[\\s,.。、]+', ' ', 'g')), 'C');
        END IF;
        
        -- 特定の重要キーワードを明示的に追加
        -- 「オンライン」「駐車場」などの重要な単語が検出されるように
        IF NEW.question ~* 'オンライン|駐車場|予約|キャンセル|料金|支払い|送迎|車種|サイズ' OR 
           NEW.answer ~* 'オンライン|駐車場|予約|キャンセル|料金|支払い|送迎|車種|サイズ' THEN
          NEW.search_vector = NEW.search_vector || 
            setweight(to_tsvector('japanese', 
              (CASE WHEN NEW.question ~* 'オンライン' OR NEW.answer ~* 'オンライン' THEN 'オンライン ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '駐車場' OR NEW.answer ~* '駐車場' THEN '駐車場 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '予約' OR NEW.answer ~* '予約' THEN '予約 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* 'キャンセル' OR NEW.answer ~* 'キャンセル' THEN 'キャンセル ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '料金' OR NEW.answer ~* '料金' THEN '料金 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '支払い' OR NEW.answer ~* '支払い' THEN '支払い ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '送迎' OR NEW.answer ~* '送迎' THEN '送迎 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* '車種' OR NEW.answer ~* '車種' THEN '車種 ' ELSE '' END) ||
              (CASE WHEN NEW.question ~* 'サイズ' OR NEW.answer ~* 'サイズ' THEN 'サイズ' ELSE '' END)
            ), 'A');
        END IF;
        
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `;
    
    // トリガーを再作成
    await prisma.$executeRaw`
      CREATE TRIGGER knowledge_vector_update
      BEFORE INSERT OR UPDATE ON "Knowledge"
      FOR EACH ROW
      EXECUTE FUNCTION knowledge_search_trigger();
    `;
    
    // 既存のレコードに対してsearch_vectorを更新
    const updateResult = await prisma.$executeRaw`
      UPDATE "Knowledge"
      SET "updatedAt" = NOW()
      WHERE id > 0
    `;
    console.log(`${updateResult}件のレコードを更新しました`);
    
    console.log('search_vectorの更新トリガーの改善が完了しました');
    return true;
  } catch (error) {
    console.error('search_vectorの更新トリガーの改善中にエラーが発生しました:', error);
    return false;
  }
}

/**
 * 日付検出・繁忙期チェック機能をテストする関数
 */
async function testDateDetection() {
  console.log('日付検出・繁忙期チェック機能をテストします...');
  
  try {
    // テスト用の繁忙期データを作成
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);
    
    const startDate = new Date(nextMonth);
    startDate.setDate(1);
    
    const endDate = new Date(nextMonth);
    endDate.setDate(7);
    
    // 既存の繁忙期データを確認
    const existingBusyPeriod = await prisma.seasonalInfo.findFirst({
      where: {
        info_type: 'busy_period',
        start_date: startDate,
        end_date: endDate
      }
    });
    
    // 繁忙期データがなければ作成
    if (!existingBusyPeriod) {
      await prisma.seasonalInfo.create({
        data: {
          info_type: 'busy_period',
          start_date: startDate,
          end_date: endDate,
          description: 'テスト用繁忙期'
        }
      });
      console.log('テスト用繁忙期データを作成しました');
    } else {
      console.log('テスト用繁忙期データは既に存在します');
    }
    
    // 日付検出のテスト
    const dateQueries = [
      `${nextMonth.getMonth() + 1}月3日に利用したいのですが`,
      '来月の最初の週に予約したい',
      '繁忙期に利用できますか'
    ];
    
    for (const query of dateQueries) {
      console.log(`クエリ: ${query}`);
      const dates = extractDatesFromText(query);
      console.log('検出された日付:', dates.map(d => formatDateToJapanese(d)));
      
      const busyPeriodResults = await checkBusyPeriods(dates);
      console.log('繁忙期チェック結果:', busyPeriodResults);
      console.log('---');
    }
    
    console.log('日付検出・繁忙期チェック機能のテストが完了しました');
    return true;
  } catch (error) {
    console.error('日付検出・繁忙期チェック機能のテスト中にエラーが発生しました:', error);
    return false;
  }
}

/**
 * タグ検索機能をテストする関数
 */
async function testTagSearch() {
  console.log('タグ検索機能をテストします...');
  
  try {
    // テスト用のタグを作成
    const tagNames = ['予約', '料金', '駐車場', 'キャンセル', '送迎'];
    
    for (const tagName of tagNames) {
      // タグが存在するか確認
      const existingTag = await prisma.tag.findFirst({
        where: { tag_name: tagName }
      });
      
      // タグがなければ作成
      if (!existingTag) {
        await prisma.tag.create({
          data: {
            tag_name: tagName,
            description: `${tagName}に関する情報`
          }
        });
        console.log(`タグ "${tagName}" を作成しました`);
      } else {
        console.log(`タグ "${tagName}" は既に存在します`);
      }
    }
    
    // タグ検索のテスト
    for (const query of TEST_QUERIES) {
      console.log(`クエリ: ${query}`);
      const results: TagSearchResult[] = await searchKnowledgeByTags([query]);
      console.log(`タグ検索結果: ${results.length}件`);
      
      if (results.length > 0) {
        console.log('上位3件:');
        results.slice(0, 3).forEach((result, index) => {
          console.log(`${index + 1}. [${result.main_category || 'なし'}/${result.sub_category || 'なし'}] ${result.question || '(質問なし)'} (関連度: ${result.relevance})`);
        });
      }
      console.log('---');
    }
    
    console.log('タグ検索機能のテストが完了しました');
    return true;
  } catch (error) {
    console.error('タグ検索機能のテスト中にエラーが発生しました:', error);
    return false;
  }
}

/**
 * 統合された検索機能をテストする関数
 */
async function testIntegratedSearch() {
  console.log('統合された検索機能をテストします...');
  
  try {
    for (const query of TEST_QUERIES) {
      console.log(`\nクエリ: ${query}`);
      
      const results: SearchResponse | null = await searchKnowledge(query);
      
      if (results?.results && results.results.length > 0) {
        console.log(`検索結果: ${results.results.length}件`);
        console.log('上位3件:');
        results.results.slice(0, 3).forEach((result, index) => {
          console.log(`${index + 1}. [${result.main_category || 'なし'}/${result.sub_category || 'なし'}] ${result.question || '(質問なし)'} (関連度: ${result.relevance || 0})`);
        });
        
        if (results.keyTerms.length > 0) {
          console.log('抽出キーワード:', results.keyTerms.join(', '));
        }
        
        if (results.synonymExpanded.length > 0) {
          console.log('同義語展開:', results.synonymExpanded.join(', '));
        }
        
        if (results.dates && results.dates.length > 0) {
          console.log('検出された日付:', results.dates.map(d => formatDateToJapanese(d)).join(', '));
        }
        
        if (results.hasBusyPeriod) {
          console.log('⚠️ 繁忙期が検出されました');
        }
      } else {
        console.log('検索結果なし');
      }
      console.log('---');
    }
    
    console.log('統合された検索機能のテストが完了しました');
    return true;
  } catch (error) {
    console.error('統合された検索機能のテスト中にエラーが発生しました:', error);
    return false;
  }
}

/**
 * メイン関数
 */
async function main() {
  console.log('検索精度向上のための最適化を開始します...');
  
  try {
    // 1. search_vectorの更新トリガーを改善
    const triggerResult = await improveSearchVectorTrigger();
    if (!triggerResult) {
      console.error('search_vectorの更新トリガーの改善に失敗しました');
      return;
    }
    
    // 2. 日付検出・繁忙期チェック機能をテスト
    const dateResult = await testDateDetection();
    if (!dateResult) {
      console.error('日付検出・繁忙期チェック機能のテストに失敗しました');
      return;
    }
    
    // 3. タグ検索機能をテスト
    const tagResult = await testTagSearch();
    if (!tagResult) {
      console.error('タグ検索機能のテストに失敗しました');
      return;
    }
    
    // 4. 統合された検索機能をテスト
    const searchResult = await testIntegratedSearch();
    if (!searchResult) {
      console.error('統合された検索機能のテストに失敗しました');
      return;
    }
    
    console.log('検索精度向上のための最適化が完了しました');
  } catch (error) {
    console.error('最適化中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
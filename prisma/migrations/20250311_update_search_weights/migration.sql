-- トリガー関数を更新して新しい重み付けスキームを適用
CREATE OR REPLACE FUNCTION knowledge_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.answer, '')), 'A') ||     -- 回答を最重要視
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.main_category, '')), 'B') ||  -- メインカテゴリを次に重要視
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.sub_category, '')), 'B') ||   -- サブカテゴリも同様に
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.detail_category, '')), 'B') || -- 詳細カテゴリも同様に
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.question, '')), 'C') ||     -- 質問は参考情報として
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.note, '')), 'D');          -- 備考は補足情報として
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 既存のレコードに対して全文検索ベクトルを更新
UPDATE "Knowledge"
SET question = question,
    answer = answer;

-- 同義語辞書の拡充
INSERT INTO "SearchSynonym" ("word", "synonym")
VALUES 
  -- 質問パターンの同義語
  ('予約', '予約方法'),
  ('予約', '予約手続き'),
  ('予約', 'リザーブ'),
  ('予約', '予約可能'),
  ('予約', '予約状況'),
  ('料金', '価格'),
  ('料金', '費用'),
  ('料金', 'コスト'),
  ('料金', '料金体系'),
  ('料金', '料金表'),
  ('駐車', '駐車場'),
  ('駐車', 'パーキング'),
  ('駐車', '駐車可能'),
  ('駐車', '駐車状況'),
  
  -- 質問形式の同義語
  ('できますか', '可能ですか'),
  ('できますか', '利用できますか'),
  ('できますか', '利用可能ですか'),
  ('いくらですか', '料金はいくらですか'),
  ('いくらですか', '費用はいくらですか'),
  ('いくらですか', '価格はいくらですか'),
  
  -- 時間表現の同義語
  ('1日', '24時間'),
  ('1日', '1泊'),
  ('1日', '1日間'),
  ('1週間', '7日間'),
  ('1週間', '1週'),
  ('1週間', '7日'),
  
  -- 場所表現の同義語
  ('国際線', 'インターナショナル'),
  ('国際線', '国際ターミナル'),
  ('国際線', '国際便'),
  ('国内線', 'ドメスティック'),
  ('国内線', '国内ターミナル'),
  ('国内線', '国内便')
ON CONFLICT DO NOTHING; 
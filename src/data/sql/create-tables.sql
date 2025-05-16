-- tag_synonymテーブルの作成
CREATE TABLE IF NOT EXISTS tag_synonym (
    id SERIAL PRIMARY KEY,
    tag_name VARCHAR(255) NOT NULL,
    synonym VARCHAR(255) NOT NULL,
    FOREIGN KEY (tag_name) REFERENCES tag(tag_name),
    UNIQUE(tag_name, synonym)
); 
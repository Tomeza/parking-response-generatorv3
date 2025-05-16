const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPostgresConfig() {
  try {
    // 利用可能なテキスト検索設定を確認
    console.log('利用可能なテキスト検索設定:');
    const tsConfigs = await prisma.$queryRaw`SELECT cfgname FROM pg_ts_config`;
    console.log(tsConfigs);
    
    // japanese設定の詳細を確認
    console.log('\njapanese設定の詳細:');
    try {
      const japaneseConfig = await prisma.$queryRaw`
        SELECT 
          tt.alias as token_type,
          dict.dictname as dictionary
        FROM
          pg_ts_config_map map
          JOIN pg_ts_config cfg ON map.mapcfg = cfg.oid
          JOIN pg_ts_parser prs ON cfg.cfgparser = prs.oid
          JOIN pg_ts_token_type tt ON map.maptokentype = tt.tokid
          JOIN pg_ts_dict dict ON map.mapdict = dict.oid
        WHERE
          cfg.cfgname = 'japanese'
        ORDER BY
          map.maptokentype, map.mapseqno
      `;
      console.log(japaneseConfig);
    } catch (e) {
      console.log('japanese設定の詳細取得エラー:', e.message);
    }
    
    // 簡単なテスト検索
    console.log('\n簡単なテスト検索:');
    const testQuery = '予約';
    
    // to_tsvectorの出力を確認
    const vectorTest = await prisma.$queryRaw`SELECT to_tsvector('japanese', ${testQuery}) as vector`;
    console.log('to_tsvector(japanese, 予約):', vectorTest);
    
    // plainto_tsqueryの出力を確認
    const queryTest = await prisma.$queryRaw`SELECT plainto_tsquery('japanese', ${testQuery}) as query`;
    console.log('plainto_tsquery(japanese, 予約):', queryTest);
    
    // テスト検索のデモ
    console.log('\nテスト検索のデモ:');
    const testSearch = await prisma.$queryRaw`
      SELECT 
        id, question, answer,
        ts_rank_cd(to_tsvector('japanese', answer), plainto_tsquery('japanese', ${testQuery})) as rank
      FROM 
        "Knowledge"
      WHERE 
        to_tsvector('japanese', answer) @@ plainto_tsquery('japanese', ${testQuery})
      LIMIT 3
    `;
    
    if (testSearch.length > 0) {
      console.log(`テスト検索 '${testQuery}' の結果:`, testSearch);
    } else {
      console.log(`テスト検索 '${testQuery}' の結果が見つかりませんでした`);
      
      // 代替の検索方法
      console.log('\n代替の検索方法でのテスト:');
      
      // simple to_tsqueryを使用した検索
      try {
        const altSearch = await prisma.$queryRaw`
          SELECT 
            id, question
          FROM 
            "Knowledge"
          WHERE 
            to_tsvector('japanese', answer) @@ to_tsquery('japanese', ${testQuery})
          LIMIT 1
        `;
        console.log('to_tsquery results:', altSearch);
      } catch (e) {
        console.log('代替検索エラー:', e.message);
      }
      
      // 拡張機能のステータスを確認
      console.log('\nPostgreSQLの日本語関連拡張機能:');
      const extensions = await prisma.$queryRaw`
        SELECT name, default_version, installed_version, comment
        FROM pg_available_extensions 
        WHERE name IN ('pg_trgm', 'pgroonga', 'pgstattuple', 'btree_gin')
      `;
      console.log(extensions);
    }
    
  } catch (e) {
    console.error('エラー:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkPostgresConfig(); 
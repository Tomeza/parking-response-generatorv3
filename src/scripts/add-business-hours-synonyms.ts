const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 営業時間関連の同義語を追加する関数
 */
async function addBusinessHoursSynonyms() {
  try {
    console.log("営業時間関連の同義語を追加中...");

    // 同義語のペアを定義
    const synonymPairs = [
      // 営業時間関連
      { word: '営業時間', synonym: '営業' },
      { word: '営業時間', synonym: '開店時間' },
      { word: '営業時間', synonym: '閉店時間' },
      { word: '営業時間', synonym: '営業日' },
      { word: '営業時間', synonym: '開店' },
      { word: '営業時間', synonym: '閉店' },
      { word: '営業時間', synonym: '何時から' },
      { word: '営業時間', synonym: '何時まで' },
      { word: '営業時間', synonym: '利用時間' },
      { word: '営業時間', synonym: '駐車時間' },
      { word: '営業時間', synonym: '営業開始' },
      { word: '営業時間', synonym: '営業終了' },
      { word: '営業時間', synonym: '深夜' },
      { word: '営業時間', synonym: '終日' },
      { word: '営業時間', synonym: '24時間' },
      
      // 営業日関連
      { word: '営業日', synonym: '休業日' },
      { word: '営業日', synonym: '休み' },
      { word: '営業日', synonym: '定休日' },
      { word: '営業日', synonym: '年中無休' },
      { word: '営業日', synonym: '土日営業' },
      { word: '営業日', synonym: '土曜営業' },
      { word: '営業日', synonym: '日曜営業' },
      { word: '営業日', synonym: '営業日時' },
      { word: '営業日', synonym: '営業時間' },
    ];

    // 既存の同義語をチェックし、存在しないものだけ追加
    for (const pair of synonymPairs) {
      const existingSynonym = await prisma.searchSynonym.findFirst({
        where: {
          word: pair.word,
          synonym: pair.synonym
        }
      });

      // 同義語が存在しない場合のみ追加
      if (!existingSynonym) {
        await prisma.searchSynonym.create({
          data: {
            word: pair.word,
            synonym: pair.synonym
          }
        });
        console.log(`同義語追加: ${pair.word} -> ${pair.synonym}`);
      } else {
        console.log(`同義語既存: ${pair.word} -> ${pair.synonym}`);
      }

      // 双方向の関係性も確認して追加
      if (pair.word !== pair.synonym) {
        const reverseExistingSynonym = await prisma.searchSynonym.findFirst({
          where: {
            word: pair.synonym,
            synonym: pair.word
          }
        });

        // 逆方向の同義語が存在しない場合のみ追加
        if (!reverseExistingSynonym) {
          await prisma.searchSynonym.create({
            data: {
              word: pair.synonym,
              synonym: pair.word
            }
          });
          console.log(`同義語追加(逆方向): ${pair.synonym} -> ${pair.word}`);
        } else {
          console.log(`同義語既存(逆方向): ${pair.synonym} -> ${pair.word}`);
        }
      }
    }

    console.log("営業時間関連の同義語の追加が完了しました");
  } catch (error) {
    console.error("営業時間関連の同義語の追加中にエラーが発生しました:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトの実行
addBusinessHoursSynonyms()
  .then(() => {
    console.log("処理が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }); 
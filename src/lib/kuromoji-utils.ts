import kuromoji from 'kuromoji';
import path from 'path';

// 形態素解析器の初期化
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

async function initializeTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  if (!tokenizer) {
    tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((resolve, reject) => {
      kuromoji.builder({ dicPath: path.join(process.cwd(), 'public/kuromoji/dict') })
        .build((err, tokenizer) => {
          if (err) reject(err);
          else resolve(tokenizer);
        });
    });
  }
  return tokenizer;
}

// 複合語を検出して結合する
function combineCompoundWords(tokens: kuromoji.IpadicFeatures[]): string[] {
  const keywords: string[] = [];
  let currentCompound = '';

  // 個別の単語も追加する
  tokens.forEach(token => {
    // 意味のある品詞のみを追加（助詞、助動詞などは除外）
    if (['名詞', '動詞', '形容詞', '形容動詞', '副詞'].includes(token.pos)) {
      keywords.push(token.surface_form);
    }
  });

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];

    // 複合語の条件をチェック
    const isCompound = next && (
      // 名詞 + 名詞
      (current.pos === '名詞' && next.pos === '名詞') ||
      // 形容詞 + 名詞
      (current.pos === '形容詞' && next.pos === '名詞') ||
      // 形容動詞 + 名詞
      (current.pos === '形容動詞' && next.pos === '名詞') ||
      // 動詞 + 名詞
      (current.pos === '動詞' && next.pos === '名詞') ||
      // 副詞 + 名詞
      (current.pos === '副詞' && next.pos === '名詞')
    );

    if (isCompound) {
      // 複合語の場合は結合
      currentCompound += current.surface_form;
    } else {
      // 単語の場合は個別に追加
      if (currentCompound) {
        currentCompound += current.surface_form;
        keywords.push(currentCompound);
        currentCompound = '';
      }
    }
  }

  // 最後の複合語を追加
  if (currentCompound) {
    keywords.push(currentCompound);
  }

  // 重複を削除して返す
  return Array.from(new Set(keywords));
}

// テキストから検索キーワードを生成
export async function generateSearchKeywords(text: string): Promise<string[]> {
  const tokenizer = await initializeTokenizer();
  const tokens = tokenizer.tokenize(text);
  return combineCompoundWords(tokens);
}

// テキストを形態素解析して、PostgreSQLのtsquery形式に変換
export async function generateTsQuery(text: string): Promise<string> {
  const keywords = await generateSearchKeywords(text);
  
  // キーワードが1つの場合はそのまま使用
  if (keywords.length === 1) {
    return `${keywords[0]}:*`;
  }
  
  // 複数のキーワードがある場合はOR条件で結合
  return keywords.map(keyword => `${keyword}:*`).join(' | ');
}

// テキストから正規表現パターンを生成
export async function generateRegexPattern(text: string): Promise<string> {
  const keywords = await generateSearchKeywords(text);
  return keywords.join('|');
} 
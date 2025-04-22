This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

# Parking Response Generator v3

## 実装フェーズ

### フェーズ4: 検索精度向上（完了）
- PostgreSQL全文検索の実装
  - tsvector/tsquery実装
  - 検索インデックス設定
  - 重み付け検索実装
- 高度なタグ検索機能
  - 複合タグ処理
  - 同義語テーブル連携
  - タグ階層構造
- ナレッジデータの充実
  - キャンセル関連ナレッジ追加
  - 営業時間関連ナレッジ追加
  - 特殊対応・クレーム関連ナレッジ追加
  - タグとシノニムの拡充

### フェーズ5: 管理機能（実装中）
- 管理画面基盤
  - 管理者認証実装
  - 管理画面レイアウト構築
  - タブナビゲーション実装
  - アクセス制御
- 回答履歴管理
  - 回答記録一覧表示実装
  - ソート・フィルター機能
  - 詳細表示機能
  - 検索機能
- ナレッジ管理
  - ナレッジエディタ実装
  - カテゴリ・タグ選択UI
  - CRUD操作実装
  - 即時検索反映
- システム管理
  - バックアップ機能実装
  - 復元機能実装
  - タグ・アラートワード管理
  - 繁忙期設定

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## データベース管理

Prisma Studioを使用してデータベースを管理できます：

```bash
npx prisma studio
```

ブラウザで [http://localhost:5555](http://localhost:5555) を開くと、データベースの内容を確認・編集できます。

## ナレッジデータの追加

新しいナレッジデータを追加するには、以下の手順に従います：

1. CSVファイルを `src/data/csv/production/` ディレクトリに配置
2. `import-data.ts` ファイルでCSVファイルのパスを更新
3. `npm run import-data` コマンドを実行してデータをインポート
4. `npm run import-tags` コマンドを実行してタグを関連付け

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 技術スタック
- Next.js
- PostgreSQL
- Prisma
- TypeScript

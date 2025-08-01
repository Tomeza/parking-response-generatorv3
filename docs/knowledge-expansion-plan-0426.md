# 駐車場サービス ナレッジ拡張計画 2024/04/26

## 現状の課題

網羅的検索テストの結果から、以下の課題が特定されました：

1. **旅行目的の駐車場情報の不足**
   - 「旅行に出かけるときに車を停めておける場所はありますか」→最高スコア4.57
   - 「送迎車の待機場所変更時の対応」という関連性の低い結果が返される
   - サービスの根幹となる基本情報が不足

2. **緊急時連絡に関するスコアリングの問題**
   - 「飛行機の遅れで到着が遅くなった場合の連絡方法」→スコア10.21
   - 情報自体は存在するが、特定の表現によってスコアが最適化されていない

## 改善アプローチ

### 1. ナレッジ拡張（優先度高）

特にサービスの基本となる情報を拡充する必要があります：

#### 追加すべき基本情報エントリ：

```
質問: 旅行に出かけるとき、車を停めておける場所はありますか？
回答: はい、当駐車場は旅行者のために空港近くに車を安全に駐車できるサービスを提供しています。国内線をご利用のお客様専用の駐車場で、ご旅行中のお車をお預かりし、空港まで送迎いたします。営業時間は朝5時から深夜0時までです。ご予約は事前にウェブサイトから行っていただく必要があります。
```

```
質問: 初めて利用する場合、どのような手順で駐車場を利用すればよいですか？
回答: 初めてご利用の方は、以下の手順に従ってください：
1. まずウェブサイトから希望日時の予約を行います
2. 予約時に車種や到着予定時間を入力します
3. 当日は予約時間の15分前までに駐車場にお越しください
4. 受付で予約番号をお伝えいただくと、スタッフが対応します
5. お車をお預けいただき、送迎車で空港まで約10分でお送りします
6. 帰着時は空港の指定場所から送迎車にご乗車いただき、駐車場までお送りします
なお、国内線専用となっておりますので、国際線をご利用の方はサービス対象外となります。
```

```
質問: 駐車場サービスの概要を教えてください
回答: 当駐車場サービスは、空港をご利用になる旅行者様向けの安全な駐車スペースと送迎サービスを提供しています。主なサービス内容は以下の通りです：
・空港近接の安全な駐車スペース確保
・空港までの送迎サービス（所要時間約10分）
・朝5時から深夜0時までの営業時間
・事前予約制（ウェブサイトから予約可能）
・国内線利用のお客様専用
・高級車・特定外車は保険の関係上お預かりできません
・最大6名までの送迎対応
まずはウェブサイトからご希望の日程をご予約ください。
```

### 2. スコアリング改善（第二段階）

飛行機遅延などの緊急連絡については、情報自体は存在するものの、スコアリングが最適化されていない問題があります：

- 各種クエリのバリエーションを追加したテストケースを作成
- ベクトル検索の重み付けパラメータの微調整
- PGroonga検索とベクトル検索のバランス見直し

## 実装計画

1. **ナレッジベース拡充（優先）**
   - 上記の基本情報エントリを追加
   - スコア5以下の検索結果が出るクエリを収集・グループ化
   - 特に「旅行」「出張」「初めて」などの基本キーワードに対応する知識を充実

2. **効果検証**
   - 追加後に再度検索テストを実行
   - 同一クエリでのスコア向上の確認

3. **スコアリング改善**
   - テスト結果に基づき重み付けパラメータを調整
   - より自然な表現バリエーションに対応できるようにする

## まとめ

現在のハイブリッド検索システムは基本的に機能していますが、特にサービスの基本となる情報（駐車場の基本的な利用目的、初めての方向けガイド）の不足が顕著です。

優先的にナレッジ拡張を行うことで、ユーザー体験を大幅に向上させることができます。その後、スコアリングの最適化を進めることで、さらに質の高い検索結果を提供することが可能になります。 
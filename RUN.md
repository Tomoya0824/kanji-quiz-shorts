# 自動投稿手順（スケジュール実行用）

1日1回（19:46 JST）実行し、クイズのショートを1本作って公開投稿する。ジャンルは複数あり、再生数のデータで配分を決める。上から順に実行する。

**Zapier は無料プラン（月100タスク）で運用する。** MCP 呼び出し1回＝2タスクなので月50回まで。
内訳の目安：投稿 1回/日（月30〜31回）＋ 再生数取得 週2回（月約9回）＝ 約40回。
`log.md` の各行末に `[zapier+N]`（その回の成功したZapier呼び出し回数）を付けて記録し、
当月（暦月）の合計が **44回以上** なら再生数の取得はしない（投稿を優先）。**48回以上** ならその月は投稿もせず「上限回避」と記録して終了する。

関連ファイル：
- `GENRES.md` … ジャンルごとの作り方とJSONのキー（**必ず読む**）
- `genre_plan.md` … 今日どのジャンルを作るかのルールと今週の予定
- `quizzes/NNN.json` … 出題データ（投稿後に `youtube_id` を書き込む）
- `stats.csv` … 再生数の記録
- `insights.md` … 分析結果と「次に試すこと」
- `log.md` … 実行ログ（`日付 NNN category 問題の要約 URL [zapier+N]`）

## 1. 準備
- リポジトリ `Tomoya0824/kanji-quiz-shorts` を clone（無ければ push 権限で接続してから）。
- `log.md` に今日の投稿済み行があれば何もせず終了（1日1本）。
- `log.md` の `[zapier+N]` を当月分合計し、上の上限ルールを確認する。
- `quizzes/` の最大番号 + 1 を今回の番号 `NNN`（3桁ゼロ埋め）とする。

## 2. 再生数の取得と分析（月曜と木曜のみ。それ以外は `insights.md` を読むだけ）
- `youtube_id` を持つ quiz を新しい順に最大50件集め、Zapier の YouTube `youtube_make_api_get_request`（action `_zap_raw_request`）で
  `GET https://www.googleapis.com/youtube/v3/videos`、querystring `part=statistics`、`id=カンマ区切り` を**1回だけ**呼ぶ。
- `stats.csv` に `取得日時,NNN,youtube_id,経過時間h,views,likes,comments` で追記。
- `insights.md` を書き直す：
  - 投稿72時間時点（近い値で可）の再生数で比較。72時間未満の動画は判断に使わない。
  - **ジャンル（category）ごと**の平均を最初に出し、次にジャンル内で `difficulty` / `genre` / `hook_type` / 曜日 ごとの傾向を見る。
  - いいね率・コメント率が高い動画も挙げる。
  - 最後に「次に試すこと」を3つ。データが少ないうちはそう明記する。
- **月曜**は `genre_plan.md` のルールに従って、探索期→最適化期への切り替え判定と「今週の予定」の更新も行う。

## 3. 今日のジャンルを決めて出題を作る（`quizzes/NNN.json`）
- `genre_plan.md` に従って今日の category を決める。
- `GENRES.md` のそのジャンルの定義を読み、共通キーをすべて埋める。
- `insights.md` を読み、そのジャンル内では約7割は伸びている型、約3割は新しい型を試す。
- 出題済みの `question` と重複・酷似するものは使わない。

## 4. 事実確認（必須）
- 答え・意味・由来/解説を、ジャンル定義に書かれた種類の信頼できる情報源で Web 検索して確認する。
- 確認できなければその問題は捨てて作り直す。誤答の選択肢が実は正しい、ということがないかも確認する。
- なぞなぞは「答えが一つに決まるか」「解説で納得できるか」を自分で厳しくチェックする。

## 5. 動画生成と確認
```
python3 make_short.py quizzes/NNN.json videos/NNN.mp4
```
- 0秒・2.5秒・7.5秒・10.5秒のフレームを切り出して目視確認（文字のはみ出し・豆腐文字・句読点だけの行が無いこと）。崩れたら文言を短くして作り直す。
- 動画は約12.4秒。0秒目から問題が全部見えている／カウント中に「A・B・Cでコメント」が出る／最後に冒頭の画面へ戻ってループする、が崩れていないこと。

## 6. push → YouTube 投稿
- `quizzes/NNN.json` と `videos/NNN.mp4` をコミットして main に push。
- Zapier: YouTube（`YouTubeV4CLIAPI`）`upload_video`
  - video: `https://raw.githubusercontent.com/Tomoya0824/kanji-quiz-shorts/main/videos/NNN.mp4`
  - title / description / tags は JSON から
  - privacy_status `public`, category_id `27`, made_for_kids `false`, default_language / default_audio_language `ja`, notify_subscribers `true`
  - push 直後でURLが取れず失敗したら、1分待って1回だけ再試行。
- 返ってきた動画IDを `quizzes/NNN.json` の `youtube_id` に書き込む。

## 7. 記録
- `log.md` に1行追記して、変更をすべて push。
- 失敗したらその日は投稿しない。理由を `log.md` に書いて終了（やり直しで2本上げない）。
- Zapier のタスク上限・YouTube の投稿上限に当たった場合は `log.md` に「上限」と明記する。

## 8. 本数について
Zapier 無料プランの範囲では1日1本が上限。本数は自動で増やさない。

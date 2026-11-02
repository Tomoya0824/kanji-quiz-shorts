# 自動投稿手順（スケジュール実行用）

1本 = 「難読漢字の読み3択クイズ」。1日1回（19:46 JST）実行する。上から順に実行する。

**Zapier は無料プラン（月100タスク）で運用する。** MCP 呼び出し1回＝2タスクなので月50回まで。
内訳の目安：投稿 1回/日（月30〜31回）＋ 再生数取得 週2回（月約9回）＝ 約40回。
`log.md` の各行末に `[zapier+N]`（その回の成功したZapier呼び出し回数）を付けて記録し、
当月（暦月）の合計が **44回以上** なら再生数の取得はしない（投稿を優先）。**48回以上** ならその月は投稿もせず「上限回避」と記録して終了する。

関連ファイル：
- `quizzes/NNN.json` … 出題データ（投稿後に `youtube_id` を書き込む）
- `stats.csv` … 再生数の記録（取得のたびに1行ずつ追記）
- `insights.md` … 分析結果と「次に試すこと」（毎晩更新）
- `log.md` … 実行ログ
- スケジュールタスクID：`trig_01V4JuSBHgStCU5D6zxyeLUh`

## 1. 準備
- リポジトリ `Tomoya0824/kanji-quiz-shorts` を clone（無ければ push 権限で接続してから）。
- `log.md` に今日の投稿済み行があれば何もせず終了（1日1本）。
- `log.md` の `[zapier+N]` を当月分合計し、上の上限ルールを確認する。
- `quizzes/` の最大番号 + 1 を今回の番号 `NNN`（3桁ゼロ埋め）とする。
- `quizzes/*.json` の `question` を全部読み、**出題済みの漢字は絶対に使わない**。

## 2. 再生数の取得と分析（月曜と木曜のみ。それ以外の日は `insights.md` を読むだけ）
Zapier はMCP呼び出し1回で2タスク消費するので、取得は1日1回・1呼び出しにまとめる。
- `youtube_id` を持つ quiz を新しい順に最大50件集め、Zapier の YouTube `youtube_make_api_get_request`（action `_zap_raw_request`）で
  `GET https://www.googleapis.com/youtube/v3/videos`、querystring `part=statistics`、`id=カンマ区切り` を1回だけ呼ぶ。
- 取得結果を `stats.csv` に `取得日時,NNN,youtube_id,投稿からの経過時間h,views,likes,comments` で追記。
- `insights.md` を書き直す：
  - 投稿から72時間時点（近い値で可）の再生数で比較する。投稿72時間未満の動画は判断に使わない。
  - `difficulty` / `genre` / `hook_type` / 曜日 / 漢字の文字数 ごとの平均を出し、伸びているパターン・伸びていないパターンを書く。
  - いいね率・コメント率が高い動画も挙げる（視聴者の反応の質）。
  - 最後に「次に試すこと」を3つ書く。データが10本未満のうちは「まだ判断材料が少ない」と明記し、偏らず色々試す。

## 3. 出題を作る（`quizzes/NNN.json`）
`quizzes/001.json` と同じキー構成で作る（`youtube_id` は投稿後に入れる）。
- **`insights.md` を読んでから決める**：約7割は伸びているパターンに寄せ、約3割はまだ試していないパターンを試す（偏りすぎると反復的に見えるため）。
- 題材：一般の大人が「見たことはあるが読めない」程度の難読漢字。1〜4文字。
- 難易度（やさしい〜超難読）と hook の型（「読める？」「意外と読めない」「9割が読めない」「読めたら天才」等）は日ごとに回して比較できるようにする。分析結果に応じて寄せてよい。
- 選択肢3つ。誤答は「それっぽいが明確に間違い」の読み。`answer_index` は0〜2で偏らせない。
- `meaning` 25字以内、`example` は「例：」で始まる25字以内の一文。
- `origin`（由来）40字以内：なぜその漢字・読みなのかを1文で。辞書や信頼できる解説で確認できたものだけ書く。諸説ある場合は「〜とされる」と書く。確認できなければ `origin` は省略する（捏造しない）。
- 分析用に `difficulty`（やさしい/標準/難しい/超難読）、`genre`（副詞・動植物・食べ物・体・道具・自然・その他 等）、`hook_type`（hookの型を短く）を必ず入れる。
- `cta` は「フォローで毎日1問 脳トレ！」のような**フォロー誘導**の短い一文（18字以内）。コメント誘導は動画側で自動表示されるので書かない。
- `title` は100字以内、`#漢字クイズ #shorts` を含める。直近10本と同じタイトル型を続けない。
- `description` / `tags` は 001 と同じ形式。説明文には由来も1行入れる。

## 4. 事実確認（必須）
- 読み・意味・由来を Web 検索で辞書サイト（コトバンク、goo辞書、Weblio 等）で確認する。
- 読みか意味が確認できなければその漢字は捨てて作り直す。
- 誤答の選択肢が「別の正しい読み」になっていないかも確認する。

## 5. 動画生成と確認
```
python3 make_short.py quizzes/NNN.json videos/NNN.mp4
```
- 0秒・2.5秒・7.5秒・10.5秒のフレームを切り出して目視確認（文字のはみ出し・豆腐文字が無いこと）。はみ出す場合は文言を短くして作り直す。
- 動画は約12.4秒。0秒目から問題が全部見えている／3秒カウント中に「A・B・Cでコメント」が出る／最後に冒頭の画面へ戻ってループする、の3点が崩れていないこと。

## 6. push → YouTube 投稿
- `quizzes/NNN.json` と `videos/NNN.mp4` をコミットして main に push。
- Zapier: YouTube（`YouTubeV4CLIAPI`）`upload_video`
  - video: `https://raw.githubusercontent.com/Tomoya0824/kanji-quiz-shorts/main/videos/NNN.mp4`
  - title / description / tags は JSON から
  - privacy_status `public`, category_id `27`, made_for_kids `false`, default_language / default_audio_language `ja`, notify_subscribers `true`
  - push 直後でURLが取れず失敗したら、1分待って1回だけ再試行。
- 返ってきた動画IDを `quizzes/NNN.json` の `youtube_id` に書き込む。

## 7. 記録
- `log.md` に `日付 NNN 漢字 URL [zapier+N]` を1行追記して、変更をすべて push。
- 失敗したらその回は投稿しない。理由を `log.md` に書いて終了（やり直しで2本上げない）。
- Zapier のタスク上限・YouTube の投稿上限に当たった場合は、`log.md` に「上限」と明記する。

## 8. 本数について
Zapier 無料プランの範囲では1日1本が上限。本数は自動で増やさない。
（増やすには Zapier を有料にするか、アップロード経路を Zapier 以外に変える必要がある）

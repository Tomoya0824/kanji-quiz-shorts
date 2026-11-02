# 毎日の自動投稿手順（スケジュール実行用）

1本 = 「難読漢字の読み3択クイズ」。以下を上から順に実行する。

## 1. 準備
- リポジトリ `Tomoya0824/kanji-quiz-shorts` を clone（無ければ push 権限で接続してから）。
- `quizzes/` の最大番号 + 1 を今回の番号 `NNN`（3桁ゼロ埋め）とする。
- `quizzes/*.json` の `question` を全部読み、**出題済みの漢字は絶対に使わない**。

## 2. 出題を作る（`quizzes/NNN.json`）
`quizzes/001.json` と同じキー構成で作る。
- 題材：一般の大人が「見たことはあるが読めない」程度の難読漢字（熟語・副詞・動植物名・地名以外の一般語）。1〜4文字。
- 選択肢3つ。誤答は「それっぽいが明確に間違い」の読み。正解の位置（`answer_index`）は0〜2で毎回ばらつかせる。
- `meaning` は短く（25字以内）、`example` は「例：」で始まる自然な一文（25字以内）。
- `hook` は「この漢字、読める？」を基本に、ときどき「9割が読めない漢字」「大人なら読みたい漢字」などに変える。
- `title` は「【読めたらすごい】「漢字」読める？ #漢字クイズ #shorts」の形（煽り文句は適宜変えてよい、100字以内）。
- `description` / `tags` は 001 と同じ形式で内容を合わせる。

## 3. 事実確認（必須）
- 読み方と意味を Web 検索で辞書サイト（コトバンク、goo辞書、Weblio 等）で確認する。
- 正しいと確認できなければその漢字は捨てて別の漢字で作り直す。
- 誤答の選択肢が「別の正しい読み」になっていないかも確認する。

## 4. 動画生成と確認
```
python3 make_short.py quizzes/NNN.json videos/NNN.mp4
```
- 1.5秒・5秒・10秒・14秒のフレームを切り出して目視確認（文字のはみ出し・豆腐文字が無いこと）。
- はみ出す場合は文言を短くして作り直す。

## 5. push
- `git add quizzes/NNN.json videos/NNN.mp4` してコミット・push（main）。

## 6. YouTube に投稿（Zapier: YouTubeV4CLIAPI / upload_video）
- video: `https://raw.githubusercontent.com/Tomoya0824/kanji-quiz-shorts/main/videos/NNN.mp4`
- title / description / tags は JSON から
- privacy_status: `public`, category_id: `27`, made_for_kids: `false`,
  default_language / default_audio_language: `ja`, notify_subscribers: `true`
- push 直後で URL が取得できずに失敗したら、1分待って1回だけ再試行。

## 7. 記録
- 投稿結果の動画URLを `log.md` に「日付 NNN 漢字 URL」の1行で追記し push。
- どこかで失敗して投稿できなかった場合は、理由を `log.md` に書いて終了（同じ日に2本上げない）。

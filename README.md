# kanji-quiz-shorts

毎日1問・クイズ系YouTubeショート（難読漢字・なぞなぞ・雑学 ほか）を自動生成するパイプライン。
ジャンルは `GENRES.md`、配分ルールは `genre_plan.md`、実行手順は `RUN.md`。

- `make_short.py` … `quizzes/NNN.json` から縦型動画（1080x1920, 約15秒）を生成
- `quizzes/` … 出題データ（出題済みの漢字は重複しないようここで管理）
- `videos/` … 生成済み動画（YouTubeへのアップロード元URLとして使用）

```
python3 make_short.py quizzes/001.json videos/001.mp4
```

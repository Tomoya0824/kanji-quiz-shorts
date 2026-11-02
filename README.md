# kanji-quiz-shorts

毎日1問・漢字クイズのYouTubeショートを自動生成するパイプライン。

- `make_short.py` … `quizzes/NNN.json` から縦型動画（1080x1920, 約15秒）を生成
- `quizzes/` … 出題データ（出題済みの漢字は重複しないようここで管理）
- `videos/` … 生成済み動画（YouTubeへのアップロード元URLとして使用）

```
python3 make_short.py quizzes/001.json videos/001.mp4
```

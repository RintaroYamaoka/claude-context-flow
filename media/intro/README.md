# context-flow 紹介動画(HyperFrames)

`../context-flow-intro.mp4` のソース。HTML を 1 フレームずつ描いて動画にする(HyperFrames)。作り方・見た目・語り口は claude-cockpit の `media/intro` と同じ。

```
node src/gen.mjs                                  # src/scenes/*.html(各 scene の markup + GSAP script)を生成
<venv>/bin/python narrate.py                      # 台本 → 声(Kokoro jf_alpha)→ 声の長さに場面を伸ばす → src/scenes-timed, index.html, assets/mix.wav
SCENES=src/scenes-timed node build.mjs            # compositions/*.html(chrome.css + lib.js + pane.js を inline)
npx hyperframes@0.9.26 check --json
npx hyperframes@0.9.26 render --output out/context-flow-intro.mp4
# GitHub の画面から上げて README に埋め込むので 10MB 未満にする(書き出しのままだと超える)
ffmpeg -y -i out/context-flow-intro.mp4 -c:v libx264 -preset slow -b:v 560k -maxrate 900k -bufsize 1800k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart ../context-flow-intro.mp4
```

- `<venv>` は kokoro-onnx / pyopenjtalk / misaki[ja] / unidic-lite / soundfile / numpy の入った Python(3.12 で確認)。リポジトリの外に作る:
  `uv venv --python 3.12 v && uv pip install --python v/bin/python kokoro-onnx pyopenjtalk "misaki[ja]" unidic-lite soundfile numpy && uv pip uninstall --python v/bin/python unidic`
  (`misaki[ja]` が `unidic` を連れてくる。入ったままだと辞書が無くて MeCab の初期化で落ちるので、外して `unidic-lite` だけにする)。モデルは `~/.cache/hyperframes/tts/`。
- 台本と場面の尺は `narrate.py` の `SC`。字幕・左のトランスクリプト・会話の中身(`SESSION`:ターン、章の区切り `seg1` / `seg2`、決まったこと・残っていること)・出来事の時刻(`ev("名前", 秒)`)は `src/gen.mjs`。見た目の数字は `SPEC.md`。
- 右のペインは `src/pane.js` が描く。mod の `context-flow/hooks/ui/pane.tsx`(ペイン)・`ui/splash.tsx`(起動アニメーション)・`domain/flow.ts`(章 → 行、「いま」の行、窓)・`domain/color.ts`(虹・光の帯・波形・背景の配色)・`domain/text.ts` の式を移したもので、行の並び・文言・記号・色は実物と同じ。**mod の描画を変えたら、pane.js も同じように直す。**(合わせてあるのは main の fb0ea87 = 既定の背景が none の版。)
- ペインは時刻の関数。`ev()` の時刻を通しの表 `G` にまとめ、`cfWorld(SESSION, G, 時刻)` が状態(計器・目的・決まったこと・ターンと章・いま・サブエージェント・スクロール・起動の時刻・配色)を、`cfLayout` が 30 行を返す。実物と同じく毎フレーム描く(コマ番号 = 時刻 / 200 ms の小数)。`narrate.py` が声に合わせて `ev()` の時刻も動かし、`G` と場面の開始 `T0` を各 scene に書き戻す。起動アニメーションは `open` の時刻から実時間で 2.6 秒(声で伸びない)。
- 音源:Drift – Minimal / PodcastAC(CC BY)、効果音 3 つ(`assets/audio/`)。
- 生成物(コミットしない。`.gitignore` 済み):`out/`・`_vo/`・`_*.json`・`render.log`・`assets/mix.wav`・`.hyperframes/`・`node_modules/`・`__pycache__/`。

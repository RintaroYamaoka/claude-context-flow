# context-flow 紹介動画(HyperFrames)

`../context-flow-intro.mp4` のソース。HTML を 1 フレームずつ描いて動画にする(HyperFrames)。作り方・見た目・語り口は claude-cockpit の `media/intro` と同じ。

```
node src/gen.mjs                                  # src/scenes/*.html(各 scene の markup + GSAP script)を生成
<venv>/bin/python narrate.py                      # 台本 → 声(Kokoro jf_alpha)→ 声の長さに場面を伸ばす → src/scenes-timed, index.html, assets/mix.wav
SCENES=src/scenes-timed node build.mjs            # compositions/*.html(chrome.css + lib.js + pane.js を inline)
npx hyperframes@0.9.26 check --json
npx hyperframes@0.9.26 render --output out/context-flow-intro.mp4
cp out/context-flow-intro.mp4 ../context-flow-intro.mp4
```

- `<venv>` は kokoro-onnx / pyopenjtalk / misaki[ja] / unidic-lite / soundfile / numpy の入った Python(3.12 で確認。`uv venv --python 3.12 v && uv pip install --python v/bin/python kokoro-onnx pyopenjtalk "misaki[ja]" unidic-lite soundfile numpy`。`unidic` が入っていると辞書の取得を求められて落ちるので、`unidic-lite` だけにする)。モデルは `~/.cache/hyperframes/tts/`。
- 台本と場面の尺は `narrate.py` の `SC`。字幕・左のトランスクリプト・会話の中身(`SESSION`)・出来事の時刻(`ev("名前", 秒)`)は `src/gen.mjs`。見た目の数字は `SPEC.md`。
- 右のペインは `src/pane.js` が描く。`context-flow/hooks/register.tsx` の `ui.render`(Pane)を移したもので、行の並び・文言・記号・虹の式・コマの刻み(80 ms、待機中は 960 ms)は実物と同じ。**register.tsx の描画を変えたら、pane.js も同じように直す。**
- ペインは時刻の関数。`ev()` の時刻を通しの表 `G` にまとめ、`cfWorld(SESSION, G, 時刻)` が状態を、`cfLayout` が 24 行を返す。`narrate.py` が声に合わせて `ev()` の時刻も動かし、`G` と場面の開始 `T0` を各 scene に書き戻す。
- 音源:Drift – Minimal / PodcastAC(CC BY)、効果音 3 つ(`assets/audio/`)。
- 生成物(コミットしない。`.gitignore` 済み):`out/`・`_vo/`・`_*.json`・`render.log`・`assets/mix.wav`・`.hyperframes/`・`node_modules/`・`__pycache__/`。

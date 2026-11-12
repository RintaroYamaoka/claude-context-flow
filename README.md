# claude-context-flow

長いセッションでも、話の流れを見失わない。Claude Code の mod。

セッションが長くなると、いま何の話をしていて、ここまで何が決まったのかが、スクロールの向こうに消えていく。
context-flow は、その「会話の流れ」をチャットの横に 1 枚で出し続ける。左の Claude Code は素のまま。


https://github.com/user-attachments/assets/e4361666-6949-4b06-b985-c281294a8a9a


```
  F A B L E   5 . 2          84.2k / 200k  42%
  ━━━━━━━━━━━━━━━━━──────────────────────────

  目的
  API の入力チェックを zod に置き換える

  決まったこと
  ✓ 検証は zod、型はスキーマから導出
  ✓ エラーは { code, message } でそろえる
  残っていること
  · README に入力のルールを書く

  流れ                              9 ターン目

  ●  現状の調査                           #1-2
  ┃
  ●  zod への置き換え                     #3-4
  ┣━━○ 落ちたテストの修正                 #5-6
  ┣━━○ lint の手直し                        #7
  ┃
  ◉  エラー応答の統一                      #8-
  ┃  · 返し方がバラバラな箇所の洗い出し     #8
  ┃
  ◉  メッセージを日本語にして             0:42
  ┆  · Read schema.ts
  ┆  ❯ Edit messages.ts                ▂▅▇▄▁▃
```

## 見えるもの

- **流れ** — 本筋と寄り道。太い縦線が本筋で、節(`●`)が話の段階。手直し・やり直し・脱線は、線から右へ出る枝(`○`)になる。いまの節だけターンの見出しまで開き、説明が出るのは最新の 1 件だけ。
- **決まったこと・残っていること** — ここまでに決まったこと・出来上がったものと、まだ終わっていないことを、短い箇条書きで。
- **目的** — セッション全体で何をしようとしているかの 1 文。話がずれると直る。
- **いま** — 送った瞬間に出て、実行中のツールとサブエージェントが流れる。経過時間つき。
- **計器** — モデルとコンテキスト量。70% で琥珀、85% で赤。

色は Claude Code 本体の虹(テーマの `rainbow_*`)と同じ 7 色。
色が文字の上をなめらかに流れ続け、その上を明るい帯が走る。過去のターンの文字は白と薄い灰色だけ。

上(計器・目的・決まったこと)と下(いま)は固定で、スクロールするのは間の流れだけ。
節・枝・見出しを押すと、左のトランスクリプトがその発言まで飛ぶ。
節の分け方と、本筋か寄り道かは、ターンが終わるたびに Haiku が決める(書くのは会話の中身だけ)。
途中から入れても、それまでの会話から流れを起こす。設定は無い。

## インストール

Claude Code のプロンプトで:

```
/plugin install context-flow --marketplace rintaroyamaoka/claude-context-flow
```

シェルから:

```
claude plugin install context-flow --marketplace rintaroyamaoka/claude-context-flow
```

`Add marketplace?` に `y`、scope は user を選ぶ。
デスクトップアプリでは、プロンプト欄の横の + → Plugins → Add marketplace に `rintaroyamaoka/claude-context-flow` → Add plugin。

ペインは自動で開く。閉じたあと・端末の幅が狭くて出なかったときは `/context-flow`。
セッションの開始時と、ほかのペインのタブから切り替えたときに、起動アニメーションが流れる(`/context-flow boot` でもう一度)。

背景は、ペイン全体を一色で塗る。配色は `/context-flow bg <名前>` で変えられる(名前なしで次の配色へ。選んだものは次のセッションにも残る)。

| 名前 | 配色 |
| --- | --- |
| `sumi` | 墨(既定) |
| `navy` | 濃紺 |
| `murasaki` | 紫 |
| `mori` | 深緑 |
| `akane` | 茜 |
| `yoake` | 夜明け(暗い紫紺) |
| `umi` | 深海 |
| `none` | 背景なし |

## 知っておくこと

- **要約は Haiku を呼ぶ。** ターンが終わるたびに 1 回、直近の依頼と返答(それぞれ先頭 1,500 字まで)を渡す。セッションと同じ認証で課金される。
- **見出しを押して飛べるのは、フルスクリーン表示の端末だけ。** 飛び先は、その発言の行が一度画面に描かれたときに覚える。
- **返答の前に中断して言い直した発言は、1 ターンにまとめる。** Claude Code 本体のプロンプト数より少なく出ることがある。
- **サブエージェントの動きは流れに入れない。** 走っている間だけ、下の「いま」に出る。
- `/clear` で流れは消える。mod の API は early access で、Claude Code の更新で動かなくなることがある。

## 開発

```
claude --plugin-dir ./context-flow        # そのセッションだけ読み込む(保存で再読み込み)
claude plugin validate ./context-flow     # manifest と hooks module の検証
claude plugin test ./context-flow         # 単体テストと、ペインを描くテスト
npm run typecheck                         # tsc --noEmit(型は読み込み時にエンジンが置く)
```

コードは `context-flow/hooks/` にある。`register.tsx` が配線、`store.ts` が状態、`domain/` が純粋なロジック、`app/` がエンジンを呼ぶ処理、`ui/` が描画。

紹介動画のソースは [media/intro](./media/intro)(HyperFrames)。ペインの描き方を変えたら `media/intro/src/pane.js` も直す。

## ライセンス

MIT

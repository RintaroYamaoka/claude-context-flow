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

  流れ                              4 ターン目

  ○  現状の調査                             #1
  │  入力チェックの場所を尋ね、3 か所と分かった
  │
  ○  zod への置き換え                       #2
  │  手書きの検証を zod に替え、型も導出に変更
  │
  ○  テストの修正                           #3
  │  落ちた 2 件を直し、境界値のテストを追加
  │
  ◉  エラーメッセージを日本語にして       0:42
  ┆  · Read schema.ts
  ┆  ❯ Edit messages.ts                ▂▅▇▄▁▃
```

## 見えるもの

- **流れ** — 1 ターンを「見出し+説明」にして古い順に並べる。何を頼み、どうなったか。書くのは会話の中身だけで、ターンが終わるたびに Haiku が要約する。
- **目的** — セッション全体で何をしようとしているかの 1 文。話がずれると直る。
- **いま** — 送った瞬間に出て、実行中のツールとサブエージェントが流れる。経過時間つき。
- **計器** — モデルとコンテキスト量。70% で琥珀、85% で赤。

上(計器・目的)と下(いま)は固定で、スクロールするのは間の年表だけ。
見出しを押すと、左のトランスクリプトがそのターンを始めた発言まで飛ぶ。
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
npm run typecheck                         # tsc --noEmit(型は読み込み時にエンジンが置く)
```

紹介動画のソースは [media/intro](./media/intro)(HyperFrames)。ペインの描き方を変えたら `media/intro/src/pane.js` も直す。

## ライセンス

MIT

// src/gen.mjs — src/scenes/*.html を生成する。
// 右のペインは src/pane.js(register.tsx の ui.render を移したもの)が時刻から描く。ここで決めるのは、会話の中身(SESSION)・左のトランスクリプト・字幕・出来事の時刻(ev)。
import fs from 'node:fs';
const CF = new Function(fs.readFileSync('src/pane.js', 'utf8') + '; return { cfWorld, cfLayout, cfRainbow, CF_COLS, CF_ROWS };')();
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jp = html => html.replace(/[⺀-￿]+/g, m => `<i class="w" data-layout-allow-occlusion data-layout-allow-overflow>${m}</i>`); // 全角は 2 桁ぶんの幅

// ---------- 会話の中身(架空の orders-api。注文 API にバリデーションを足すセッション)
const SESSION = {
  model: 'Fable 5.2', tokens: 84200, window: 200000,
  goal1: '注文 API に入力バリデーションを足す',
  goal2: '注文 API の入力検証と、エラー応答の統一',
  past: [
    { prompt: 'POST /orders の入力って、今どこで検証してる?', title: '現状の確認', summary: 'POST /orders の入力処理を調べ、検証が無いと確認した。' },
    { prompt: 'zod で入口に検証を入れたい。方針を出して。', title: '方針の決定', summary: 'zod のスキーマをハンドラの入口で通す方針に決めた。' },
    { prompt: 'じゃあスキーマから書いて。', title: 'スキーマの追加', summary: 'OrderSchema を schemas/order.ts に作り、型を infer で出した。' },
    { prompt: 'POST /orders に組み込んで。', title: 'ハンドラへの組み込み', summary: 'POST /orders で safeParse を通し、失敗は 400 を返すようにした。' },
    { prompt: 'テストも足して。', title: 'テストの追加', summary: '不正な数量と欠けた項目のテストを足し、すべて通った。' },
    { prompt: '日付は ISO 8601 だけ受けたい。', title: '日付の形式', summary: '納期を ISO 8601 に限り、過去の日付は弾くようにした。' },
    { prompt: '型エラーが出てる。', title: '型エラーの修正', summary: 'infer した型とハンドラの型のずれを直し、tsc が通った。' },
    { prompt: 'PATCH /orders/:id にも同じ検証を。', title: 'PATCH への展開', summary: 'OrderSchema.partial() を PATCH に使い、テストを足した。' },
    { prompt: '数量に上限を付けて。999 まで。', title: '数量の上限', summary: '数量の上限を 999 に決め、スキーマとテストに入れた。' },
    { prompt: 'README に入力のルールを書いておいて。', title: 'README の更新', summary: '項目ごとの型と範囲を、表にして README に足した。' },
    { prompt: 'lint が怒ってる。直して。', title: 'lint の修正', summary: '使っていない import を 3 つ消し、lint が通った。' },
    { prompt: 'CI が落ちてる。原因を見て。', title: 'CI の失敗の調査', summary: '下限を変えた時の直し漏れが原因。テストを合わせた。' },
  ],
  turn: {
    prompt: 'エラーの返し方がバラバラ。全エンドポイントで同じ形にそろえて。', title: 'エラー応答の統一',
    summary: '全エンドポイントのエラーを { code, message, fields } にそろえた。',
    // actionOf(tool.call)と同じ形:ツール名 + description / パスの末尾 2 段 / pattern
    actions: [
      { at: 'a1', text: 'Read routes/orders.ts' }, { at: 'a2', text: 'Grep res.status' },
      { at: 'a3', text: 'Agent エラーを返す箇所を探す' }, { at: 'a4', text: 'Agent テストの期待値を直す' },
      { at: 'a5', text: 'Write lib/errors.ts' }, { at: 'a6', text: 'Edit routes/orders.ts' }, { at: 'a7', text: 'Bash テストを実行' },
    ],
    subs: [
      { type: 'Explore', description: 'エラーを返す箇所を探す', from: 's1', to: 'e1',
        actions: [{ at: 's1a', text: 'Grep res.status' }, { at: 's1b', text: 'Read routes/users.ts' }, { at: 's1c', text: 'Grep throw new' }, { at: 's1d', text: 'Read routes/items.ts' }] },
      { type: 'general-purpose', description: 'テストの期待値を直す', from: 's2', to: 'e2',
        actions: [{ at: 's2a', text: 'Read tests/orders.test.ts' }, { at: 's2b', text: 'Edit tests/orders.test.ts' }, { at: 's2c', text: 'Bash 関連テストを実行' }] },
    ],
  },
  // コンテキスト量:ツールが返るたびに増える
  grow: [['a1', 2100], ['a2', 400], ['a3', 300], ['a4', 300], ['e1', 1800], ['e2', 1300], ['a5', 900], ['a6', 700], ['a7', 600], ['done', 500]],
  // 流れの窓のホイール(+ でさかのぼる)
  wheel: [['wu1', 2], ['wu2', 2], ['wu3', 2], ['wu4', 2], ['wu5', 2], ['wd1', -2], ['wd2', -2], ['wd3', -2], ['wd4', -2], ['wd5', -2]],
};

// ---------- 左:Claude Code のトランスクリプト(素のまま)
const O = `<span class="ok" data-layout-allow-occlusion>●</span>`, N = `<span class="now" data-layout-allow-occlusion>●</span>`;
const you = t => `<span class="dim">></span> ${t}`;
const say = t => `${N} ${t}`, more = t => `  ${t}`;
const tool = (name, arg) => `${O} <span class="b">${name}</span>(${esc(arg)})`;
const res = t => `  <span class="dim">⎿  ${esc(t)}</span>`;
const ROWS = [
  ['p9', you('数量に上限を付けて。999 まで。')], [null, ' '],
  [null, say('OrderSchema の quantity に max(999) を足します。')], [null, ' '],
  [null, tool('Update', 'src/schemas/order.ts')], [null, res('Updated src/schemas/order.ts with 1 addition and 1 removal')], [null, ' '],
  [null, tool('Update', 'tests/orders.test.ts')], [null, res('Updated tests/orders.test.ts with 6 additions')], [null, ' '],
  [null, say('上限 999 を入れ、1000 を弾くテストを足しました。')], [null, ' '],
  ['p10', you('README に入力のルールを書いておいて。')], [null, ' '],
  [null, tool('Update', 'README.md')], [null, res('Updated README.md with 14 additions')], [null, ' '],
  [null, say('項目ごとの型と範囲を、表にして README に足しました。')], [null, ' '],
  ['p11', you('lint が怒ってる。直して。')], [null, ' '],
  [null, tool('Bash', 'npm run lint')], [null, res('✖ 3 problems (3 errors, 0 warnings)')], [null, ' '],
  [null, tool('Update', 'src/routes/orders.ts')], [null, res('Updated src/routes/orders.ts with 3 removals')], [null, ' '],
  [null, say('使っていない import を 3 つ消しました。lint は通っています。')], [null, ' '],
  ['p12', you('CI が落ちてる。原因を見て。')], [null, ' '],
  [null, tool('Bash', 'gh run view --log-failed')], [null, res('FAIL tests/orders.test.ts > rejects quantity 0')], [null, ' '],
  [null, tool('Update', 'tests/orders.test.ts')], [null, res('Updated tests/orders.test.ts with 2 additions and 2 removals')], [null, ' '],
  [null, tool('Bash', 'npm test')], [null, res('Tests  42 passed (42)')], [null, ' '],
  [null, say('数量の下限を 1 にした時に、テストを直していませんでした。')], [null, more('新しい仕様に合わせ、42 件すべて通っています。')], [null, ' '],
  // ここから 13 ターン目(動画の中で送る)
  ['p13', you(SESSION.turn.prompt)], ['x0', ' '],
  ['i13', say('まず、エラーを返している箇所を洗い出します。')], ['x1', ' '],
  ['r0', tool('Read', 'src/routes/orders.ts')], ['r1', res('Read 86 lines')], ['x2', ' '],
  ['g0', tool('Search', 'pattern: "res.status"')], ['g1', res('Found 9 lines across 4 files')], ['x3', ' '],
  ['ag0', tool('Explore', 'エラーを返す箇所を探す')], ['ag1', res('Done (9 tool uses · 21.4k tokens · 18s)')], ['x4', ' '],
  ['ah0', tool('general-purpose', 'テストの期待値を直す')], ['ah1', res('Done (7 tool uses · 16.0k tokens · 24s)')], ['x5', ' '],
  ['w0', tool('Write', 'src/lib/errors.ts')], ['w1', res('Wrote 24 lines to src/lib/errors.ts')], ['x6', ' '],
  ['u0', tool('Update', 'src/routes/orders.ts')], ['u1', res('Updated src/routes/orders.ts with 4 additions and 9 removals')], ['x7', ' '],
  ['b0', tool('Bash', 'npm test')], ['b1', res('Tests  42 passed (42)')], ['x8', ' '],
  ['f0', say('エラーは { code, message, fields } の形にそろえました。')], ['f1', more('4 つのエンドポイントとテストを直し、42 件通っています。')],
];
const idx = id => ROWS.findIndex(r => r[0] === id);
const VIS = 21; // 見えている行数(630px / 30px)
const yFor = shown => -Math.max(0, shown - VIS) * 30; // shown 行目までが下端に来る位置
const FIRST13 = idx('p13');
/** shown: 最初から見えている行数。それ以降は opacity 0 で置いておく */
function transcript(P, { full = false, shown = FIRST13 - 1, y = yFor(shown), typed = null, hidden = [] } = {}) {
  return `<div class="tx${full ? ' full' : ''}" id="${P}-tx" data-layout-allow-overlap><div class="txs"><div class="txin" id="${P}-txin" data-y="${y}" data-layout-allow-overflow>`
    + ROWS.map(([id, h], i) => `<div class="ln" data-layout-allow-occlusion data-layout-allow-overflow${id ? ` id="${P}-${id}"` : ''}${i >= shown || hidden.includes(id) ? ' style="opacity:0"' : ''}>${jp(h).replace(/<span /g, '<span data-layout-allow-occlusion data-layout-allow-overflow ')}</div>`).join('\n')
    + `</div></div><div class="txb"><div class="ln"><span class="dim" id="${P}-hr">${'─'.repeat(full ? 137 : 74)}</span></div><div class="ln"><span class="dim">></span> ${typed ? `<span id="${P}-typed" data-type="${typed}"></span>` : ''}<span class="cur" id="${P}-cur"></span></div><div class="ln"><span class="dim">  ? for shortcuts</span></div></div></div>`;
}
const win = (P, inner) => `<div class="win" id="${P}-win"><div class="titlebar" data-layout-allow-occlusion><span class="d r"></span><span class="d y"></span><span class="d g"></span><span class="ttl">orders-api — claude</span></div><div class="body" id="${P}-body">${inner}</div></div>`;
const paneBox = (P, style = '') => `<div class="cp" id="${P}-cp" data-layout-allow-overlap data-layout-allow-overflow${style ? ` style="${style}"` : ''}></div>`;
const cap = (id, parts) => `<p class="cap" id="${id}">${parts.map(p => p.startsWith('*') ? `<span class="ac">${p.slice(1)}</span>` : `<span>${p}</span>`).join('')}</p>`;
const sub = (id, parts) => `<p class="sub" id="${id}">${parts.map(p => `<span>${p}</span>`).join('')}</p>`;
const lab = (id, text, { x, y, ac = false }) => `<div class="lab${ac ? ' ac' : ''}" id="${id}" style="right:${1920 - x}px;top:${y}px">${text} ▸</div>`;
const chip = (id, text, { x, y }) => `<div class="chip" id="${id}" style="left:${x}px;top:${y}px"><span class="tk"></span>${text}</div>`;
const ptr = id => `<svg class="ptr" id="${id}" viewBox="0 0 28 36"><path d="M2 2 L2 28 L9 21 L14 33 L19 31 L14 19 L24 19 Z" fill="#fff" stroke="#1b1b1f" stroke-width="2" stroke-linejoin="round"/></svg>`;

const ROWY = r => 112 + r * 30;  // ペインの r 行目の frame 上の y
const LABX = 1036;               // ラベルの右端(仕切り x=1044 の左)
const PANEX = 120 + 925 + 24;    // ペインの文字の左端
const COLW = 12;                 // 1 桁の幅

// ---------- ペインの行の位置(ラベルを置く行を、実際の描画から求める)
const G_IDLE = { open: 0, sumA: 0, sumB: 1 };                               // 12 ターン・待機中
const G_RUN = { ...G_IDLE, send: 50, a1: 51, a2: 52, a3: 53, a4: 54, a5: 55, a6: 56, a7: 57 }; // 13 ターン目が走っている
const G_DONE = { ...G_IDLE, send: 50, done: 60, sumT: 61 };                 // 13 ターン・待機中
const rowsAt = (G, g) => CF.cfLayout(CF.cfWorld(SESSION, G, g), CF.CF_COLS, CF.CF_ROWS);
const rowOf = (rows, f) => { const i = rows.findIndex(r => f(r.meta)); if (i < 0) throw new Error('row not found'); return i; };

const scenes = [];
const scene = (id, dur, markup, script) => scenes.push({ id, dur, markup, script });
const dimTx = (P, at) => `tl.to("#${P}-tx",{opacity:0.14,duration:0.4,ease:"power2.inOut"},${at});`;
const undimTx = (P, at) => `tl.to("#${P}-tx",{opacity:1,duration:0.4,ease:"power2.inOut"},${at});`;
const TXY = P => `gsap.set("#${P}-txin",{y:+document.querySelector("#${P}-txin").getAttribute("data-y")});`;
const HEAD = P => `/*CF*/\n${TXY(P)}\ncfDrive("#${P}-cp",D,G,T0,tl);`;
/** 行を出して、下端まで送る */
const appear = (P, ids, t) => { const last = Math.max(...ids.map(idx)) + 1;
  return ids.map((id, i) => `rise("#${P}-${id}",${(t + i * 0.3).toFixed(2)},tl,8);`).join(' ') + ` scrollTo("#${P}-txin",${t.toFixed(2)},tl,${yFor(last)});`; };

// ===== 1 hook(8 s):長いセッション。流れていって、見失う
{
  const P = 'hk';
  scene('hook', 8, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="8" data-track-index="0">
${win(P, transcript(P, { full: true, y: 0 }))}
${cap(`${P}-c1`, ['セッションが長くなると、', '*流れを見失う', '。'])}
${sub(`${P}-s1`, ['A long session scrolls away.'])}
${cap(`${P}-c2`, ['いま何の話で、', '*何が決まった', 'のか。'])}
${sub(`${P}-s2`, ['What are we on now, and what has been decided? You have to scroll back.'])}
</div>`, `
${TXY(P)}
blink("#${P}-cur",0.2,7.9,tl);
words("#${P}-c1",0.6,tl,0.1); words("#${P}-s1",1.0,tl,0.05);
tl.to("#${P}-txin",{y:${yFor(FIRST13 - 1)},duration:2.6,ease:"steps(${FIRST13 - 1 - VIS})"},0.5);
unwords("#${P}-c1",3.4,tl); unwords("#${P}-s1",3.4,tl);
words("#${P}-c2",3.8,tl,0.1); words("#${P}-s2",4.2,tl,0.05);
flip("#${P}-tx",4.4,tl,{opacity:1},{opacity:0.45},0.5,"power2.inOut");
flip("#${P}-tx",7.0,tl,{opacity:0.45},{opacity:1},0.4,"power2.inOut");
unwords("#${P}-c2",7.6,tl); unwords("#${P}-s2",7.6,tl);
`);
}

// ===== 2 reveal(9 s):窓が割れて右に 1 枚。途中から入れても、それまでの会話から流れを起こす
{
  const P = 'rv';
  scene('reveal', 9, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="9" data-track-index="0">
${win(P, transcript(P, { full: true }) + `<div class="vr" id="${P}-vr" style="opacity:0"></div>` + paneBox(P, 'opacity:0'))}
${cap(`${P}-c1`, ['*context-flow', ' ― 右に 1 枚。'])}
${sub(`${P}-s1`, ['context-flow: one pane on the right. Claude Code on the left is untouched.'])}
${cap(`${P}-c2`, ['途中から入れても、', '*流れを起こす', '。'])}
${sub(`${P}-s2`, ['Added mid-session, it rebuilds the flow from the conversation so far.'])}
</div>`, `
${HEAD(P)}
blink("#${P}-cur",0.2,8.9,tl);
words("#${P}-c1",0.3,tl,0.1); words("#${P}-s1",0.7,tl,0.05);
tl.to("#${P}-tx",{width:924,duration:0.6,ease:"power2.inOut"},0.7);
tl.to("#${P}-hr",{opacity:0,duration:0.1},0.7);
tl.set("#${P}-hr",{textContent:"${'─'.repeat(74)}"},0.9);
tl.to("#${P}-hr",{opacity:1,duration:0.2},1.0);
tl.fromTo("#${P}-vr",{opacity:1,scaleY:0},{opacity:1,scaleY:1,duration:0.5,ease:"expo.out"},1.0);
ev("open",1.1);
tl.fromTo("#${P}-cp",{opacity:0,x:60},{opacity:1,x:0,duration:0.6,ease:"expo.out"},1.1);
unwords("#${P}-c1",3.2,tl); unwords("#${P}-s1",3.2,tl);
words("#${P}-c2",3.6,tl,0.1); words("#${P}-s2",4.0,tl,0.05);
ev("sumA",2.6); ev("sumB",7.2);
unwords("#${P}-c2",8.6,tl); unwords("#${P}-s2",8.6,tl);
`);
}

// ===== 3 flow(12 s):年表の読み方。1 ターン = 見出し + 説明。会話の中身だけ
{
  const P = 'fl';
  const rows = rowsAt(G_IDLE, 40);
  const h11 = rowOf(rows, m => m.step === 10 && m.part === 'head'), b11 = rowOf(rows, m => m.step === 10 && m.part === 'body');
  const h12 = rowOf(rows, m => m.step === 11 && m.part === 'head'), ab = rowOf(rows, m => m.part === 'above');
  const note = `<div class="legend" id="${P}-lg" data-layout-allow-overlap data-layout-allow-occlusion style="top:${ROWY(12)}px">`
    + `<div><span class="lk ok">書く</span>依頼者が何を求め、何が決まり、何が変わったか</div><div><span class="lk bad">書かない</span><span class="dim">中断された・ツールを実行した・確認を待っている</span></div></div>`;
  scene('flow', 12, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="12" data-track-index="0">
${win(P, transcript(P) + `<div class="vr"></div>` + paneBox(P))}
${note}
${lab(`${P}-l1`, '見出し(15 字以内)', { x: LABX, y: ROWY(h11) + 1, ac: true })}
${lab(`${P}-l2`, '説明:何を頼み、どうなったか', { x: LABX, y: ROWY(b11) + 1 })}
${lab(`${P}-l3`, '最新は ◉', { x: LABX, y: ROWY(h12) + 1, ac: true })}
${lab(`${P}-l4`, '窓の外に、まだ前のターン', { x: LABX, y: ROWY(ab) + 1 })}
${cap(`${P}-c1`, ['1 ターンが、', '*見出しと説明', '。'])}
${sub(`${P}-s1`, ['Each turn becomes a heading and a line: what was asked, how it ended.'])}
${cap(`${P}-c2`, ['書くのは、', '*会話の中身', 'だけ。'])}
${sub(`${P}-s2`, ['Only what was said and decided. Never "interrupted" or "ran a tool".'])}
${cap(`${P}-c3`, ['古い順に上から。', '*最新が下', '。'])}
${sub(`${P}-s3`, ['Oldest on top, latest at the bottom. Above the window: "↑ n earlier turns".'])}
</div>`, `
${HEAD(P)}
blink("#${P}-cur",0.2,11.9,tl);
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
${dimTx(P, 0.6)}
label("#${P}-l1",1.0,tl); label("#${P}-l2",2.0,tl);
unlabel("#${P}-l1",4.5,tl); unlabel("#${P}-l2",4.5,tl);
unwords("#${P}-c1",4.6,tl); unwords("#${P}-s1",4.6,tl);
words("#${P}-c2",5.0,tl,0.1); words("#${P}-s2",5.4,tl,0.05);
show("#${P}-lg",5.3,tl,0.35);
hide("#${P}-lg",9.5,tl,0.25);
unwords("#${P}-c2",8.2,tl); unwords("#${P}-s2",8.2,tl);
words("#${P}-c3",8.6,tl,0.1); words("#${P}-s3",9.0,tl,0.05);
label("#${P}-l4",9.0,tl); label("#${P}-l3",9.8,tl);
unlabel("#${P}-l3",11.3,tl); unlabel("#${P}-l4",11.3,tl);
${undimTx(P, 11.3)}
unwords("#${P}-c3",11.6,tl); unwords("#${P}-s3",11.6,tl);
`);
}

// ===== 4 now(14 s):送った瞬間に「いま」。ツールとサブエージェントが流れる
{
  const P = 'nw';
  scene('now', 14, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="14" data-track-index="0">
${win(P, transcript(P, { typed: SESSION.turn.prompt }) + `<div class="vr"></div>` + paneBox(P))}
${cap(`${P}-c1`, ['送った瞬間に、', '*いま', 'が出る。'])}
${sub(`${P}-s1`, ['Send, and "now" appears below: your request and a running clock.'])}
${cap(`${P}-c2`, ['実行中の', '*ツール', 'が流れる。'])}
${sub(`${P}-s2`, ['Running tools scroll through. The current one gets a small waveform.'])}
${cap(`${P}-c3`, ['*サブエージェント', 'も、1 行ずつ。'])}
${sub(`${P}-s3`, ['Sub-agents too: type, task and latest tool, one line each.'])}
</div>`, `
${HEAD(P)}
blink("#${P}-cur",0.1,0.3,tl); blink("#${P}-cur",2.0,13.9,tl);
typeIn("#${P}-typed",0.3,tl,24);
tl.set("#${P}-cur",{opacity:1},0.3);
ev("send",2.0);
tl.set("#${P}-typed",{opacity:0},2.0);
${appear(P, ['p13'], 2.0)}
words("#${P}-c1",2.2,tl,0.1); words("#${P}-s1",2.6,tl,0.05);
${appear(P, ['i13'], 2.8)}
ev("a1",3.4); ${appear(P, ['r0', 'r1'], 3.4)}
unwords("#${P}-c1",4.0,tl); unwords("#${P}-s1",4.0,tl);
words("#${P}-c2",4.4,tl,0.1); words("#${P}-s2",4.8,tl,0.05);
ev("a2",5.0); ${appear(P, ['g0', 'g1'], 5.0)}
ev("a3",6.6); ev("s1",6.8); ${appear(P, ['ag0'], 6.6)}
ev("a4",7.4); ev("s2",7.6); ${appear(P, ['ah0'], 7.4)}
unwords("#${P}-c2",8.0,tl); unwords("#${P}-s2",8.0,tl);
words("#${P}-c3",8.4,tl,0.1); words("#${P}-s3",8.8,tl,0.05);
ev("s1a",7.3); ev("s2a",8.2); ev("s1b",9.2); ev("s2b",10.4); ev("s1c",11.2); ev("s2c",12.2); ev("s1d",12.9);
unwords("#${P}-c3",13.6,tl); unwords("#${P}-s3",13.6,tl);
`);
}

// ===== 5 meter(11 s):計器は常に上。上と下は固定で、年表だけがスクロールする
{
  const P = 'mt';
  const rows = rowsAt(G_RUN, 58);
  const nowRow = rowOf(rows, m => m.part === 'now');
  const barY = ROWY(2), x70 = PANEX + Math.round(0.70 * 58) * COLW, x85 = PANEX + Math.round(0.85 * 58) * COLW;
  scene('meter', 11, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="11" data-track-index="0">
${win(P, transcript(P, { shown: idx('ah0') + 1, hidden: ['ag1'] }) + `<div class="vr"></div>` + paneBox(P))}
${chip(`${P}-k1`, '70% 琥珀', { x: x70, y: barY + 27 })}
${chip(`${P}-k2`, '85% 赤', { x: x85, y: barY + 27 })}
${lab(`${P}-l0`, 'モデル ・ コンテキスト量', { x: LABX, y: ROWY(1) + 1, ac: true })}
${lab(`${P}-l1`, '固定:計器と目的', { x: LABX, y: ROWY(4) + 1 })}
${lab(`${P}-l2`, 'ここだけスクロール', { x: LABX, y: ROWY(13) + 1, ac: true })}
${lab(`${P}-l3`, '固定:いま', { x: LABX, y: ROWY(nowRow) + 1 })}
${cap(`${P}-c1`, ['*モデルとコンテキスト量', 'は、常に上。'])}
${sub(`${P}-s1`, ['Model and context usage stay on top. The bar turns amber at 70% and red at 85%.'])}
${cap(`${P}-c2`, ['上と下は固定。', '*年表だけ', 'が動く。'])}
${sub(`${P}-s2`, ['Top and bottom stay put. Only the timeline scrolls.'])}
</div>`, `
${HEAD(P)}
blink("#${P}-cur",0.2,10.9,tl);
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
label("#${P}-l0",0.8,tl);
ev("e1",0.9); ${appear(P, ['ag1'], 0.9).replace(/scrollTo[^;]*;/, '')}
ev("a5",1.5); ${appear(P, ['w0', 'w1'], 1.5)}
ev("e2",2.3); ${appear(P, ['ah1'], 2.3).replace(/scrollTo[^;]*;/, '')}
keys("#${P}-k1",2.4,tl); keys("#${P}-k2",2.8,tl);
ev("a6",3.5); ${appear(P, ['u0', 'u1'], 3.5)}
unkeys("#${P}-k1",4.6,tl); unkeys("#${P}-k2",4.6,tl); unlabel("#${P}-l0",4.6,tl);
unwords("#${P}-c1",4.8,tl); unwords("#${P}-s1",4.8,tl);
words("#${P}-c2",5.2,tl,0.1); words("#${P}-s2",5.6,tl,0.05);
ev("a7",5.4); ${appear(P, ['b0'], 5.4)}
label("#${P}-l1",5.6,tl); label("#${P}-l3",5.9,tl); label("#${P}-l2",6.2,tl);
ev("wu1",6.6); ev("wu2",6.8); ev("wu3",7.0); ev("wu4",7.2); ev("wu5",7.4);
ev("wd1",8.8); ev("wd2",9.0); ev("wd3",9.2); ev("wd4",9.4); ev("wd5",9.6);
unlabel("#${P}-l1",10.3,tl); unlabel("#${P}-l2",10.3,tl); unlabel("#${P}-l3",10.3,tl);
unwords("#${P}-c2",10.6,tl); unwords("#${P}-s2",10.6,tl);
`);
}

// ===== 6 done(10 s):ターンが終わると要約が打ち出される。目的は、話がずれると直る
{
  const P = 'dn';
  const rows = rowsAt(G_DONE, 90);
  const h13 = rowOf(rows, m => m.step === 12 && m.part === 'head');
  scene('done', 10, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="10" data-track-index="0">
${win(P, transcript(P, { shown: idx('b0') + 1 }) + `<div class="vr"></div>` + paneBox(P))}
${lab(`${P}-l1`, 'Haiku の要約が届いた', { x: LABX, y: ROWY(h13) + 1, ac: true })}
${lab(`${P}-l2`, '目的:セッション全体を 1 文で', { x: LABX, y: ROWY(5) + 1, ac: true })}
${cap(`${P}-c1`, ['終わると、要約が', '*打ち出される', '。'])}
${sub(`${P}-s1`, ['When the turn ends, its summary is typed out: heading, then what happened.'])}
${cap(`${P}-c2`, ['*目的', 'は、話がずれると直る。'])}
${sub(`${P}-s2`, ['The goal: one sentence for the whole session, rewritten when the talk shifts.'])}
</div>`, `
${HEAD(P)}
blink("#${P}-cur",0.2,9.9,tl);
${appear(P, ['b1'], 0.2)}
${appear(P, ['f0', 'f1'], 0.5)}
words("#${P}-c1",0.6,tl,0.1); words("#${P}-s1",1.0,tl,0.05);
ev("done",0.9);
ev("sumT",2.4);
label("#${P}-l1",2.5,tl);
unlabel("#${P}-l1",4.6,tl);
unwords("#${P}-c1",4.8,tl); unwords("#${P}-s1",4.8,tl);
words("#${P}-c2",5.2,tl,0.1); words("#${P}-s2",5.6,tl,0.05);
label("#${P}-l2",5.4,tl);
unlabel("#${P}-l2",9.3,tl);
unwords("#${P}-c2",9.6,tl); unwords("#${P}-s2",9.6,tl);
`);
}

// ===== 7 jump(9 s):見出しを押すと、左がそのターンの発言まで飛ぶ
{
  const P = 'jp';
  const rows = rowsAt(G_DONE, 90);
  const heads = rows.map((r, i) => ({ i, m: r.meta })).filter(x => x.m.part === 'head' && SESSION.past[x.m.step] && idx('p' + (x.m.step + 1)) >= 0);
  if (heads.length < 1) throw new Error('jump: 押せる見出しが見えていない');
  const A = heads[0]; // 見えている中でいちばん古いターン
  const px = PANEX + 36 + 190, py = r => ROWY(r) + 14;
  const yTo = id => -idx(id) * 30; // その発言が窓の先頭に来る位置(block: start)
  const pa = 'p' + (A.m.step + 1);
  scene('jump', 5.8, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="5.8" data-track-index="0">
${win(P, transcript(P, { shown: ROWS.length }) + `<div class="vr"></div>` + paneBox(P))}
${ptr(`${P}-ptr`)}
${cap(`${P}-c1`, ['見出しを押すと、', '*その発言へ飛ぶ', '。'])}
${sub(`${P}-s1`, ['Click a heading: the transcript jumps to the message that started that turn.'])}
</div>`, `
${HEAD(P)}
blink("#${P}-cur",0.2,5.7,tl);
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
tl.fromTo("#${P}-ptr",{opacity:0,x:1500,y:760},{opacity:1,x:1500,y:760,duration:0.2},1.0);
tl.to("#${P}-ptr",{x:${px},y:${py(A.i)},duration:0.8,ease:"power2.inOut"},1.2);
tl.to("#${P}-ptr",{scale:0.82,duration:0.08,ease:"power2.in"},2.4);
tl.to("#${P}-ptr",{scale:1,duration:0.2,ease:"back.out(2)"},2.5);
tl.to("#${P}-txin",{y:${yTo(pa)},duration:0.35,ease:"power2.out"},2.5);
tl.fromTo("#${P}-${pa}",{backgroundColor:"rgba(69,71,90,0)"},{backgroundColor:"rgba(69,71,90,1)",duration:0.15},2.7);
tl.to("#${P}-${pa}",{backgroundColor:"rgba(69,71,90,0)",duration:0.5,ease:"power2.in"},4.9);
tl.to("#${P}-ptr",{opacity:0,duration:0.2},4.7);
unwords("#${P}-c1",5.4,tl); unwords("#${P}-s1",5.4,tl);
`);
  scenes[scenes.length - 1].jumpTo = yTo(pa);
}

// ===== 8 end(8 s)
{
  const P = 'en';
  const name = '◉ context-flow';
  const mark = [...name].map((c, i) => `<span style="color:${CF.cfRainbow(i * 0.045)}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  const card = `<div id="${P}-card" style="position:absolute;left:0;top:0;width:924px;bottom:0;opacity:0">
  <div id="${P}-mark" class="mono" style="position:absolute;left:40px;top:150px;font:700 76px/100px 'JetBrains Mono';white-space:nowrap">${mark}</div>
  <div id="${P}-line" style="position:absolute;left:44px;top:270px;font:500 28px/44px 'Noto Sans JP';color:#a6adc8">長いセッションでも、話の流れを見失わない。</div>
  <div id="${P}-big" style="position:absolute;left:44px;top:330px;font:700 34px/50px 'Noto Sans JP';color:#cdd6f4"><span style="display:block">設定は無い。</span><span style="display:block">途中から入れても、流れを起こす。</span><span style="display:block">開き直しは /context-flow。</span></div>
  <div class="mono" style="position:absolute;left:44px;top:520px;font:400 22px/32px 'JetBrains Mono';color:#cdd6f4;white-space:pre"><span class="dim">></span> <span id="${P}-cmd" data-type="/plugin install context-flow&#10;    --marketplace rintaroyamaoka/claude-context-flow"></span></div>
</div>`;
  scene('end', 7.6, `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="7.6" data-track-index="0">
${win(P, transcript(P, { shown: ROWS.length, y: scenes[scenes.length - 1].jumpTo }) + card + `<div class="vr"></div>` + paneBox(P))}
${cap(`${P}-c1`, ['*/plugin install context-flow'])}
${sub(`${P}-s1`, ['github.com/rintaroyamaoka/claude-context-flow · MIT · ♪ Drift – Minimal / PodcastAC (CC BY)'])}
</div>`, `
${HEAD(P)}
blink("#${P}-cur",0.2,0.6,tl);
tl.to("#${P}-tx",{opacity:0,duration:0.3,ease:"power3.in"},0.3);
tl.fromTo("#${P}-card",{opacity:0},{opacity:1,duration:0.2},0.6);
tl.fromTo("#${P}-mark",{opacity:0,x:-20},{opacity:1,x:0,duration:0.6,ease:"expo.out"},0.6);
tl.fromTo("#${P}-line",{opacity:0},{opacity:1,duration:0.4,ease:"power2.out"},1.1);
tl.fromTo("#${P}-big span",{opacity:0,filter:"blur(8px)"},{opacity:1,filter:"blur(0px)",duration:0.25,ease:"power2.out",stagger:0.15},1.4);
typeIn("#${P}-cmd",2.6,tl,28);
words("#${P}-c1",2.8,tl,0.1); words("#${P}-s1",3.4,tl,0.05);
`);
}

// ---------- 出来事の時刻の表(通し時刻)。narrate.py が声の長さに合わせて書き直す
const G = {}; let t0 = 0;
for (const s of scenes) { s.t0 = t0; for (const m of s.script.matchAll(/\bev\("(\w+)",\s*([\d.]+)\)/g)) G[m[1]] = +(t0 + parseFloat(m[2])).toFixed(3); t0 += s.dur; }
const used = new Set([...SESSION.turn.actions.map(a => a.at), ...SESSION.turn.subs.flatMap(s => [s.from, s.to, ...s.actions.map(a => a.at)]), ...SESSION.grow.map(g => g[0]), ...SESSION.wheel.map(w => w[0]), 'open', 'sumA', 'sumB', 'send', 'done', 'sumT']);
for (const k of used) if (G[k] === undefined) throw new Error('ev が無い: ' + k);

// ---------- 書き出し
fs.mkdirSync('src/scenes', { recursive: true });
for (const f of fs.readdirSync('src/scenes')) fs.unlinkSync('src/scenes/' + f);
scenes.forEach((s, i) => {
  const head = `const D=${JSON.stringify(SESSION)};\nconst G=${JSON.stringify(G)};\nconst T0=${s.t0};`;
  const f = `src/scenes/${String(i + 1).padStart(2, '0')}-${s.id}.html`;
  fs.writeFileSync(f, s.markup.trim() + '\n<!--SCRIPT-->\n' + s.script.trim().replace('/*CF*/', head) + '\n');
  console.log('gen', f, s.dur + 's');
});

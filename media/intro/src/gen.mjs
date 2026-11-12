// src/gen.mjs — src/scenes/*.html を生成する。
// 右のペインは src/pane.js(mod の ui/pane.tsx・ui/splash.tsx・domain/flow.ts・color.ts を移したもの)が時刻から描く。
// ここで決めるのは、会話の中身(SESSION)・左のトランスクリプト・字幕・出来事の時刻(ev)。
import fs from 'node:fs';
const CF = new Function(fs.readFileSync('src/pane.js', 'utf8') + '; return { cfWorld, cfLayout, cfRainbow, CF_COLS, CF_ROWS };')();
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jp = html => html.replace(/[⺀-￿]+/g, m => `<i class="w" data-layout-allow-occlusion data-layout-allow-overflow>${m}</i>`); // 全角は 2 桁ぶんの幅

// ---------- 会話の中身(架空の orders-api。注文 API にバリデーションを足すセッション)
const D1 = '検証は zod、入口で通す';
const SESSION = {
  model: 'Fable 5.2', tokens: 84200, window: 200000,
  goal1: '注文 API に入力バリデーションを足す',
  goal2: '注文 API の入力検証と、エラー応答の統一',
  // decided / open:その要約が届いた時点の「決まったこと・残っていること」(各 18 字以内。最大 3 / 2)
  past: [
    { prompt: 'POST /orders の入力って、今どこで検証してる?', title: '現状の確認', summary: 'POST /orders の入力処理を調べ、検証が無いと確認した。' },
    { prompt: 'zod で入口に検証を入れたい。方針を出して。', title: '方針の決定', summary: 'zod のスキーマをハンドラの入口で通す方針に決めた。', decided: [D1], open: ['スキーマを書く'] },
    { prompt: 'じゃあスキーマから書いて。', title: 'スキーマの追加', summary: 'OrderSchema を schemas/order.ts に作り、型を infer で出した。' },
    { prompt: 'POST /orders に組み込んで。', title: 'ハンドラへの組み込み', summary: 'POST /orders で safeParse を通し、失敗は 400 を返すようにした。' },
    { prompt: 'テストも足して。', title: 'テストの追加', summary: '不正な数量と欠けた項目のテストを足し、すべて通った。', decided: [D1, 'POST /orders に検証'], open: ['PATCH にも同じ検証'] },
    { prompt: '型エラーが出てる。', title: '型エラーの修正', summary: 'infer した型とハンドラの型のずれを直し、tsc が通った。' },
    { prompt: '日付は ISO 8601 だけ受けたい。', title: '日付の形式', summary: '納期を ISO 8601 に限り、過去の日付は弾くようにした。' },
    { prompt: 'PATCH /orders/:id にも同じ検証を。', title: 'PATCH への展開', summary: 'OrderSchema.partial() を PATCH に使い、テストを足した。', decided: [D1, 'POST と PATCH に適用'], open: ['README に入力のルール'] },
    { prompt: '数量に上限を付けて。999 まで。', title: '数量の上限', summary: '数量の上限を 999 に決め、スキーマとテストに入れた。', decided: [D1, 'POST と PATCH に適用', '数量は 1〜999、日付は ISO'] },
    { prompt: 'README に入力のルールを書いておいて。', title: 'README の更新', summary: '項目ごとの型と範囲を、表にして README に足した。', open: ['エラーの返し方をそろえる'] },
    { prompt: 'lint が怒ってる。直して。', title: 'lint の修正', summary: '使っていない import を 3 つ消し、lint が通った。' },
    { prompt: 'CI が落ちてる。原因を見て。', title: 'CI の失敗の調査', summary: '下限を変えた時の直し漏れが原因。テストを合わせた。' },
  ],
  // 章の区切り(applySegments に渡る形):[開始, 終了, 寄り道か, 章の名前]。seg1 = 12 ターンぶん、seg2 = 13 ターン目が終わったあと
  seg1: [[1, 2, false, '現状の調査と方針'], [3, 5, false, 'zod の検証を追加'], [6, 6, true, '型エラーの修正'], [7, 10, false, '入力ルールの拡充'], [11, 12, true, 'lint と CI の手直し']],
  seg2: [[1, 2, false, '現状の調査と方針'], [3, 5, false, 'zod の検証を追加'], [6, 6, true, '型エラーの修正'], [7, 10, false, '入力ルールの拡充'], [11, 12, true, 'lint と CI の手直し'], [13, 13, false, 'エラー応答の統一']],
  turn: {
    prompt: 'エラーの返し方がバラバラ。全エンドポイントで同じ形にそろえて。', title: 'エラーの形をそろえる',
    summary: '全エンドポイントのエラーを { code, message, fields } にそろえた。',
    decided: [D1, 'POST と PATCH に適用', 'エラーの形を 1 つに統一'], open: ['README にエラーの形を書く', 'ほかの API にも広げる'],
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
  wheel: [['wu1', 1], ['wu2', 1], ['wu3', 1], ['wu4', 1], ['wd1', -1], ['wd2', -1], ['wd3', -1], ['wd4', -1]],
  // 背景の配色(既定は none = 塗らない)。/context-flow bg <名前>
  bg: [['bg1', 'sumi'], ['bg2', 'none']],
};

// ---------- 左:Claude Code のトランスクリプト(素のまま)
const O = `<span class="ok" data-layout-allow-occlusion>●</span>`, N = `<span class="now" data-layout-allow-occlusion>●</span>`;
const you = t => `<span class="dim">></span> ${t}`;
const say = t => `${N} ${t}`, more = t => `  ${t}`;
const tool = (name, arg) => `${O} <span class="b">${name}</span>(${esc(arg)})`;
const res = t => `  <span class="dim">⎿  ${esc(t)}</span>`;
const BGLIST = ['選べるのは: navy(濃紺) / sumi(墨) /', 'murasaki(紫) / mori(深緑) / akane(茜) / yoake(夜明け) /', 'umi(深海) / none(黒)'];
const ROWS = [
  ['p7', you('日付は ISO 8601 だけ受けたい。')], [null, ' '],
  [null, tool('Update', 'src/schemas/order.ts')], [null, res('Updated src/schemas/order.ts with 3 additions and 1 removal')], [null, ' '],
  [null, say('納期は ISO 8601 だけ受け、過去の日付は弾きます。')], [null, ' '],
  ['p8', you('PATCH /orders/:id にも同じ検証を。')], [null, ' '],
  [null, tool('Update', 'src/routes/orders.ts')], [null, res('Updated src/routes/orders.ts with 8 additions')], [null, ' '],
  [null, tool('Update', 'tests/orders.test.ts')], [null, res('Updated tests/orders.test.ts with 12 additions')], [null, ' '],
  [null, say('OrderSchema.partial() を PATCH に通し、テストを足しました。')], [null, ' '],
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
  ['f0', say('エラーは { code, message, fields } の形にそろえました。')], ['f1', more('4 つのエンドポイントとテストを直し、42 件通っています。')], ['x9', ' '],
  // ここから /context-flow bg(bg の場面で打つ)。返事の文は app/session.ts の runCommand のまま(幅で折り返したもの)
  ['k1', you('/context-flow bg sumi')], ['k1a', res('背景を sumi(墨)にしました。' + BGLIST[0])], ['k1b', `  <span class="dim">   ${BGLIST[1]}</span>`], ['k1c', `  <span class="dim">   ${BGLIST[2]}</span>`], ['x10', ' '],
  ['k2', you('/context-flow bg none')], ['k2a', res('背景を none(黒)にしました。' + BGLIST[0])], ['k2b', `  <span class="dim">   ${BGLIST[1]}</span>`], ['k2c', `  <span class="dim">   ${BGLIST[2]}</span>`],
];
const idx = id => { const i = ROWS.findIndex(r => r[0] === id); if (i < 0) throw new Error('row が無い: ' + id); return i; };
const LINE = 24;  // 窓の中の 1 行(18px の字)
const VIS = 27;   // 見えている行数(648px / 24px)
const yFor = shown => -Math.max(0, shown - VIS) * LINE; // shown 行目までが下端に来る位置
const FIRST13 = idx('p13'), FIRSTK = idx('k1');
/** shown: 最初から見えている行数。それ以降は opacity 0 で置いておく */
function transcript(P, { full = false, shown = FIRST13 - 1, y = yFor(shown), typed = null, hidden = [] } = {}) {
  const types = typed ? (Array.isArray(typed) ? typed : [typed]) : [];
  return `<div class="tx${full ? ' full' : ''}" id="${P}-tx" data-layout-allow-overlap><div class="txs"><div class="txin" id="${P}-txin" data-y="${y}" data-layout-allow-overflow>`
    + ROWS.map(([id, h], i) => `<div class="ln" data-layout-allow-occlusion data-layout-allow-overflow${id ? ` id="${P}-${id}"` : ''}${i >= shown || hidden.includes(id) ? ' style="opacity:0"' : ''}>${jp(h).replace(/<span /g, '<span data-layout-allow-occlusion data-layout-allow-overflow ')}</div>`).join('\n')
    + `</div></div><div class="txb"><div class="ln"><span class="dim" id="${P}-hr">${'─'.repeat(full ? 152 : 82)}</span></div><div class="ln"><span class="dim">></span> ${types.map((t, i) => `<span id="${P}-typed${i ? i + 1 : ''}" data-type="${t}"></span>`).join('')}<span class="cur" id="${P}-cur"></span></div><div class="ln"><span class="dim">  ? for shortcuts</span></div></div></div>`;
}
const win = (P, inner) => `<div class="win" id="${P}-win"><div class="titlebar" data-layout-allow-occlusion><span class="d r"></span><span class="d y"></span><span class="d g"></span><span class="ttl">orders-api — claude</span></div><div class="body" id="${P}-body">${inner}</div></div>`;
const paneBox = (P, style = '') => `<div class="cp" id="${P}-cp" data-layout-allow-overlap data-layout-allow-overflow${style ? ` style="${style}"` : ''}></div>`;
const cap = (id, parts) => `<p class="cap" id="${id}">${parts.map(p => p.startsWith('*') ? `<span class="ac">${p.slice(1)}</span>` : `<span>${p}</span>`).join('')}</p>`;
const sub = (id, parts) => `<p class="sub" id="${id}">${parts.map(p => `<span>${p}</span>`).join('')}</p>`;
const lab = (id, text, { x, y, ac = false }) => `<div class="lab${ac ? ' ac' : ''}" id="${id}" style="right:${1920 - x}px;top:${y}px">${text} ▸</div>`;
const ptr = id => `<svg class="ptr" id="${id}" viewBox="0 0 28 36"><path d="M2 2 L2 28 L9 21 L14 33 L19 31 L14 19 L24 19 Z" fill="#fff" stroke="#1b1b1f" stroke-width="2" stroke-linejoin="round"/></svg>`;

const ROWY = r => 112 + r * LINE; // ペインの r 行目の frame 上の y
const LABY = r => ROWY(r) - 2;    // その行に添えるラベルの y(ラベルの行高は 28px)
const LABX = 1036;                // ラベルの右端(仕切り x=1044 の左)
const PANEX = 120 + 925 + 27;     // ペインの文字の左端
const COLW = 10.8;                // 1 桁の幅

// ---------- ペインの行の位置(ラベルを置く行を、実際の描画から求める)
const G_IDLE = { open: 0, sumA: 1, sumB: 2, seg1: 3 };                                  // 12 ターン・待機中
const G_RUN = { ...G_IDLE, send: 50, a1: 51, a2: 52, a3: 53, a4: 54, s1: 53.5, s2: 54.5 }; // 13 ターン目が走っている(サブエージェント 2)
const G_SUM = { ...G_IDLE, send: 50, done: 60, sumT: 61 };                              // 13 ターン・要約が届いた(区切り直しの前)
const G_DONE = { ...G_SUM, seg2: 62 };                                                  // 13 ターン・区切り直したあと
const rowsAt = (G, g) => CF.cfLayout(CF.cfWorld(SESSION, G, g), CF.CF_COLS, CF.CF_ROWS);
const rowOf = (rows, f, what) => { const i = rows.findIndex(r => f(r.meta)); if (i < 0) throw new Error('row not found: ' + what); return i; };

const scenes = [];
const scene = (id, dur, markup, script) => scenes.push({ id, dur, markup, script });
const dimTx = (P, at) => `tl.to("#${P}-tx",{opacity:0.14,duration:0.4,ease:"power2.inOut"},${at});`;
const undimTx = (P, at) => `tl.to("#${P}-tx",{opacity:1,duration:0.4,ease:"power2.inOut"},${at});`;
const TXY = P => `gsap.set("#${P}-txin",{y:+document.querySelector("#${P}-txin").getAttribute("data-y")});`;
const HEAD = P => `/*CF*/\n${TXY(P)}\ncfDrive("#${P}-cp",D,G,T0,tl);`;
/** 行を出して、下端まで送る */
const appear = (P, ids, t, scroll = true) => { const last = Math.max(...ids.map(idx)) + 1;
  return ids.map((id, i) => `rise("#${P}-${id}",${(t + i * 0.3).toFixed(2)},tl,8);`).join(' ') + (scroll ? ` scrollTo("#${P}-txin",${t.toFixed(2)},tl,${yFor(last)});` : ''); };
const stage = (P, dur, inner) => `<div id="${P}-stage" class="stage clip" data-start="0" data-duration="${dur}" data-track-index="0">\n${inner}\n</div>`;

// ===== 1 hook(8 s):長いセッション。流れていって、見失う
{
  const P = 'hk';
  scene('hook', 8, stage(P, 8, `${win(P, transcript(P, { full: true, y: 0 }))}
${cap(`${P}-c1`, ['セッションが長くなると、', '*流れを見失う', '。'])}
${sub(`${P}-s1`, ['A long session scrolls away.'])}
${cap(`${P}-c2`, ['いま何の話で、', '*何が決まった', 'のか。'])}
${sub(`${P}-s2`, ['What are we on now, and what has been decided? You have to scroll back.'])}`), `
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

// ===== 2 reveal(12 s):窓が割れて右に 1 枚。起動アニメーション(実物どおり 2.6 秒)→ 途中から入れても流れを起こす → 細かいターンが節にまとまる
{
  const P = 'rv';
  scene('reveal', 12, stage(P, 12, `${win(P, transcript(P, { full: true }) + `<div class="vr" id="${P}-vr" style="opacity:0"></div>` + paneBox(P))}
${cap(`${P}-c1`, ['*context-flow', ' ― 右に 1 枚。'])}
${sub(`${P}-s1`, ['context-flow: one pane on the right. Claude Code on the left is untouched.'])}
${cap(`${P}-c2`, ['途中から入れても、', '*流れを起こす', '。'])}
${sub(`${P}-s2`, ['Added mid-session, it reads the conversation so far and rebuilds the flow.'])}
${cap(`${P}-c3`, ['細かいターンが、', '*節にまとまる', '。'])}
${sub(`${P}-s3`, ['Small turns fold into nodes, one per stage of the conversation.'])}`), `
${HEAD(P)}
blink("#${P}-cur",0.2,11.9,tl);
words("#${P}-c1",0.3,tl,0.1); words("#${P}-s1",0.7,tl,0.05);
tl.to("#${P}-tx",{width:924,duration:0.6,ease:"power2.inOut"},0.7);
tl.to("#${P}-hr",{opacity:0,duration:0.1},0.7);
tl.set("#${P}-hr",{textContent:"${'─'.repeat(82)}"},0.9);
tl.to("#${P}-hr",{opacity:1,duration:0.2},1.0);
tl.fromTo("#${P}-vr",{opacity:1,scaleY:0},{opacity:1,scaleY:1,duration:0.5,ease:"expo.out"},1.0);
ev("open",1.3);
unwords("#${P}-c1",3.3,tl); unwords("#${P}-s1",3.3,tl);
words("#${P}-c2",3.7,tl,0.1); words("#${P}-s2",4.1,tl,0.05);
ev("sumA",4.0); ev("sumB",7.0);
unwords("#${P}-c2",7.8,tl); unwords("#${P}-s2",7.8,tl);
words("#${P}-c3",8.2,tl,0.1); words("#${P}-s3",8.6,tl,0.05);
ev("seg1",9.2);
unwords("#${P}-c3",11.6,tl); unwords("#${P}-s3",11.6,tl);
`);
}

// ===== 3 flow(12 s):流れの読み方。本筋と寄り道。節 = 話の段階、枝 = 手直し。いまの節だけ見出しまで開く
{
  const P = 'fl';
  const rows = rowsAt(G_IDLE, 40);
  const node = rowOf(rows, m => m.part === 'node' && m.chapter === 1, 'node'), br = rowOf(rows, m => m.part === 'branch' && !m.current, 'branch');
  const cur = rowOf(rows, m => m.current, 'current'), head = rowOf(rows, m => m.part === 'head' && m.step === 10, 'head'), body = rowOf(rows, m => m.part === 'body', 'body');
  scene('flow', 12, stage(P, 12, `${win(P, transcript(P) + `<div class="vr"></div>` + paneBox(P))}
${lab(`${P}-l1`, '本筋の節 ● = 話の段階', { x: LABX, y: LABY(node), ac: true })}
${lab(`${P}-l2`, '寄り道の枝 ○ = 手直し・やり直し', { x: LABX, y: LABY(br), ac: true })}
${lab(`${P}-l3`, 'いまの節 ◉', { x: LABX, y: LABY(cur), ac: true })}
${lab(`${P}-l4`, 'ターンの見出し', { x: LABX, y: LABY(head) })}
${lab(`${P}-l5`, '説明は、最新のターンだけ', { x: LABX, y: LABY(body) })}
${cap(`${P}-c1`, ['流れは、', '*本筋と寄り道', '。'])}
${sub(`${P}-s1`, ['The flow is a trunk with detours. Each node on the thick line is a stage.'])}
${cap(`${P}-c2`, ['手直しは、右へ出る', '*枝', '。'])}
${sub(`${P}-s2`, ['Fixes, retries and tangents branch off to the right, in dim text.'])}
${cap(`${P}-c3`, ['いまの節だけ、', '*見出しまで開く', '。'])}
${sub(`${P}-s3`, ['Only the current node opens down to its turn headings.'])}`), `
${HEAD(P)}
blink("#${P}-cur",0.2,11.9,tl);
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
${dimTx(P, 0.6)}
label("#${P}-l1",1.2,tl);
unwords("#${P}-c1",4.2,tl); unwords("#${P}-s1",4.2,tl);
words("#${P}-c2",4.6,tl,0.1); words("#${P}-s2",5.0,tl,0.05);
label("#${P}-l2",4.8,tl);
unlabel("#${P}-l1",7.8,tl); unlabel("#${P}-l2",7.8,tl);
unwords("#${P}-c2",8.0,tl); unwords("#${P}-s2",8.0,tl);
words("#${P}-c3",8.4,tl,0.1); words("#${P}-s3",8.8,tl,0.05);
label("#${P}-l3",8.6,tl); label("#${P}-l4",9.2,tl); label("#${P}-l5",9.8,tl);
unlabel("#${P}-l3",11.3,tl); unlabel("#${P}-l4",11.3,tl); unlabel("#${P}-l5",11.3,tl);
unwords("#${P}-c3",11.6,tl); unwords("#${P}-s3",11.6,tl);
`);
}

// ===== 4 state(6.5 s):上に固定で出る。目的、決まったこと・残っていること
{
  const P = 'st';
  const rows = rowsAt(G_IDLE, 40);
  const aim = rowOf(rows, m => m.part === 'aim', 'aim'), dec = rowOf(rows, m => m.part === 'decided-label', 'decided'), opn = rowOf(rows, m => m.part === 'open-label', 'open');
  scene('state', 6.5, stage(P, 6.5, `${win(P, transcript(P, { shown: FIRST13 - 1 }) + `<div class="vr"></div>` + paneBox(P))}
${lab(`${P}-l1`, '目的:セッション全体を 1 文で', { x: LABX, y: LABY(aim) })}
${lab(`${P}-l2`, '決まったこと(✓ 最大 3 個)', { x: LABX, y: LABY(dec), ac: true })}
${lab(`${P}-l3`, '残っていること(最大 2 個)', { x: LABX, y: LABY(opn), ac: true })}
${cap(`${P}-c1`, ['*決まったこと・残っていること', 'が、上に。'])}
${sub(`${P}-s1`, ['Decided and still open, pinned at the top under the goal. Always visible.'])}`), `
${HEAD(P)}
gsap.set("#${P}-tx",{opacity:0.14});
blink("#${P}-cur",0.2,6.4,tl);
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
label("#${P}-l1",0.8,tl); label("#${P}-l2",1.6,tl); label("#${P}-l3",2.4,tl);
unlabel("#${P}-l1",5.7,tl); unlabel("#${P}-l2",5.7,tl); unlabel("#${P}-l3",5.7,tl);
${undimTx(P, 5.7)}
unwords("#${P}-c1",6.1,tl); unwords("#${P}-s1",6.1,tl);
`);
}

// ===== 5 now(14 s):送った瞬間に「いま」。考え中 → ツール → サブエージェント
{
  const P = 'nw';
  scene('now', 14, stage(P, 14, `${win(P, transcript(P, { typed: SESSION.turn.prompt }) + `<div class="vr"></div>` + paneBox(P))}
${cap(`${P}-c1`, ['送った瞬間に、', '*いま', 'が出る。'])}
${sub(`${P}-s1`, ['Send, and "now" appears at the bottom: your request, a clock, "thinking".'])}
${cap(`${P}-c2`, ['実行中の', '*ツール', 'が流れる。'])}
${sub(`${P}-s2`, ['Running tools scroll through. The current one gets a small waveform.'])}
${cap(`${P}-c3`, ['*サブエージェント', 'も、1 行ずつ。'])}
${sub(`${P}-s3`, ['Sub-agents too: type, task and latest tool, one line each.'])}`), `
${HEAD(P)}
blink("#${P}-cur",0.1,0.3,tl); blink("#${P}-cur",2.0,13.9,tl);
typeIn("#${P}-typed",0.3,tl,24);
tl.set("#${P}-cur",{opacity:1},0.3);
ev("send",2.0);
tl.set("#${P}-typed",{opacity:0},2.0);
${appear(P, ['p13'], 2.0)}
words("#${P}-c1",2.2,tl,0.1); words("#${P}-s1",2.6,tl,0.05);
${appear(P, ['i13'], 2.9)}
ev("a1",3.7); ${appear(P, ['r0', 'r1'], 3.7)}
unwords("#${P}-c1",4.2,tl); unwords("#${P}-s1",4.2,tl);
words("#${P}-c2",4.6,tl,0.1); words("#${P}-s2",5.0,tl,0.05);
ev("a2",5.2); ${appear(P, ['g0', 'g1'], 5.2)}
ev("a3",6.6); ev("s1",6.8); ${appear(P, ['ag0'], 6.6)}
ev("a4",7.4); ev("s2",7.6); ${appear(P, ['ah0'], 7.4)}
unwords("#${P}-c2",8.0,tl); unwords("#${P}-s2",8.0,tl);
words("#${P}-c3",8.4,tl,0.1); words("#${P}-s3",8.8,tl,0.05);
ev("s1a",7.3); ev("s2a",8.2); ev("s1b",9.4); ev("s2b",10.8); ev("s1c",12.4);
unwords("#${P}-c3",13.6,tl); unwords("#${P}-s3",13.6,tl);
`);
}

// ===== 6 fixed(8.2 s):上と下は固定で、スクロールするのは間の流れだけ
{
  const P = 'fx';
  const rows = rowsAt(G_RUN, 58);
  const nowRow = rowOf(rows, m => m.part === 'now', 'now'), flowRow = rowOf(rows, m => m.part === 'flow-label', 'flow'), dec = rowOf(rows, m => m.part === 'decided-label', 'decided');
  if (rows.maxScroll < 4) throw new Error('fixed: 流れが窓に収まっていて、スクロールできない(maxScroll ' + rows.maxScroll + ')');
  scene('fixed', 8.2, stage(P, 8.2, `${win(P, transcript(P, { shown: idx('ah0') + 1, hidden: ['ag1'] }) + `<div class="vr"></div>` + paneBox(P))}
${lab(`${P}-l1`, '固定:計器・目的・決まったこと', { x: LABX, y: LABY(dec) })}
${lab(`${P}-l2`, 'ここだけスクロール', { x: LABX, y: LABY(Math.round((flowRow + 1 + nowRow) / 2)), ac: true })}
${lab(`${P}-l3`, '固定:いま', { x: LABX, y: LABY(nowRow) })}
${cap(`${P}-c1`, ['上と下は固定。', '*流れだけ', 'が動く。'])}
${sub(`${P}-s1`, ['Top and bottom stay put. Only the flow in between scrolls.'])}`), `
${HEAD(P)}
blink("#${P}-cur",0.2,8.1,tl);
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
${dimTx(P, 0.6)}
label("#${P}-l1",0.9,tl); label("#${P}-l3",1.3,tl); label("#${P}-l2",1.7,tl);
ev("s2c",1.2);
ev("wu1",2.8); ev("wu2",3.1); ev("wu3",3.4); ev("wu4",3.7);
ev("s1d",4.4);
ev("wd1",5.4); ev("wd2",5.7); ev("wd3",6.0); ev("wd4",6.3);
unlabel("#${P}-l1",7.2,tl); unlabel("#${P}-l2",7.2,tl); unlabel("#${P}-l3",7.2,tl);
${undimTx(P, 7.2)}
unwords("#${P}-c1",7.7,tl); unwords("#${P}-s1",7.7,tl);
`);
}

// ===== 7 done(12 s):ターンが終わる → 要約が打ち出される → 全体を見渡して節を区切り直す。決まったことも書き換わる
{
  const P = 'dn';
  const sum = rowsAt(G_SUM, 90), fin = rowsAt(G_DONE, 90);
  const h13 = rowOf(sum, m => m.step === 12 && m.part === 'head', 'head 13');
  const node = rowOf(fin, m => m.part === 'node' && m.current, 'node 13'), br = rowOf(fin, m => m.part === 'branch' && m.first === 10, 'branch 11');
  const dec = rowOf(fin, m => m.part === 'decided-label', 'decided');
  scene('done', 12, stage(P, 12, `${win(P, transcript(P, { shown: idx('ah0') + 1, hidden: ['ag1'] }) + `<div class="vr"></div>` + paneBox(P))}
${lab(`${P}-l1`, 'Haiku の要約が届いた', { x: LABX, y: LABY(h13), ac: true })}
${lab(`${P}-l2`, '寄り道は、枝に閉じた', { x: LABX, y: LABY(br) })}
${lab(`${P}-l3`, '新しい節', { x: LABX, y: LABY(node), ac: true })}
${lab(`${P}-l4`, '決まったことも、書き換わる', { x: LABX, y: LABY(dec), ac: true })}
${cap(`${P}-c1`, ['終わると、要約が', '*打ち出される', '。'])}
${sub(`${P}-s1`, ['When the turn ends, its summary is typed out: heading, then what happened.'])}
${cap(`${P}-c2`, ['そのたびに、', '*節を区切り直す', '。'])}
${sub(`${P}-s2`, ['Then the whole session is re-segmented: the detour closes into a branch, a new node opens.'])}`), `
${HEAD(P)}
blink("#${P}-cur",0.2,11.9,tl);
ev("e1",0.3); ${appear(P, ['ag1'], 0.3, false)}
ev("e2",0.6); ${appear(P, ['ah1'], 0.6, false)}
ev("a5",0.9); ${appear(P, ['w0', 'w1'], 0.9)}
ev("a6",1.4); ${appear(P, ['u0', 'u1'], 1.4)}
ev("a7",1.9); ${appear(P, ['b0', 'b1'], 1.9)}
words("#${P}-c1",2.3,tl,0.1); words("#${P}-s1",2.7,tl,0.05);
ev("done",2.8); ${appear(P, ['f0', 'f1'], 2.8)}
ev("sumT",4.2);
label("#${P}-l1",4.4,tl);
unlabel("#${P}-l1",6.2,tl);
unwords("#${P}-c1",6.3,tl); unwords("#${P}-s1",6.3,tl);
words("#${P}-c2",6.7,tl,0.1); words("#${P}-s2",7.1,tl,0.05);
ev("seg2",7.5);
label("#${P}-l2",7.9,tl); label("#${P}-l3",8.3,tl); label("#${P}-l4",9.3,tl);
unlabel("#${P}-l2",11.3,tl); unlabel("#${P}-l3",11.3,tl); unlabel("#${P}-l4",11.3,tl);
unwords("#${P}-c2",11.6,tl); unwords("#${P}-s2",11.6,tl);
`);
}

// ===== 8 jump(5.8 s):節・枝・見出しを押すと、左がその発言まで飛ぶ(ここでは枝「lint と CI の手直し」→ #11 の発言)
{
  const P = 'jp';
  const rows = rowsAt(G_DONE, 90);
  const br = rowOf(rows, m => m.part === 'branch' && m.first === 10, 'branch 11');
  const px = PANEX + 6 * COLW + 150, py = ROWY(br) + 10;
  const yTo = id => -idx(id) * LINE; // その発言が窓の先頭に来る位置(block: start)
  const pa = 'p11';
  scene('jump', 5.8, stage(P, 5.8, `${win(P, transcript(P, { shown: FIRSTK - 1 }) + `<div class="vr"></div>` + paneBox(P))}
${ptr(`${P}-ptr`)}
${cap(`${P}-c1`, ['節や枝を押すと、', '*その発言へ飛ぶ', '。'])}
${sub(`${P}-s1`, ['Click a node, a branch or a heading: the transcript jumps to that message.'])}`), `
${HEAD(P)}
blink("#${P}-cur",0.2,5.7,tl);
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
tl.fromTo("#${P}-ptr",{opacity:0,x:1500,y:760},{opacity:1,x:1500,y:760,duration:0.2},1.0);
tl.to("#${P}-ptr",{x:${px.toFixed(0)},y:${py},duration:0.8,ease:"power2.inOut"},1.2);
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

// ===== 9 bg(7 s):背景は既定では塗らない。/context-flow bg <名前> でペイン全体を一色で塗れる(sumi → none に戻す)
{
  const P = 'bg';
  scene('bg', 7, stage(P, 7, `${win(P, transcript(P, { shown: FIRSTK - 1, y: scenes[scenes.length - 1].jumpTo, typed: ['/context-flow bg sumi', '/context-flow bg none'] }) + `<div class="vr"></div>` + paneBox(P))}
${cap(`${P}-c1`, ['背景は、', '*/context-flow bg', '&nbsp;で塗れる。'])}
${sub(`${P}-s1`, ['Unpainted by default. /context-flow bg &lt;name&gt; paints the whole pane in one colour.'])}`), `
${HEAD(P)}
gsap.set("#${P}-cur",{opacity:0});
words("#${P}-c1",0.4,tl,0.1); words("#${P}-s1",0.8,tl,0.05);
typeIn("#${P}-typed",0.7,tl,30);
tl.set("#${P}-cur",{opacity:1},1.4);
ev("bg1",1.9);
tl.set("#${P}-cur",{opacity:0},1.9);
tl.set("#${P}-typed",{display:"none"},1.9);
${appear(P, ['k1', 'k1a', 'k1b', 'k1c'], 1.9)}
typeIn("#${P}-typed2",3.6,tl,30);
tl.set("#${P}-cur",{opacity:1},4.3);
ev("bg2",4.8);
tl.set("#${P}-cur",{opacity:0},4.8);
tl.set("#${P}-typed2",{opacity:0},4.8);
${appear(P, ['k2', 'k2a', 'k2b', 'k2c'], 4.8)}
unwords("#${P}-c1",6.6,tl); unwords("#${P}-s1",6.6,tl);
`);
}

// ===== 10 end(7.6 s)
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
  scene('end', 7.6, stage(P, 7.6, `${win(P, transcript(P, { shown: ROWS.length, y: yFor(ROWS.length) }) + card + `<div class="vr"></div>` + paneBox(P))}
${cap(`${P}-c1`, ['*/plugin install context-flow'])}
${sub(`${P}-s1`, ['github.com/rintaroyamaoka/claude-context-flow · MIT · ♪ Drift – Minimal / PodcastAC (CC BY)'])}`), `
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
const used = new Set([...SESSION.turn.actions.map(a => a.at), ...SESSION.turn.subs.flatMap(s => [s.from, s.to, ...s.actions.map(a => a.at)]), ...SESSION.grow.map(g => g[0]), ...SESSION.wheel.map(w => w[0]), ...SESSION.bg.map(b => b[0]), 'open', 'sumA', 'sumB', 'seg1', 'send', 'done', 'sumT', 'seg2']);
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
console.log('total', t0.toFixed(1) + 's(声を入れる前)');

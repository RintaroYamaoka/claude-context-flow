// src/pane.js — context-flow のペイン。mod の描画を移したもの:
//   context-flow/hooks/ui/pane.tsx(ペイン)・ui/splash.tsx(起動アニメーション)・
//   domain/flow.ts(章 → 行、「いま」の行、窓)・domain/color.ts(虹・光の帯・波形・背景)・domain/text.ts(幅・切り詰め)。
// 行の並び・文言・記号・色の式は実物と同じ。違うのは「いつ何が起きるか」を時刻の表(G)から決めることだけ。
// build.mjs が各 scene に inline する。gen.mjs も同じファイルを読んで、ラベルを置く行を計算する。
const CF_FRAME_MS = 200, CF_TYPE_MS = 18, CF_NOW0 = 600000;
const CF_TRUNK = 3, CF_BRANCH = 6;
const CF_SPLASH_MS = 1900, CF_REVEAL_MS = 700, CF_WORDMARK = "c o n t e x t   f l o w";
const CF_WARN = "#ffc107", CF_ERR = "#ff6b80", CF_OK = "#4eba65";
const NB = " ";

// ── domain/text.ts ──
const cfCells = t => { let n = 0; for (const ch of t) n += ch.codePointAt(0) > 0x2e7f ? 2 : 1; return n; };
const cfClip = (t, max) => { if (cfCells(t) <= max) return t; let out = "", n = 0;
  for (const ch of t) { const w = ch.codePointAt(0) > 0x2e7f ? 2 : 1; if (n + w > max - 1) break; out += ch; n += w; } return out + "…"; };
const cfWrap = (t, width, maxLines) => { const lines = []; let line = "", n = 0;
  for (const ch of t) { const w = ch.codePointAt(0) > 0x2e7f ? 2 : 1; if (n + w > width) { lines.push(line); line = ""; n = 0; } line += ch; n += w; }
  if (line !== "" || lines.length === 0) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines); kept[maxLines - 1] = cfClip(kept[maxLines - 1] + "……", width); return kept; };
const cfModelName = raw => { const split = /^(.*?)\s*[([](.+)[)\]]\s*$/.exec(raw); let name = (split ? split[1] : raw).trim().replace(/^claude-/, "");
  if (/^[a-z0-9-]+$/.test(name)) name = name.replace(/-\d{8}$/, "").replace(/-/g, " ").replace(/(\d+) (\d+)/, "$1.$2"); return name; };
const cfClock = ms => { const total = Math.max(0, Math.floor(ms / 1000)); return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0"); };
const cfTokens = n => n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M" : n >= 1000 ? (n / 1000).toFixed(n >= 1e5 ? 0 : 1) + "k" : String(n);

// ── domain/color.ts ──
const cfRunsOf = (t, paint) => { const runs = []; let i = 0;
  for (const ch of t) { const s = paint(i++); const last = runs[runs.length - 1]; const g = ch === " " ? NB : ch;
    if (last && last.color === s.color && last.isBold === s.isBold && last.isDim === s.isDim) last.text += g; else runs.push({ text: g, ...s }); }
  return runs; };
const cfHex = rgb => "#" + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const CF_PALETTES = {
  navy: { label: "濃紺", top: [16, 26, 51], bottom: [5, 7, 13] },
  sumi: { label: "墨", top: [30, 30, 34], bottom: [10, 10, 12] },
  murasaki: { label: "紫", top: [36, 20, 56], bottom: [8, 5, 14] },
  mori: { label: "深緑", top: [10, 36, 32], bottom: [4, 9, 9] },
  akane: { label: "茜", top: [52, 18, 28], bottom: [12, 5, 8] },
  yoake: { label: "夜明け", top: [14, 22, 50], bottom: [44, 20, 38] },
  umi: { label: "深海", top: [6, 34, 48], bottom: [3, 8, 16] },
  none: null,
};
const cfBackground = name => { const p = CF_PALETTES[name]; if (!p) return "transparent"; return cfHex([0, 1, 2].map(c => (p.top[c] + p.bottom[c]) / 2)); };
const CF_RAINBOW = [[235, 95, 87], [245, 139, 87], [250, 195, 95], [145, 200, 130], [130, 170, 220], [155, 130, 200], [200, 130, 180]];
const CF_SHADES = 720;
const cfRainbow = (t, glow = 0) => { const n = Math.floor((((t % 1) + 1) % 1) * CF_SHADES) % CF_SHADES; const g = glow >= 0.7 ? 0.75 : glow > 0 ? 0.4 : 0;
  const x = (n / CF_SHADES) * CF_RAINBOW.length; const i = Math.floor(x) % CF_RAINBOW.length;
  const a = CF_RAINBOW[i], b = CF_RAINBOW[(i + 1) % CF_RAINBOW.length], k = x - Math.floor(x);
  const mix = c => { const v = a[c] + (b[c] - a[c]) * k; return v + (255 - v) * g; };
  return cfHex([mix(0), mix(1), mix(2)]); };
const cfHueAt = (frame, index = 0, glow = 0) => cfRainbow(index * 0.045 - frame * 0.05, glow);
const cfUltraAt = (index, length, frame) => { const center = ((frame * 2.2) % (length + 16)) - 6; const far = Math.abs(index - center);
  const glow = far < 1.2 ? 0.75 : far < 3 ? 0.4 : 0; return { color: cfRainbow(index * 0.045 - frame * 0.05, glow), isBold: true }; };
const cfUltra = (t, frame) => { const length = [...t].length; return cfRunsOf(t, i => cfUltraAt(i, length, frame)); };
const CF_PULSE = ["◌", "○", "◎", "◉", "◎", "○"];
const CF_METER_WIDTH = 6, CF_BARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];
const cfWave = frame => Array.from({ length: CF_METER_WIDTH }, (_, k) => CF_BARS[Math.round(((Math.sin(frame * 0.9 + k * 1.4) + 1) / 2) * (CF_BARS.length - 1))] || "▁").join("");

// ── domain/flow.ts ──
const cfChaptersOf = list => { const chapters = [];
  list.forEach((step, i) => { const current = chapters[chapters.length - 1]; const name = step.chapter ?? (current ? current.name : "…");
    if (current !== undefined && current.name === name) current.last = i;
    else chapters.push({ name, isSide: chapters.length > 0 && step.isSide === true, first: i, last: i }); });
  return chapters; };
function cfFlowLines(list, isRunning, text, now, frame) {
  const chapters = cfChaptersOf(list), all = [];
  chapters.forEach((chapter, c) => {
    const isCurrent = c === chapters.length - 1, isLast = isCurrent && !isRunning;
    const tag = chapter.first === chapter.last && !isCurrent ? "#" + (chapter.first + 1) : "#" + (chapter.first + 1) + "-" + (isCurrent ? "" : chapter.last + 1);
    const gutter = chapter.isSide ? CF_BRANCH : CF_TRUNK, width = text - (gutter - CF_TRUNK);
    const name = cfClip(chapter.name, width - cfCells(tag) - 2);
    const jump = isCurrent ? undefined : chapter.first;
    if (!chapter.isSide && all.length > 0) all.push({ rail: "┃", runs: [], meta: { part: "gap" } });
    if (chapter.isSide) all.push({ rail: (isCurrent ? "┗" : "┣") + "━━" + (isCurrent ? "◉" : "○"), gutter, isNode: true, isStrong: isLast,
      runs: [{ text: name, isBold: isCurrent, isDim: !isCurrent }], right: tag, isRightQuiet: true, target: jump, meta: { part: "branch", chapter: c, first: chapter.first, current: isCurrent } });
    else all.push({ rail: isCurrent ? "◉" : "●", isNode: true, isStrong: isLast, runs: [{ text: name, isBold: true }], right: tag, isRightQuiet: true, target: jump,
      meta: { part: "node", chapter: c, first: chapter.first, current: isCurrent } });
    if (!isCurrent) return;
    const inside = chapter.isSide ? NB + NB + NB + "│" : "┃";
    for (let i = chapter.first; i <= chapter.last; i++) {
      const step = list[i]; if (step === undefined) continue;
      const isLatest = i === list.length - 1, number = "#" + (i + 1);
      const title = cfClip(step.title ?? (step.prompt || "(入力なしで続行)"), width - 2 - cfCells(number) - 2);
      let budget = step.doneAt === undefined ? Infinity : Math.max(0, Math.floor((now - step.doneAt) / CF_TYPE_MS));
      const type = line => { const chars = [...line]; const shown = chars.slice(0, Math.max(0, budget)).join(""); const hasCursor = budget >= 0 && budget < chars.length; budget -= chars.length; return { shown, hasCursor }; };
      if (step.summary === undefined) {
        all.push({ rail: inside, gutter, isLive: true, right: number, isRightQuiet: true, target: i, meta: { part: "head", step: i },
          runs: cfRunsOf("· " + title, index => ({ isDim: Math.abs(index - ((frame * 1.6) % ([...title].length + 10))) > 2 })) });
        continue;
      }
      const head = type(title);
      all.push({ rail: inside, gutter, right: number, isRightQuiet: true, target: i, meta: { part: "head", step: i },
        runs: [{ text: "· ", isDim: true }, { text: head.shown, isBold: isLatest && !isRunning }, ...(head.hasCursor ? [{ text: "▍", color: cfHueAt(frame) }] : [])] });
      if (!isLatest) continue;
      cfWrap(step.summary, width - 2, 3).forEach((line, k) => { const body = type(line);
        all.push({ rail: inside, gutter, meta: { part: "body", step: i, k }, runs: [{ text: NB + NB }, { text: body.shown, isDim: true }, ...(body.hasCursor ? [{ text: "▍", color: cfHueAt(frame) }] : [])] }); });
    }
    if (isRunning) all.push({ rail: chapter.isSide ? NB + NB + NB + "│" : "┃", gutter, runs: [], meta: { part: "join" } });
  });
  return all;
}
function cfFootLines(running, subs, text, now, frame) {
  const beatIndex = Math.floor(frame), actions = running ? running.actions.slice(-3) : [], foot = [];
  if (running !== null) {
    const time = cfClock(now - running.startedAt), title = cfClip(running.prompt || "続行中", text - cfCells(time) - 2);
    foot.push({ rail: CF_PULSE[beatIndex % CF_PULSE.length] || "◉", isNode: true, isLive: true, runs: cfUltra(title, frame), right: time, meta: { part: "now" } });
    const shown = actions.length > 0 ? actions : ["考え中"];
    shown.forEach((action, i) => { const isCurrent = i === shown.length - 1;
      foot.push({ rail: "┆", isLive: true, runs: [{ text: cfClip((isCurrent ? "❯" : "·") + " " + action, text - (isCurrent ? CF_METER_WIDTH + 2 : 0)).replace(/ /g, NB), isDim: !isCurrent }],
        rightRuns: isCurrent ? cfUltra(cfWave(frame), frame) : undefined, meta: { part: isCurrent ? "tool-now" : "tool" } }); });
  }
  if (subs.length > 0) {
    foot.push({ rail: "┆", isLive: true, runs: [{ text: "サブエージェント" + NB + subs.length, isDim: true }], meta: { part: "subs" } });
    for (const sub of subs.slice(0, 4)) { const label = cfClip((sub.type + " " + sub.description).trim(), text - 2); const spare = text - 2 - cfCells(label) - 3;
      const action = sub.action !== undefined && spare >= 8 ? cfClip(sub.action, spare) : "";
      foot.push({ rail: CF_PULSE[(beatIndex + 3) % CF_PULSE.length] || "○", isNode: true, isLive: true, meta: { part: "sub" },
        runs: [...cfUltra(label, frame), ...(action === "" ? [] : [{ text: NB + "·" + NB + action.replace(/ /g, NB), isDim: true }])] }); }
    if (subs.length > 4) foot.push({ rail: "┆", isLive: true, runs: [{ text: "ほか" + NB + (subs.length - 4), isDim: true }], meta: {} });
  }
  // 「いま」の区画は、全部の文字に虹の流れと光の帯を乗せる。
  for (const line of foot) { const whole = line.runs.map(r => r.text).join(""); line.runs = cfUltra(whole, frame);
    if (line.right !== undefined) { line.rightRuns = cfUltra(line.right, frame); line.right = undefined; } }
  return foot;
}
const cfWindowOf = (total, rows, back) => { const maxScroll = Math.max(0, total - rows), offset = Math.min(back, maxScroll);
  let end = total - offset, start = Math.max(0, end - rows); const hasAbove = start > 0, hasBelow = offset > 0;
  if (hasAbove) start += 1; if (hasBelow) end -= 1; return { start, end, hasAbove, hasBelow, maxScroll }; };

// ── 時刻 g(秒・動画の通し時刻)での状態。D = 会話の中身(gen.mjs の SESSION)、G = 出来事の時刻の表 ──
function cfWorld(D, G, g) {
  const E = k => (G[k] === undefined ? 1e9 : G[k]);
  const ms = t => CF_NOW0 + t * 1000;
  const now = ms(g), n = D.past.length;
  const doneOf = i => ms(E("sumA") + ((E("sumB") - E("sumA")) * i) / (n - 1));
  let steps = [], goal = "", decided = [], open = [];
  if (g >= E("open")) D.past.forEach((s, i) => { const d = doneOf(i);
    if (now >= d) { steps.push({ id: "past-" + i, prompt: s.prompt, title: s.title, summary: s.summary, doneAt: d });
      if (i === 0) goal = D.goal1; if (s.decided) decided = s.decided; if (s.open) open = s.open; }
    else steps.push({ id: "past-" + i, prompt: s.prompt }); });
  const T = D.turn; let live = null;
  if (g >= E("send") && g < E("done")) live = { prompt: T.prompt, startedAt: ms(E("send")), actions: T.actions.filter(a => g >= E(a.at)).map(a => a.text).slice(-6) };
  if (g >= E("done")) {
    if (g >= E("sumT")) { steps.push({ id: "turn", prompt: T.prompt, title: T.title, summary: T.summary, doneAt: ms(E("sumT")) }); goal = D.goal2; decided = T.decided; open = T.open; }
    else steps.push({ id: "turn", prompt: T.prompt });
  }
  // 章の区切り直し(applySegments)。届く前は chapter が無い(=「…」の 1 章、または直前の章の続き)。
  const seg = g >= E("seg2") ? D.seg2 : g >= E("seg1") ? D.seg1 : null;
  if (seg) steps = steps.map((step, i) => { let ch;
    for (const one of seg) if (one[0] <= i + 1 && i + 1 <= one[1]) ch = one;
    if (!ch) for (const one of seg) if (one[0] <= i + 1) ch = one;
    if (!ch) ch = seg[0];
    return { ...step, chapter: ch[3], isSide: ch !== seg[0] && ch[2] }; });
  const agents = T.subs.filter(s => g >= E(s.from) && g < E(s.to)).map(s => { const done = s.actions.filter(a => g >= E(a.at)); return { type: s.type, description: s.description, action: done.length ? done[done.length - 1].text : undefined }; });
  let tokens = D.tokens; for (const [k, by] of D.grow) if (g >= E(k)) tokens += by;
  let scroll = 0; for (const [k, by] of D.wheel) if (g >= E(k) && E(k) > E("send")) scroll += by; // 送信で最新に戻る
  let palette = "none"; for (const [k, name] of D.bg) if (g >= E(k)) palette = name;
  return { meter: { model: D.model, tokens, window: D.window, percent: (tokens / D.window) * 100 }, goal, decided, open, steps, live, agents,
    scroll: Math.max(0, scroll), boot: g >= E("open") ? ms(E("open")) : 0, palette, isOpen: g >= E("open"), now };
}

// ── 描画(ui/pane.tsx の renderPane と同じ順・同じ式)。rows = [{html, meta}] を room 行ぶん返す ──
const cfEsc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// 罫線(┃ ┣ ┗ ━ ─ │ ┆)は、端末と同じく 1 桁のマスいっぱいに線で描く(フォントの字形だと行の間が切れ、太さもそろわない)。
// 丸(● ○ ◉ ◌ ◎)は 1 桁のマスの中央に置く。どちらも色は文字と同じ(currentColor)。
const CF_BOX = { "┃": "v", "┣": "t", "┗": "l", "━": "h", "─": "hl", "│": "vl", "┆": "vd" };
const cfTxt = s => cfEsc(s).replace(/[⺀-￿]+/g, m => '<i class="w">' + m + "</i>") // 全角は 2 桁ぶんの幅にする
  .replace(/[┃┣┗━─│┆]/g, c => '<b class="bx bx-' + CF_BOX[c] + '"></b>').replace(/[●○◉◌◎]/g, c => '<b class="dot">' + c + "</b>");
const cfRun = r => { const st = (r.color ? "color:" + r.color + ";" : "") + (r.isBold ? "font-weight:700;" : "");
  return "<span" + (r.isDim ? ' class="dim"' : "") + (st ? ' style="' + st + '"' : "") + ">" + cfTxt(r.text) + "</span>"; };

function cfLayout(S, bodyColumns, bodyRows) {
  const gauge = S.meter, aim = S.goal, list = S.steps, running = S.live, now = S.now;
  const columns = Math.max(24, bodyColumns - 4), text = columns - 3, room = Math.max(14, bodyRows);
  const frame = now / CF_FRAME_MS;
  const percent = Math.min(100, Math.max(0, gauge.percent));
  const tone = percent >= 85 ? CF_ERR : percent >= 70 ? CF_WARN : undefined;
  const amount = cfTokens(gauge.tokens) + " / " + cfTokens(gauge.window);
  const filled = Math.round((percent / 100) * columns);
  const glint = ((frame * 1.5) % (filled + 12)) - 3;
  const bar = cfRunsOf("━".repeat(filled), i => { const far = Math.abs(i - glint); const glow = far < 1.5 ? 0.75 : far < 3.5 ? 0.4 : 0;
    return { color: cfRainbow(i * 0.045 - frame * 0.05, glow), isBold: glow > 0 }; });
  const aimLines = cfWrap(aim || (list.length > 0 ? "読み取り中…" : "まだ会話がありません"), columns, 2);
  const name = cfModelName(gauge.model), spaced = [...name.toUpperCase()].join(" ");
  const nameText = name === "" ? "…" : cfCells(spaced) <= columns - cfCells(amount) - 9 ? spaced : name;
  const isTall = bodyRows >= 30;
  const decidedShown = S.decided.slice(0, isTall ? 3 : 2), openShown = S.open.slice(0, isTall ? 2 : 1);
  const stateRows = (decidedShown.length > 0 ? 1 + decidedShown.length : 0) + (openShown.length > 0 ? 1 + openShown.length : 0) + (decidedShown.length + openShown.length > 0 ? 1 : 0);
  const headRows = 1 + 2 + 1 + 1 + aimLines.length + 1 + stateRows + 1 + 1;

  const foot = cfFootLines(running, S.agents, text, now, frame);
  const all = cfFlowLines(list, running !== null, text, now, frame);
  const total = all.length;
  const cut = cfWindowOf(total, Math.max(3, room - headRows - foot.length), S.scroll);
  const lines = all.slice(cut.start, cut.end), above = cut.start, below = total - cut.end;
  const drop = running === null ? -9 : Math.floor(frame * 2.5) % (lines.length + foot.length + 5);
  const draw = (line, row) => { const far = drop - row;
    const railColor = far === 0 ? cfHueAt(frame, row * 2, 0.75) : far === 1 ? cfHueAt(frame, row * 2, 0.4) : line.isLive || line.isStrong || far === 2 ? cfHueAt(frame, row * 2) : undefined;
    const isLit = railColor !== undefined;
    let h = '<span class="rail' + (isLit ? "" : " dim") + '" style="width:' + (line.gutter || 3) + "ch" + (isLit ? ";color:" + railColor + ";font-weight:700" : "") + '">' + cfTxt(line.rail) + "</span>";
    h += '<span class="lft">' + line.runs.map(cfRun).join("") + "</span>";
    if (line.rightRuns !== undefined) h += '<span class="rgt">' + line.rightRuns.map(cfRun).join("") + "</span>";
    if (line.right !== undefined && line.isRightQuiet) h += '<span class="rgt dim">' + line.right + "</span>";
    if (line.right !== undefined && !line.isRightQuiet) h += '<span class="rgt" style="font-weight:700;color:' + cfHueAt(frame, text) + '">' + line.right + "</span>";
    return { html: '<div class="pl">' + h + "</div>", meta: line.meta || {} }; };

  const out = [];
  const push = (html, meta) => out.push({ html: html || "", meta: meta || {} });
  push("");
  push('<div class="ph"><span>' + cfUltra(nameText, frame).map(cfRun).join("") + '</span><span><span class="dim">' + amount + "  </span><span style=\"font-weight:700" + (tone ? ";color:" + tone : "") + '">' + Math.round(percent) + "%</span></span></div>", { part: "meter" });
  push(bar.map(r => cfRun({ text: r.text, isBold: r.isBold, color: r.isBold ? r.color : tone || r.color })).join("") + '<span class="dim">' + cfTxt("─".repeat(columns - filled)) + "</span>", { part: "bar" });
  push("");
  push('<span class="dim">' + cfTxt("目的") + "</span>", { part: "aim-label" });
  const plain = run => cfRun(run);
  aimLines.forEach(line => push(plain({ text: line, isBold: aim !== "", isDim: aim === "" }), { part: "aim" }));
  push("");
  if (decidedShown.length > 0) push('<span class="dim">' + cfTxt("決まったこと") + "</span>", { part: "decided-label" });
  decidedShown.forEach((item, k) => push('<span style="color:' + CF_OK + '">✓ </span>' + plain({ text: cfClip(item, columns - 2) }), { part: "decided", k }));
  if (openShown.length > 0) push('<span class="dim">' + cfTxt("残っていること") + "</span>", { part: "open-label" });
  openShown.forEach((item, k) => push('<span class="dim">· </span>' + plain({ text: cfClip(item, columns - 2) }), { part: "open", k }));
  if (decidedShown.length + openShown.length > 0) push("");
  push('<div class="ph"><span class="dim">' + cfTxt("流れ") + '</span><span style="font-weight:700">' + cfTxt(running !== null ? list.length + 1 + " ターン目" : list.length + " ターン") + "</span></div>", { part: "flow-label" });
  push("");
  if (list.length === 0 && running === null) push('<span class="dim">' + cfTxt("最初のターンが終わると、ここに流れが並びます。") + "</span>");
  if (cut.hasAbove) push('<span class="dim">' + cfTxt("┆  ↑ 上に " + above + " 行") + "</span>", { part: "above" });
  lines.forEach((line, row) => out.push(draw(line, row)));
  if (cut.hasBelow) push('<span class="dim">' + cfTxt("┆  ↓ 下に " + below + " 行") + "</span>", { part: "below" });
  foot.forEach((line, row) => out.push(draw(line, lines.length + row)));
  while (out.length < room) push("");
  out.maxScroll = cut.maxScroll;

  // ── ui/splash.tsx(renderBoot) ──
  const sinceBoot = S.boot === 0 ? Infinity : Math.max(0, now - S.boot);
  if (sinceBoot >= CF_SPLASH_MS + CF_REVEAL_MS) return out;
  if (sinceBoot >= CF_SPLASH_MS) { const k = (sinceBoot - CF_SPLASH_MS) / CF_REVEAL_MS, eased = 1 - (1 - k) * (1 - k) * (1 - k);
    const h = Math.max(1, Math.round(room * eased)); return out.map((r, i) => (i < h ? r : { html: "", meta: {} })); }
  const clamp = v => Math.min(1, Math.max(0, v));
  const typed = [...CF_WORDMARK].slice(0, Math.floor(sinceBoot / 40)).join(""), isTyping = typed.length < CF_WORDMARK.length;
  const opened = clamp((sinceBoot - 150) / 800), half = Math.round((1 - (1 - opened) * (1 - opened)) * (columns / 2));
  const swell = Math.sin(Math.PI * clamp((sinceBoot - 350) / 1450));
  const crest = Array.from({ length: columns }, (_, c) => CF_BARS[Math.round(swell * ((Math.sin(frame * 1.3 + c * 0.42) + 1) / 2) * (CF_BARS.length - 1))] || "▁").join("");
  const status = sinceBoot < 1250 ? "会話の流れを読み込み中" : "準備完了";
  const top = Math.max(1, Math.floor((room - 7) / 2)), splash = {};
  splash[top] = cfUltra(typed === "" ? " " : typed, frame).map(cfRun).join("") + (isTyping ? '<span style="color:' + cfHueAt(frame) + '">▍</span>' : "");
  splash[top + 2] = cfUltra("━".repeat(Math.max(1, half * 2)), frame).map(cfRun).join("");
  splash[top + 4] = cfUltra(crest, frame).map(r => cfRun({ text: r.text, color: r.color })).join("");
  splash[top + 6] = '<span class="dim">' + cfTxt(status) + "</span>";
  return Array.from({ length: room }, (_, i) => ({ html: splash[i] ? '<div class="pc">' + splash[i] + "</div>" : "", meta: { part: "splash" } }));
}

const CF_COLS = 69, CF_ROWS = 30; // ペインの本文:69 桁 x 30 行(左右 2 桁の余白を引いて 65 桁。30 行以上で 決まったこと 3・残っていること 2 まで出る)
function cfRender(el, D, G, g) {
  const S = cfWorld(D, G, g);
  // 背景は行ごとに塗る(backgroundAt)。既定の none は塗らない(端末の地の色のまま)。
  // ペインの一番下の 1 行は mod からは塗れないので、色を付けた時もそこだけ地の色になる。
  const bg = CF_PALETTES[S.palette] ? cfBackground(S.palette) : "";
  const html = S.isOpen ? cfLayout(S, CF_COLS, CF_ROWS).slice(0, CF_ROWS).map((r, i) => '<div class="ln"' + (bg && i < CF_ROWS - 1 ? ' style="background:' + bg + '"' : "") + ">" + r.html + "</div>").join("") : "";
  if (el.__cf !== html) { el.innerHTML = html; el.__cf = html; }
}
// 時間軸に乗せる:t を 0 → 場面の尺まで等速で動かし、値が書かれるたびに描き直す(seek でも同じ絵になる)。
function cfDrive(sel, D, G, T0, tl) {
  const el = document.querySelector(sel); if (!el) return;
  const dur = parseFloat(el.closest(".stage").getAttribute("data-duration"));
  const p = {}; let v = 0;
  Object.defineProperty(p, "t", { get() { return v; }, set(x) { v = x; cfRender(el, D, G, T0 + x); } });
  cfRender(el, D, G, T0);
  tl.to(p, { t: dur, duration: dur, ease: "none" }, 0);
}
function ev() {} // 出来事の時刻の印(gen.mjs と narrate.py が読んで G を作る)

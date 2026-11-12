// src/pane.js — context-flow のペイン。context-flow/hooks/register.tsx の ui.render(Pane)を移したもの。
// 行の並び・文言・記号・色の式・コマの刻みは実物と同じ。違うのは「いつ何が起きるか」を時刻の表(G)から決めることだけ。
// build.mjs が各 scene に inline する。gen.mjs も同じファイルを読んで、ラベルを置く行を計算する。
const CF_FRAME_MS = 200, CF_TYPE_MS = 18, CF_BEAT_MS = 80, CF_IDLE_EVERY = 12, CF_NOW0 = 600000;
const CF_TX = "#cdd6f4", CF_WARN = "#ffc107", CF_ERR = "#ff6b80";

const cfCells = t => { let n = 0; for (const ch of t) n += ch.codePointAt(0) > 0x2e7f ? 2 : 1; return n; };
const cfClip = (t, max) => { if (cfCells(t) <= max) return t; let out = "", n = 0;
  for (const ch of t) { const w = ch.codePointAt(0) > 0x2e7f ? 2 : 1; if (n + w > max - 1) break; out += ch; n += w; } return out + "…"; };
const cfWrap = (t, width, maxLines) => { const lines = []; let line = "", n = 0;
  for (const ch of t) { const w = ch.codePointAt(0) > 0x2e7f ? 2 : 1; if (n + w > width) { lines.push(line); line = ""; n = 0; } line += ch; n += w; }
  if (line !== "" || lines.length === 0) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines); kept[maxLines - 1] = cfClip(kept[maxLines - 1] + "……", width); return kept; };
const cfRunsOf = (t, paint) => { const runs = []; let i = 0;
  for (const ch of t) { const s = paint(i++); const last = runs[runs.length - 1]; const g = ch === " " ? " " : ch;
    if (last && last.color === s.color && last.isBold === s.isBold && last.isDim === s.isDim) last.text += g; else runs.push({ text: g, ...s }); }
  return runs; };
const CF_PULSE = ["◌", "○", "◎", "◉", "◎", "○"];
const CF_RAINBOW = [[235, 95, 87], [245, 139, 87], [250, 195, 95], [145, 200, 130], [130, 170, 220], [155, 130, 200], [200, 130, 180]];
const cfHex = rgb => "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
const cfRainbow = (t, glow = 0) => { const x = (((t % 1) + 1) % 1) * CF_RAINBOW.length; const i = Math.floor(x) % CF_RAINBOW.length;
  const a = CF_RAINBOW[i], b = CF_RAINBOW[(i + 1) % CF_RAINBOW.length], k = x - Math.floor(x);
  const mix = n => { const v = a[n] + (b[n] - a[n]) * k; return v + (255 - v) * glow; };
  return cfHex([mix(0), mix(1), mix(2)]); };
const cfUltraAt = (index, length, frame) => { const center = ((frame * 2.2) % (length + 16)) - 6; const far = Math.abs(index - center);
  const glow = far < 1.2 ? 0.75 : far < 3 ? 0.4 : 0; return { color: cfRainbow(index * 0.045 - frame * 0.05, glow), isBold: true }; };
const cfUltra = (t, frame) => { const length = [...t].length; return cfRunsOf(t, i => cfUltraAt(i, length, frame)); };
const CF_METER_WIDTH = 6, CF_BARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];
const cfWave = frame => Array.from({ length: CF_METER_WIDTH }, (_, k) => CF_BARS[Math.round(((Math.sin(frame * 0.9 + k * 1.4) + 1) / 2) * (CF_BARS.length - 1))]).join("");
const cfModelName = raw => { const split = /^(.*?)\s*[([](.+)[)\]]\s*$/.exec(raw); let name = (split ? split[1] : raw).trim().replace(/^claude-/, "");
  if (/^[a-z0-9-]+$/.test(name)) name = name.replace(/-\d{8}$/, "").replace(/-/g, " ").replace(/(\d+) (\d+)/, "$1.$2"); return name; };
const cfClock = ms => { const total = Math.max(0, Math.floor(ms / 1000)); return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0"); };
const cfTokens = n => n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M" : n >= 1000 ? (n / 1000).toFixed(n >= 1e5 ? 0 : 1) + "k" : String(n);

// ── 時刻 g(秒・動画の通し時刻)での状態。D = 会話の中身(gen.mjs の SESSION)、G = 出来事の時刻の表 ──
function cfWorld(D, G, g) {
  const E = k => (G[k] === undefined ? 1e9 : G[k]);
  const ms = t => CF_NOW0 + t * 1000;
  const raw = ms(g), n = D.past.length;
  const doneOf = i => ms(E("sumA") + ((E("sumB") - E("sumA")) * i) / (n - 1));
  const list = []; let fastUntil = 0;
  if (g >= E("open")) D.past.forEach((s, i) => { const d = doneOf(i);
    if (raw >= d) { list.push({ id: "past-" + i, prompt: s.prompt, title: s.title, summary: s.summary, doneAt: d }); fastUntil = Math.max(fastUntil, d + 3500); }
    else list.push({ id: "past-" + i, prompt: s.prompt }); });
  const T = D.turn; let running = null;
  if (g >= E("send") && g < E("done")) running = { prompt: T.prompt, startedAt: ms(E("send")), actions: T.actions.filter(a => g >= E(a.at)).map(a => a.text).slice(-6) };
  if (g >= E("done")) { const d = ms(E("sumT"));
    if (raw >= d) { list.push({ id: "turn", prompt: T.prompt, title: T.title, summary: T.summary, doneAt: d }); fastUntil = Math.max(fastUntil, d + 3500); }
    else list.push({ id: "turn", prompt: T.prompt }); }
  const subs = T.subs.filter(s => g >= E(s.from) && g < E(s.to)).map(s => { const done = s.actions.filter(a => g >= E(a.at)); return { type: s.type, description: s.description, action: done.length ? done[done.length - 1].text : undefined }; });
  const aim = g >= E("sumT") ? D.goal2 : n > 0 && g >= E("open") && raw >= doneOf(0) ? D.goal1 : "";
  let tokens = D.tokens; for (const [k, by] of D.grow) if (g >= E(k)) tokens += by;
  let back = 0; for (const [k, by] of D.wheel) if (g >= E(k)) back += by;
  const busy = running !== null || subs.length > 0 || raw <= fastUntil;
  const q = busy ? CF_BEAT_MS : CF_BEAT_MS * CF_IDLE_EVERY;
  return { gauge: { model: D.model, tokens, window: D.window, percent: (tokens / D.window) * 100 }, aim, list, running, subs, back: Math.max(0, back), now: Math.floor(raw / q) * q };
}

// ── 描画(register.tsx の Pane と同じ順・同じ式)。rows = [{html, meta}] を返す ──
const cfEsc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cfTxt = s => cfEsc(s).replace(/[⺀-￿]+/g, m => '<i class="w">' + m + "</i>"); // 全角は 2 桁ぶんの幅にする
const cfRun = r => { const st = (r.color ? "color:" + r.color + ";" : "") + (r.isBold ? "font-weight:700;" : "");
  return "<span" + (r.isDim ? ' class="dim"' : "") + (st ? ' style="' + st + '"' : "") + ">" + cfTxt(r.text) + "</span>"; };

function cfLayout(S, bodyColumns, bodyRows) {
  const { gauge, aim, list, running, subs, now, back } = S;
  const columns = Math.max(24, bodyColumns - 4), text = columns - 3, room = Math.max(14, bodyRows);
  const frame = now / CF_FRAME_MS, beatIndex = Math.floor(frame);
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
  const headRows = 1 + 2 + 1 + 1 + aimLines.length + 1 + 1 + 1;
  const hue = (index = 0, glow = 0) => cfRainbow(index * 0.045 - frame * 0.05, glow);

  const foot = [];
  if (running !== null) {
    const time = cfClock(now - running.startedAt);
    foot.push({ rail: CF_PULSE[beatIndex % CF_PULSE.length], isNode: true, isLive: true, runs: cfUltra(cfClip(running.prompt || "続行中", text - cfCells(time) - 2), frame), right: time, meta: { part: "now" } });
    const actions = running.actions.slice(-3), shown = actions.length > 0 ? actions : ["考え中"];
    shown.forEach((action, i) => { const isCurrent = i === shown.length - 1;
      foot.push({ rail: "┆", isLive: true, runs: [{ text: cfClip((isCurrent ? "❯" : "·") + " " + action, text - (isCurrent ? CF_METER_WIDTH + 2 : 0)).replace(/ /g, " "), isDim: !isCurrent }],
        rightRuns: isCurrent ? cfUltra(cfWave(frame), frame) : undefined, meta: { part: isCurrent ? "tool-now" : "tool" } }); });
  }
  if (subs.length > 0) {
    foot.push({ rail: "┆", isLive: true, runs: [{ text: "サブエージェント " + subs.length, isDim: true }], meta: { part: "subs" } });
    for (const sub of subs.slice(0, 4)) { const label = cfClip((sub.type + " " + sub.description).trim(), text - 2); const spare = text - 2 - cfCells(label) - 3;
      const action = sub.action !== undefined && spare >= 8 ? cfClip(sub.action, spare) : "";
      foot.push({ rail: CF_PULSE[(beatIndex + 3) % CF_PULSE.length], isNode: true, isLive: true, meta: { part: "sub" },
        runs: [...cfUltra(label, frame), ...(action === "" ? [] : [{ text: " · " + action.replace(/ /g, " "), isDim: true }])] }); }
    if (subs.length > 4) foot.push({ rail: "┆", isLive: true, runs: [{ text: "ほか " + (subs.length - 4), isDim: true }] });
  }

  const wrapped = list.map(step => cfWrap(step.summary || "", text, 3));
  const sizes = wrapped.map((lines, i) => 1 + (list[i].summary === undefined ? 0 : lines.length) + (running === null && i === list.length - 1 ? 0 : 1));
  const total = sizes.reduce((a, b) => a + b, 0);
  const win = Math.max(3, room - headRows - foot.length);
  const maxScroll = Math.max(0, total - win), offset = Math.min(back, maxScroll);
  let end = total - offset, start = Math.max(0, end - win);
  const hasAbove = start > 0, hasBelow = offset > 0;
  if (hasAbove) start += 1; if (hasBelow) end -= 1;
  const lines = []; let above = 0, below = 0, at = 0;
  list.forEach((step, i) => {
    const top = at; at += sizes[i];
    if (top < start) above++; if (top >= end) below++;
    if (at <= start || top >= end) return;
    const isStrong = i === list.length - 1 && running === null, tag = "#" + (i + 1);
    const title = cfClip(step.title || step.prompt || "(入力なしで続行)", text - cfCells(tag) - 2);
    let budget = step.doneAt === undefined ? Infinity : Math.max(0, Math.floor((now - step.doneAt) / CF_TYPE_MS));
    const type = line => { const chars = [...line]; const shown = chars.slice(0, Math.max(0, budget)).join(""); const hasCursor = budget >= 0 && budget < chars.length; budget -= chars.length; return { shown, hasCursor }; };
    const block = [];
    if (step.summary === undefined) {
      block.push({ rail: CF_PULSE[beatIndex % CF_PULSE.length], isNode: true, isLive: true, right: tag, isRightQuiet: true, target: i, meta: { step: i, part: "head" },
        runs: cfRunsOf(title, index => ({ isDim: Math.abs(index - ((frame * 1.6) % ([...title].length + 8))) > 2 })) });
    } else {
      const head = type(title);
      block.push({ rail: isStrong ? "◉" : "○", isNode: true, isStrong, right: tag, isRightQuiet: true, target: i, meta: { step: i, part: "head" },
        runs: [{ text: head.shown, isBold: true }, ...(head.hasCursor ? [{ text: "▍", color: hue() }] : [])] });
      wrapped[i].forEach((line, k) => { const body = type(line);
        block.push({ rail: "│", meta: { step: i, part: "body", k }, runs: [{ text: body.shown, isDim: true }, ...(body.hasCursor ? [{ text: "▍", color: hue() }] : [])] }); });
    }
    block.push({ rail: "│", runs: [], meta: { step: i, part: "gap" } });
    block.slice(0, sizes[i]).forEach((line, k) => { if (top + k >= start && top + k < end) lines.push(line); });
  });
  const drop = running === null ? -9 : Math.floor(frame * 2.5) % (lines.length + foot.length + 5);
  const draw = (line, row) => { const far = drop - row;
    const railColor = far === 0 ? hue(row * 2, 0.75) : far === 1 ? hue(row * 2, 0.4) : line.isLive || line.isStrong || far === 2 ? hue(row * 2) : undefined;
    const isLit = railColor !== undefined;
    let h = '<span class="rail' + (isLit ? "" : " dim") + '"' + (isLit ? ' style="color:' + railColor + ';font-weight:700"' : "") + ">" + (!line.isNode && far === 0 ? "┃" : line.rail) + "</span>";
    h += '<span class="lft">' + line.runs.map(cfRun).join("") + "</span>";
    if (line.rightRuns !== undefined) h += '<span class="rgt">' + line.rightRuns.map(cfRun).join("") + "</span>";
    if (line.right !== undefined && line.isRightQuiet) h += '<span class="rgt dim">' + line.right + "</span>";
    if (line.right !== undefined && !line.isRightQuiet) h += '<span class="rgt" style="font-weight:700;color:' + hue(text) + '">' + line.right + "</span>";
    return { html: '<div class="pl">' + h + "</div>", meta: line.meta || {} }; };

  const rows = [];
  const push = (html, meta) => rows.push({ html, meta: meta || {} });
  push("");
  push('<div class="ph"><span>' + cfUltra(nameText, frame).map(cfRun).join("") + '</span><span><span class="dim">' + amount + "  </span><span style=\"font-weight:700" + (tone ? ";color:" + tone : "") + '">' + Math.round(percent) + "%</span></span></div>", { part: "meter" });
  push(bar.map(r => cfRun({ text: r.text, isBold: r.isBold, color: r.isBold ? r.color : tone || r.color })).join("") + '<span class="dim">' + "─".repeat(columns - filled) + "</span>", { part: "bar" });
  push("");
  push('<span class="dim">' + cfTxt("目的") + "</span>", { part: "aim-label" });
  aimLines.forEach(line => push(cfRun({ text: line, isBold: aim !== "", isDim: aim === "" }), { part: "aim" }));
  push("");
  push('<div class="ph"><span class="dim">' + cfTxt("流れ") + '</span><span style="font-weight:700">' + cfTxt(running !== null ? list.length + 1 + " ターン目" : list.length + " ターン") + "</span></div>", { part: "flow-label" });
  push("");
  if (list.length === 0 && running === null) push('<span class="dim">' + cfTxt("最初のターンが終わると、ここに流れが並びます。") + "</span>");
  if (hasAbove) push('<span class="dim">' + cfTxt("┆  ↑ 前に " + above + " ターン") + "</span>", { part: "above" });
  lines.forEach((line, row) => rows.push(draw(line, row)));
  if (hasBelow) push('<span class="dim">' + cfTxt("┆  ↓ 後に " + below + " ターン") + "</span>", { part: "below" });
  foot.forEach((line, row) => rows.push(draw(line, lines.length + row)));
  return rows;
}

const CF_COLS = 62, CF_ROWS = 24; // ペインの本文:62 桁 x 24 行(左右 2 桁の余白を引いて 58 桁)
function cfRender(el, D, G, g) {
  const html = cfLayout(cfWorld(D, G, g), CF_COLS, CF_ROWS).slice(0, CF_ROWS).map(r => '<div class="ln">' + r.html + "</div>").join("");
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

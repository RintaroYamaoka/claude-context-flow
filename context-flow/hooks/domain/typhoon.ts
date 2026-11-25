// 台風の起動・暴風(`/context-flow boot typhoon` で名指しした時だけ流れる)。`$` は使わない。
// 物語: 黄色いしま猫がまん中に座っている。左から暴風が吹きつけ、すじが画面を埋め、葉っぱと砂ぼこりが飛び、草が寝る。
// 猫は驚いて、耳を伏せ、目をつむって踏んばるが、風下へずるずる押され(しっぽは真横にちぎれそうになびく)、
// とうとう浮き上がって、くるくる回りながら右上の空へ飛んでいく。
// 風がやむと、猫が空から落ちてきて元の場所にどすんと座り、目を回す。
// 最後の一枚の葉っぱが猫の頭にふわりと乗り、猫がにっこりする。
// 猫の絵は雷の起動と同じもの(`./thunder` の絵の差し替え口)を使う。形と位置は起動の時刻だけで決める。
import { type Run, lot, runsOf } from './color'
import {
  FACES,
  INK,
  type Mood,
  SIT,
  SIT_WIDTH,
  TAILS,
  TAIL_X,
  WHISKER_ROW,
  thunderLayout,
} from './thunder'

/** 物語の長さ(このあと画面が開く)。 */
export const TYPHOON_MS = 5400

/** 場面の時刻(起動からのミリ秒)。 */
const T = {
  blink: 350,
  gustIn: 600,
  surprise: 700,
  brace: 950,
  peak: 1250,
  liftOff: 2050,
  gone: 2900,
  ease: 3200,
  calm: 3650,
  drop: 3750,
  land: 4050,
  leafFrom: 4150,
  leafLand: 4600,
} as const
/** タイトルを打ち始める時刻と、ひとことを出す時刻。 */
export const TYPHOON_TITLE_AT = 4550
export const TYPHOON_MARK_AT = 4950

/** 行の割り振りは雷の起動と同じ(地面の行・タイトル・ひとこと)。 */
export const typhoonLayout = thunderLayout

/** 風下へなびくしっぽ(7 桁 × 4 行)の 2 コマ。SIT の STREAM_X 桁目・STREAM_ROW 行目から重ねる。 */
const STREAM_X = 15
const STREAM_ROW = 11
const STREAMS = [
  ['.....oo', 'ooooyyo', 'yydyyo.', 'oooo...'],
  ['.......', 'oooooo.', 'yydyyyo', 'oooooo.'],
]

/** 舞う葉っぱの文字と色。 */
const LEAF_GLYPHS = ['✿', '❀', '•', '✾'] as const
const LEAF_COLORS = ['#e86a3a', '#f2b134', '#8fbf4a', '#d9543f', '#c7d84a', '#f08c3a'] as const
const LEAVES = 40
/** 砂ぼこり(葉っぱより小さく、速い)。 */
const DUST = 60
/** 頭に乗る最後の一枚(舞う葉っぱとは別の文字)。 */
const LAST_LEAF = { ch: '❦', color: '#8fbf4a' } as const

type Cell = Omit<Run, 'text'> & { ch: string }

const easeOut = (k: number): number => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3
const between = (ms: number, from: number, to: number): number =>
  Math.min(1, Math.max(0, (ms - from) / (to - from)))

/** 風の強さ(0〜1)。吹き始めて強まり、しばらく続いて、やむ。 */
export const windStrength = (ms: number): number => {
  if (ms < T.gustIn || ms >= T.calm) return 0
  if (ms < T.peak) return between(ms, T.gustIn, T.peak)
  if (ms < T.ease) return 1

  return 1 - between(ms, T.ease, T.calm)
}

/** 突風(0〜1): 強い風の上に、ときどき一段と強いひと吹きが来る。 */
const gustAt = (ms: number): number => {
  const w = windStrength(ms)
  const pulse = (Math.sin(ms / 140) + Math.sin(ms / 53)) / 2

  return w >= 1 ? Math.max(0, pulse) : 0
}

/** 踏んばっている顔: 耳を伏せ(しょんぼりの耳)、目をつむり(まばたきの目)、口をむっと結ぶ。 */
const BRACE_FACE: Record<number, string> = {
  0: FACES.sad[0] ?? '',
  1: FACES.sad[1] ?? '',
  2: FACES.sad[2] ?? '',
  3: FACES.sad[3] ?? '',
  6: FACES.blink[6] ?? '',
  7: FACES.blink[7] ?? '',
  8: FACES.blink[8] ?? '',
  10: FACES.angry[10] ?? '',
}

/**
 * 台風の起動の全部の行。`rows` は行数、`columns` は桁数、`ms` は起動からのミリ秒。
 * タイトルとひとことの行は、呼ぶ側が上から描く。
 */
export const typhoonScene = (seed: number, rows: number, columns: number, ms: number): Run[][] => {
  const { ground } = typhoonLayout(rows)
  const height = rows * 2
  const groundPix = ground * 2
  const pix: (string | undefined)[][] = Array.from({ length: height }, () =>
    Array.from({ length: columns }, () => undefined),
  )
  const text: (Cell | undefined)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => undefined),
  )
  const put = (x: number, y: number, color: string | undefined) => {
    if (color === undefined || x < 0 || x >= columns || y < 0 || y >= height) return
    pix[y]![x] = color
  }
  const blit = (art: readonly string[], x0: number, y0: number) => {
    art.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const key = row[c] ?? '.'
        if (key !== '.') put(x0 + c, y0 + r, INK[key])
      }
    })
  }
  const say = (x: number, line: number, ch: string, color: string, isBold = true) => {
    if (x < 0 || x >= columns || line < 0 || line >= rows) return
    text[line]![x] = { ch, color, isBold }
  }
  const isEmpty = (x: number, line: number) =>
    pix[line * 2]?.[x] === undefined && pix[line * 2 + 1]?.[x] === undefined

  const w = windStrength(ms)
  const isWindy = w > 0.3
  const sitX = Math.floor((columns - SIT_WIDTH) / 2)
  const mid = sitX + Math.floor(SIT_WIDTH / 2)
  const sitTop = groundPix - SIT.length
  const catTopLine = Math.floor(sitTop / 2)

  // ── 猫 ──
  const mood: Mood | 'brace' =
    ms >= T.leafLand
      ? 'happy'
      : ms >= T.land
        ? 'blink'
        : ms >= T.liftOff
          ? 'surprise'
          : ms >= T.brace && w > 0
        ? 'brace'
        : ms >= T.surprise && w > 0
          ? 'surprise'
          : ms >= T.blink && ms < T.blink + 140
            ? 'blink'
            : 'normal'
  const face = mood === 'brace' ? BRACE_FACE : FACES[mood]
  const seated = SIT.map((row, r) => face[r] ?? row)
  const isFlying = ms >= T.liftOff && ms < T.gone
  const isAway = ms >= T.gone && ms < T.drop
  const isDropping = ms >= T.drop && ms < T.land
  // 飛んでいる間は、上下・左右に裏返して、くるくる回って見せる。
  const spin = Math.floor(ms / 80) % 4
  const flipH = (rows: string[]) => rows.map(row => [...row].reverse().join(''))
  const body = !isFlying
    ? seated
    : spin === 0
      ? seated
      : spin === 1
        ? flipH(seated)
        : spin === 2
          ? flipH([...seated].reverse())
          : [...seated].reverse()
  // 暴風の間は、風下へずるずる押され(最大 4 桁)、突風のたびにがくがく揺れる。
  const gust = gustAt(ms)
  const slide = Math.round(4 * w * Math.min(1, between(ms, T.gustIn, T.ease)))
  const jolt = w > 0.5 ? Math.floor(lot(seed, 2000 + Math.floor(ms / 50)) * (2 + Math.round(gust * 2))) : 0
  const pushed = sitX + slide + jolt
  const hop = sitTop - (gust > 0.7 && Math.floor(ms / 50) % 2 === 0 ? 1 : 0)
  // 飛ばされる: 右へ速く、上へ放物線を描いて、画面の外へ。
  const flight = between(ms, T.liftOff, T.gone)
  const x0 = isFlying
    ? Math.round(pushed + (columns - pushed + 4) * flight ** 1.3)
    : isDropping || ms >= T.land
      ? sitX
      : pushed
  const y0 = isFlying
    ? Math.round(hop - (hop + SIT.length + 4) * Math.sin((flight * Math.PI) / 2))
    : isDropping
      ? Math.round(-SIT.length + (sitTop + SIT.length) * between(ms, T.drop, T.land) ** 2)
      : ms >= T.land
        ? sitTop
        : hop
  if (!isAway) blit(body, x0, y0)
  if (isFlying || isAway || isDropping) {
    // 飛んでいる猫の後ろに、風の渦。
    if (isFlying) {
      for (let i = 1; i <= 3; i++) say(x0 - i * 2, Math.floor((y0 + SIT.length / 2) / 2), '@', '#d8f0ff')
    }
  } else if (isWindy) {
    blit(STREAMS[Math.floor(ms / 60) % 2] ?? [], x0 + STREAM_X, y0 + STREAM_ROW)
  } else {
    const wag = Math.floor(ms / (ms >= T.leafLand ? 160 : 380)) % 2
    blit(TAILS[wag] ?? [], x0 + TAIL_X, sitTop)
  }
  // ひげ: ふだんは横に。風の間は、風上のひげは顔に張りつき、風下のひげがなびく。
  const hasWhiskers = !isFlying && !isAway && !isDropping
  const whisker = Math.floor((y0 + WHISKER_ROW) / 2)
  const flutter = Math.floor(ms / 40) % 2 === 0 ? '~' : '─'
  if (hasWhiskers && !isWindy) {
    say(x0 - 1, whisker, '─', '#fff4dc', false)
    say(x0 - 2, whisker, '─', '#fff4dc', false)
  }
  if (hasWhiskers) {
    say(x0 + SIT_WIDTH, whisker, isWindy ? flutter : '─', '#fff4dc', false)
    say(x0 + SIT_WIDTH + 1, whisker, isWindy ? flutter : '─', '#fff4dc', false)
  }

  // ── 地面と草: 風の間は風下へなびく ──
  for (let x = 0; x < columns; x++) {
    if (isEmpty(x, ground)) say(x, ground, '─', '#3f5a3a', false)
    if (lot(seed, 400 + x) < 0.22 && isEmpty(x, ground - 1)) {
      const bend = isWindy || (w > 0 && Math.floor(ms / 120 + x) % 2 === 0)
      const flat = w > 0.8 && Math.floor(ms / 60 + x) % 3 !== 0
      say(x, ground - 1, flat ? '_' : bend ? '╱' : '|', '#6fae5a', false)
    }
  }

  // ── 風のすじ: 左から右へ流れる。強いほど多く、長い ──
  if (w > 0) {
    for (let line = 0; line < ground - 1; line++) {
      for (let k = 0; k < 4; k++) {
        const salt = 1000 + line * 7 + k
        if (lot(seed, salt) >= w * (0.6 + 0.3 * gustAt(ms))) continue
        const length = 4 + Math.floor((lot(seed, salt + 3) * 9 + 3) * w)
        const speed = 0.07 + lot(seed, salt + 5) * 0.07
        const span = columns + length
        const head = Math.floor((ms * speed + lot(seed, salt + 9) * span) % span)
        for (let i = 0; i < length; i++) {
          const x = head - i
          if (!isEmpty(x, line) || text[line]?.[x] !== undefined) continue
          const isGust = gustAt(ms) > 0.5
          if (i === 0) say(x, line, '~', '#ffffff', isGust)
          else say(x, line, w > 0.7 ? (isGust && i < 3 ? '≡' : '═') : '─', isGust ? '#d8f0ff' : '#9ec9e8', false)
        }
      }
    }
  }

  // ── 舞う葉っぱ: 左の外から右の外へ、上下にゆれながら ──
  for (let i = 0; i < LEAVES; i++) {
    const from = T.gustIn + 100 + i * 60
    const fly = 450 + lot(seed, 1500 + i) * 450
    const age = ms - from
    if (age < 0 || age > fly) continue
    const k = age / fly
    const x = Math.round(-2 + (columns + 4) * k)
    const baseLine = 1 + Math.floor(lot(seed, 1600 + i) * Math.max(1, ground - 3))
    const line = Math.round(baseLine + Math.sin(k * Math.PI * 5 + i) * 2.5)
    if (from + fly > T.calm || line >= ground || !isEmpty(x, line)) continue
    say(x, line, LEAF_GLYPHS[i % LEAF_GLYPHS.length] ?? '•', LEAF_COLORS[i % LEAF_COLORS.length] ?? '#f2b134')
  }

  // ── 砂ぼこり: 地面すれすれを、葉っぱより速く ──
  if (w > 0.4) {
    for (let i = 0; i < DUST; i++) {
      const fly = 300 + lot(seed, 2500 + i) * 300
      const age = (ms + lot(seed, 2600 + i) * fly) % fly
      const x = Math.round(-1 + (columns + 2) * (age / fly))
      const line = ground - 1 - Math.floor(lot(seed, 2700 + i) * Math.min(4, ground))
      if (lot(seed, 2800 + i) >= w || !isEmpty(x, line) || text[line]?.[x] !== undefined) continue
      say(x, line, i % 3 === 0 ? '∙' : '·', '#c8b48a', false)
    }
  }

  // ── 最後の一枚: ふわふわ漂って、猫の頭に乗る ──
  if (ms >= T.leafFrom) {
    const k = easeOut(between(ms, T.leafFrom, T.leafLand))
    const landLine = catTopLine - 1
    const x = Math.round(2 + (mid - 2) * k)
    const sway = ms < T.leafLand ? Math.round(Math.sin(k * Math.PI * 2) * 2) : 0
    const line = Math.round(1 + (landLine - 1) * k) + sway
    say(x, Math.min(line, landLine), LAST_LEAF.ch, LAST_LEAF.color)
  }

  // ── 気持ちの記号 ──
  if (mood === 'surprise' && ms < T.liftOff) say(mid, catTopLine - 1, '!', '#ffffff')
  if (ms >= T.land && ms < T.land + 300) {
    const reach = Math.floor((ms - T.land) / 60)
    for (let d = 1; d <= 3 + reach; d++) {
      say(sitX - d, ground - 1, d % 2 === 0 ? '·' : '∙', '#c8b48a', false)
      say(sitX + SIT_WIDTH - 1 + d, ground - 1, d % 2 === 0 ? '·' : '∙', '#c8b48a', false)
    }
  }
  if (ms >= T.land && ms < T.leafLand) {
    for (let i = 0; i < 3; i++) {
      const angle = ms / 150 + (i * Math.PI * 2) / 3
      say(mid + Math.round(Math.cos(angle) * 5), catTopLine - 1 + Math.round(Math.sin(angle)), '✧', '#fff7b0')
    }
  }
  if (mood === 'brace' && ms < T.liftOff && Math.floor(ms / 120) % 2 === 0) {
    say(x0 - 3, catTopLine + 1, '>', '#cfd6ff')
    say(x0 - 4, catTopLine + 1, '>', '#cfd6ff')
  }

  // ── 音符: にっこりした猫から浮かぶ ──
  if (ms >= T.leafLand + 150) {
    for (let i = 0; i < 3; i++) {
      const age = ms - T.leafLand - 150 - i * 260
      if (age < 0 || age > 900) continue
      const line = catTopLine - Math.floor(age / 220)
      const x = sitX + SIT_WIDTH + 1 + i * 2 + (Math.floor(age / 220) % 2)
      say(x, line, i % 2 === 0 ? '♪' : '♫', LEAF_COLORS[(i * 2) % LEAF_COLORS.length] ?? '#ffffff')
    }
  }

  // ── ドットと文字を 1 行ずつに ──
  return Array.from({ length: rows }, (_, line) => {
    const cells: Cell[] = Array.from({ length: columns }, (_, x) => {
      const over = text[line]?.[x]
      if (over !== undefined) return over
      const upper = pix[line * 2]?.[x]
      const lower = pix[line * 2 + 1]?.[x]
      if (upper !== undefined && lower !== undefined) return { ch: '▀', color: upper, backgroundColor: lower }
      if (upper !== undefined) return { ch: '▀', color: upper }
      if (lower !== undefined) return { ch: '▄', color: lower }
      return { ch: ' ' }
    })

    return runsOf(
      cells.map(cell => cell.ch).join(''),
      i => {
        const { ch: _, ...style } = cells[i] ?? { ch: ' ' }
        return style
      },
    )
  })
}

/** 風の絵の行の長さがそろっているか。そろっていない絵の名前を返す。 */
export const typhoonArtProblems = (): string[] => {
  const problems: string[] = []
  STREAMS.forEach((art, i) => {
    if (new Set(art.map(row => row.length)).size !== 1) problems.push(`STREAMS[${i}]`)
  })
  if (Object.values(BRACE_FACE).some(row => row.length !== SIT_WIDTH)) problems.push('BRACE_FACE')
  if (STREAM_ROW + (STREAMS[0]?.length ?? 0) > SIT.length) problems.push('STREAM_ROW')

  return problems
}

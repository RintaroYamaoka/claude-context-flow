// 雷の起動(花火に外れた起動の THUNDER_RATE の割合。`./color` の bootLotOf)。`$` は使わない。
// 物語: 黄色いしま猫が右から歩いてきて、まん中に座る。不機嫌な雨雲が流れてきて雨を降らせる。
// 猫は驚いて、しょんぼりして、怒って毛を逆立てて静電気をため、雲へ雷を打ち上げて吹き飛ばす。
// 雲が消えると虹がかかり、毛がふくらんだままの猫がにっこりする。
// ドットは上下半分のブロック(▀ ▄)で 1 文字に 2 つ縦に描く(文字の縦横比で、ほぼ正方形になる)。
// 雨・火花・雷などは、ドットの上に文字で重ねる。形と位置は起動の時刻だけで決める。
import { type Run, hexOf, lot, runsOf } from './color'

/** 物語の長さ(このあと画面が開く)。 */
export const THUNDER_MS = 5300

/** 場面の時刻(起動からのミリ秒)。 */
const T = {
  walkEnd: 1500,
  blink: 1750,
  cloudIn: 1950,
  cloudStop: 2450,
  rain: 2450,
  surprise: 2550,
  sad: 2800,
  charge: 3050,
  zap: 3650,
  burst: 4100,
  rainbow: 4150,
  notes: 4450,
} as const
/** タイトルを打ち始める時刻と、ひとことを出す時刻。 */
export const TITLE_AT = 4200
export const MARK_AT = 4500

/** ドットの色。`.` は透明。 */
export const INK: Record<string, string> = {
  o: '#4a2f1a', // 輪郭
  y: '#ffd84d', // 毛
  d: '#e8a62c', // しま
  w: '#fff4dc', // 口元・胸・足先
  k: '#2b1d14', // 目・口
  e: '#ffffff', // 目の光
  p: '#ff9fb0', // 鼻・耳の内側
  t: '#7cc7ff', // 涙
  f: '#fff09a', // ふくらんだ毛
  C: '#8a8fa6', // 雲の上側
  c: '#5f6478', // 雲
}

// ── 絵の差し替え口 ──
// 絵は文字の並びで、1 文字が 1 ドット。色は上の INK(`.` は透明)。
// どの絵も、行ごとに同じ長さにする。大きさを変えても、置く位置・雷の出どころ・雲の位置は絵の大きさから決まる。
// - WALK_BODY + WALK_LEGS[コマ]: 歩く姿(左向き)。足は 2 コマ。体と足の幅をそろえる。
// - SIT: 座った姿(正面)。FACES は気持ちごとに SIT の何行目を置き換えるか(行番号 → その行の絵)。
// - TAILS: しっぽの 2 コマ。SIT の TAIL_X 桁目・同じ行に重ねる(`.` と空の行は体を消さない)。
// - WHISKER_ROW: ひげを横に出す SIT の行。電気がたまると、ひげが立つ。
// `d`(しま)は、電気がたまると光って流れる。

// ── 歩く姿(左向き 20×13)。頭を大きく、体を小さく ──
const WALK_BODY = [
  '.o.....o............',
  '.oo...oo............',
  'oypooopyo...........',
  'oyyyyyyyyo..........',
  'oyekyyyyyyo.........',
  'oykkyyydyyo......o..',
  'oyyyyyyyyyo.....oyo.',
  'pyyyyyyyyyoooooooyo.',
  'owwyyyyyyydyydyyyo..',
  '.owkwyyyyyyyyyyyyo..',
  '..oowwwyyyyyyyyyyo..',
]
const WALK_LEGS = [
  ['...oyo.oyo..oyo.oyo.', '...oww.oww..oww.oww.'],
  ['..oyo..oyo.oyo...oyo', '..oww..oww.oww...oww'],
]

// ── 座った姿(正面 18×16)。大きな頭・大きな目・小さな体 ──
export const SIT = [
  '..o............o..',
  '..oo..........oo..',
  '.oypo........opyo.',
  '.oyppooooooooppyo.',
  '.oyyyyydyydyyyyyo.',
  'oyyyyyyyyyyyyyyyyo',
  'oyyekkyyyyyyekkyyo',
  'oyykkkyyyyyykkkyyo',
  'oyykkkyyyyyykkkyyo',
  'oyyyyyywppwyyyyyyo',
  '.oyyyywkwwkwyyyyo.',
  '..ooyyywwwwyyyoo..',
  '...oyydwwwwdyyo...',
  '...oyyywwwwyyyo...',
  '...owwyyyyyywwo...',
  '....oooooooooo....',
]
export type Mood = 'normal' | 'blink' | 'surprise' | 'sad' | 'angry' | 'happy'
export const FACES: Record<Mood, Record<number, string>> = {
  normal: {},
  blink: {
    6: 'oyyyyyyyyyyyyyyyyo',
    7: 'oyyyyyyyyyyyyyyyyo',
    8: 'oyykkkyyyyyykkkyyo',
  },
  surprise: { 10: '.oyyyyywkkwyyyyyo.' },
  sad: {
    0: '..................',
    1: '..................',
    2: 'ooyo..........oyoo',
    3: '.oyyyooooooooyyyo.',
    6: 'oyyyyyyyyyyyyyyyyo',
    7: 'oyykkkyyyyyykkkyyo',
    8: 'oyyykkyyyyyykkyyyo',
    9: 'oyytyyywppwyyyyyyo',
    10: '.oyyyywwkkwwyyyyo.',
  },
  // きりっとした >< の目。
  angry: {
    6: 'oyykyyyyyyyyyykyyo',
    7: 'oyyykkyyyyyykkyyyo',
    8: 'oyykyyyyyyyyyykyyo',
    10: '.oyyyywkkkkwyyyyo.',
  },
  // にっこり(目を細め、口を開けて笑う)。
  happy: {
    6: 'oyyyyyyyyyyyyyyyyo',
    7: 'oyykkkyyyyyykkkyyo',
    8: 'oykyyykyyyykyyykyo',
    10: '.oyyyywkppkwyyyyo.',
  },
}
/** しっぽ(5 桁)。SIT の TAIL_X 桁目に重ねる。2 コマで振る。 */
export const TAIL_X = 14
export const TAILS = [
  ['', '', '', '', '', '', '', '', '', '', '...o.', '..oyo', '..odo', '.oyo.', 'oyo..', 'oo...'],
  ['', '', '', '', '', '', '', '', '', '', '.....', '...o.', '..oyo', '.odo.', 'oyo..', 'oo...'],
]
/** ひげを出す SIT の行(その行と次の行が 1 文字の行になる)。 */
export const WHISKER_ROW = 8
export const SIT_WIDTH = SIT[0]?.length ?? 18

// ── 雨雲(14×8)。むすっとした顔 ──
const CLOUD = [
  '....CCC.......',
  '..CCCCCCC.CC..',
  '.CCCCCCCCCCCC.',
  'CCCCCCCCCCCCCC',
  'cccckcccckcccc',
  '.ccccckkcccccc',
  '..cccc..cccc..',
  '..............',
]

/** 電気の光(しま・ひげ・毛が順に光る)。 */
const SPARK = ['#9ff3ff', '#ffffff', '#fff7b0'] as const

const RAINBOW = ['#ff6b6b', '#ffb04d', '#ffe66b', '#6be58a', '#6bb8ff', '#b48cff']

/** 行の割り振り: 地面の行・タイトル・ひとこと。ひとことはペインの一番下の行に収める。 */
export const thunderLayout = (rows: number) => {
  const ground = Math.max(0, rows - 5)

  return { ground, title: ground + 2, status: ground + 4 }
}

type Cell = Omit<Run, 'text'> & { ch: string }

const ease = (k: number): number => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3
const between = (ms: number, from: number, to: number): number =>
  Math.min(1, Math.max(0, (ms - from) / (to - from)))

/** 雷が光る間(打ち上げの 3 回)。 */
const ZAPS = [
  [T.zap, T.zap + 130],
  [T.zap + 190, T.zap + 300],
  [T.zap + 340, T.zap + 450],
] as const

/**
 * 雷の起動の全部の行。`rows` は行数、`columns` は桁数、`ms` は起動からのミリ秒。
 * タイトルとひとことの行は、呼ぶ側が上から描く。
 */
export const thunderScene = (seed: number, rows: number, columns: number, ms: number): Run[][] => {
  const { ground } = thunderLayout(rows)
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
  const blit = (
    art: readonly string[],
    x0: number,
    y0: number,
    ink: (key: string, r: number) => string | undefined,
  ) => {
    art.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const key = row[c] ?? '.'
        if (key !== '.') put(x0 + c, y0 + r, ink(key, r))
      }
    })
  }
  const say = (x: number, line: number, ch: string, color: string, isBold = true) => {
    if (x < 0 || x >= columns || line < 0 || line >= rows) return
    text[line]![x] = { ch, color, isBold }
  }
  const isEmpty = (x: number, line: number) =>
    pix[line * 2]?.[x] === undefined && pix[line * 2 + 1]?.[x] === undefined

  const sitX = Math.floor((columns - SIT_WIDTH) / 2)
  const mid = sitX + Math.floor(SIT_WIDTH / 2)
  const sitTop = groundPix - SIT.length
  const catTopLine = Math.floor(sitTop / 2)
  const isZapping = ZAPS.some(([from, to]) => ms >= from && ms < to)

  // ── 虹(雲が消えた後、左から右へかかる)──
  if (ms >= T.rainbow) {
    const cx = mid
    const radius = Math.min(Math.floor(columns / 2) - 2, groundPix - 4)
    const sweep = Math.PI * ease(between(ms, T.rainbow, T.rainbow + 600))
    for (let y = 0; y < groundPix; y++) {
      for (let x = 0; x < columns; x++) {
        const d = Math.hypot(x + 0.5 - cx, groundPix - y)
        const band = Math.floor(radius - d)
        if (band < 0 || band >= RAINBOW.length) continue
        // 左(π)から右(0)へ伸びる。
        const angle = Math.atan2(groundPix - y, x + 0.5 - cx)
        if (Math.PI - angle <= sweep) put(x, y, RAINBOW[band])
      }
    }
  }

  // ── 雨雲 ──
  // 雲と猫の間は、いつも 6 ドット(雨と雷が通る)。低いペインでは雲の上が画面の外に切れる。
  const cloudTop = sitTop - CLOUD.length - 6
  const cloudWidth = CLOUD[0]?.length ?? 14
  const cloudHome = mid - Math.floor(cloudWidth / 2)
  const cloudX =
    Math.round(-cloudWidth + (cloudHome + cloudWidth) * ease(between(ms, T.cloudIn, T.cloudStop))) +
    (ms >= T.charge && ms < T.burst ? Math.floor(ms / 70) % 2 : 0)
  const hasCloud = ms >= T.cloudIn && ms < T.burst
  if (hasCloud) {
    const isLit = isZapping || (ms >= T.burst - 200 && Math.floor(ms / 50) % 2 === 0)
    blit(CLOUD, cloudX, cloudTop, key => (isLit ? (key === 'k' ? '#5f6478' : '#ffffff') : INK[key]))
  }

  // ── 猫 ──
  const step = Math.floor(ms / 130) % 2
  if (ms < T.walkEnd) {
    const from = columns + 1
    const to = sitX - 1
    const x = Math.round(from + (to - from) * between(ms, 0, T.walkEnd))
    const walk = [...WALK_BODY, ...(WALK_LEGS[step] ?? [])]
    const walkWidth = WALK_BODY[0]?.length ?? 20
    // 一歩ごとに、ぴょこっと弾む。
    const top = groundPix - walk.length - (step === 1 ? 2 : 0)
    blit(walk, x, top, key => INK[key])
    // 足元の土ぼこり。
    for (let k = 0; k < 3; k++) {
      const puff = x + walkWidth + 1 + k * 2
      if ((Math.floor(ms / 130) + k) % 3 !== 0) say(puff, ground - 1, k === 0 ? '∘' : '·', '#a89880', false)
    }
  } else {
    const mood: Mood =
      ms >= T.burst
        ? 'happy'
        : ms >= T.charge
          ? 'angry'
          : ms >= T.sad
            ? 'sad'
            : ms >= T.surprise
              ? 'surprise'
              : ms >= T.blink && ms < T.blink + 140
                ? 'blink'
                : 'normal'
    const face = FACES[mood]
    const body = SIT.map((row, r) => face[r] ?? row)
    const shake = ms >= T.charge && ms < T.zap ? (Math.floor(ms / 45) % 3) - 1 : 0
    const x0 = sitX + shake
    // 怒っている間と、雷の後は、毛が逆立つ(輪郭の外にもう一回り毛を足す)。
    const isPuffed = ms >= T.charge
    if (isPuffed) {
      const fur = ms >= T.burst ? INK.f : Math.floor(ms / 60) % 2 === 0 ? '#fff7b0' : '#9ff3ff'
      body.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== 'o') continue
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]] as const) {
            const nx = c + dx
            const ny = r + dy
            if ((body[ny]?.[nx] ?? '.') === '.' && (nx + ny + Math.floor(ms / 120)) % 2 === 0) {
              put(x0 + nx, sitTop + ny, fur)
            }
          }
        }
      })
    }
    const isLit = isZapping
    // 電気がたまると、しまが光って流れる。
    const isCharged = ms >= T.charge
    const glow = (r: number) => SPARK[(r + Math.floor(ms / 70)) % SPARK.length]
    const inkOf = (key: string, r: number) =>
      isLit && (key === 'y' || key === 'd')
        ? '#fffbe0'
        : isCharged && key === 'd'
          ? glow(r)
          : INK[key]
    blit(body, x0, sitTop, inkOf)
    const wag = Math.floor(ms / (ms >= T.burst ? 160 : 380)) % 2
    blit(TAILS[wag] ?? [], x0 + TAIL_X, sitTop, inkOf)
    // ひげ: ふだんは横に。電気がたまると、ぴんと立つ。
    const whisker = Math.floor((sitTop + WHISKER_ROW) / 2)
    const wColor = ms >= T.charge && ms < T.burst ? (glow(0) ?? '#fff4dc') : '#fff4dc'
    say(x0 - 1, whisker, isCharged ? '╲' : '─', wColor, false)
    say(x0 - 2, whisker, isCharged ? '╲' : '─', wColor, false)
    say(x0 + SIT_WIDTH, whisker, isCharged ? '╱' : '─', wColor, false)
    say(x0 + SIT_WIDTH + 1, whisker, isCharged ? '╱' : '─', wColor, false)
    // 落ち着いている間も、耳の先で小さな火花がぱちっと跳ねる。
    if (!isCharged && Math.floor(ms / 110) % 5 === 0) {
      const ear = Math.floor(ms / 550) % 2 === 0 ? x0 + 1 : x0 + SIT_WIDTH - 2
      say(ear, catTopLine - 1, '✧', '#fff7b0')
    }
  }

  // ── 地面 ──
  for (let x = 0; x < columns; x++) {
    if (isEmpty(x, ground)) say(x, ground, '─', '#3f5a3a', false)
  }

  // ── 雨: 雲の下から地面まで。猫には重ねない ──
  if (ms >= T.rain && ms < T.zap + 80) {
    const tick = Math.floor(ms / 45)
    const bottom = Math.floor((cloudTop + CLOUD.length - 1) / 2) + 1
    for (let x = cloudX + 1; x < cloudX + cloudWidth - 1; x++) {
      const phase = Math.floor(lot(seed, 700 + x) * 5)
      for (let line = bottom; line < ground; line++) {
        if ((line - tick + phase + 1000) % 4 === 0 && isEmpty(x, line)) say(x, line, '╷', '#7cc7ff', false)
      }
    }
  }

  // ── 気持ちの記号 ──
  if (ms >= T.surprise && ms < T.sad) say(mid, catTopLine - 1, '!', '#ffffff')
  if (ms >= T.sad && ms < T.charge) {
    const dots = Math.min(3, Math.floor((ms - T.sad) / 70))
    for (let i = 0; i < dots; i++) say(sitX + SIT_WIDTH - 1 + i, catTopLine, '.', '#cfd6ff')
  }
  if (ms >= T.charge && ms < T.zap) say(sitX + SIT_WIDTH - 3, catTopLine, '#', '#ff6b6b')

  // ── 静電気: だんだん増える ──
  if (ms >= T.charge && ms < T.burst) {
    const density = ms < T.zap ? 0.03 + 0.12 * between(ms, T.charge, T.zap) : 0.05
    const tick = Math.floor(ms / 70)
    for (let line = catTopLine - 2; line < ground; line++) {
      for (let x = sitX - 4; x < sitX + SIT_WIDTH + 4; x++) {
        if (!isEmpty(x, line) || text[line]?.[x] !== undefined) continue
        if (lot(seed, 3000 + tick * 131 + line * 53 + x) < density) {
          say(x, line, tick % 2 === 0 ? 'ϟ' : '✧', (x + line + tick) % 2 === 0 ? '#9ff3ff' : '#fff7b0')
        }
      }
    }
  }

  // ── 雷: 猫の頭から雲へ打ち上げる ──
  if (isZapping) {
    const zap = ZAPS.findIndex(([from, to]) => ms >= from && ms < to)
    const top = Math.floor((cloudTop + CLOUD.length - 2) / 2) + 1
    let x = mid
    for (let line = catTopLine - 1; line >= top; line--) {
      const d = Math.floor(lot(seed, 800 + zap * 37 + line) * 3) - 1
      const next = Math.min(columns - 1, Math.max(0, x + d))
      say(x, line, next === x ? '│' : next > x ? '╱' : '╲', zap === 1 ? '#ffe14a' : '#ffffff')
      // 枝分かれ。
      if (lot(seed, 860 + zap * 37 + line) < 0.3) say(x + (d >= 0 ? -1 : 1), line, d >= 0 ? '╲' : '╱', '#ffe14a')
      x = next
    }
  }

  // ── 雲がはじける: 虹色のかけらが四方へ ──
  if (ms >= T.burst && ms < T.burst + 650) {
    const age = (ms - T.burst) / 650
    const cx = cloudHome + Math.floor(cloudWidth / 2)
    const cy = Math.floor((cloudTop + 4) / 2)
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + lot(seed, 950 + i)
      const reach = age * (6 + lot(seed, 970 + i) * 8)
      const x = Math.round(cx + Math.cos(angle) * reach * 2)
      const line = Math.round(cy + Math.sin(angle) * reach)
      say(x, line, age < 0.5 ? '✦' : '·', RAINBOW[i % RAINBOW.length] ?? '#ffffff')
    }
  }

  // ── 音符: にっこりした猫から浮かぶ ──
  if (ms >= T.notes) {
    for (let i = 0; i < 3; i++) {
      const age = ms - T.notes - i * 260
      if (age < 0 || age > 900) continue
      const line = catTopLine - Math.floor(age / 220)
      const x = sitX + SIT_WIDTH + 1 + i * 2 + (Math.floor(age / 220) % 2)
      say(x, line, i % 2 === 0 ? '♪' : '♫', RAINBOW[(i * 2 + 1) % RAINBOW.length] ?? '#ffffff')
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

/** 雷が光るたびに、背景が白く光る。光っていない時は `base` のまま。 */
export const thunderFlash = (ms: number, base: string | undefined): string | undefined => {
  const hit = ZAPS.find(([from]) => ms >= from && ms < from + 90)
  if (hit === undefined) return base
  const k = 1 - (ms - hit[0]) / 90
  const from = /^#[0-9a-f]{6}$/i.test(base ?? '') ? base ?? '#000000' : '#000000'
  const rgb = [1, 3, 5].map(i => Number.parseInt(from.slice(i, i + 2), 16))
  const glow = [235, 245, 255]

  return hexOf(rgb.map((v, c) => v + ((glow[c] ?? 0) - v) * k * 0.8))
}

/** 絵の行の長さがそろっているか(差し替えたときの確かめ)。そろっていない絵の名前を返す。 */
export const artProblems = (): string[] => {
  const widthOf = (rows: readonly string[]) => new Set(rows.filter(row => row !== '').map(row => row.length))
  const problems: string[] = []
  const walk = WALK_BODY[0]?.length
  if (widthOf(WALK_BODY).size !== 1) problems.push('WALK_BODY')
  WALK_LEGS.forEach((legs, i) => {
    if ([...widthOf(legs)].some(w => w !== walk)) problems.push(`WALK_LEGS[${i}]`)
  })
  if (widthOf(SIT).size !== 1) problems.push('SIT')
  for (const [mood, rows] of Object.entries(FACES)) {
    if (Object.values(rows).some(row => row.length !== SIT_WIDTH)) problems.push(`FACES.${mood}`)
  }
  TAILS.forEach((tail, i) => {
    if (widthOf(tail).size > 1) problems.push(`TAILS[${i}]`)
  })
  if (widthOf(CLOUD).size !== 1) problems.push('CLOUD')
  for (const [mood, rows] of Object.entries(FACES)) {
    if (Object.keys(rows).some(r => Number(r) >= SIT.length)) problems.push(`FACES.${mood} の行番号`)
  }
  if (WHISKER_ROW >= SIT.length) problems.push('WHISKER_ROW')
  // 色の決まっていない文字(INK に無い文字)は、描かれずに透明になる。
  const arts = [WALK_BODY, ...WALK_LEGS, SIT, ...Object.values(FACES).map(rows => Object.values(rows)), ...TAILS, CLOUD]
  const unknown = new Set(arts.flat().join('').split('').filter(ch => ch !== '.' && INK[ch] === undefined))
  if (unknown.size > 0) problems.push(`INK に無い文字: ${[...unknown].join(' ')}`)

  return problems
}

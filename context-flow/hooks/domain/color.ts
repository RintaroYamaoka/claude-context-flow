// 色:流れの色(虹・サイバーパンク・赤・ブループル)・光の帯・小さな波形・背景の配色。`$` は使わない。

export type Run = {
  text: string
  color?: string
  backgroundColor?: string
  isBold?: boolean
  isDim?: boolean
}

/** 同じ見た目の文字をまとめる(描く要素の数を抑える)。 */
export const runsOf = (
  text: string,
  paint: (index: number) => Omit<Run, 'text'>,
): Run[] => {
  const runs: Run[] = []
  let i = 0
  for (const ch of text) {
    const style = paint(i++)
    const last = runs.at(-1)
    const glyph = ch === ' ' ? '\u00a0' : ch
    if (
      last !== undefined &&
      last.color === style.color &&
      last.isBold === style.isBold &&
      last.isDim === style.isDim &&
      last.backgroundColor === style.backgroundColor
    ) {
      last.text += glyph
    } else {
      runs.push({ text: glyph, ...style })
    }
  }

  return runs
}

export const hexOf = (rgb: readonly number[]): string =>
  `#${rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`

// ── 背景 ──
// ペイン全体を一色で塗る(配色ごとに、上の色と下の色の中ほどを使う)。
// 配色は `/context-flow bg <名前>` で切り替える(名前なしで次の配色へ)。
type Rgb = readonly [number, number, number]
type Palette = { label: string; top: Rgb; bottom: Rgb }
export const PALETTES: Record<string, Palette | null> = {
  navy: { label: '濃紺', top: [16, 26, 51], bottom: [5, 7, 13] },
  sumi: { label: '墨', top: [30, 30, 34], bottom: [10, 10, 12] },
  murasaki: { label: '紫', top: [36, 20, 56], bottom: [8, 5, 14] },
  mori: { label: '深緑', top: [10, 36, 32], bottom: [4, 9, 9] },
  akane: { label: '茜', top: [52, 18, 28], bottom: [12, 5, 8] },
  yoake: { label: '夜明け', top: [14, 22, 50], bottom: [44, 20, 38] },
  umi: { label: '深海', top: [6, 34, 48], bottom: [3, 8, 16] },
  // 塗らない。端末の地の色(ふつうは黒)がそのまま出る。
  none: null,
}
export const PALETTE_NAMES = Object.keys(PALETTES)
/** 何も選んでいない時の配色。 */
export const DEFAULT_PALETTE = 'none'

/** ペインに敷く一色。配色の上の色と下の色の中ほど。 */
export const paneBackground = (paletteName: string): string => {
  const palette = PALETTES[paletteName]
  if (palette === null || palette === undefined) return 'transparent'

  return hexOf([0, 1, 2].map(c => ((palette.top[c] ?? 0) + (palette.bottom[c] ?? 0)) / 2))
}

/** 行の背景色。ペイン全体を一色で塗る(配色の上の色と下の色の中ほど)。 */
export const backgroundAt = (
  paletteName: string,
  _row: number,
  _total: number,
): string | undefined =>
  PALETTES[paletteName] === null || PALETTES[paletteName] === undefined
    ? undefined
    : paneBackground(paletteName)

/** 配色の一覧(コマンドの返事に添える)。 */
export const paletteList = (): string =>
  PALETTE_NAMES.map(
    name => `${name}(${PALETTES[name]?.label ?? '黒'})`,
  ).join(' / ')

/** 名前の一覧から 1 つ選ぶ。空なら次のもの、名前か呼び名ならそれ。無ければ undefined。 */
const pickFrom = (
  table: Record<string, { label: string } | null>,
  asked: string,
  current: string,
): string | undefined => {
  const names = Object.keys(table)

  return asked === ''
    ? names[(names.indexOf(current) + 1) % names.length]
    : asked in table
      ? asked
      : names.find(name => table[name]?.label === asked)
}

/** 頼まれた配色の名前を決める。空なら次の配色、名前か呼び名ならそれ。無ければ undefined。 */
export const pickPalette = (asked: string, current: string): string | undefined =>
  pickFrom(PALETTES, asked, current)

// ── 流れの色 ──
// 色が文字の上をなめらかに左へ流れ続け、その上を明るい帯が右へ走る。
// 色の並びは `/context-flow color <名前>` で切り替える(名前なしで次の色へ)。
// 並びは輪になっていて、最後の色から最初の色へ戻る(行って戻る並びは、折り返しも書く)。
type Spectrum = { label: string; stops: readonly Rgb[] }
export const SPECTRA: Record<string, Spectrum> = {
  // Claude Code 本体の虹(テーマの rainbow_*)と同じ 7 色。
  niji: {
    label: '虹',
    stops: [
      [235, 95, 87],
      [245, 139, 87],
      [250, 195, 95],
      [145, 200, 130],
      [130, 170, 220],
      [155, 130, 200],
      [200, 130, 180],
    ],
  },
  // ネオンの桃・紫・水色・青。
  cyberpunk: {
    label: 'サイバーパンク',
    stops: [
      [255, 50, 160],
      [180, 70, 255],
      [40, 220, 255],
      [90, 110, 255],
    ],
  },
  // 赤が基調。深い紅から、赤・朱・桃がかった赤へ。
  red: {
    label: '赤',
    stops: [
      [200, 30, 55],
      [255, 60, 60],
      [255, 115, 70],
      [255, 70, 120],
    ],
  },
  // Discord の青紫(#5865F2)が基調。明るい青紫・藤色・深い青紫へ。
  blurple: {
    label: 'ブループル',
    stops: [
      [88, 101, 242],
      [124, 136, 255],
      [165, 145, 255],
      [70, 82, 215],
    ],
  },
}
export const SPECTRUM_NAMES = Object.keys(SPECTRA)
/** 何も選んでいない時の流れの色。 */
export const DEFAULT_SPECTRUM = 'niji'

/** 流れの色の一覧(コマンドの返事に添える)。 */
export const spectrumList = (): string =>
  SPECTRUM_NAMES.map(name => `${name}(${SPECTRA[name]?.label ?? ''})`).join(' / ')

/** 頼まれた流れの色の名前を決める。空なら次の色、名前か呼び名ならそれ。無ければ undefined。 */
export const pickSpectrum = (asked: string, current: string): string | undefined =>
  pickFrom(SPECTRA, asked, current)

// 色の刻み。隣り合う色の差が目に見えない細かさにする(毎コマ計算した色と同じに見える)。
const SHADES = 720
type ShadeTable = readonly (readonly string[])[]
/** 白への寄せ方 3 段(なし・帯の縁・帯の芯)× 並びを一周する SHADES 色。 */
const shadesOf = (stops: readonly Rgb[]): ShadeTable =>
  [0, 0.4, 0.75].map(glow =>
    Array.from({ length: SHADES }, (_, n) => {
      const x = (n / SHADES) * stops.length
      const i = Math.floor(x) % stops.length
      const a = stops[i] ?? [0, 0, 0]
      const b = stops[(i + 1) % stops.length] ?? a
      const k = x - Math.floor(x)
      const mix = (c: 0 | 1 | 2): number => {
        const v = a[c] + (b[c] - a[c]) * k

        return v + (255 - v) * glow
      }

      return hexOf([mix(0), mix(1), mix(2)])
    }),
  )

/** 色の表の控え。並びごとに、初めて使う時に 1 度だけ作る。 */
const shadeMemo = new Map<string, ShadeTable>()
const tableOf = (name: string): ShadeTable => {
  const made = shadeMemo.get(name) ?? shadesOf((SPECTRA[name] ?? SPECTRA[DEFAULT_SPECTRUM])?.stops ?? [])
  shadeMemo.set(name, made)

  return made
}

// いまの流れの色。描く関数すべてがこれを読むので、ここに 1 つだけ持つ。
let spectrumName = DEFAULT_SPECTRUM
let shadeTable = tableOf(spectrumName)

/** いまの流れの色の名前。 */
export const currentSpectrum = (): string => spectrumName

/** 流れの色を切り替える。知らない名前なら何もしない。 */
export const setSpectrum = (name: string): void => {
  if (!(name in SPECTRA)) return
  spectrumName = name
  shadeTable = tableOf(name)
}

/** いまの流れの色を一周する色。`t` は何周目でもよい。`glow` で白に寄せる(0・0.4・0.75 の 3 段)。 */
export const rainbow = (t: number, glow = 0): string => {
  const n = Math.floor((((t % 1) + 1) % 1) * SHADES) % SHADES

  return shadeTable[glow >= 0.7 ? 2 : glow > 0 ? 1 : 0]?.[n] ?? '#ffffff'
}

/** いまの流れの色(1 色で塗るもの用)。全体で同じ流れに乗せる。 */
export const hueAt = (frame: number, index = 0, glow = 0): string =>
  rainbow(index * 0.045 - frame * 0.05, glow)

// ── 光の帯 ──
// 明るい帯は、ペインを左から右へ横切る 1 本だけ。どの行も、帯が自分の桁を通る時に光る。
// 速さ・幅・周期をここで 1 度だけ決めるので、モデル名もバーも文字も同じ調子で動く。
/** 帯が 1 コマ(FRAME_MS)に進む桁数。 */
const BAND_SPEED = 3
/** 帯が一周する桁数(ペインの幅より少し長く取り、右へ抜けてから戻る)。 */
const BAND_SPAN = 64
/** 帯が左端の何桁手前から入ってくるか。 */
const BAND_LEAD = 6

/** ペインの `cell` 桁目に、いま帯がどれだけ当たっているか(0・0.4・0.75)。 */
export const glowAt = (cell: number, frame: number): number => {
  const far = Math.abs(cell - (((frame * BAND_SPEED) % BAND_SPAN) - BAND_LEAD))

  return far < 1.5 ? 0.75 : far < 3.5 ? 0.4 : 0
}

/** 文字ごとの、ペインの中での桁(全角は 2 桁)。`offset` は行の頭の桁。 */
const cellsOf = (text: string, offset: number): number[] => {
  const starts: number[] = []
  let cell = offset
  for (const ch of text) {
    starts.push(cell)
    cell += (ch.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1
  }

  return starts
}

/**
 * 虹の文字: 虹が左へ流れ、明るい帯が右へ走る。
 * 色も帯も、ペインの中での桁で決める(同じ桁なら、どの行も同じ色・同じ光り方)。
 */
export const ultra = (text: string, frame: number, offset = 0): Run[] => {
  const starts = cellsOf(text, offset)

  return runsOf(text, i => {
    const cell = starts[i] ?? offset

    return {
      color: rainbow(cell * 0.045 - frame * 0.05, glowAt(cell, frame)),
      isBold: true,
    }
  })
}

/** 色なしの光に使う 3 段の明るさ(地・帯の縁・帯の芯)。 */
const SHINE = ['#b4b4b4', '#dedede', '#ffffff'] as const

/**
 * アクセント: 色を付けずに、明るい帯だけを文字の上に走らせる。
 * 帯は虹の行(`ultra`)と同じ 1 本。目立たせたい数か所だけに使う。
 */
export const shine = (
  text: string,
  frame: number,
  isBold = false,
  offset = 0,
): Run[] => {
  const starts = cellsOf(text, offset)

  return runsOf(text, i => {
    const glow = glowAt(starts[i] ?? offset, frame)

    return glow >= 0.7
      ? { color: SHINE[2], isBold: true }
      : glow > 0
        ? { color: SHINE[1], isBold }
        : { color: SHINE[0], isBold }
  })
}

export const PULSE = ['◌', '○', '◎', '◉', '◎', '○']
export const METER_WIDTH = 6
export const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇']

/** 小さな波形。棒の高さが波打つ。 */
export const wave = (frame: number): string =>
  Array.from({ length: METER_WIDTH }, (_, k) => {
    const level = (Math.sin(frame * 0.9 + k * 1.4) + 1) / 2

    return BARS[Math.round(level * (BARS.length - 1))] ?? '▁'
  }).join('')

// ── まれな起動 ──
// 起動アニメーションは、ときどき(RARE_ODDS 回に 1 回)派手な夜空になる:
// 文字と線は原色が速く流れ、空には花火がはじけ、流れ星が斜めに降り、一瞬だけ金色に光る。
// 当たりかどうかは起動の時刻だけで決める(描くたびに変わらないように)。
/** 何回に 1 回、まれな起動になるか。 */
export const RARE_ODDS = 10

/** 起動の時刻から 0 以上 1 未満の数を作る(同じ時刻・同じ salt なら同じ数)。 */
export const lot = (seed: number, salt = 0): number => {
  let h = Math.imul((seed ^ (seed / 2 ** 32)) | 0, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)

  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32
}

/** 何回に 1 回、雷の起動(ドット絵の黄色いしま猫が、雨雲を雷で吹き飛ばす。`./thunder`)になるか。 */
export const THUNDER_ODDS = 30

/** この時刻に始まった起動が、雷の起動か。 */
export const isThunderBoot = (seed: number): boolean => seed > 0 && lot(seed) < 1 / THUNDER_ODDS

/** この時刻に始まった起動が、まれな起動(花火の夜空)か。雷の起動とは重ならない。 */
export const isRareBoot = (seed: number): boolean => {
  const n = lot(seed)

  return seed > 0 && n >= 1 / THUNDER_ODDS && n < 1 / THUNDER_ODDS + 1 / RARE_ODDS
}

/** まれな起動の原色(花火と、流れる文字の色)。 */
const NEON = ['#ff3b6b', '#ffd54a', '#3bf0ff', '#b15cff', '#5cff8a', '#ff8a3b'] as const
const neonAt = (i: number): string => NEON[((i % NEON.length) + NEON.length) % NEON.length] ?? '#ffffff'

/** 派手な文字: 原色が 1 文字ずつ速く流れ、明るい帯の芯は白く光る。 */
export const jackpot = (text: string, frame: number, offset = 0): Run[] => {
  const starts = cellsOf(text, offset)

  return runsOf(text, i => {
    const cell = starts[i] ?? offset

    return {
      color: glowAt(cell, frame) >= 0.7 ? '#ffffff' : neonAt(Math.floor(cell / 2 - frame * 3)),
      isBold: true,
    }
  })
}

/** 一瞬の金色の光をかけた背景。`ms` は起動からのミリ秒。光っていない時は `base` のまま。 */
export const flashAt = (ms: number, base: string | undefined): string | undefined => {
  const k = 1 - (ms - FLASH_AT) / FLASH_MS
  if (k <= 0 || k > 1) return base
  const from = /^#[0-9a-f]{6}$/i.test(base ?? '') ? base ?? '#000000' : '#000000'
  const rgb = [1, 3, 5].map(i => Number.parseInt(from.slice(i, i + 2), 16))
  const gold = [255, 190, 40]

  // 光ってすぐ引く(濁った中間色が長く残らないように)。
  return hexOf(rgb.map((v, c) => v + ((gold[c] ?? 0) - v) * k * k * 0.9))
}
/** 金色に光る時刻(タイトルを打ち終えるころ)と長さ。 */
const FLASH_AT = 950
const FLASH_MS = 260

const STARS = ['·', '∙', '✧', '✦', '✧', '∙'] as const
const BURST = ['✺', '✸', '✦', '✧', '∙', '·'] as const
const TAIL = ['•', '∙', '∙', '·', '·', '·'] as const
const BURSTS = 9
const METEORS = 4

/**
 * 空の 1 行: 瞬く星・はじける花火・斜めに降る流れ星。
 * 位置と時刻は起動ごとに決まり、`ms`(起動からのミリ秒)で動く。`rows` は空の行数。
 */
export const skyRow = (
  seed: number,
  row: number,
  rows: number,
  columns: number,
  ms: number,
  frame: number,
): Run[] => {
  // 花火と流れ星の位置・時刻は、行ごとに 1 度だけ求める(桁ごとには求めない)。
  const bursts = Array.from({ length: BURSTS }, (_, b) => ({
    b,
    age: ms - (150 + b * 170 + lot(seed, 900 + b) * 120),
    cy: 1 + lot(seed, 910 + b) * (rows - 2),
    cx: 2 + lot(seed, 920 + b) * (columns - 4),
    reach: 3 + lot(seed, 930 + b) * 4,
  })).filter(burst => burst.age >= 0 && burst.age <= 650)
  const meteors = Array.from({ length: METEORS }, (_, m) => {
    const age = ms - (100 + m * 380 + lot(seed, 940 + m) * 150)

    return {
      m,
      age,
      hr: lot(seed, 950 + m) * rows * 0.5 + age / 70,
      hc: columns * (0.6 + lot(seed, 960 + m) * 0.5) - age / 35,
    }
  }).filter(meteor => meteor.age >= 0)

  const cellAt = (c: number): Omit<Run, 'text'> & { ch: string } => {
    // 花火: 輪が広がり、色が抜けていく。
    for (const { b, age, cy, cx, reach } of bursts) {
      const radius = (age / 650) * reach
      const d = Math.hypot(row - cy, (c - cx) / 2)
      if (Math.abs(d - radius) < 0.4) {
        const fade = Math.min(BURST.length - 1, Math.floor((age / 650) * BURST.length))
        return { ch: BURST[fade] ?? '·', color: age < 90 ? '#ffffff' : neonAt(b), isBold: true }
      }
    }
    // 流れ星: 右上から左下へ、尾を引いて降る。
    for (const { m, hr, hc } of meteors) {
      const k = c - hc
      if (k < -0.5 || k > TAIL.length * 2) continue
      if (Math.round(hr - k / 2) !== row) continue
      if (k < 0.5) return { ch: '★', color: '#fff6c8', isBold: true }
      return { ch: TAIL[Math.floor(k / 2)] ?? '·', color: neonAt(m + 1) }
    }
    // 星: 瞬くだけ。
    if (lot(seed, row * 1009 + c) < 0.05) {
      const phase = Math.floor(frame * 0.8 + lot(seed, c * 7 + row) * STARS.length)
      return { ch: STARS[phase % STARS.length] ?? '·', color: '#8f9bd6' }
    }
    return { ch: ' ' }
  }
  const cells = Array.from({ length: columns }, (_, c) => cellAt(c))

  return runsOf(
    cells.map(cell => cell.ch).join(''),
    i => {
      const { ch: _, ...style } = cells[i] ?? { ch: ' ' }
      return style
    },
  )
}

/** 地平の流れ星: 右から左へ、尾を引いて横切る 1 行。`k` は 0 から 1 への進み。 */
export const shootingStar = (k: number, columns: number): string => {
  const tail = '━━━━──···'
  // 尾まで左へ抜けきってから終わる。
  const head = Math.round((1 - k) * (columns + tail.length + 3)) - tail.length - 2

  return Array.from({ length: columns }, (_, c) => {
    if (c === head) return '★'
    const behind = c - head - 1

    return behind >= 0 && behind < tail.length ? (tail[behind] ?? ' ') : ' '
  }).join('')
}

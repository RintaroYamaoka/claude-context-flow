// 色:虹の流れ・光の帯・小さな波形・背景の配色。`$` は使わない。

export type Run = { text: string; color?: string; isBold?: boolean; isDim?: boolean }

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
      last.isDim === style.isDim
    ) {
      last.text += glyph
    } else {
      runs.push({ text: glyph, ...style })
    }
  }

  return runs
}

const hexOf = (rgb: readonly number[]): string =>
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
  none: null,
}
export const PALETTE_NAMES = Object.keys(PALETTES)
/** 何も選んでいない時の配色。 */
export const DEFAULT_PALETTE = 'sumi'

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
    name => `${name}(${PALETTES[name]?.label ?? '背景なし'})`,
  ).join(' / ')

/** 頼まれた配色の名前を決める。空なら次の配色、名前か呼び名ならそれ。無ければ undefined。 */
export const pickPalette = (asked: string, current: string): string | undefined => {
  const byLabel = PALETTE_NAMES.find(name => PALETTES[name]?.label === asked)

  return asked === ''
    ? PALETTE_NAMES[(PALETTE_NAMES.indexOf(current) + 1) % PALETTE_NAMES.length]
    : asked in PALETTES
      ? asked
      : byLabel
}

// ── 虹の流れ ──
// 色は Claude Code 本体の虹(テーマの rainbow_*)と同じ 7 色。
// 色が文字の上をなめらかに左へ流れ続け、その上を明るい帯が右へ走る。
const RAINBOW: readonly Rgb[] = [
  [235, 95, 87],
  [245, 139, 87],
  [250, 195, 95],
  [145, 200, 130],
  [130, 170, 220],
  [155, 130, 200],
  [200, 130, 180],
]

// 虹の刻み。隣り合う色の差が目に見えない細かさにする(毎コマ計算した色と同じに見える)。
const SHADES = 720
/** 白への寄せ方 3 段(なし・帯の縁・帯の芯)× 虹を一周する SHADES 色。起動時に 1 度だけ作る。 */
const SHADE_TABLE: readonly (readonly string[])[] = [0, 0.4, 0.75].map(glow =>
  Array.from({ length: SHADES }, (_, n) => {
    const x = (n / SHADES) * RAINBOW.length
    const i = Math.floor(x) % RAINBOW.length
    const a = RAINBOW[i] ?? [0, 0, 0]
    const b = RAINBOW[(i + 1) % RAINBOW.length] ?? a
    const k = x - Math.floor(x)
    const mix = (c: 0 | 1 | 2): number => {
      const v = a[c] + (b[c] - a[c]) * k

      return v + (255 - v) * glow
    }

    return hexOf([mix(0), mix(1), mix(2)])
  }),
)

/** 虹を一周する色。`t` は何周目でもよい。`glow` で白に寄せる(0・0.4・0.75 の 3 段)。 */
export const rainbow = (t: number, glow = 0): string => {
  const n = Math.floor((((t % 1) + 1) % 1) * SHADES) % SHADES

  return SHADE_TABLE[glow >= 0.7 ? 2 : glow > 0 ? 1 : 0]?.[n] ?? '#ffffff'
}

/** いまの虹の色(1 色で塗るもの用)。全体で同じ流れに乗せる。 */
export const hueAt = (frame: number, index = 0, glow = 0): string =>
  rainbow(index * 0.045 - frame * 0.05, glow)

/** `index` 桁目の文字の見た目: 虹が左へ流れ、明るい帯が右へ走る。 */
const ultraAt = (index: number, length: number, frame: number): Omit<Run, 'text'> => {
  const center = ((frame * 2.2) % (length + 16)) - 6
  const far = Math.abs(index - center)
  const glow = far < 1.2 ? 0.75 : far < 3 ? 0.4 : 0

  return { color: rainbow(index * 0.045 - frame * 0.05, glow), isBold: true }
}

export const ultra = (text: string, frame: number): Run[] => {
  const length = [...text].length

  return runsOf(text, i => ultraAt(i, length, frame))
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

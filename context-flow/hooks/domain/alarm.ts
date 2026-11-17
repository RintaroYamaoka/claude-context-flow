// コンテキストの警報: 70% を超えた時の計器の線と警告の行。`$` は使わない。
//   登場(越えてから INTRO_MS の間): 線が白く 3 回瞬き、警告の文が乱れた字から打ち出される
//   その後: 線をサイレンの光が往復し、先端で火花がはじけ、空きは注意テープが流れる。
//           WARNING の札が脈打ち、文に光が走り、右で ››› が駆ける
//   100% に近いほど速くなり、90% 以上で札が CRITICAL になる
import { type Run, hexOf, lot, runsOf } from './color'
import { cells } from './text'

/** これ以上で警報。 */
export const WARN_PERCENT = 70
/** これ以上で札が CRITICAL になる。 */
export const CRITICAL_PERCENT = 90
/** 越えた直後の登場の長さ(ミリ秒)。 */
export const INTRO_MS = 2400

export const WARN_MESSAGE = `コンテキストが ${WARN_PERCENT}% を超えました`

export const isOverWarn = (percent: number | undefined): boolean =>
  percent !== undefined && percent >= WARN_PERCENT

/** 下から `WARN_PERCENT` を越えた時だけ true(越えたままの間と、下がった時は false)。 */
export const crossedWarn = (before: number | undefined, after: number | undefined): boolean =>
  !isOverWarn(before) && isOverWarn(after)

type Rgb = readonly number[]
const RED: Rgb = [255, 60, 60]
const AMBER: Rgb = [255, 196, 40]
const WHITE: Rgb = [255, 250, 235]
const mix = (a: Rgb, b: Rgb, t: number): number[] => a.map((v, c) => v + ((b[c] ?? 0) - v) * t)

/** 警報の速さ: `WARN_PERCENT` で 1 倍、100% で 2 倍。 */
export const urgency = (percent: number): number =>
  1 + Math.max(0, Math.min(100 - WARN_PERCENT, percent - WARN_PERCENT)) / (100 - WARN_PERCENT)

/** 赤と琥珀を行き来する色(コマは 200ms)。`cell` で位相をずらすと波が右へ流れる。 */
export const alarmAt = (frame: number, cell = 0, speed = 1): string =>
  hexOf(mix(RED, AMBER, (Math.sin(frame * 1.05 * speed - cell * 0.35) + 1) / 2))

/** 点滅(約 1.2 秒で点いて消える。急ぐほど速い)。 */
export const blinkOn = (frame: number, speed = 1): boolean =>
  Math.floor((frame * speed) / 3) % 2 === 0

const SPARKS = ['✦', '✶', '✧', '✶'] as const
const TAPE_ON = '#8a6414'
const TAPE_OFF = '#3a3f47'

/**
 * 警報中の計器の線(幅 `columns` ちょうど)。`sinceWarn` は越えてからのミリ秒
 * (分からない時は Infinity で、登場は出さない)。
 */
export const alarmBar = (
  filled: number,
  columns: number,
  frame: number,
  sinceWarn: number,
  percent: number,
): Run[] => {
  const speed = urgency(percent)
  // サイレンの光: 埋まった部分の端から端へ、ゆっくり往復する白い芯。
  const sweep = Math.max(0, filled - 2) * (0.5 - 0.5 * Math.cos(frame * 0.5 * speed))
  // 登場: 最初の 0.6 秒は線全体が白く 3 回瞬く。
  const flash = sinceWarn < 600 ? (Math.floor(sinceWarn / 100) % 2 === 0 ? 1 : 0.25) : 0
  const march = Math.floor(frame * 1.5 * speed)
  const glyphs: string[] = []
  const styles: Omit<Run, 'text'>[] = []
  for (let i = 0; i < columns; i++) {
    if (i < filled - 1) {
      const glow = Math.max(0, 1 - Math.abs(i - sweep) / 3)
      const base = mix(RED, AMBER, (Math.sin(frame * 1.05 * speed - i * 0.35) + 1) / 2)
      glyphs.push('━')
      styles.push({ color: hexOf(mix(base, WHITE, Math.max(glow * 0.85, flash))), isBold: true })
    } else if (i === filled - 1) {
      // 先端の火花: 形と色がぱちぱち変わる。
      const k = Math.floor(frame * 2 * speed)
      glyphs.push(SPARKS[k % SPARKS.length] ?? '✦')
      styles.push({ color: k % 2 === 0 ? hexOf(WHITE) : hexOf(AMBER), isBold: true })
    } else {
      // 空き: 注意テープが右へ流れる。
      const isOn = (((i - march) % 4) + 4) % 4 < 2
      glyphs.push('╱')
      styles.push({ color: isOn ? TAPE_ON : TAPE_OFF })
    }
  }

  return runsOf(glyphs.join(''), i => styles[i] ?? {})
}

const GLITCH = ['░', '▒', '▓', '#', '%', '&', '@', '$'] as const

/**
 * 警告の行。`left` は ⚠・札・文(幅を超える分は … で切る)、`right` は ››› と /compact(幅が足りなければ省く)。
 * 登場の間は、左から 1 字ずつ打ち出し、打ち出す先の 3 字は乱れた字になる。
 */
export const alarmLine = (
  frame: number,
  sinceWarn: number,
  percent: number,
  width: number,
): { left: Run[]; right: Run[] } => {
  const speed = urgency(percent)
  const isCritical = percent >= CRITICAL_PERCENT
  const pulse = alarmAt(frame, 0, speed)
  const badge = isCritical ? ' CRITICAL ' : ' WARNING '

  // 1 字ずつの見た目を並べてから、打ち出しと光を掛ける。
  const chars: { ch: string; style: Omit<Run, 'text'> }[] = []
  for (const ch of blinkOn(frame, speed) ? '⚠ ' : '  ') {
    chars.push({ ch, style: { color: pulse, isBold: true } })
  }
  // 札は色を反転させ、脈に合わせて地の色が変わる。
  for (const ch of badge) {
    chars.push({ ch, style: { color: '#1a0f0f', backgroundColor: pulse, isBold: true } })
  }
  chars.push({ ch: ' ', style: {} })
  // 文に、白い光の帯が左から右へ走る(約 3 秒に 1 回)。
  const message = [...WARN_MESSAGE]
  const band = ((frame * 1.2 * speed) % (message.length + 14)) - 7
  message.forEach((ch, i) => {
    const near = Math.abs(i - band)
    chars.push({
      ch,
      style:
        near < 1.5
          ? { color: hexOf(WHITE), isBold: true }
          : { color: alarmAt(frame, i + 3, speed), isBold: near < 3 },
    })
  })

  // 幅に収まらない時は、文の終わりを … で切る(折り返すと、流れの窓の高さがずれる)。
  if (cells(chars.map(one => one.ch).join('')) > width) {
    let used = 0
    let keep = 0
    for (const one of chars) {
      const w = cells(one.ch)
      if (used + w > width - 1) break
      used += w
      keep++
    }
    chars.length = keep
    chars.push({ ch: '…', style: { color: pulse } })
  }

  const isTyping = sinceWarn < INTRO_MS
  const shown = isTyping ? Math.floor(sinceWarn / 35) : chars.length
  const typed: { ch: string; style: Omit<Run, 'text'> }[] = []
  chars.forEach((one, i) => {
    if (i < shown) typed.push(one)
    else if (i < shown + 3) {
      const pick = GLITCH[Math.floor(lot(Math.floor(frame * 3) + 1, i) * GLITCH.length)] ?? '#'
      typed.push({ ch: pick, style: { color: pulse, isBold: true } })
    }
  })
  const left = runsOf(typed.map(one => one.ch).join(''), i => typed[i]?.style ?? {})

  // 右: ››› が右へ駆ける(先頭が白)。打ち終えてから出す。
  if (isTyping && shown < chars.length) return { left, right: [] }
  const step = Math.floor(frame * 2 * speed) % 3
  const arrows = runsOf('›››', i =>
    i === step ? { color: hexOf(WHITE), isBold: true } : { color: alarmAt(frame, i, speed) },
  )
  const used = cells(chars.map(one => one.ch).join(''))
  const hasHint = used + cells(' ››› /compact') <= width
  const right = hasHint ? [...arrows, { text: '\u00a0/compact', isDim: true }] : arrows

  return { left, right: used + 4 <= width ? right : [] }
}

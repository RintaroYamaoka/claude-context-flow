// 状態の唯一の置き場。atom と、それを読む・変える関数はこのファイルにだけ書く
// (検証の制約: read / update の相手は、キーが文字列リテラルの atom。$ を渡す先は関数宣言)。
import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import type { Live, Meter, Step, Sub } from '../types'
import { DEFAULT_PALETTE } from './domain/color'

export const PANE = 'context-flow'

const meter = atom({ plugin: 'context-flow', key: 'meter' } as const, null, {
  shape: 'meter-1',
})
const goal = atom({ plugin: 'context-flow', key: 'goal' } as const, '')
const steps = atom({ plugin: 'context-flow', key: 'steps' } as const, [], {
  shape: 'steps-6',
})
const live = atom({ plugin: 'context-flow', key: 'live' } as const, null, {
  shape: 'live-1',
})
const beatRef = { plugin: 'context-flow', key: 'beat' } as const
const beat = atom(beatRef, 0)
const scroll = atom({ plugin: 'context-flow', key: 'scroll' } as const, 0)
const decided = atom({ plugin: 'context-flow', key: 'decided' } as const, [])
const open = atom({ plugin: 'context-flow', key: 'open' } as const, [])
const boot = atom({ plugin: 'context-flow', key: 'boot' } as const, 0)
const rows = atom({ plugin: 'context-flow', key: 'rows' } as const, {})
const agents = atom({ plugin: 'context-flow', key: 'agents' } as const, [], {
  shape: 'agents-1',
})

type $ = EngineInterface

// ── ファイルをまたいで書き換える旗 ──
// ES module の `let` は他のファイルから代入できないので、1 つのオブジェクトにまとめる。
export const flags: {
  /** いまの背景の配色の名前。読み込み時に、前に選んだものを戻す。 */
  paletteName: string
  /** 流れをさかのぼれる最大の行数。描くたびに更新する。 */
  maxScroll: number
  /** このペインが、いま表に出ているタブか(まだ分からない間は undefined)。 */
  isShown: boolean | undefined
} = {
  paletteName: DEFAULT_PALETTE,
  maxScroll: 0,
  isShown: undefined,
}

// ── 状態の控え ──
// 描くたびに状態を読みに行くと 1 コマに何度も通信が走るので、書いた値を手元に控え、
// 描く時はそれを読む。書くのはこの mod だけなので、控えはいつも最新。

const held = new Map<unknown, unknown>()
let isHydrated = false

/** 書いた値を手元の控えにも入れる。 */
const keep = <T,>(target: Atom<T>, value: T): T => {
  held.set(target, value)

  return value
}

/** 控えから読む(通信しない)。 */
const peek = <T,>(target: Atom<T>): T =>
  held.has(target) ? (held.get(target) as T) : target.initial

/** 読み込み直後に 1 度だけ、保存されている値を控えに入れる。 */
export async function hydrate($: $): Promise<void> {
  held.set(meter, await read($, meter))
  held.set(goal, await read($, goal))
  held.set(steps, await read($, steps))
  held.set(live, await read($, live))
  held.set(scroll, await read($, scroll))
  held.set(agents, await read($, agents))
  held.set(boot, await read($, boot))
  held.set(decided, await read($, decided))
  held.set(open, await read($, open))
  isHydrated = true
}

/** まだ控えが無ければ(描画が読み込みより先に来た時)、ここで入れる。 */
export async function ensureHydrated($: $): Promise<void> {
  if (!isHydrated) await hydrate($)
}

/** 描画 1 回分の状態の写し(控えから。通信しない)。 */
export type Frame = {
  meter: Meter | null
  goal: string
  steps: Step[]
  live: Live | null
  scroll: number
  agents: Sub[]
  boot: number
  decided: string[]
  open: string[]
}

export const frame = (): Frame => ({
  meter: peek(meter),
  goal: peek(goal),
  steps: peek(steps),
  live: peek(live),
  scroll: peek(scroll),
  agents: peek(agents),
  boot: peek(boot),
  decided: peek(decided),
  open: peek(open),
})

// ── 読む(エンジンから) ──

export function getMeter($: $) {
  return read($, meter)
}
export function getGoal($: $) {
  return read($, goal)
}
export function getSteps($: $) {
  return read($, steps)
}
export function getLive($: $) {
  return read($, live)
}
export function getDecided($: $) {
  return read($, decided)
}
export function getOpen($: $) {
  return read($, open)
}
export function getAgents($: $) {
  return read($, agents)
}
export function getRows($: $) {
  return read($, rows)
}
/** コマの時刻。描画がこれを読むことが、描き直しのきっかけになる。 */
export function getBeat($: $) {
  return read($, beat)
}

// ── 書く(控えにも入れる) ──

export async function setMeter($: $, v: Meter | null) {
  return keep(meter, await update($, meter, () => v))
}
export async function setGoal($: $, v: string) {
  return keep(goal, await update($, goal, () => v))
}
export async function setSteps($: $, fn: (v: Step[]) => Step[]) {
  return keep(steps, await update($, steps, fn))
}
export async function setLive($: $, fn: (v: Live | null) => Live | null) {
  return keep(live, await update($, live, fn))
}
export async function setScroll($: $, fn: (v: number) => number) {
  return keep(scroll, await update($, scroll, fn))
}
export async function setDecided($: $, v: string[]) {
  return keep(decided, await update($, decided, () => v))
}
export async function setOpen($: $, v: string[]) {
  return keep(open, await update($, open, () => v))
}
export async function setBoot($: $, v: number) {
  return keep(boot, await update($, boot, () => v))
}
export async function setRows($: $, v: Record<string, string>) {
  return keep(rows, await update($, rows, () => v))
}
export async function setAgents($: $, fn: (v: Sub[]) => Sub[]) {
  return keep(agents, await update($, agents, fn))
}
/** コマを進める。控えには入れない(描画はこれだけをエンジンから読む)。 */
export function setBeat($: $, now: number) {
  return $.state.set(beatRef, now)
}

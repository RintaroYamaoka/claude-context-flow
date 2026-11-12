// 流れの行の組み立て:ターンの並び → 章 → 描く行(本筋の節と、寄り道の枝)。
// 下の「いま」の行、流れの窓の切り出し、飛ぶ先の行探しもここ。`$` は使わない。
import type { Live, Step, Sub } from '../../types'
import { METER_WIDTH, PULSE, glowAt, hueAt, runsOf, ultra, wave } from './color'
import type { Run } from './color'
import { cells, clip, clock, wrapCells } from './text'

/** 要約の文字が打ち出される速さ(1 文字あたりのミリ秒)。 */
const TYPE_MS = 18
const TRUNK = 3 // 本筋の線の列の幅
const BRANCH = 6 // 枝の行の、線の列の幅(┣━━○ と空き)

/** 飛ぶ先のターン。 */
export type Target = { id?: string; rowId?: string; anchor?: string; prompt?: string }

export type Line = {
  rail: string
  isNode?: boolean
  isLive?: boolean
  isStrong?: boolean
  runs: Run[]
  right?: string
  /** 右端に描く、色分けした文字(動く表示)。 */
  rightRuns?: Run[]
  /** 右端を控えめに描く(ターン番号)。 */
  isRightQuiet?: boolean
  /** 押すと飛ぶ先(ターンの見出しの行だけ)。 */
  target?: Target & { id: string }
  /** 左の線の列の幅(枝の行は広い)。 */
  gutter?: number
  /** アクセント(色なしの光を走らせる行)。いまの節の名前だけ。 */
  isAccent?: boolean
}

export type Chapter = { name: string; isSide: boolean; first: number; last: number }

/** 同じ章の名前が続くターンを、1 つの章にまとめる。最初の章はいつも本筋。 */
export const chaptersOf = (list: readonly Step[]): Chapter[] => {
  const chapters: Chapter[] = []
  list.forEach((step, i) => {
    const current = chapters.at(-1)
    // 要約待ちのターンは、ひとまず直前の章の続きとして置く。
    const name = step.chapter ?? current?.name ?? '…'
    if (current !== undefined && current.name === name) current.last = i
    else {
      chapters.push({
        name,
        isSide: chapters.length > 0 && step.isSide === true,
        first: i,
        last: i,
      })
    }
  })

  return chapters
}

const targetOf = (step: Step): Target & { id: string } => ({
  id: step.id,
  rowId: step.rowId,
  anchor: step.anchor,
  prompt: step.prompt,
})

/** 折り返しの結果の控え(同じ文を毎コマ折り返さない)。 */
const wrapMemo = new Map<string, string[]>()

/**
 * 流れ: 本筋と寄り道。
 * 太い縦線が本筋で、節(●)が話の段階。手直しや脱線は、線から右へ出る枝(○)にする。
 * いまの節だけ、ターンの見出しまで開く。説明文が出るのは最新のターンだけ。
 * `text` はレールの右の文章の幅、`now` はコマの時刻、`frame` は小数のコマ番号。
 */
export const flowLines = (
  list: readonly Step[],
  isRunning: boolean,
  text: number,
  now: number,
  frame: number,
): Line[] => {
  const chapters = chaptersOf(list)
  const all: Line[] = []
  chapters.forEach((chapter, c) => {
    const isCurrent = c === chapters.length - 1
    const isLast = isCurrent && !isRunning
    const first = list[chapter.first]
    const tag =
      chapter.first === chapter.last && !isCurrent
        ? `#${chapter.first + 1}`
        : `#${chapter.first + 1}-${isCurrent ? '' : chapter.last + 1}`
    const gutter = chapter.isSide ? BRANCH : TRUNK
    const width = text - (gutter - TRUNK)
    const name = clip(chapter.name, width - cells(tag) - 2)
    const jump =
      first === undefined
        ? undefined
        : { ...targetOf(first), id: `chapter-${first.id}` }

    // 本筋の節の前には、線だけの 1 行を置いて間を空ける(枝は詰めてぶら下げる)。
    if (!chapter.isSide && all.length > 0) all.push({ rail: '┃', runs: [] })
    if (chapter.isSide) {
      // 枝: 本筋から右へ出る。最後の章が枝なら、線はそこで曲がって終わる。
      all.push({
        rail: `${isCurrent ? '┗' : '┣'}━━${isCurrent ? '◉' : '○'}`,
        gutter,
        isNode: true,
        isStrong: isLast,
        isAccent: isCurrent,
        runs: [{ text: name, isBold: isCurrent, isDim: !isCurrent }],
        right: tag,
        isRightQuiet: true,
        target: isCurrent ? undefined : jump,
      })
    } else {
      all.push({
        rail: isCurrent ? '◉' : '●',
        isNode: true,
        isStrong: isLast,
        isAccent: isCurrent,
        runs: [{ text: name, isBold: true }],
        right: tag,
        isRightQuiet: true,
        target: isCurrent ? undefined : jump,
      })
    }
    if (!isCurrent) return

    // いまの節の中: ターンの見出しを 1 行ずつ。
    const inside = chapter.isSide ? '\u00a0\u00a0\u00a0│' : '┃'
    for (let i = chapter.first; i <= chapter.last; i++) {
      const step = list[i]
      if (step === undefined) continue
      const isLatest = i === list.length - 1
      const number = `#${i + 1}`
      const title = clip(
        step.title ?? (step.prompt || '(入力なしで続行)'),
        width - 2 - cells(number) - 2,
      )
      // 要約が届いた直後は、見出しから順に文字を打ち出す。
      let budget =
        step.doneAt === undefined
          ? Infinity
          : Math.max(0, Math.floor((now - step.doneAt) / TYPE_MS))
      const type = (line: string): { shown: string; hasCursor: boolean } => {
        const chars = [...line]
        const shown = chars.slice(0, Math.max(0, budget)).join('')
        const hasCursor = budget >= 0 && budget < chars.length
        budget -= chars.length

        return { shown, hasCursor }
      }
      if (step.summary === undefined) {
        // 要約を待っている間は、見出しの上を光が走る。
        all.push({
          rail: inside,
          gutter,
          isLive: true,
          runs: runsOf(`· ${title}`, index => ({
            isDim: glowAt(gutter + index, frame) === 0,
          })),
          right: number,
          isRightQuiet: true,
          target: targetOf(step),
        })
        continue
      }
      const head = type(title)
      all.push({
        rail: inside,
        gutter,
        runs: [
          { text: '· ', isDim: true },
          { text: head.shown, isBold: isLatest && !isRunning },
          ...(head.hasCursor ? [{ text: '▍', color: hueAt(frame) }] : []),
        ],
        right: number,
        isRightQuiet: true,
        target: targetOf(step),
      })
      if (!isLatest) continue
      // 最新のターンだけ、何が起きたかの説明を添える。
      if (wrapMemo.size > 600) wrapMemo.clear()
      const key = `${width}\u0000${step.summary}`
      const detail = wrapMemo.get(key) ?? wrapCells(step.summary, width - 2, 3)
      wrapMemo.set(key, detail)
      for (const line of detail) {
        const body = type(line)
        all.push({
          rail: inside,
          gutter,
          runs: [
            { text: '\u00a0\u00a0' },
            { text: body.shown, isDim: true },
            ...(body.hasCursor ? [{ text: '▍', color: hueAt(frame) }] : []),
          ],
        })
      }
    }
    // 走っている間は、「いま」の行へ線をつなぐ。
    if (isRunning) all.push({ rail: chapter.isSide ? '\u00a0\u00a0\u00a0│' : '┃', gutter, runs: [] })
  })

  return all
}

/** 下の「いま」: 走っているターンと、その直近のツール呼び出し、サブエージェント。 */
export const footLines = (
  running: Live | null,
  subs: readonly Sub[],
  text: number,
  now: number,
  frame: number,
): Line[] => {
  const beatIndex = Math.floor(frame)
  const actions = running?.actions.slice(-3) ?? []
  const foot: Line[] = []
  if (running !== null) {
    const time = clock(now - running.startedAt)
    const title = clip(running.prompt || '続行中', text - cells(time) - 2)
    foot.push({
      rail: PULSE[beatIndex % PULSE.length] ?? '◉',
      isNode: true,
      isLive: true,
      runs: ultra(title, frame),
      right: time,
    })
    // いま動いているものの右で、小さな波形が揺れる。ツールが無い間は「考え中」。
    const shown = actions.length > 0 ? actions : ['考え中']
    shown.forEach((action, i) => {
      const isCurrent = i === shown.length - 1
      foot.push({
        rail: '┆',
        isLive: true,
        runs: [
          {
            text: clip(
              `${isCurrent ? '❯' : '·'} ${action}`,
              text - (isCurrent ? METER_WIDTH + 2 : 0),
            ).replace(/ /g, '\u00a0'),
            isDim: !isCurrent,
          },
        ],
        // 波形は右端に置くので、色と光もその桁のものにする。
        rightRuns: isCurrent
          ? ultra(wave(frame), frame, 3 + text - METER_WIDTH)
          : undefined,
      })
    })
  }

  if (subs.length > 0) {
    foot.push({
      rail: '┆',
      isLive: true,
      runs: [{ text: `サブエージェント\u00a0${subs.length}`, isDim: true }],
    })
    for (const sub of subs.slice(0, 4)) {
      const label = clip(`${sub.type} ${sub.description}`.trim(), text - 2)
      const spare = text - 2 - cells(label) - 3
      const action =
        sub.action !== undefined && spare >= 8 ? clip(sub.action, spare) : ''
      foot.push({
        rail: PULSE[(beatIndex + 3) % PULSE.length] ?? '○',
        isNode: true,
        isLive: true,
        runs: [
          ...ultra(label, frame),
          ...(action === ''
            ? []
            : [{ text: `\u00a0·\u00a0${action.replace(/ /g, '\u00a0')}`, isDim: true }]),
        ],
      })
    }
    if (subs.length > 4) {
      foot.push({
        rail: '┆',
        isLive: true,
        runs: [{ text: `ほか\u00a0${subs.length - 4}`, isDim: true }],
      })
    }
  }

  // 「いま」の区画は、見出しだけでなく全部の文字(ツールの行・考え中・
  // サブエージェント・経過時間)に、虹の流れと光の帯を乗せる。
  for (const line of foot) {
    const whole = line.runs.map(run => run.text).join('')
    // 行の頭は、レールの列(3 桁)の右。右端のものは、文章の幅の右端に寄る。
    line.runs = ultra(whole, frame, 3)
    if (line.right !== undefined) {
      line.rightRuns = ultra(line.right, frame, 3 + text - cells(line.right))
      line.right = undefined
    }
  }

  return foot
}

/**
 * 流れの窓: 全 `total` 行のうち、最新から `back` 行さかのぼった `rows` 行分を切り出す。
 * 窓の外に続きがある側は、1 行を「まだある」の印に使う。
 */
export const windowOf = (
  total: number,
  rows: number,
  back: number,
): {
  start: number
  end: number
  hasAbove: boolean
  hasBelow: boolean
  maxScroll: number
} => {
  const maxScroll = Math.max(0, total - rows)
  const offset = Math.min(back, maxScroll)
  let end = total - offset
  let start = Math.max(0, end - rows)
  const hasAbove = start > 0
  const hasBelow = offset > 0
  if (hasAbove) start += 1
  if (hasBelow) end -= 1

  return { start, end, hasAbove, hasBelow, maxScroll }
}

/** ターンの依頼文から、それを始めた発言の行を探す。`rowIds` は 発言の頭 → 行。 */
export const findRow = (
  target: Target,
  rowIds: ReadonlyMap<string, string>,
): string | undefined => {
  if (target.rowId !== undefined) return target.rowId
  const exact =
    target.anchor === undefined ? undefined : rowIds.get(target.anchor)
  if (exact !== undefined) return exact
  // 頭が一致しない時(言い直しをまとめたターン、表示と文面のずれ)は、
  // 依頼文に含まれる発言のうち、いちばん長く一致するものを取る。
  const prompt = target.prompt ?? ''
  let best: string | undefined
  let score = 0
  for (const [anchor, id] of rowIds) {
    const head = anchor.slice(0, 40)
    const isMatch =
      prompt.includes(anchor) || (head.length >= 4 && prompt.includes(head))
    if (isMatch && anchor.length >= score) {
      best = id
      score = anchor.length
    }
  }

  return best
}

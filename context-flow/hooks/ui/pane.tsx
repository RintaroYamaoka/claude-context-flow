// ペイン(枠は固定):
//   上  計器(モデル名・コンテキスト量)、目的、決まったこと・残っていること
//   中  流れ(本筋と寄り道)。ここだけがスクロールする
//   下  いま(走っているターン・ツール・サブエージェント)
import type { EngineInterface, RenderInput } from 'claude-code'

import { backgroundAt, hueAt, rainbow, runsOf, ultra } from '../domain/color'
import { flowLines, footLines, windowOf } from '../domain/flow'
import type { Line, Target } from '../domain/flow'
import { cells, clip, formatTokens, modelName, wrapCells } from '../domain/text'
import { flags } from '../store'
import type { Frame } from '../store'
import { renderBoot } from './splash'

type PaneInput = Extract<RenderInput, { component: 'Pane' }>

export type Actions = { jump: (target: Target) => void }

/** 動きの速さの単位。コマ番号は「この時間が何回過ぎたか」で、小数のまま使う。 */
const FRAME_MS = 200

/**
 * `f` は手元の控えから読んだ状態、`now` はコマの時刻
 * (状態から読むのはこれだけなので、1 コマの通信は 1 回で済む)。
 */
export function renderPane(
  $: EngineInterface,
  e: PaneInput,
  f: Frame,
  now: number,
  actions: Actions,
): JSX.Element {
  const { Box, Button, Text } = $.ui.resolve(e)
  const gauge = f.meter
  const aim = f.goal
  const list = f.steps
  const running = f.live
  // 左右に 2 桁ずつの余白を取る。
  const columns = Math.max(24, e.props.bodyColumns - 4)
  const text = columns - 3 // レールの右の、文章の幅
  // 木の高さを窓の高さちょうどに収める(エンジンに全体をスクロールさせない)。
  const room = Math.max(14, e.props.scroll.bodyRows)
  // 小数のコマ番号。描く回数を増やすほど、動きがなめらかになる。
  const frame = now / FRAME_MS

  // ── 固定ヘッダー: 計器と目的 ──
  const percent = Math.min(100, Math.max(0, gauge?.percent ?? 0))
  const tone = percent >= 85 ? 'error' : percent >= 70 ? 'warning' : undefined
  const amount =
    gauge === null
      ? ''
      : gauge.tokens === undefined
        ? `– / ${formatTokens(gauge.window)}`
        : `${formatTokens(gauge.tokens)} / ${formatTokens(gauge.window)}`
  const filled = Math.round((percent / 100) * columns)
  // 埋まっている部分を、光の帯が左から右へ走る。
  const glint = ((frame * 1.5) % (filled + 12)) - 3
  const bar = runsOf('━'.repeat(filled), i => {
    const far = Math.abs(i - glint)
    const glow = far < 1.5 ? 0.75 : far < 3.5 ? 0.4 : 0

    return {
      color: rainbow(i * 0.045 - frame * 0.05, glow),
      isBold: glow > 0,
    }
  })
  const aimLines = wrapCells(
    aim || (list.length > 0 ? '読み取り中…' : 'まだ会話がありません'),
    columns,
    2,
  )
  const model = modelName(gauge?.model ?? '')
  // モデル名は 1 行。幅に余裕があれば、大文字を 1 字ずつ空けて少し大きく見せる。
  const spaced = [...model.name.toUpperCase()].join(' ')
  const nameText =
    model.name === ''
      ? '…'
      : cells(spaced) <= columns - cells(amount) - 9
        ? spaced
        : model.name
  // 現在地: 決まったこと・残っていること(短い箇条書き。狭い時は数を減らす)。
  const isTall = e.props.scroll.bodyRows >= 30
  const decidedShown = f.decided.slice(0, isTall ? 3 : 2)
  const openShown = f.open.slice(0, isTall ? 2 : 1)
  const stateRows =
    (decidedShown.length > 0 ? 1 + decidedShown.length : 0) +
    (openShown.length > 0 ? 1 + openShown.length : 0) +
    (decidedShown.length + openShown.length > 0 ? 1 : 0)
  // 上の余白 1 行+計器 2 行+空行+目的+空行+現在地+流れの見出し+空行。
  const headRows = 1 + 2 + 1 + 1 + aimLines.length + 1 + stateRows + 1 + 1

  // ── 固定フッター: いま ──
  const foot = footLines(running, f.agents, text, now, frame)

  // ── 流れ: ヘッダーとフッターの間の窓で、ここだけがスクロールする ──
  const all = flowLines(list, running !== null, text, now, frame)
  const total = all.length
  const cut = windowOf(total, Math.max(3, room - headRows - foot.length), f.scroll)
  flags.maxScroll = cut.maxScroll
  const lines = all.slice(cut.start, cut.end)
  const above = cut.start
  const below = total - cut.end

  // レールを、光の粒が上から下へ流れ落ちる(走っている間だけ)。
  const drop =
    running === null
      ? -9
      : Math.floor(frame * 2.5) % (lines.length + foot.length + 5)

  const draw = (line: Line, row: number) => {
    const far = drop - row
    // レールも同じ虹に乗せる。落ちてくる光の頭ほど白に近い。
    const railColor =
      far === 0
        ? hueAt(frame, row * 2, 0.75)
        : far === 1
          ? hueAt(frame, row * 2, 0.4)
          : line.isLive || line.isStrong || far === 2
            ? hueAt(frame, row * 2)
            : undefined
    const isLit = railColor !== undefined
    const target = line.target

    return (
      <Box flexDirection="row">
        <Box width={line.gutter ?? 3} flexShrink={0}>
          <Text bold={isLit} color={railColor} dimColor={!isLit}>
            {line.rail}
          </Text>
        </Box>
        <Box flexDirection="row" flexGrow={1} justifyContent="space-between">
          {target === undefined ? (
            <Box flexDirection="row">
              {line.runs.map(run => (
                <Text
                  bold={run.isBold}
                  color={run.color}
                  dimColor={run.isDim}
                  wrap="truncate-end"
                >
                  {run.text}
                </Text>
              ))}
            </Box>
          ) : (
            <Button
              key={`turn:${target.id}`}
              plain
              onPress={() => {
                actions.jump(target)
              }}
            >
              {line.runs.map(run => (
                <Text bold={run.isBold} color={run.color} dimColor={run.isDim}>
                  {run.text}
                </Text>
              ))}
            </Button>
          )}
          {line.rightRuns !== undefined && (
            <Box flexDirection="row" flexShrink={0}>
              {line.rightRuns.map(run => (
                <Text bold={run.isBold} color={run.color} dimColor={run.isDim}>
                  {run.text}
                </Text>
              ))}
            </Box>
          )}
          {line.right !== undefined && line.isRightQuiet && (
            <Text dimColor>{line.right}</Text>
          )}
          {line.right !== undefined && !line.isRightQuiet && (
            <Text bold color={hueAt(frame, text)}>
              {line.right}
            </Text>
          )}
        </Box>
      </Box>
    )
  }

  // 画面を 1 行ずつの並びに組む(行ごとに背景色を変えるため)。空の行は undefined。
  const out: (JSX.Element | undefined)[] = []
  out.push(undefined)
  out.push(
    <Box flexDirection="row" justifyContent="space-between">
      <Box flexDirection="row">
        {ultra(nameText, frame).map(run => (
          <Text bold color={run.color}>
            {run.text}
          </Text>
        ))}
      </Box>
      <Box flexDirection="row">
        <Text dimColor>{amount}  </Text>
        <Text bold color={tone}>
          {gauge?.percent === undefined ? '–' : `${Math.round(percent)}%`}
        </Text>
      </Box>
    </Box>,
  )
  out.push(
    <Box flexDirection="row">
      {bar.map(run => (
        <Text bold={run.isBold} color={run.isBold ? run.color : (tone ?? run.color)}>
          {run.text}
        </Text>
      ))}
      <Text dimColor>{'─'.repeat(columns - filled)}</Text>
    </Box>,
  )
  out.push(undefined)
  out.push(
    <Box flexDirection="row">
      <Text dimColor>目的</Text>
    </Box>,
  )
  for (const line of aimLines) {
    out.push(
      <Box flexDirection="row">
        <Text bold={aim !== ''} dimColor={aim === ''}>
          {line}
        </Text>
      </Box>,
    )
  }
  out.push(undefined)
  if (decidedShown.length > 0) {
    out.push(
      <Box flexDirection="row">
        <Text dimColor>決まったこと</Text>
      </Box>,
    )
  }
  for (const item of decidedShown) {
    out.push(
      <Box flexDirection="row">
        <Text color="success">✓ </Text>
        <Text wrap="truncate-end">{clip(item, columns - 2)}</Text>
      </Box>,
    )
  }
  if (openShown.length > 0) {
    out.push(
      <Box flexDirection="row">
        <Text dimColor>残っていること</Text>
      </Box>,
    )
  }
  for (const item of openShown) {
    out.push(
      <Box flexDirection="row">
        <Text dimColor>· </Text>
        <Text wrap="truncate-end">{clip(item, columns - 2)}</Text>
      </Box>,
    )
  }
  if (decidedShown.length + openShown.length > 0) out.push(undefined)
  out.push(
    <Box flexDirection="row" justifyContent="space-between">
      <Text dimColor>流れ</Text>
      <Text bold>
        {running !== null
          ? `${list.length + 1} ターン目`
          : `${list.length} ターン`}
      </Text>
    </Box>,
  )
  out.push(undefined)
  if (list.length === 0 && running === null) {
    out.push(
      <Box flexDirection="row">
        <Text dimColor>最初のターンが終わると、ここに流れが並びます。</Text>
      </Box>,
    )
  }
  if (cut.hasAbove) {
    out.push(
      <Box flexDirection="row">
        <Text dimColor>{`┆  ↑ 上に ${above} 行`}</Text>
      </Box>,
    )
  }
  lines.forEach((line, row) => {
    out.push(draw(line, row))
  })
  if (cut.hasBelow) {
    out.push(
      <Box flexDirection="row">
        <Text dimColor>{`┆  ↓ 下に ${below} 行`}</Text>
      </Box>,
    )
  }
  foot.forEach((line, row) => {
    out.push(draw(line, lines.length + row))
  })
  // 下の余りも塗って、ペインの底まで背景を続ける。
  while (out.length < room) out.push(undefined)

  const view = (
    <Box flexDirection="column">
      {out.map((cell, i) => (
        <Box
          flexDirection="column"
          width={e.props.bodyColumns}
          paddingX={2}
          backgroundColor={backgroundAt(flags.paletteName, i, out.length)}
        >
          {cell ?? <Text> </Text>}
        </Box>
      ))}
    </Box>
  )

  const sinceBoot = f.boot === 0 ? Infinity : Math.max(0, now - f.boot)

  return renderBoot($, e, view, { sinceBoot, frame, columns, room })
}

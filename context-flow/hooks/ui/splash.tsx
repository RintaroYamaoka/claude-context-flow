// 起動アニメーション。
// セッションが始まってから少しの間、タイトルが打ち出され、線が中央から開き、
// 波が立ってから、画面が上から下へ開く。
// ときどき(RARE_ODDS 回に 1 回)、花火と流れ星の派手な夜空になる(まれな起動)。
// もっとまれに(THUNDER_ODDS 回に 1 回)、ドット絵の黄色いしま猫が雨雲を雷で吹き飛ばす(雷の起動)。
import type { EngineInterface, RenderInput } from 'claude-code'

import {
  BARS,
  backgroundAt,
  flashAt,
  hueAt,
  isRareBoot,
  isThunderBoot,
  jackpot,
  shootingStar,
  skyRow,
  ultra,
} from '../domain/color'
import {
  MARK_AT,
  THUNDER_MS,
  TITLE_AT,
  thunderFlash,
  thunderLayout,
  thunderScene,
} from '../domain/thunder'
import { flags } from '../store'

type PaneInput = Extract<RenderInput, { component: 'Pane' }>

/** タイトルが出ている時間と、そのあと画面が開く時間。 */
const SPLASH_MS = 1900
const REVEAL_MS = 700
const WORDMARK = 'c o n t e x t   f l o w'
/** まれな起動の、カーソルの色。 */
const RARE_GOLD = '#ffd54a'
/** まれな起動の、ひとことの代わりに瞬く飾り。 */
const RARE_MARK = '★ ✦ ★ ✦ ★ ✦ ★'

const clamp = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * 起動からの時間に応じて、タイトルの画面・開きかけのペイン・ペインそのものを返す。
 * `sinceBoot` は起動アニメーションが始まってからのミリ秒、`view` は描き上がったペイン。
 * `bootAt` は起動の時刻(まれな起動かどうかと、星の位置を決める)。
 */
export function renderBoot(
  $: EngineInterface,
  e: PaneInput,
  view: JSX.Element,
  at: { sinceBoot: number; bootAt: number; frame: number; columns: number; room: number },
): JSX.Element {
  const { Box, Text } = $.ui.resolve(e)
  const { sinceBoot, bootAt, frame, columns, room } = at
  // 雷の起動は物語があるので長い。
  // OFF の間は、名指しで流した時だけ雷にする(前の会話の時刻が残っていても出さない)。
  const isThunder =
    isThunderBoot(bootAt) && (flags.isThunderOn || bootAt === flags.thunderBootAt)
  const splashMs = isThunder ? THUNDER_MS : SPLASH_MS
  if (sinceBoot >= splashMs + REVEAL_MS) return view
  if (sinceBoot >= splashMs) {
    const k = (sinceBoot - splashMs) / REVEAL_MS
    const eased = 1 - (1 - k) * (1 - k) * (1 - k)

    return (
      <Box
        flexDirection="column"
        height={Math.max(1, Math.round(room * eased))}
        overflow="hidden"
      >
        {view}
      </Box>
    )
  }

  if (isThunder) return renderThunder($, e, at)

  const isRare = isRareBoot(bootAt)
  const paint = isRare ? jackpot : ultra
  const typed = [...WORDMARK].slice(0, Math.floor(sinceBoot / 40)).join('')
  const isTyping = typed.length < WORDMARK.length
  const opened = clamp((sinceBoot - 150) / 800)
  const half = Math.round((1 - (1 - opened) * (1 - opened)) * (columns / 2))
  // 波の高さは、立ち上がってから静まる。まれな起動では、波の代わりに流れ星が横切る。
  const swell = Math.sin(Math.PI * clamp((sinceBoot - 350) / 1450))
  const crest = isRare
    ? shootingStar(clamp((sinceBoot - 350) / 1300), columns)
    : Array.from({ length: columns }, (_, c) => {
        const level = swell * ((Math.sin(frame * 1.3 + c * 0.42) + 1) / 2)

        return BARS[Math.round(level * (BARS.length - 1))] ?? '▁'
      }).join('')
  const status = sinceBoot < 1250 ? '会話の流れを読み込み中' : '準備完了'

  // タイトル・線・波・ひとことを、縦の中央に 1 行おきに置く。
  // 背景はペインと同じく、行ごとに塗る。
  const top = Math.max(1, Math.floor((room - 7) / 2))
  const splash = new Map<number, JSX.Element>([
    [
      top,
      <Box flexDirection="row">
        {paint(typed === '' ? ' ' : typed, frame).map(run => (
          <Text bold color={run.color}>
            {run.text}
          </Text>
        ))}
        {isTyping && <Text color={isRare ? RARE_GOLD : hueAt(frame)}>▍</Text>}
      </Box>,
    ],
    [
      top + 2,
      <Box flexDirection="row">
        {paint('━'.repeat(Math.max(1, half * 2)), frame).map(run => (
          <Text bold color={run.color}>
            {run.text}
          </Text>
        ))}
      </Box>,
    ],
    [
      top + 4,
      <Box flexDirection="row">
        {paint(crest, frame).map(run => (
          <Text color={run.color}>{run.text}</Text>
        ))}
      </Box>,
    ],
    [
      top + 6,
      <Box flexDirection="row">
        {isRare ? (
          jackpot(RARE_MARK, frame * 3).map(run => (
            <Text bold color={run.color}>
              {run.text}
            </Text>
          ))
        ) : (
          <Text dimColor>{status}</Text>
        )}
      </Box>,
    ],
  ])
  // まれな起動では、空いた行に星・花火・流れ星を描く。
  const sky = (row: number): JSX.Element | undefined =>
    isRare ? (
      <Box flexDirection="row">
        {skyRow(bootAt, row, room, columns, sinceBoot, frame).map(run => (
          <Text bold={run.isBold} color={run.color}>
            {run.text}
          </Text>
        ))}
      </Box>
    ) : undefined
  // まれな起動では、タイトルを打ち終えるころに一瞬だけ金色に光る。
  const backdrop = (row: number): string | undefined => {
    const base = backgroundAt(flags.paletteName, row, room)

    return isRare ? flashAt(sinceBoot, base) : base
  }

  return (
    <Box flexDirection="column">
      {Array.from({ length: room }, (_, i) => (
        <Box
          flexDirection="column"
          alignItems="center"
          width={e.props.bodyColumns}
          paddingX={2}
          backgroundColor={backdrop(i)}
        >
          {splash.get(i) ?? sky(i) ?? <Text> </Text>}
        </Box>
      ))}
    </Box>
  )
}

/** 雷の起動の、文字の色。 */
const THUNDER_GOLD = '#ffe14a'
const THUNDER_MARK = '⚡ R A R E ⚡'

/**
 * 雷の起動: 黄色いしま猫が歩いてきて、雨雲を雷で吹き飛ばし、虹がかかる(`../domain/thunder`)。
 * タイトルは虹がかかってから打ち出す。
 */
function renderThunder(
  $: EngineInterface,
  e: PaneInput,
  at: { sinceBoot: number; bootAt: number; frame: number; columns: number; room: number },
): JSX.Element {
  const { Box, Text } = $.ui.resolve(e)
  const { sinceBoot, bootAt, columns, room } = at
  const { title, status } = thunderLayout(room)
  const typed = [...WORDMARK]
    .slice(0, Math.max(0, Math.floor((sinceBoot - TITLE_AT) / 25)))
    .join('')
  const isLit = Math.floor(sinceBoot / 90) % 2 === 0
  const scene = thunderScene(bootAt, room, columns, sinceBoot)

  const line = (row: number): JSX.Element => {
    if (row === title) {
      return (
        <Text bold color={THUNDER_GOLD}>
          {typed === '' ? ' ' : typed}
        </Text>
      )
    }
    if (row === status) {
      return sinceBoot >= MARK_AT ? (
        <Text bold color={isLit ? '#ffffff' : THUNDER_GOLD}>
          {THUNDER_MARK}
        </Text>
      ) : (
        <Text> </Text>
      )
    }

    return (
      <Box flexDirection="row">
        {(scene[row] ?? []).map(run => (
          <Text bold={run.isBold} color={run.color} backgroundColor={run.backgroundColor}>
            {run.text}
          </Text>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {Array.from({ length: room }, (_, i) => (
        <Box
          flexDirection="column"
          alignItems="center"
          width={e.props.bodyColumns}
          paddingX={2}
          backgroundColor={thunderFlash(sinceBoot, backgroundAt(flags.paletteName, i, room))}
        >
          {line(i)}
        </Box>
      ))}
    </Box>
  )
}

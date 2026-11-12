// 純粋なロジックの単体テスト。claude plugin test ./context-flow で回す。
import { expect, test } from 'claude-code/testing'

import type { Step } from '../types'
import { backgroundAt, paneBackground, pickPalette, rainbow, runsOf } from '../hooks/domain/color'
import { chaptersOf, findRow, flowLines, footLines, windowOf } from '../hooks/domain/flow'
import { applySegments, itemsOf, parseSegments, parseSummary, segmentPrompt, summaryPrompt, turnsOf } from '../hooks/domain/summary'
import { actionOf, anchorOf, cells, clip, clock, formatTokens, modelName, oneLine, wrapCells } from '../hooks/domain/text'

const step = (id: string, more: Partial<Step> = {}): Step => ({
  id,
  prompt: `依頼 ${id}`,
  answer: '',
  tools: [],
  at: 0,
  ...more,
})

test('セル幅:全角は 2、半角は 1', async () => {
  expect(cells('abc')).toBe(3)
  expect(cells('流れ')).toBe(4)
  expect(cells('a流b')).toBe(4)
  expect(cells('')).toBe(0)
})

test('切り詰め:収まればそのまま、はみ出せば … を付けて幅に収める', async () => {
  expect(clip('abc', 3)).toBe('abc')
  expect(clip('abcdef', 4)).toBe('abc…')
  expect(clip('会話の流れ', 6)).toBe('会話…')
  expect(cells(clip('会話の流れを見失わない', 9))).toBeLessThanOrEqual(9)
})

test('折り返し:セル幅で折り、行数を超えたら最後の行を … で切る', async () => {
  expect(wrapCells('abcdef', 3, 5)).toEqual(['abc', 'def'])
  expect(wrapCells('会話の流れ', 4, 5)).toEqual(['会話', 'の流', 'れ'])
  expect(wrapCells('', 4, 2)).toEqual([''])
  const cut = wrapCells('abcdefghijkl', 4, 2)
  expect(cut).toEqual(['abcd', 'efg…'])
})

test('整形:1 行化・発言の頭・トークン数・モデル名・時刻・ツールの 1 行', async () => {
  expect(oneLine('a\n  b <system-reminder>x\ny</system-reminder> c')).toBe('a b c')
  expect(oneLine('[Request interrupted by user for tool use] 続き')).toBe('続き')
  expect(anchorOf('x'.repeat(100))).toBe('x'.repeat(80))
  expect(formatTokens(999)).toBe('999')
  expect(formatTokens(1500)).toBe('1.5k')
  expect(formatTokens(200_000)).toBe('200k')
  expect(formatTokens(1_000_000)).toBe('1M')
  expect(modelName('claude-opus-4-5-20251101')).toEqual({ name: 'opus 4.5', extra: '' })
  expect(modelName('Opus 4.5 (1M context)')).toEqual({ name: 'Opus 4.5', extra: '1M context' })
  expect(clock(65_000)).toBe('1:05')
  expect(clock(-5)).toBe('0:00')
  expect(actionOf({ tool: 'Bash' })).toBe('Bash')
  expect(actionOf({ tool: 'Read', file_path: '/a/b/c/d.ts' } as { tool: string })).toBe('Read c/d.ts')
  expect(actionOf({ tool: 'mcp__server__search', query: 'x  y' } as { tool: string })).toBe('search x y')
})

test('色:同じ見た目はまとめる、虹は一周で戻る、背景は一色', async () => {
  expect(runsOf('a b', () => ({ isDim: true }))).toEqual([{ text: 'a\u00a0b', isDim: true }])
  expect(runsOf('ab', i => ({ isBold: i === 0 })).length).toBe(2)
  expect(rainbow(0)).toBe('#eb5f57')
  expect(rainbow(1)).toBe(rainbow(0))
  expect(rainbow(-0.25)).toBe(rainbow(0.75))
  // どの行も同じ色(配色の上の色と下の色の中ほど)。
  expect(backgroundAt('navy', 0, 10)).toBe('#0b1120')
  expect(backgroundAt('navy', 9, 10)).toBe('#0b1120')
  expect(backgroundAt('sumi', 3, 10)).toBe(paneBackground('sumi'))
  expect(backgroundAt('none', 0, 10)).toBeUndefined()
  expect(paneBackground('none')).toBe('transparent')
  expect(paneBackground('sumi')).toBe('#141417')
  expect(pickPalette('', 'navy')).toBe('sumi')
  expect(pickPalette('', 'none')).toBe('navy')
  expect(pickPalette('茜', 'navy')).toBe('akane')
  expect(pickPalette('umi', 'navy')).toBe('umi')
  expect(pickPalette('無い色', 'navy')).toBeUndefined()
})

test('要約の返答:GOAL などの行を読み、無い行は undefined', async () => {
  const found = parseSummary(
    [
      'GOAL: mod をファイルに分ける',
      'TITLE: 分割の依頼',
      'STEP:  1 ファイルを役割ごとに分けた ',
      'DECIDED: store に状態 | domain は純粋 | テストを足す | 4 つ目',
      'OPEN: なし',
    ].join('\n'),
  )
  expect(found).toEqual({
    goal: 'mod をファイルに分ける',
    title: '分割の依頼',
    step: '1 ファイルを役割ごとに分けた',
    decided: ['store に状態', 'domain は純粋', 'テストを足す'],
    open: [],
  })
  expect(parseSummary('')).toEqual({ goal: undefined, title: undefined, step: undefined, decided: [], open: [] })
  expect(itemsOf(' a |  | なし | b ', 5)).toEqual(['a', 'b'])
  expect(itemsOf(undefined, 3)).toEqual([])
})

test('要約に渡す文:目的・決まったこと・手前の流れ・このターン', async () => {
  const list = [step('a', { summary: '最初にやったこと' }), step('b', { tools: ['Bash', 'Read'], answer: '返事' })]
  const prompt = summaryPrompt(list, 1, { goal: '', decided: ['x', 'y'], open: [] })
  expect(prompt).toContain('これまでの目的: (まだ無い)')
  expect(prompt).toContain('決まったこと: x | y')
  expect(prompt).toContain('残っていること: なし')
  expect(prompt).toContain('これまでの流れ:\n1. 最初にやったこと')
  expect(prompt).toContain('依頼:\n依頼 b')
  expect(prompt).toContain('使ったツール: Bash, Read')
  expect(prompt).toContain('返答:\n返事')
  expect(summaryPrompt(list, 0, { goal: 'g', decided: [], open: [] })).toContain('これまでの流れ:\n(このターンが最初)')
})

test('章の区切りの行:範囲・本筋と寄り道・名前を読み、読めない行は捨てる', async () => {
  const parsed = parseSegments(
    ['3-3 | 寄り道 | 色の手直し', '前置きの文', '1-2 | 本筋 | 設計', ' 4 〜 6 |本筋|  公開  ', '7 | 寄り道 | 質問'].join('\n'),
  )
  expect(parsed).toEqual([
    { from: 1, to: 2, isSide: false, name: '設計' },
    { from: 3, to: 3, isSide: true, name: '色の手直し' },
    { from: 4, to: 6, isSide: false, name: '公開' },
    { from: 7, to: 7, isSide: true, name: '質問' },
  ])
  expect(parseSegments('区切れませんでした')).toEqual([])
})

test('章の当てはめ:最初の章は本筋、抜けた番号は手前の章の続き', async () => {
  const list = ['a', 'b', 'c', 'd'].map(id => step(id))
  const applied = applySegments(list, [
    { from: 1, to: 1, isSide: true, name: '始まり' },
    { from: 2, to: 2, isSide: true, name: '手直し' },
    { from: 4, to: 4, isSide: false, name: '公開' },
  ])
  expect(applied.map(one => [one.chapter, one.isSide])).toEqual([
    ['始まり', false],
    ['手直し', true],
    ['手直し', true],
    ['公開', false],
  ])
  // いまの区切りは、続く章を 1 行にまとめて渡す。
  const prompt = segmentPrompt(applied.map(one => ({ ...one, title: '見出し', summary: '説明' })))
  expect(prompt).toContain('いまの区切り:\n1-1 | 本筋 | 始まり\n2-3 | 寄り道 | 手直し\n4-4 | 本筋 | 公開')
  expect(prompt).toContain('1. 見出し — 説明')
  expect(segmentPrompt([step('a', { summary: 's' })])).toContain('いまの区切り:\n(まだ無い)')
})

test('会話からターンを起こす:言い直しは同じ依頼、返答とツールはそのターンに', async () => {
  const found = turnsOf(
    [
      { role: 'user', text: '<command-name>x</command-name>', toolUses: [] },
      { role: 'user', text: '最初の依頼', toolUses: [] },
      { role: 'user', text: '言い直し', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool: 'Bash' }, { tool: 'Bash' }, { tool: 'Read' }] },
      { role: 'assistant', text: 'できました', toolUses: [] },
      { role: 'user', text: '次の依頼', toolUses: [] },
    ],
    42,
  )
  expect(found).toEqual([
    { id: 'past-0', prompt: '最初の依頼 / 言い直し', anchor: '言い直し', answer: 'できました', tools: ['Bash', 'Read'], at: 42 },
    { id: 'past-1', prompt: '次の依頼', anchor: '次の依頼', answer: '', tools: [], at: 42 },
  ])
})

const FLOW: Step[] = [
  step('a', { chapter: '設計', title: '方針の相談', summary: '方針を決めた' }),
  step('b', { chapter: '設計', title: '型の定義', summary: '型を書いた' }),
  step('c', { chapter: '色の手直し', isSide: true, title: '色の調整', summary: '色を変えた' }),
  step('d', { chapter: '公開', title: '公開の準備', summary: '公開の手順を確かめた' }),
]

test('章:同じ名前の続きをまとめ、最初の章は本筋にする', async () => {
  expect(chaptersOf(FLOW)).toEqual([
    { name: '設計', isSide: false, first: 0, last: 1 },
    { name: '色の手直し', isSide: true, first: 2, last: 2 },
    { name: '公開', isSide: false, first: 3, last: 3 },
  ])
  // 要約待ちのターンは直前の章の続き。最初のターンが寄り道でも本筋。
  expect(chaptersOf([step('a', { chapter: '始まり', isSide: true }), step('b')])).toEqual([
    { name: '始まり', isSide: false, first: 0, last: 1 },
  ])
  expect(chaptersOf([step('a')])).toEqual([{ name: '…', isSide: false, first: 0, last: 0 }])
})

test('章 → 行:本筋の節と寄り道の枝が出て、いまの節だけターンまで開く', async () => {
  const lines = flowLines(FLOW, false, 40, 0, 0)
  const textOf = (i: number) => lines[i]?.runs.map(run => run.text).join('')
  expect(lines.map(line => line.rail)).toEqual(['●', '┣━━○', '┃', '◉', '┃', '┃'])
  // 本筋の節
  expect(textOf(0)).toBe('設計')
  expect(lines[0]).toMatchObject({ right: '#1-2', isNode: true, isStrong: false })
  expect(lines[0]?.target).toMatchObject({ id: 'chapter-a', prompt: '依頼 a' })
  // 寄り道の枝(線の列が広い)
  expect(textOf(1)).toBe('色の手直し')
  expect(lines[1]).toMatchObject({ right: '#3', gutter: 6 })
  expect(lines[1]?.runs[0]).toMatchObject({ isBold: false, isDim: true })
  // いまの節は押せない。中にターンの見出しと、最新のターンの説明。
  expect(lines[3]).toMatchObject({ right: '#4-', isStrong: true })
  expect(lines[3]?.target).toBeUndefined()
  expect(textOf(4)).toBe('· 公開の準備')
  expect(lines[4]).toMatchObject({ right: '#4' })
  expect(lines[4]?.target).toMatchObject({ id: 'd' })
  expect(textOf(5)).toBe('\u00a0\u00a0公開の手順を確かめた')
})

test('章 → 行:最後の章が寄り道なら線はそこで曲がる。走っている間は「いま」へつなぐ', async () => {
  const lines = flowLines(FLOW.slice(0, 3), true, 40, 0, 0)
  expect(lines.map(line => line.rail)).toEqual(['●', '┗━━◉', '\u00a0\u00a0\u00a0│', '\u00a0\u00a0\u00a0│', '\u00a0\u00a0\u00a0│'])
  expect(lines[1]).toMatchObject({ isStrong: false })
  expect(lines.at(-1)?.runs).toEqual([])
  expect(flowLines([], false, 40, 0, 0)).toEqual([])
})

test('章 → 行:要約が届いた直後は、見出しから順に文字を打ち出す', async () => {
  const list = [step('a', { chapter: '設計', title: 'あいうえお', summary: 'かきくけこ', doneAt: 1000 })]
  const at = (now: number) => flowLines(list, false, 40, now, 0).map(line => line.runs.map(run => run.text).join(''))
  expect(at(1000)).toEqual(['設計', '· ▍', '\u00a0\u00a0'])
  expect(at(1000 + 18 * 2)).toEqual(['設計', '· あい▍', '\u00a0\u00a0'])
  expect(at(1000 + 18 * 7)).toEqual(['設計', '· あいうえお', '\u00a0\u00a0かき▍'])
  expect(at(1000 + 18 * 100)).toEqual(['設計', '· あいうえお', '\u00a0\u00a0かきくけこ'])
})

test('いま:走っているターン・ツール・サブエージェントの行', async () => {
  expect(footLines(null, [], 40, 0, 0)).toEqual([])
  const live = { turnId: 't', prompt: '直して', actions: ['Read a.ts', 'Bash ls'], tools: ['Read', 'Bash'], startedAt: 0 }
  const foot = footLines(live, [{ id: 's', type: 'Explore', description: '調べる' }], 40, 61_000, 0)
  const textOf = (i: number) => foot[i]?.runs.map(run => run.text).join('')
  expect(foot.map(line => line.rail)).toEqual(['◌', '┆', '┆', '┆', '◉'])
  expect(textOf(0)).toBe('直して')
  expect(foot[0]?.rightRuns?.map(run => run.text).join('')).toBe('1:01')
  expect(foot[0]?.right).toBeUndefined()
  expect(textOf(1)).toBe('·\u00a0Read\u00a0a.ts')
  expect(textOf(2)).toBe('❯\u00a0Bash\u00a0ls')
  expect(foot[2]?.rightRuns).toBeDefined()
  expect(textOf(3)).toBe('サブエージェント\u00a01')
  expect(textOf(4)).toBe('Explore\u00a0調べる')
  expect(textOf(1) && footLines({ ...live, actions: [] }, [], 40, 0, 0)[1]?.runs.map(run => run.text).join('')).toBe('❯\u00a0考え中')
})

test('流れの窓:最新を追い、続きがある側の 1 行を印に使う', async () => {
  expect(windowOf(5, 10, 0)).toEqual({ start: 0, end: 5, hasAbove: false, hasBelow: false, maxScroll: 0 })
  expect(windowOf(20, 10, 0)).toEqual({ start: 11, end: 20, hasAbove: true, hasBelow: false, maxScroll: 10 })
  expect(windowOf(20, 10, 4)).toEqual({ start: 7, end: 15, hasAbove: true, hasBelow: true, maxScroll: 10 })
  expect(windowOf(20, 10, 99)).toEqual({ start: 0, end: 9, hasAbove: false, hasBelow: true, maxScroll: 10 })
})

test('飛ぶ先:行の id、発言の頭、依頼文に含まれるいちばん長い発言の順に探す', async () => {
  const rows = new Map([
    ['最初の依頼', 'r1'],
    ['言い直し', 'r2'],
    ['言い直しの長い版', 'r3'],
  ])
  expect(findRow({ rowId: 'r9', anchor: '最初の依頼' }, rows)).toBe('r9')
  expect(findRow({ anchor: '最初の依頼' }, rows)).toBe('r1')
  expect(findRow({ anchor: '無い', prompt: '最初の依頼 / 言い直しの長い版' }, rows)).toBe('r3')
  expect(findRow({ anchor: '無い', prompt: '関係ない文' }, rows)).toBeUndefined()
})

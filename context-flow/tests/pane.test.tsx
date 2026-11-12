// ペインを mount して、描画が丸ごと落ちていないことを確かめる。
import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'context-flow',
  component: 'Pane',
  requestId: 'context-flow',
  props: {
    title: 'context',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('何も無い時:目的と流れの見出し、案内の文が出る', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /目的/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /流れ/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /まだ会話/ }))?.text).toBe('まだ会話がありません')
  expect((await ui.find({ type: 'Text', text: /ターン$/ }))?.text).toBe('0 ターン')
  expect(await ui.find({ type: 'Text', text: /最初のターンが終わると/ })).toBeDefined()
  await ui.unmount()
})

test('ターンが終わると流れに積まれ、走っている間は「いま」に出る', async ($, on) => {
  // ここのフックがエンジンの代わりに答える。
  mock.clock(on, { now: 1000 })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))

  await $.turn.start({ turnId: 't1', text: 'ペインを分けてください' })
  await $.tool.call({ tool: 'Bash', command: 'ls', description: '一覧を見る' })

  const running = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await running.find({ type: 'Text', text: /ターン目$/ }))?.text).toBe('1 ターン目')
  // 「いま」の行は 1 文字ずつ色が違う(虹)ので、文字をつないで確かめる。
  const shown = (await running.findAll({ type: 'Text' })).map(one => one.text).join('')
  expect(shown).toContain('ペインを分けてください')
  expect(shown).toContain('❯\u00a0Bash\u00a0一覧を見る')
  await running.unmount()

  await $.turn.complete({
    turnId: 't1',
    answer: '分けました',
    durationMs: 10,
    isAborted: false,
    reason: 'answer',
  })

  const done = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await done.find({ type: 'Text', text: /ターン$/ }))?.text).toBe('1 ターン')
  // 要約が付くまでは、依頼文がそのまま見出しになる。押すとその発言へ飛ぶボタン。
  expect(await done.find({ type: 'Button', key: 'turn:t1' })).toBeDefined()
  await done.unmount()
})

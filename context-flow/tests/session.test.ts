// ペインを開く順番。最後に開いたペインが表に出るので、ほかの mod の後に開く。
import type { EngineInterface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { bootTimeFrom, openBehind, runCommand } from '../hooks/app/session'
import { isRareBoot, isThunderBoot, isTyphoonBoot } from '../hooks/domain/color'

test('ほかの mod のペインが開いた後に、自分のペインを 1 回だけ開く', async () => {
  const opened: string[] = []
  const engine = {
    ui: {
      open: async (pane: { id: string }) => {
        opened.push(pane.id)

        return { isPlaced: true }
      },
    },
  } as unknown as EngineInterface

  // 自分のペインが開いた時は、何もしない(開き直さない)。
  await openBehind(engine, 'context-flow')
  expect(opened).toEqual([])

  // ほかの mod のペインが開いたら、続けて自分のペインを開く。
  await openBehind(engine, 'cockpit')
  expect(opened).toEqual(['context-flow'])

  // もう開いているので、2 回目からは開かない。
  await openBehind(engine, 'another')
  expect(opened).toEqual(['context-flow'])
})

test('起動の選び方:ふだんは当たった時刻のまま、名指しはその起動、会話の途中は雷も台風も出さない', async () => {
  const start = 1_763_000_000_000
  let thunderAt = start
  while (!isThunderBoot(thunderAt)) thunderAt++
  let typhoonAt = start
  while (!isTyphoonBoot(typhoonAt)) typhoonAt++
  // on/off は無いので、当たった時刻はそのまま(雷も台風も出る)。
  expect(bootTimeFrom(thunderAt, 'any')).toBe(thunderAt)
  expect(bootTimeFrom(typhoonAt, 'any')).toBe(typhoonAt)
  // 名指しは、その起動になる時刻までずらす。
  expect(isRareBoot(bootTimeFrom(start, 'rare'))).toBe(true)
  expect(isThunderBoot(bootTimeFrom(start, 'thunder'))).toBe(true)
  expect(isTyphoonBoot(bootTimeFrom(start, 'typhoon'))).toBe(true)
  // タブを表に戻した時(会話の途中)は、長い起動(雷・台風)にしない。
  for (const at of [thunderAt, typhoonAt]) {
    const quiet = bootTimeFrom(at, 'quiet')
    expect(isThunderBoot(quiet) || isTyphoonBoot(quiet)).toBe(false)
  }
})

test('雷の on/off の切り替えは無い(thunder on は何も保存せず、ペインを開くだけ)', async () => {
  const saved = new Map<string, unknown>()
  const engine = {
    store: {
      get: async (key: string) => saved.get(key),
      set: async (key: string, value: unknown) => {
        saved.set(key, value)
      },
    },
    ui: { open: async () => ({ isPlaced: true }) },
  } as unknown as EngineInterface

  expect((await runCommand(engine, 'thunder on')).text).toBe('Context ペインを開きました。')
  expect(saved.has('thunder')).toBe(false)
})

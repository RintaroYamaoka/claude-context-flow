// ペインを開く順番。最後に開いたペインが表に出るので、ほかの mod の後に開く。
import type { EngineInterface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { bootTimeFrom, openBehind, runCommand } from '../hooks/app/session'
import { isThunderBoot } from '../hooks/domain/color'
import { flags } from '../hooks/store'

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

test('雷の起動:既定は出さず、名指しなら流し、ON にすれば当たった時刻のまま', async () => {
  // 雷の起動に当たる時刻を 1 つ探す。
  let hit = 1_763_000_000_000
  while (!isThunderBoot(hit)) hit++
  expect(isThunderBoot(bootTimeFrom(hit, 'any', false))).toBe(false)
  expect(bootTimeFrom(hit, 'any', true)).toBe(hit)
  expect(isThunderBoot(bootTimeFrom(hit - 5000, 'thunder', false))).toBe(true)
  // タブを表に戻した時(会話の途中)は、ON でも雷を出さない。
  expect(isThunderBoot(bootTimeFrom(hit, 'quiet', true))).toBe(false)
})

test('雷の起動:/context-flow thunder on|off で切り替えて保存し、boot thunder とは混ざらない', async () => {
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

  flags.isThunderOn = false
  expect((await runCommand(engine, 'thunder on')).text).toContain('ON')
  expect(flags.isThunderOn).toBe(true)
  expect(saved.get('thunder')).toBe(true)
  await runCommand(engine, 'thunder off')
  expect(flags.isThunderOn).toBe(false)
  expect(saved.get('thunder')).toBe(false)
  await runCommand(engine, 'thunder')
  expect(flags.isThunderOn).toBe(true)
  expect((await runCommand(engine, 'thunder maybe')).text).toContain('on か off')
  expect(flags.isThunderOn).toBe(true)
  flags.isThunderOn = false
})

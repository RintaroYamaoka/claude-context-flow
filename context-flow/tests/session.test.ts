// ペインを開く順番。最後に開いたペインが表に出るので、ほかの mod の後に開く。
import type { EngineInterface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { openBehind } from '../hooks/app/session'

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

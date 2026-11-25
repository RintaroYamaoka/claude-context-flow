// 台風の起動: 行の幅・物語の場面が描かれること・名指しの時だけ流れること。
import { expect, test } from 'claude-code/testing'

import { bootTimeFrom } from '../hooks/app/session'
import { isTyphoonBoot } from '../hooks/domain/color'
import { TYPHOON_MS, typhoonArtProblems, typhoonLayout, typhoonScene, windStrength } from '../hooks/domain/typhoon'

const base = 1_763_000_000_000
const textOf = (runs: { text: string }[]) => runs.map(run => run.text).join('')
const screen = (ms: number, rows = 24, columns = 44) => typhoonScene(base, rows, columns, ms).map(textOf)

test('台風の起動:どの時刻・どの大きさでも、行の数と幅がペインどおり', async () => {
  for (const [rows, columns] of [[24, 44], [16, 30], [40, 80]] as const) {
    for (let ms = 0; ms <= TYPHOON_MS; ms += 100) {
      const lines = screen(ms, rows, columns)
      expect(lines.length).toBe(rows)
      for (const line of lines) expect([...line].length).toBe(columns)
    }
  }
})

test('台風の起動:猫が座っていて、暴風に飛ばされ、やむと落ちてきて、頭に葉っぱが乗る', async () => {
  const has = (ms: number, pattern: RegExp) => screen(ms).some(line => pattern.test(line))
  // 初めから猫は座っている。風はまだ無い。
  expect(has(0, /[▀▄]/)).toBe(true)
  expect(has(0, /[═~]/)).toBe(false)
  expect(windStrength(0)).toBe(0)
  // 暴風の間は、すじと葉っぱが流れ、草がなびくか寝る。
  expect(windStrength(2000)).toBe(1)
  expect(has(2000, /[═─]{2,}~|~/)).toBe(true)
  expect(has(2000, /[❦✿❀•✾]/)).toBe(true)
  const { ground } = typhoonLayout(24)
  expect(screen(2000)[ground - 1]).toMatch(/[╱_]/)
  // 飛ばされている間、猫は画面の外(右上)へ消える。
  expect(has(1500, /[▀▄]/)).toBe(true)
  expect(has(3300, /[▀▄]/)).toBe(false)
  // やんだ後は、すじは消え、草はまっすぐ。猫は落ちてきて座り、頭に葉っぱが一枚。
  expect(windStrength(4000)).toBe(0)
  expect(has(4000, /═/)).toBe(false)
  expect(screen(4000)[ground - 1]).not.toMatch(/╱/)
  expect(has(5000, /[▀▄]/)).toBe(true)
  expect(screen(5000).filter(line => line.includes('❦')).length).toBe(1)
})

test('台風の起動:低いペインでも、ひとことは画面に収まる', async () => {
  for (const rows of [14, 16, 19, 24, 40]) {
    const { status } = typhoonLayout(rows)
    expect(status).toBeLessThan(rows)
    expect(screen(2000, rows).length).toBe(rows)
  }
})

test('台風の起動:名指しの typhoon は、台風に当たる時刻へずらす', async () => {
  expect(isTyphoonBoot(bootTimeFrom(base, 'typhoon'))).toBe(true)
})

test('台風の起動:絵はどれも、行の長さがそろっている', async () => {
  expect(typhoonArtProblems()).toEqual([])
})

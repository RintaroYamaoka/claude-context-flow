// 雷の起動: 当たりの割合・行の幅・物語の場面が描かれること。
import { expect, test } from 'claude-code/testing'

import { RARE_RATE, THUNDER_RATE, TYPHOON_RATE, isRareBoot, isThunderBoot, isTyphoonBoot } from '../hooks/domain/color'
import { THUNDER_MS, artProblems, thunderFlash, thunderLayout, thunderScene } from '../hooks/domain/thunder'

const base = 1_763_000_000_000
const textOf = (runs: { text: string }[]) => runs.map(run => run.text).join('')
const screen = (ms: number, rows = 24, columns = 44) =>
  thunderScene(base, rows, columns, ms).map(textOf)

test('起動の当たり:花火 20%、外れの 10% が雷、さらに外れの 10% が台風。重ならない', async () => {
  expect(RARE_RATE).toBe(0.2)
  expect(THUNDER_RATE).toBe(0.1)
  expect(TYPHOON_RATE).toBe(0.1)
  expect(isRareBoot(0) || isThunderBoot(0) || isTyphoonBoot(0)).toBe(false)
  let rare = 0
  let thunder = 0
  let typhoon = 0
  const tries = 60_000
  for (let i = 0; i < tries; i++) {
    const seed = base + i * 137
    const hits = [isRareBoot(seed), isThunderBoot(seed), isTyphoonBoot(seed)].filter(Boolean).length
    expect(hits).toBeLessThan(2)
    if (isRareBoot(seed)) rare++
    if (isThunderBoot(seed)) thunder++
    if (isTyphoonBoot(seed)) typhoon++
  }
  const near = (count: number, rate: number) => {
    expect(count / tries).toBeGreaterThan(rate * 0.9)
    expect(count / tries).toBeLessThan(rate * 1.1)
  }
  near(rare, 0.2)
  near(thunder, 0.8 * 0.1)
  near(typhoon, 0.8 * 0.9 * 0.1)
})

test('雷の起動:どの時刻・どの大きさでも、行の数と幅がペインどおり', async () => {
  for (const [rows, columns] of [[24, 44], [16, 30], [40, 80]] as const) {
    for (let ms = 0; ms <= THUNDER_MS; ms += 100) {
      const lines = screen(ms, rows, columns)
      expect(lines.length).toBe(rows)
      for (const line of lines) expect([...line].length).toBe(columns)
    }
  }
})

test('雷の起動:猫が歩いてきて、雨が降り、雷が上がり、虹がかかる', async () => {
  const has = (ms: number, pattern: RegExp) => screen(ms).some(line => pattern.test(line))
  // 初めは誰もいない(右の外から歩いてくる)。
  expect(has(0, /[▀▄]/)).toBe(false)
  expect(has(800, /[▀▄]/)).toBe(true)
  expect(has(2700, /╷/)).toBe(true)
  expect(has(3400, /ϟ|✧/)).toBe(true)
  expect(has(3800, /╷/)).toBe(false)
  const { ground } = thunderLayout(24)
  expect(screen(5000)[ground]).toMatch(/─/)
  expect(thunderFlash(3660, '#101010')).not.toBe('#101010')
  expect(thunderFlash(0, '#101010')).toBe('#101010')
  expect(thunderFlash(5000, undefined)).toBeUndefined()
})

test('雷の起動:低いペインでも、雷は猫の頭の上を走り、ひとことは画面に収まる', async () => {
  for (const rows of [14, 16, 19, 24, 40]) {
    const { ground, status } = thunderLayout(rows)
    expect(status).toBeLessThan(rows)
    // 猫の頭より上の行(ひげは頭より下なので、ここに出るのは雷だけ)。
    const catTopLine = ground - 8
    const above = screen(3660, rows).slice(0, catTopLine)
    expect(above.some(line => /[│╱╲]/.test(line))).toBe(true)
  }
})

test('雷の起動:絵はどれも、行の長さがそろっている', async () => {
  expect(artProblems()).toEqual([])
})

// 雷の起動: 当たりの割合・行の幅・物語の場面が描かれること。
import { expect, test } from 'claude-code/testing'

import { RARE_ODDS, THUNDER_ODDS, isRareBoot, isThunderBoot } from '../hooks/domain/color'
import { THUNDER_MS, artProblems, thunderFlash, thunderLayout, thunderScene } from '../hooks/domain/thunder'

const base = 1_763_000_000_000
const textOf = (runs: { text: string }[]) => runs.map(run => run.text).join('')
const screen = (ms: number, rows = 24, columns = 44) =>
  thunderScene(base, rows, columns, ms).map(textOf)

test('雷の起動:おおよそ THUNDER_ODDS 回に 1 回で、花火の夜空とは重ならない', async () => {
  expect(isThunderBoot(0)).toBe(false)
  let thunder = 0
  let rare = 0
  const tries = 30_000
  for (let i = 0; i < tries; i++) {
    const seed = base + i * 137
    const isThunder = isThunderBoot(seed)
    const isRare = isRareBoot(seed)
    expect(isThunder && isRare).toBe(false)
    if (isThunder) thunder++
    if (isRare) rare++
  }
  expect(thunder / tries).toBeGreaterThan(0.7 / THUNDER_ODDS)
  expect(thunder / tries).toBeLessThan(1.3 / THUNDER_ODDS)
  expect(rare / tries).toBeGreaterThan(0.7 / RARE_ODDS)
  expect(rare / tries).toBeLessThan(1.3 / RARE_ODDS)
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

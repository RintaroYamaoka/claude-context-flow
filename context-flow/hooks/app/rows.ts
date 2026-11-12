// 発言の行の記憶と、「飛ぶ」処理。流れの見出しを押すと、そのターンを始めた発言へ動く。
import type { EngineInterface } from 'claude-code'

import { findRow } from '../domain/flow'
import type { Target } from '../domain/flow'
import { anchorOf } from '../domain/text'
import { getRows, setRows } from '../store'

/** 発言の頭 → トランスクリプトの行。行が描かれるたびに覚える。 */
const rowIds = new Map<string, string>()
/** 覚えた行のうち、まだ保存していないものがあるか。 */
let hasNewRows = false

/** 発言の行が描かれた。その行の id を覚える。 */
export const rememberRow = (text: string, requestId: string): void => {
  const anchor = anchorOf(text)
  if (anchor !== '' && rowIds.get(anchor) !== requestId) {
    rowIds.set(anchor, requestId)
    hasNewRows = true
  }
}

/** 発言の頭から、覚えている行を引く。 */
export const rowOf = (anchor: string | undefined): string | undefined =>
  anchor === undefined ? undefined : rowIds.get(anchor)

/** 前に覚えた行を戻す(再読み込みで消えるため)。 */
export async function restoreRows($: EngineInterface): Promise<void> {
  for (const [anchor, id] of Object.entries(await getRows($))) {
    if (!rowIds.has(anchor)) rowIds.set(anchor, id)
  }
}

/** 覚えた行を保存する(描いている最中には書けないので、周期の中で)。 */
export async function saveRows($: EngineInterface): Promise<void> {
  if (!hasNewRows) return
  hasNewRows = false
  const latest = Object.fromEntries([...rowIds].slice(-400))
  await setRows($, latest)
}

/** ターンを始めた発言の行へ、トランスクリプトを動かす。 */
export async function jump($: EngineInterface, target: Target): Promise<void> {
  const requestId = findRow(target, rowIds)
  if (requestId === undefined) {
    await $.ui.toast(
      `このターンの位置が見つかりません(覚えている発言の行: ${rowIds.size} 件)`,
    )

    return
  }
  const moved = await $.ui.scroll({ to: { requestId }, block: 'start' })
  if (moved.deny !== undefined) {
    await $.ui.toast(`移動できませんでした: ${moved.deny}`)
  }
}

// 周期の処理: 計器・行・サブエージェントの更新と、要約・章の区切り直し。
import type { EngineInterface } from 'claude-code'

import { refreshAgents, refreshMeter } from './gauges'
import { saveRows } from './rows'
import { backfill, resegment, summarizeNext } from './summary'

let isSummarizing = false
let hasBackfilled = false

export async function tick($: EngineInterface): Promise<void> {
  try {
    await refreshMeter($)
    await saveRows($)
    await refreshAgents($)
  } catch {
    // 次の周期で読み直す。
  }
  if (isSummarizing) return
  isSummarizing = true
  try {
    if (!hasBackfilled) {
      hasBackfilled = true
      await backfill($)
    }
    await summarizeNext($)
    await resegment($)
  } catch {
    // 次の周期でやり直す。
  } finally {
    isSummarizing = false
  }
}

// ターンの要約と、章の区切り直し(どちらも Haiku)。途中から読み込んだ時の起こし直し。
import type { EngineInterface } from 'claude-code'

import {
  SEGMENT_SYSTEM,
  SYSTEM,
  applySegments,
  parseSegments,
  parseSummary,
  segmentPrompt,
  summaryPrompt,
  turnsOf,
} from '../domain/summary'
import { clip } from '../domain/text'
import {
  getDecided,
  getGoal,
  getLive,
  getOpen,
  getSteps,
  setDecided,
  setGoal,
  setOpen,
  setSteps,
} from '../store'

const BACKFILL_TURNS = 80

/** まだ要約の無い、いちばん古いターンを 1 つ要約する。 */
export async function summarizeNext($: EngineInterface): Promise<void> {
  const list = await getSteps($)
  const at = list.findIndex(step => step.summary === undefined)
  const step = list[at]
  if (step === undefined) return

  const decided = await getDecided($)
  const open = await getOpen($)
  const goal = await getGoal($)

  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: summaryPrompt(list, at, { goal, decided, open }),
    // 考える分も上限に数えられるので、考えは浅くして、上限には余裕を持たせる
    // (上限が小さいと、考えだけで使い切って返答が途中で切れる)。
    effort: 'low',
    maxTokens: 2000,
    timeoutMs: 30_000,
  })
  const found = parseSummary(reply.isAnswered ? reply.text : '')
  // 要約できなかったターンは、依頼の冒頭をそのまま残す(やり直しで回り続けない)。
  const summary =
    found.step ||
    clip(step.prompt || step.answer || '(中身のないターン)', 100)
  const title = found.title || clip(step.prompt || '(入力なしで続行)', 30)
  const doneAt = Date.now()

  await setSteps($, now =>
    now.map(one =>
      one.id === step.id
        ? { ...one, title, summary, doneAt, answer: '', tools: [] }
        : one,
    ),
  )
  if (found.goal) await setGoal($, found.goal)
  if (reply.isAnswered) {
    await setDecided($, found.decided)
    await setOpen($, found.open)
  }
}

/** 区切り直しが済んでいるターンの並び(同じ並びで何度も呼ばない)。 */
let segmentedFor = ''
/** 区切り直しに失敗した時、次に試してよい時刻。 */
let segmentRetryAt = 0

/**
 * 全部のターンを見渡して、章(本筋の節と寄り道の枝)に区切り直す。
 * 1 ターンずつ「前の章の続きか」を決めると、同じ章に入り続けてしまうため。
 */
export async function resegment($: EngineInterface): Promise<void> {
  const list = await getSteps($)
  if (list.length === 0 || list.some(step => step.summary === undefined)) return
  const key = list.map(step => step.id).join(',')
  if (key === segmentedFor || Date.now() < segmentRetryAt) return

  const reply = await $.model.complete({
    model: 'haiku',
    system: SEGMENT_SYSTEM,
    prompt: segmentPrompt(list),
    // 考える分も上限に数えられる。上限が小さいと返答が途中で切れ、
    // 後ろのターンが全部最後の章に入ってしまう。
    effort: 'low',
    maxTokens: 8000,
    timeoutMs: 60_000,
  })
  const parsed = reply.isAnswered ? parseSegments(reply.text) : []
  // 返答が無い・読み取れない・最後のターンまで届いていない時は、当てはめずに
  // 30 秒おいてやり直す(途中までの区切りを当てると、残りが 1 つの章に固まる)。
  const reached = parsed.reduce((max, one) => Math.max(max, one.to), 0)
  if (reached < list.length) {
    segmentRetryAt = Date.now() + 30_000

    return
  }
  segmentedFor = key

  await setSteps($, now => applySegments(now, parsed))
}

/** mod が途中で読み込まれた時、それまでの会話からターンを起こす。 */
export async function backfill($: EngineInterface): Promise<void> {
  if ((await getSteps($)).length > 0) return
  const messages = await $.session.messages()
  const found = turnsOf(messages, await $.clock.now())
  // いま走っているターンは live が持つので、過去の分だけ入れる。
  const running = await getLive($)
  const past = running === null ? found : found.slice(0, -1)
  if (past.length === 0) return
  await setSteps($, now => (now.length > 0 ? now : past.slice(-BACKFILL_TURNS)))
}

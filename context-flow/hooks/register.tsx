// 配線だけ: どのイベントでどの関数を呼ぶか。状態は store、処理は app、描画は ui。
import type { EngineInterface, Register } from 'claude-code'

import { dropAgent, noteAgentCall, refreshMeter } from './app/gauges'
import { jump, rememberRow } from './app/rows'
import { openBehind, runCommand, startSession } from './app/session'
import { clearFlow, completeTurn, noteToolCall, startTurn } from './app/turn'
import type { Target } from './domain/flow'
import { actionOf, toolName } from './domain/text'
import { PANE, ensureHydrated, flags, frame, getBeat, setScroll } from './store'
import { renderPane } from './ui/pane'

function makeActions($: EngineInterface) {
  return {
    jump: (target: Target) => {
      void jump($, target).catch(() => undefined)
    },
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await startSession($)

    return next(e)
  })

  on('ui.open', async ($, e, next) => {
    const opened = await next(e)
    await openBehind($, e.id)

    return opened
  })

  on('command.run', { command: 'context-flow' }, ($, e) =>
    runCommand($, String(e.args ?? '')),
  )

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await clearFlow($)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await startTurn($, e.turnId, e.text)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      await noteAgentCall($, e.agentId, actionOf(e))

      return next(e)
    }
    await noteToolCall($, actionOf(e), toolName(e.tool))
    const ran = await next(e)
    void refreshMeter($).catch(() => undefined)

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) await dropAgent($, e.agentId)
    else await completeTurn($, e.turnId, e.answer)

    return next(e)
  })

  // トランスクリプトの発言の行が描かれるたびに、その行の id を覚える(描き方は変えない)。
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    rememberRow(e.props.text, e.requestId)

    return next(e)
  })

  // ペインの上のホイール・スクロールキーは、流れの窓だけを動かす。
  // 上(計器・目的)と下(いま)は動かさないので、エンジンには動かさせない。
  on('ui.scroll', { requestId: PANE }, async ($, e) => {
    await setScroll($, back =>
      Math.min(flags.maxScroll, Math.max(0, Math.min(back, flags.maxScroll) - e.by)),
    )

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await ensureHydrated($)

    return renderPane($, e, frame(), await getBeat($), makeActions($))
  })
}

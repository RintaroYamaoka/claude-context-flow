// ターンの記録: 始まり・ツール呼び出し・終わり。終わったターンを流れに積む。
import type { EngineInterface } from 'claude-code'

import type { Live, Step } from '../../types'
import { anchorOf, oneLine } from '../domain/text'
import { getLive, setDecided, setGoal, setLive, setOpen, setScroll, setSteps } from '../store'
import { rowOf } from './rows'
import { tick } from './tick'

const MAX_STEPS = 200

/** 返答の前に中断されたターンの依頼。次のターンの依頼の頭に付ける。 */
let carried = ''

export async function startTurn(
  $: EngineInterface,
  turnId: string,
  text: string,
): Promise<void> {
  const startedAt = await $.clock.now()
  const prompt = [carried, oneLine(text)]
    .filter(part => part !== '')
    .join(' / ')
    .slice(0, 1500)
  carried = ''
  const anchor = anchorOf(text)
  // 新しいターンが始まったら、最新を追う位置に戻す。
  await setScroll($, () => 0)
  await setLive($, () => ({
    turnId,
    prompt,
    anchor,
    actions: [],
    tools: [],
    startedAt,
  }))
}

/** 本体のツール呼び出しを、「いま」の行に足す。 */
export async function noteToolCall(
  $: EngineInterface,
  action: string,
  tool: string,
): Promise<void> {
  const startedAt = await $.clock.now()
  await setLive($, now => {
    // ターンの途中で読み込まれた時は、ここから追い始める。
    const base: Live = now ?? {
      turnId: `joined-${startedAt}`,
      prompt: '',
      actions: [],
      tools: [],
      startedAt,
    }

    return {
      ...base,
      actions: [...base.actions, action].slice(-6),
      tools:
        base.tools.includes(tool) || base.tools.length >= 12
          ? base.tools
          : [...base.tools, tool],
    }
  })
}

export async function completeTurn(
  $: EngineInterface,
  turnId: string,
  answer: string,
): Promise<void> {
  const running = await getLive($)
  const at = await $.clock.now()
  const step: Step = {
    id: turnId,
    prompt: running?.prompt ?? '',
    anchor: running?.anchor,
    rowId: rowOf(running?.anchor),
    answer: oneLine(answer).slice(0, 1500),
    tools: running?.tools ?? [],
    at,
  }
  if (step.answer === '' && step.tools.length === 0) {
    // 何も返さないまま止まったターンは流れに載せず、依頼だけ次へ持ち越す。
    carried = step.prompt
  } else if (step.prompt !== '' || step.answer !== '') {
    await setSteps($, now =>
      now.some(one => one.id === step.id)
        ? now
        : [...now, step].slice(-MAX_STEPS),
    )
  }
  await setLive($, () => null)
  void tick($)
}

/** `/clear` で会話が消えたら、流れも消す。 */
export async function clearFlow($: EngineInterface): Promise<void> {
  await setSteps($, () => [])
  await setLive($, () => null)
  await setGoal($, '')
  await setDecided($, [])
  await setOpen($, [])
}

// 計器(モデルとコンテキスト量)と、走っているサブエージェントの一覧の更新。
import type { EngineInterface } from 'claude-code'

import type { Meter, Sub } from '../../types'
import { oneLine } from '../domain/text'
import { getAgents, getMeter, setAgents, setMeter } from '../store'

export async function refreshMeter($: EngineInterface): Promise<void> {
  const [model, usage] = await Promise.all([
    $.session.model(),
    $.session.usage(),
  ])
  const next: Meter = {
    model,
    tokens: usage.context.tokens,
    window: usage.context.window,
    percent: usage.context.percent,
  }
  const now = await getMeter($)
  if (JSON.stringify(now) !== JSON.stringify(next)) {
    await setMeter($, next)
  }
}

/** サブエージェントごとの、いちばん新しいツール呼び出し。 */
const agentActions = new Map<string, string>()

export async function refreshAgents($: EngineInterface): Promise<void> {
  const listed = await $.agent.list()
  const next: Sub[] = listed
    .filter(agent => agent.status === 'running' || agent.status === 'pending')
    .map(agent => ({
      id: agent.id,
      type: agent.type,
      description: oneLine(agent.description),
      action: agentActions.get(agent.id),
    }))
  const now = await getAgents($)
  if (JSON.stringify(now) !== JSON.stringify(next)) {
    await setAgents($, () => next)
  }
}

/** サブエージェントのツール呼び出しを、そのエージェントの行に出す。 */
export async function noteAgentCall(
  $: EngineInterface,
  id: string,
  action: string,
): Promise<void> {
  agentActions.set(id, action)
  const known = await getAgents($)
  if (known.some(agent => agent.id === id)) {
    await setAgents($, list =>
      list.map(agent => (agent.id === id ? { ...agent, action } : agent)),
    )
  } else {
    void refreshAgents($).catch(() => undefined)
  }
}

/** 終わったサブエージェントは、すぐ表示から外す。 */
export async function dropAgent($: EngineInterface, id: string): Promise<void> {
  agentActions.delete(id)
  await setAgents($, list => list.filter(agent => agent.id !== id))
}

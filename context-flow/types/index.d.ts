/** 上部の計器: モデルとコンテキストウィンドウの埋まり具合。 */
export type Meter = {
  model: string
  tokens?: number
  window: number
  percent?: number
}

/** 終わった 1 ターン。`summary` が付くまでは `prompt` をそのまま見せる。 */
export type Step = {
  id: string
  prompt: string
  /** 要約の材料。要約が付いたら空にする。 */
  answer: string
  tools: string[]
  /** 一目で読む見出し(15 字ほど)。 */
  title?: string
  summary?: string
  /** ターンを始めた発言の頭(トランスクリプトの行を探す手がかり)。 */
  anchor?: string
  /** その発言のトランスクリプト上の行。押すとここへ飛ぶ。 */
  rowId?: string
  /** 要約が付いた時刻。ここから文字が打ち出される。 */
  doneAt?: number
  at: number
}

/** 走っている最中のターン。 */
export type Live = {
  turnId: string
  prompt: string
  anchor?: string
  /** 直近のツール呼び出し(新しいものが後ろ)。 */
  actions: string[]
  tools: string[]
  startedAt: number
}

/** 走っているサブエージェント。 */
export type Sub = {
  id: string
  type: string
  description: string
  /** いちばん新しいツール呼び出し。 */
  action?: string
}

declare module 'claude-code' {
  interface PluginState {
    'context-flow': {
      meter: Shaped<Meter | null>
      goal: string
      steps: Shaped<Step[]>
      live: Shaped<Live | null>
      /** ターンが走っている間、1 秒ごとに進む時刻(経過時間とスピナー用)。 */
      beat: number
      /** 流れの窓が、最新から何行さかのぼっているか(0 = 最新を追う)。 */
      scroll: number
      /** セッションが始まった時刻。ここから起動アニメーションが流れる。 */
      boot: number
      agents: Shaped<Sub[]>
      /** 発言の頭 → トランスクリプトの行。再読み込みをまたいで覚えておく。 */
      rows: Record<string, string>
    }
  }
}

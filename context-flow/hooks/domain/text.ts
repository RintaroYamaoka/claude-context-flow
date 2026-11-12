// 文字列の整形:セル幅・切り詰め・折り返し・時刻・トークン数・モデル名・ツール呼び出しの 1 行。
// `$` は使わない(純粋な関数だけ)。

/** 端末のセル幅(全角は 2)。 */
export const cells = (text: string): number => {
  let n = 0
  for (const ch of text) n += (ch.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1

  return n
}

export const clip = (text: string, max: number): string => {
  if (cells(text) <= max) return text
  let out = ''
  let n = 0
  for (const ch of text) {
    const w = (ch.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1
    if (n + w > max - 1) break
    out += ch
    n += w
  }

  return `${out}…`
}

/** セル幅で折り返す。`maxLines` を超える分は最後の行を … で切る。 */
export const wrapCells = (text: string, width: number, maxLines: number): string[] => {
  const lines: string[] = []
  let line = ''
  let n = 0
  for (const ch of text) {
    const w = (ch.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1
    if (n + w > width) {
      lines.push(line)
      line = ''
      n = 0
    }
    line += ch
    n += w
  }
  if (line !== '' || lines.length === 0) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = clip(`${kept[maxLines - 1] ?? ''}……`, width)

  return kept
}

export const oneLine = (text: string): string =>
  text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ')
    .replace(/\[Request interrupted by user[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** 発言の頭。トランスクリプトの行を探す手がかりにする。 */
export const anchorOf = (text: string): string => oneLine(text).slice(0, 80)

export const formatTokens = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
      : String(n)

/** `/model` の表示を、名前と添え書き(例: 1M context)に分ける。 */
export const modelName = (raw: string): { name: string; extra: string } => {
  const split = /^(.*?)\s*[([](.+)[)\]]\s*$/.exec(raw)
  let name = (split?.[1] ?? raw).trim().replace(/^claude-/, '')
  if (/^[a-z0-9-]+$/.test(name)) {
    name = name
      .replace(/-\d{8}$/, '')
      .replace(/-/g, ' ')
      .replace(/(\d+) (\d+)/, '$1.$2')
  }

  return { name, extra: split?.[2]?.trim() ?? '' }
}

export const clock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60

  return `${m}:${String(s).padStart(2, '0')}`
}

/** ツールの名前(MCP の前置きは落とす)。 */
export const toolName = (tool: string): string =>
  String(tool).replace(/^mcp__.*__/, '')

/** ツール呼び出しの 1 行。 */
export const actionOf = (e: { tool: string }): string => {
  const tool = toolName(e.tool)
  const input = e as Record<string, unknown>
  const detail =
    input.description ??
    input.file_path ??
    input.pattern ??
    input.query ??
    input.url ??
    input.skill ??
    input.command
  if (typeof detail !== 'string' || detail === '') return tool
  // パスは末尾のほうが意味を持つ。
  const short = /^[~/.]/.test(detail)
    ? detail.split('/').slice(-2).join('/')
    : detail

  return `${tool} ${clip(oneLine(short), 60)}`
}

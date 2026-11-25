// セッションの立ち上げ: コマンドの登録、ペインを開く、周期とコマ送りのタイマー。
// 起動アニメーションの再生と、`/context-flow` の引数(boot・bg・color)もここ。
import type { EngineInterface } from 'claude-code'

import {
  PALETTES,
  SPECTRA,
  currentSpectrum,
  isRareBoot,
  isThunderBoot,
  isTyphoonBoot,
  paletteList,
  pickPalette,
  pickSpectrum,
  setSpectrum,
  spectrumList,
} from '../domain/color'
import { PANE, flags, hydrate, setBeat, setBoot } from '../store'
import { restoreRows } from './rows'
import { tick } from './tick'

const TITLE = 'context'
const TICK_MS = 2000
/**
 * 描き直す間隔。エンジンが端末のペインを描き直すのは 1 秒に 30 回までなので、
 * それに合わせる(これより細かく送っても、描かれずに捨てられるだけ)。
 */
const BEAT_MS = 33
/**
 * セッションの開始から、自分のペインを開くまでの待ち。
 * ほかの mod がこの間にペインを開けば、その直後に開く(`openBehind`)。
 */
const OPEN_WAIT_MS = 300

/** このセッションで、自分のペインをもう開いたか。 */
let hasOpened = false

/**
 * ペインの開き方。エンジンが敷く灰色の地は外す(`transparent`)。
 * 地を残すと、mod が塗れないペインの一番下の 1 行だけ灰色が見える。
 * 配色の色は、行ごとに mod が塗る。
 */
const paneOpen = () => ({
  id: PANE,
  title: TITLE,
  backgroundColor: 'transparent',
})

/**
 * 起動アニメーションを最初から流す。まれな起動かどうかは起動の時刻で決まる。
 * `kind` が rare(花火)・thunder(雷)・typhoon(台風)なら、その起動になる時刻まで数ミリ秒ずらして、必ずそれにする。
 */
export async function playBoot(
  $: EngineInterface,
  kind: BootKind = 'any',
): Promise<void> {
  await setBoot($, bootTimeFrom(Date.now(), kind))
}

/** `/context-flow boot` の引数から、名指しされた起動の種類を読む(名指しが無ければ any)。 */
export function bootKindOf(args: string): BootKind {
  if (/\btyphoon\b/.test(args)) return 'typhoon'
  if (/\bthunder\b/.test(args)) return 'thunder'
  if (/\brare\b/.test(args)) return 'rare'

  return 'any'
}

/** 起動アニメーションの種類。quiet は雷も台風も出さない(タブを表に戻した時など、会話の途中。長い起動でペインが読めなくなるため)。 */
export type BootKind = 'any' | 'quiet' | 'rare' | 'thunder' | 'typhoon'

/**
 * 起動アニメーションの時刻を決める。どの起動になるかは時刻で決まるので、`now` から数ミリ秒ずらして選ぶ。
 * `any` は当たった時刻のまま(花火・雷・台風のどれにもなりうる)。
 */
export function bootTimeFrom(now: number, kind: BootKind): number {
  let bootAt = now
  while (kind === 'rare' && !isRareBoot(bootAt)) bootAt++
  while (kind === 'thunder' && !isThunderBoot(bootAt)) bootAt++
  while (kind === 'typhoon' && !isTyphoonBoot(bootAt)) bootAt++
  while (kind === 'quiet' && (isThunderBoot(bootAt) || isTyphoonBoot(bootAt))) bootAt++

  return bootAt
}

export async function startSession($: EngineInterface): Promise<void> {
  await $.command.register({
    name: 'context-flow',
    description:
      'セッションの会話の流れ・モデル・コンテキスト量のペインを開く(boot で起動アニメーションを再生、bg で背景の配色、color で流れの色を切り替え)',
    argumentHint: '[boot [rare|thunder|typhoon] | bg <名前> | color <名前>]',
  })
  // 前に選んだ背景の配色を戻す。
  const saved = await $.store.get('backdrop').catch(() => undefined)
  if (typeof saved === 'string' && saved in PALETTES) flags.paletteName = saved
  // 前に選んだ流れの色を戻す。
  const savedColor = await $.store.get('spectrum').catch(() => undefined)
  if (typeof savedColor === 'string') setSpectrum(savedColor)
  // ほかの mod がペインを開くのを少し待ってから開く(その前に開いたら `openBehind` が開く)。
  $.clock.after(OPEN_WAIT_MS, () => {
    if (hasOpened) return
    hasOpened = true
    void $.ui.open(paneOpen())
  })
  $.clock.every(TICK_MS, () => {
    void tick($)
  })
  await hydrate($)
  await playBoot($)
  await restoreRows($)
  // アニメーションのコマ送り。
  let count = 0
  let isBeating = false
  let isLooking = false
  $.clock.every(BEAT_MS, () => {
    count++
    const now = Date.now()
    // 約 0.25 秒ごとに、自分のタブが表に出ているかを見る。
    // 裏から表に切り替わった瞬間に、起動アニメーションを流す。
    if (count % 8 === 0 && !isLooking) {
      isLooking = true
      void $.ui
        .panes()
        .then(async panes => {
          const mine = panes.find(pane => pane.id === PANE)
          const shown = mine !== undefined && mine.isShown && mine.isPlaced
          const wasHidden = flags.isShown === false
          flags.isShown = shown
          if (shown && wasHidden) await playBoot($, 'quiet')
        })
        .catch(() => undefined)
        .then(() => {
          isLooking = false
        })
    }
    // 裏に回っている間は描かない。
    if (flags.isShown === false) return
    // 待機中も同じ速さで描く(モデル名とバーの光が、放置しても遅くならないように)。
    // 前のコマがまだ書き終わっていなければ、このコマは飛ばす(溜めない)。
    if (isBeating) return
    isBeating = true
    void setBeat($, now)
      .catch(() => undefined)
      .then(() => {
        isBeating = false
      })
  })
  void tick($)
}

/**
 * ほかの mod のペインが開いた直後に、自分のペインを開く。
 * 最後に開いたペインが表に出るので、セッションを開いた時に自分のペインが見えるようにする。
 */
export async function openBehind($: EngineInterface, id: string): Promise<void> {
  if (id !== PANE && !hasOpened) {
    hasOpened = true
    await $.ui.open(paneOpen()).catch(() => undefined)
  }
}

/** `/context-flow`: ペインを開く。`bg <名前>` で背景の配色、`color <名前>` で流れの色、`boot` で起動アニメーション。 */
export async function runCommand(
  $: EngineInterface,
  args: string,
): Promise<{ text: string }> {
  // `/context-flow bg <名前>` で背景の配色を変える。名前なしなら次の配色へ。
  const picked = /\bbg\b\s*(\S*)/.exec(args)
  if (picked !== null) {
    const next = pickPalette(picked[1] ?? '', flags.paletteName)
    const names = paletteList()
    if (next === undefined) return { text: `その配色はありません。選べるのは: ${names}` }
    flags.paletteName = next
    await $.store.set('backdrop', next).catch(() => undefined)
    await $.ui.open(paneOpen())

    return {
      text: `背景を ${next}(${PALETTES[next]?.label ?? '黒'})にしました。選べるのは: ${names}`,
    }
  }
  // `/context-flow color <名前>` で流れの色を変える。名前なしなら次の色へ。
  const colored = /\bcolor\b\s*(\S*)/.exec(args)
  if (colored !== null) {
    const next = pickSpectrum(colored[1] ?? '', currentSpectrum())
    const names = spectrumList()
    if (next === undefined) return { text: `その色はありません。選べるのは: ${names}` }
    setSpectrum(next)
    await $.store.set('spectrum', next).catch(() => undefined)
    await $.ui.open(paneOpen())

    return {
      text: `流れの色を ${next}(${SPECTRA[next]?.label ?? ''})にしました。選べるのは: ${names}`,
    }
  }
  await $.ui.open(paneOpen())
  // `/context-flow boot` で、起動アニメーションをもう一度流す。
  // `boot rare` なら花火の夜空、`boot thunder` なら雷の起動、`boot typhoon` なら台風の起動を流す。
  if (/\bboot\b/.test(args)) {
    const kind = bootKindOf(args)
    await playBoot($, kind)

    return {
      text:
        kind === 'typhoon'
          ? '台風の起動アニメーションを流しました。'
          : kind === 'thunder'
            ? '雷の起動アニメーションを流しました。'
            : kind === 'rare'
              ? 'まれな起動アニメーションを流しました。'
              : '起動アニメーションを流しました。',
    }
  }

  return { text: 'Context ペインを開きました。' }
}

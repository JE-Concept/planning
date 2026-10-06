// Wachten tot de app klaar is, niet een vast aantal milliseconden.
//
// Gedeeld door scripts/smoke.mjs en scripts/verhuur-smoke.mjs. Daar stonden
// 255 vaste pauzes (`waitForTimeout(900)` en zo), meer dan drie minuten
// slapen per run. Te kort op een trage runner en de test valt om
// zonder dat er iets stuk is; te lang op een snelle en hij wacht voor niets.
// `rustig` wacht op wat er werkelijk gebeurt: tot er geen verzoek meer
// onderweg is (een lazy geladen scherm), geen korte timer meer moet afgaan
// (de debounce van een zoekveld of een autosave: alles tot 2 s; een toast of
// de waakhond van 15 s tellen niet) en de pagina 100 ms niet meer veranderde.
// Duurt dat langer dan 5 s, dan gaat de test gewoon verder en zegt de
// assertie erna wat er ontbreekt.

/** In elke pagina vóór de app: tel de korte timers en onthoud de laatste DOM-wijziging. */
function meetRust() {
  const w = window
  const zet = w.setTimeout.bind(w)
  const wis = w.clearTimeout.bind(w)
  const open = new Set()
  w.setTimeout = (fn, ms = 0, ...rest) => {
    if (typeof fn !== 'function' || ms > 2000) return zet(fn, ms, ...rest)
    const id = zet((...a) => {
      open.delete(id)
      fn(...a)
    }, ms, ...rest)
    open.add(id)
    return id
  }
  w.clearTimeout = (id) => {
    open.delete(id)
    return wis(id)
  }
  w.__rust = { timers: () => open.size, laatste: performance.now() }
  new MutationObserver(() => {
    w.__rust.laatste = performance.now()
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
}

/** Zet de meting op een pagina, vóór haar eerste navigatie. */
export async function meet(page) {
  await page.addInitScript(meetRust)
  page.onderweg = 0
  page.netwerkStil = Date.now()
  page.on('request', () => {
    page.onderweg += 1
    page.netwerkStil = Date.now()
  })
  const af = () => {
    page.onderweg = Math.max(0, page.onderweg - 1)
    page.netwerkStil = Date.now()
  }
  page.on('requestfinished', af)
  page.on('requestfailed', af)
  return page
}

/** Een nieuwe pagina met de meting erop; `bron` is de browser of een context. */
export const nieuwePagina = async (bron, opties) => meet(await bron.newPage(opties))

export async function rustig(page, { stil = 100, max = 5000 } = {}) {
  /*
    De stilte telt pas vanaf nu. Een klik die een lazy scherm laadt, zet zijn
    verzoek een paar milliseconden later in Node dan de klik zelf terugkomt;
    een DOM die toevallig al 100 ms stil was, gaf dan vrij voordat het scherm
    er stond. Dus: wachten vanaf het moment van vragen, en het netwerk moet
    even lang stil zijn als de pagina.
  */
  const begin = Date.now()
  await page.evaluate(() => {
    if (window.__rust) window.__rust.sinds = performance.now()
  }).catch(() => {})
  const tot = begin + max
  while (Date.now() < tot) {
    const netwerkStil = !page.onderweg && Date.now() - Math.max(page.netwerkStil ?? 0, begin) >= stil
    if (netwerkStil) {
      const klaar = await page
        .evaluate((ms) => {
          const r = window.__rust
          return Boolean(r) && r.timers() === 0 && performance.now() - Math.max(r.laatste, r.sinds ?? 0) >= ms
        }, stil)
        .catch(() => false)
      if (klaar) return
    }
    await new Promise((r) => setTimeout(r, 25))
  }
}

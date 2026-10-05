/**
 * De klok van de demo.
 *
 * De demogegevens staan vast rond één dag: maandag 28 september 2026, 9u20.
 * Het rooster toont "deze week", de socials "deze week", het magazijn "vanaf
 * vandaag" — en de smoke-tests weten precies wat er dan te zien hoort te zijn.
 * Zolang de echte dag in dezelfde week viel, klopte dat vanzelf; de maandag
 * erna was de week leeg en faalden vier tests zonder dat er iets kapot was.
 *
 * Daarom leest de app in de demo niet de echte klok maar deze: ze staat op
 * de demodag en loopt van daar gewoon door, zodat een timer tikt en een
 * "zojuist" een "zojuist" blijft. Alleen `new Date()` zonder argument en
 * `Date.now()` worden omgebogen; een datum uit gegevens blijft wat ze is.
 *
 * Dit bestand hoort als eerste te laden in `boot.js`, vóór de seed, want de
 * seed rekent haar "nu" ook hiermee.
 */
const Echt = Date
const START_ECHT = Echt.now()

export const NU = new Echt('2026-09-28T09:20:00')
const NU_MS = NU.getTime()

const nu = () => NU_MS + (Echt.now() - START_ECHT)

class DemoDate extends Echt {
  constructor(...args) {
    if (args.length === 0) super(nu())
    else super(...args)
  }
  static now() {
    return nu()
  }
}

globalThis.Date = DemoDate

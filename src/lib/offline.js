import { STANDAARDTAAL, vertaal } from './i18n'

/**
 * Wat er nog op dit toestel staat en nergens anders.
 *
 * De keuken en de koelcel hebben één streepje bereik. Firestore vangt dat zelf
 * op: een vinkje dat offline gezet wordt, gaat naar de schijfcache en wordt
 * later vanzelf doorgestuurd. Het probleem is niet het bewaren, het is het
 * zwijgen. Wie niet wéét dat zijn vinkjes nog op de tablet staan, sluit de app
 * — en dan staat er de volgende ochtend een lijst die niemand meer kan
 * terughalen.
 *
 * Elke momentopname van Firestore draagt de twee feiten die je daarvoor nodig
 * hebt: `hasPendingWrites` ("dit heb ík geschreven, de server weet het nog
 * niet") en `fromCache` ("dit komt van schijf, niet van de server"). De hooks
 * in `src/data` melden die hier, dit boek telt ze op, en de balk bovenaan zegt
 * het in gewone taal.
 *
 * Bewust een eigen boekje en geen React-state: de melding komt uit een handvol
 * abonnementen die verspreid over de app aan- en uitgaan, en die hoeven niet
 * allemaal van elkaar te weten.
 */

/**
 * Hoeveel documenten in deze momentopname nog niet bij de server zijn.
 *
 * Werkt op een lijst én op één document. Alles is defensief: een momentopname
 * zonder `metadata` (de demobuild had die aanvankelijk niet) mag hier nooit de
 * hele app omvergooien voor een mededeling.
 */
export function telWachtend(snap) {
  if (!snap) return 0
  if (Array.isArray(snap.docs)) {
    return snap.docs.reduce((n, d) => n + (d?.metadata?.hasPendingWrites ? 1 : 0), 0)
  }
  return snap.metadata?.hasPendingWrites ? 1 : 0
}

/** Komt dit antwoord van schijf in plaats van van de server? */
export function uitCache(snap) {
  return Boolean(snap?.metadata?.fromCache)
}

/**
 * Het boek zelf: per bron één regel, opgeteld één stand.
 *
 * Een fabriek en geen singleton-only, zodat de tests hem los kunnen vullen
 * zonder dat twee tests elkaars stand zien.
 */
export function maakSyncboek() {
  const bronnen = new Map()
  const kijkers = new Set()

  const stand = () => {
    let wachtend = 0
    let cache = false
    for (const regel of bronnen.values()) {
      wachtend += regel.wachtend
      if (regel.uitCache) cache = true
    }
    return { wachtend, uitCache: cache, bronnen: bronnen.size }
  }

  const vertel = () => {
    const nu = stand()
    for (const kijker of kijkers) kijker(nu)
  }

  return {
    stand,

    /**
     * Wat deze bron nu weet. Verandert er niets, dan wordt er ook niemand
     * wakker gemaakt: elk abonnement meldt bij élke momentopname, en dat zijn
     * er bij een druk bord tientallen per minuut.
     */
    meld(bron, { wachtend = 0, uitCache: cache = false } = {}) {
      const vorig = bronnen.get(bron)
      if (vorig && vorig.wachtend === wachtend && vorig.uitCache === cache) return
      bronnen.set(bron, { wachtend, uitCache: cache })
      vertel()
    },

    /** Het abonnement is gestopt; zijn regel telt niet meer mee. */
    vergeet(bron) {
      if (!bronnen.delete(bron)) return
      vertel()
    },

    abonneer(kijker) {
      kijkers.add(kijker)
      return () => kijkers.delete(kijker)
    },
  }
}

/** Het boek van de draaiende app. */
export const syncboek = maakSyncboek()

/** Wat een hook na elke momentopname doet. */
export function meldSnapshot(bron, snap) {
  syncboek.meld(bron, { wachtend: telWachtend(snap), uitCache: uitCache(snap) })
}

/** Wat een hook bij het opruimen doet. */
export function vergeetBron(bron) {
  syncboek.vergeet(bron)
}

/** Zonder taal meegegeven staat er Nederlands, de brontaal van de app. */
const nederlands = (sleutel, waarden) => vertaal(STANDAARDTAAL, sleutel, waarden)

/**
 * Wat er bovenaan het scherm hoort te staan, of niets.
 *
 * Drie gevallen, in deze volgorde:
 *
 *  - Geen verbinding. Dat moet je weten vóór je begint, niet achteraf. Er staat
 *    bij dat doorwerken mag, want dat is het hele punt van de schijfcache.
 *  - Verbinding, maar er staat nog werk klaar. Kort zichtbaar, tot het weg is.
 *  - Verbinding en niets open: zwijgen. Een balk die er altijd staat, leest
 *    niemand nog op het moment dat het wél uitmaakt.
 *
 * `uitCache` alleen is géén reden om iets te zeggen: bij het opstarten komt
 * élk antwoord eerst van schijf, en daar is niets mis mee.
 *
 * De taal komt van buiten in plaats van dat dit bestand ze opzoekt: dit is de
 * enige plek in de rekenkant waar tekst ontstaat, en de mensen die deze balk
 * het hardst nodig hebben — de keuken, de koelcel — lezen hem in het Engels.
 * Zonder `t` blijft het Nederlands, zodat de tests hierop gewoon tekst zien.
 */
export function offlineBericht({ online = true, wachtend = 0, t = nederlands } = {}) {
  if (!online) {
    return {
      toon: 'offline',
      tekst: t('lijst.offline_titel'),
      detail: wachtend
        ? t('lijst.offline_detail_wachtend', { aantal: wachtend })
        : t('lijst.offline_detail'),
    }
  }

  if (wachtend > 0) {
    return {
      toon: 'wachtend',
      tekst: t('lijst.wachtend', { aantal: wachtend }),
      detail: t('lijst.wachtend_detail'),
    }
  }

  return null
}

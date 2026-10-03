import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Dialog, Field, Input, Textarea } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { maakMateriaal, uploadFoto, verwijderFoto, wijzigMateriaal } from '@data/materiaal'
import { prijsVoorPeriode } from '@lib/huurprijs'

/**
 * Een artikel in het magazijn: wat het is, hoeveel ervan, en wat het kost.
 *
 * ── Waarom een leeg prijsveld leeg blijft ─────────────────────────────────
 * Een nul is een prijs en een leeg veld is een ontbrekend gegeven, en dat
 * verschil moet tot in de database blijven staan. Zouden we hier een lege
 * dagprijs als 0 wegschrijven, dan is het stuk gratis te huren en zegt niets
 * in de tool er nog iets van. Nu meldt `lib/huurprijs.js` het als "geen
 * tarief" en blijft een offerte zichtbaar onvolledig.
 *
 * ── Waarom "zelf af te halen" een vinkje is en geen prijsgrens ────────────
 * Omdat niet alles wat goedkoop is, eenvoudig is. Een doos glazen mag mee met
 * wie ze komt halen; een mobiele bar van tweehonderd euro per dag moet op een
 * camion en moet geplaatst worden. Het onderscheid zit in het stuk en niet in
 * het bedrag, dus staat het per stuk.
 */
const leeg = {
  naam: '',
  omschrijving: '',
  categorie: '',
  aantal: 1,
  uitloopDagen: 1,
  prijsPerDag: '',
  prijsWeekend: '',
  prijsWeek: '',
  waarborg: '',
  minDagen: 1,
  vervangwaarde: '',
  directTeHuren: false,
}

/** Leeg blijft leeg; een getal wordt een getal. Zie de kop. */
const bedrag = (waarde) => {
  const tekst = String(waarde ?? '').trim()
  if (tekst === '') return null
  const n = Number(tekst.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const toonbaar = (waarde) => (waarde === null || waarde === undefined ? '' : String(waarde))

export default function ArtikelDialoog({ open, artikel, categorieen = [], onClose }) {
  const { t } = useTaal()
  const toast = useToast()
  const [vorm, setVorm] = useState(leeg)
  const [bezig, setBezig] = useState(false)
  const [fotoBezig, setFotoBezig] = useState(false)
  const bestandsveld = useRef(null)

  useEffect(() => {
    if (!open) return
    setVorm(
      artikel
        ? {
            naam: artikel.naam ?? '',
            omschrijving: artikel.omschrijving ?? '',
            categorie: artikel.categorie ?? '',
            aantal: artikel.aantal ?? 1,
            uitloopDagen: artikel.uitloopDagen ?? 0,
            prijsPerDag: toonbaar(artikel.prijsPerDag),
            prijsWeekend: toonbaar(artikel.prijsWeekend),
            prijsWeek: toonbaar(artikel.prijsWeek),
            waarborg: toonbaar(artikel.waarborg),
            minDagen: artikel.minDagen ?? 1,
            vervangwaarde: toonbaar(artikel.vervangwaarde),
            directTeHuren: artikel.directTeHuren === true,
          }
        : leeg
    )
  }, [open, artikel])

  const zet = (patch) => setVorm((oud) => ({ ...oud, ...patch }))

  /*
    Zelf afrekenen kan alleen met een dagprijs. Het vinkje staat daarom uit én
    op slot zolang die ontbreekt: dezelfde regel als op de server
    (`isLosTeHuren`), zodat het scherm niet iets belooft wat de kassa weigert.
  */
  const magDirect = bedrag(vorm.prijsPerDag) != null

  /*
    Vraag 5 in `docs/vragen-productie.md`: alles met een dagprijs mag online.
    Dus zodra iemand bij een níéuw artikel een dagprijs intikt, gaat het
    vinkje vanzelf aan — hij kan het nog uitzetten voor hij bewaart. Bij een
    bestaand artikel blijft staan wat er stond: dat is een beslissing die
    iemand al genomen heeft.
  */
  useEffect(() => {
    if (!artikel && magDirect) setVorm((oud) => (oud.directTeHuren ? oud : { ...oud, directTeHuren: true }))
  }, [artikel, magDirect])

  const bewaren = async () => {
    const naam = vorm.naam.trim()
    if (!naam) return
    setBezig(true)
    const velden = {
      naam,
      omschrijving: vorm.omschrijving.trim(),
      categorie: vorm.categorie.trim() || 'Overig',
      aantal: Math.max(1, Math.round(Number(vorm.aantal) || 1)),
      uitloopDagen: Math.max(0, Math.round(Number(vorm.uitloopDagen) || 0)),
      prijsPerDag: bedrag(vorm.prijsPerDag),
      prijsWeekend: bedrag(vorm.prijsWeekend),
      prijsWeek: bedrag(vorm.prijsWeek),
      waarborg: bedrag(vorm.waarborg),
      minDagen: Math.max(1, Math.round(Number(vorm.minDagen) || 1)),
      vervangwaarde: bedrag(vorm.vervangwaarde),
      directTeHuren: magDirect && vorm.directTeHuren,
    }
    try {
      if (artikel) await wijzigMateriaal(artikel.id, velden)
      else await maakMateriaal(velden)
      onClose()
    } catch {
      toast.error(t('artikel.mislukt'))
    } finally {
      setBezig(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={artikel ? t('artikel.wijzigen') : t('artikel.nieuw')}
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('alg.annuleren')}
          </Button>
          <Button onClick={bewaren} disabled={bezig || !vorm.naam.trim()}>
            {t('alg.bewaren')}
          </Button>
        </>
      }
    >
      <div className="je-artikelvorm">
        <Field label={t('artikel.naam')} className="je-artikelvorm__breed">
          <Input value={vorm.naam} onChange={(e) => zet({ naam: e.target.value })} autoFocus />
        </Field>

        <Field label={t('artikel.categorie')}>
          <Input
            value={vorm.categorie}
            onChange={(e) => zet({ categorie: e.target.value })}
            list="artikel-categorieen"
            placeholder={t('artikel.categorie_plaats')}
          />
          <datalist id="artikel-categorieen">
            {categorieen.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label={t('artikel.aantal')} hint={t('artikel.aantal_hint')}>
          <Input type="number" min="1" value={vorm.aantal} onChange={(e) => zet({ aantal: e.target.value })} />
        </Field>

        <Field label={t('artikel.omschrijving')} className="je-artikelvorm__breed">
          <Textarea rows={2} value={vorm.omschrijving} onChange={(e) => zet({ omschrijving: e.target.value })} />
        </Field>

        <Field label={t('artikel.per_dag')} hint={t('artikel.leeg_is_geen_prijs')}>
          <Input inputMode="decimal" value={vorm.prijsPerDag} onChange={(e) => zet({ prijsPerDag: e.target.value })} />
        </Field>
        <Field label={t('artikel.weekend')} hint={t('artikel.weekend_hint')}>
          <Input inputMode="decimal" value={vorm.prijsWeekend} onChange={(e) => zet({ prijsWeekend: e.target.value })} />
        </Field>
        <Field label={t('artikel.week')}>
          <Input inputMode="decimal" value={vorm.prijsWeek} onChange={(e) => zet({ prijsWeek: e.target.value })} />
        </Field>
        <Field label={t('artikel.waarborg')} hint={t('artikel.waarborg_hint')}>
          <Input inputMode="decimal" value={vorm.waarborg} onChange={(e) => zet({ waarborg: e.target.value })} />
        </Field>

        <Field label={t('artikel.uitloop')} hint={t('artikel.uitloop_hint')}>
          <Input type="number" min="0" value={vorm.uitloopDagen} onChange={(e) => zet({ uitloopDagen: e.target.value })} />
        </Field>
        <Field label={t('artikel.min_dagen')} hint={t('artikel.min_dagen_hint')}>
          <Input type="number" min="1" value={vorm.minDagen} onChange={(e) => zet({ minDagen: e.target.value })} />
        </Field>

        <Field label={t('artikel.vervangwaarde')} hint={t('artikel.vervangwaarde_hint')} className="je-artikelvorm__breed">
          <Input inputMode="decimal" value={vorm.vervangwaarde} onChange={(e) => zet({ vervangwaarde: e.target.value })} />
        </Field>

        {/*
          De foto staat alleen bij een bestaand artikel: ze hoort aan een id
          te hangen, en dat is er pas na het bewaren. Een nieuw artikel krijgt
          daarom eerst zijn naam en zijn prijs, en dan zijn foto.
        */}
        {artikel ? (
          <div className="je-artikelvorm__breed je-artikelvorm__foto">
            <span className="je-caps">{t('artikel.foto')}</span>
            {artikel.foto ? (
              <img src={artikel.foto} alt="" className="je-artikelvorm__fotobeeld" />
            ) : (
              <p className="je-muted-caption" style={{ margin: 0 }}>{t('artikel.geen_foto')}</p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <input
                ref={bestandsveld}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  setFotoBezig(true)
                  try {
                    await uploadFoto(artikel.id, file)
                  } catch (err) {
                    // Een klacht uit `keurBestand` is een tekstsleutel; al de rest is een storing.
                    toast.error(/^artikel\./.test(err?.message ?? '') ? t(err.message) : t('artikel.foto_mislukt'))
                  } finally {
                    setFotoBezig(false)
                  }
                }}
              />
              <Button size="sm" variant="secondary" onClick={() => bestandsveld.current?.click()} disabled={fotoBezig}>
                {fotoBezig ? t('artikel.foto_bezig') : artikel.foto ? t('artikel.foto_vervangen') : t('artikel.foto_kiezen')}
              </Button>
              {artikel.foto ? (
                <Button size="sm" variant="ghost" onClick={() => verwijderFoto(artikel.id)} disabled={fotoBezig}>
                  {t('artikel.foto_weg')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="je-artikelvorm__breed je-artikelvorm__los">
          <Checkbox
            label={t('artikel.direct')}
            description={magDirect ? t('artikel.direct_uitleg') : t('artikel.direct_geen_prijs')}
            checked={magDirect && vorm.directTeHuren}
            disabled={!magDirect}
            onChange={(e) => zet({ directTeHuren: e.target.checked })}
          />
          {magDirect && vorm.directTeHuren ? <Voorbeeld vorm={vorm} /> : null}
        </div>
      </div>
    </Dialog>
  )
}

/**
 * Wat een klant zou zien.
 *
 * De staffel is een regel die je pas gelooft als je ze ziet rekenen: dat zes
 * dagen niet duurder zijn dan een week, is hier in één oogopslag na te gaan.
 * Zonder dit zet iemand een weekprijs die hoger is dan zeven losse dagen en
 * merkt hij het pas aan een telefoontje.
 */
function Voorbeeld({ vorm }) {
  const { t } = useTaal()
  const stuk = {
    prijsPerDag: bedrag(vorm.prijsPerDag),
    prijsWeekend: bedrag(vorm.prijsWeekend),
    prijsWeek: bedrag(vorm.prijsWeek),
  }
  // Een vrijdag, zodat het weekendtarief in het voorbeeld ook echt meedoet.
  const reeks = (n) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date('2027-03-12T12:00:00')
      d.setDate(d.getDate() + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })

  const euro = (n) => `€ ${n.toFixed(2).replace('.', ',')}`

  return (
    <p className="je-muted-caption" style={{ margin: 'var(--space-3) 0 0' }}>
      {t('artikel.voorbeeld')}{' '}
      {[1, 3, 6, 7].map((n, i) => (
        <span key={n}>
          {i > 0 ? ' · ' : ''}
          {t('artikel.voorbeeld_dagen', { aantal: n })} {euro(prijsVoorPeriode(stuk, reeks(n)).bedrag)}
        </span>
      ))}
    </p>
  )
}

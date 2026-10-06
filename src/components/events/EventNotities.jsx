import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDateTime } from '@lib/dates'
import { linksIn } from '@lib/links'
import { kandidaten, metMarkering, ruweStukken, zetVermelding, zoekopdrachtVan } from '@lib/vermelding'
import { Acties, Avatar, bevestig, IconButton, Textarea } from '@components/ds'
import LinkVoorbeeld from '@components/common/LinkVoorbeeld'
import Notitietekst from '@components/common/Notitietekst'
import { useAuth } from '@context/AuthProvider'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { addComment, deleteComment, useComments } from '@data/comments'

/**
 * De notities bij een event: waar het team met elkaar praat.
 *
 * Dit is geen bijzaak maar het gesprek. Wie een event opent, wil weten wat er
 * sinds gisteren gezegd is — dat de klant verplaatst, dat de tent toch niet
 * geleverd wordt, dat er iemand uitvalt. Daarom staat het naast het werk en
 * niet achter een tabblad: een tabblad open je pas wanneer je al weet dat er
 * iets staat, en dat is precies wat je bij communicatie níét weet.
 *
 * Het leest als een gesprek: oudste bovenaan, nieuwste onderaan, het
 * schrijfvak eronder. De kolom scrolt naar de laatste notitie zodra er een
 * bijkomt, want dat is degene waar het over gaat.
 *
 * ── Iemand aanspreken ────────────────────────────────────────────────────
 * Met `@` kies je een collega. Zonder dat is een notitie een mededeling aan de
 * lucht: ze gaat naar de uitvoerders en naar wie eerder meepraatte, maar er is
 * geen manier om te zeggen "Elke, dit is voor jou". Wie vermeld wordt krijgt
 * de melding ook als hij niet op het event staat — dat is precies waarvoor je
 * iemand vermeldt.
 *
 * De rest van het rekenwerk over wie er iets hoort te horen, staat in
 * `functions/notify.js`. De schrijver zelf krijgt nooit een bericht.
 */
export default function EventNotities({ ev, compact = false }) {
  const { t } = useTaal()
  const { profile } = useAuth()
  const { profileById, profiles } = useWorkspace()
  const toast = useToast()
  const notities = useComments({ taskId: ev.id })

  const [tekst, setTekst] = useState('')
  /*
    Wie er in deze nog niet verstuurde notitie aangesproken is.

    In het veld staat gewone tekst — `@Maxine Vanbrabant` — want dat is wat
    leesbaar is. Welke naam bij welk account hoort, staat hier, en wordt er bij
    het bewaren omheen gezet. Zie `@lib/vermelding`.
  */
  const [gekozen, setGekozen] = useState([])
  const [bezig, setBezig] = useState(false)
  const [vraag, setVraag] = useState(null)
  const [actief, setActief] = useState(0)
  const onderkant = useRef(null)
  const veld = useRef(null)
  const spiegel = useRef(null)

  /*
    Wie er te vermelden valt: het team, en de ploeg.

    De ploeg stond er niet bij, en terecht: wie het event niet kon openen,
    aanspreken is een melding sturen die naar een gesloten deur wijst. Sinds de
    regels een medewerker de notitie laten lezen waarin hij zélf genoemd wordt,
    klopt dat bezwaar niet meer — en dan is het juist de ploeg die je het
    vaakst iets wil doorgeven: dat de opbouw een uur vroeger begint, dat de
    ingang verlegd is.

    De socialrol blijft erbuiten: die leest dit event sowieso niet, en komt
    ook niet werken.

    De ploeg staat onderaan. Een notitie bij een event gaat meestal over het
    dossier, en dan zoek je een collega van het bureau.
  */
  const team = useMemo(
    () =>
      profiles
        .filter((p) => p.active !== false && p.role !== 'social')
        .sort((a, b) => (a.role === 'staff' ? 1 : 0) - (b.role === 'staff' ? 1 : 0)),
    [profiles]
  )
  const voorstellen = useMemo(
    () => (vraag == null ? [] : kandidaten(team, vraag)),
    [team, vraag]
  )

  // Naar de laatste notitie zodra er een bijkomt. Bij het openen van het event
  // ook: wat je wil zien is wat er als laatste gezegd is.
  useEffect(() => {
    onderkant.current?.scrollIntoView({ block: 'nearest' })
  }, [notities.length])

  /** Na elke aanslag opnieuw bepalen of er een naam getypt wordt. */
  const volg = (waarde, cursor) => {
    const plek = zoekopdrachtVan(waarde, cursor)
    setVraag(plek ? plek.vraag : null)
    setActief(0)
  }

  const kies = (persoon) => {
    const veldje = veld.current
    const cursor = veldje?.selectionStart ?? tekst.length
    const uit = zetVermelding(tekst, cursor, persoon)
    setTekst(uit.tekst)
    if (uit.vermelding) setGekozen((lijst) => [...lijst, uit.vermelding])
    setVraag(null)
    // De cursor moet achter de naam komen te staan, en dat kan pas nadat React
    // de nieuwe waarde in het veld gezet heeft.
    requestAnimationFrame(() => {
      veldje?.focus()
      veldje?.setSelectionRange(uit.cursor, uit.cursor)
    })
  }

  const plaats = async () => {
    const schoon = tekst.trim()
    if (!schoon || bezig) return
    setBezig(true)
    try {
      // Pas hier komt de markering erin. Wie de naam ondertussen weer
      // weggeveegd heeft, spreekt niemand aan — en dat klopt.
      await addComment({ taskId: ev.id, body: metMarkering(schoon, gekozen), author: profile })
      setTekst('')
      setGekozen([])
      setVraag(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
    }
  }

  const opToets = (e) => {
    if (voorstellen.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActief((i) => (i + 1) % voorstellen.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActief((i) => (i <= 0 ? voorstellen.length : i) - 1)
        return
      }
      // Enter kiest de naam zolang de lijst openstaat; pas daarna is Enter weer
      // een nieuwe regel. Anders zou kiezen met het toetsenbord niet kunnen.
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        kies(voorstellen[actief])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setVraag(null)
        return
      }
    }
    // Verzenden met Ctrl/Cmd+Enter: wie hier de hele dag in werkt, typt sneller
    // dan hij naar een knop grijpt. Enter alleen blijft een nieuwe regel — een
    // notitie is vaker drie regels dan één.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      plaats()
    }
  }

  return (
    <aside
      className="je-panel je-notities"
      aria-label={t('events.notities.titel')}
      data-compact={compact ? '' : undefined}
    >
      <header className="je-notities__kop">
        <span className="je-eyebrow">{t('events.notities.titel')}</span>
        <span className="je-muted-caption">{t('events.notities.aantal', { aantal: notities.length })}</span>
      </header>

      <div className="je-notities__draad">
        {notities.length === 0 ? (
          <p className="je-muted-caption" style={{ margin: 0 }}>
            {t('events.notities.nog_niets')}
          </p>
        ) : (
          notities.map((n) => {
            const auteur = profileById[n.authorId]
            // Beheerders mogen ook wissen: iemand vertrekt, of er staat iets
            // dat er niet hoort te staan, en dan moet er een weg zijn. De
            // rules staan precies hetzelfde toe.
            const magWeg = n.authorId === profile?.id || profile?.role === 'owner' || profile?.role === 'admin'
            return (
              <article key={n.id} className="je-notitie">
                <Avatar profile={auteur ?? { fullName: n.authorName }} size={22} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="je-notitie__kop">
                    <span className="je-notitie__wie">{auteur?.fullName ?? n.authorName}</span>
                    <span className="je-muted-caption">{n.createdAt ? formatDateTime(n.createdAt) : ''}</span>
                    {magWeg ? (
                      <IconButton
                        icon="trash-2"
                        label={t('events.notities.notitie_weg')}
                        size="sm"
                        variant="bare"
                        onClick={() => {
                          if (bevestig(t('events.notities.notitie_weg_vraag')))
                            deleteComment(n).catch((err) => toast.error(err.message))
                        }}
                      />
                    ) : null}
                  </div>
                  <Notitietekst
                    className="je-notitie__tekst"
                    tekst={n.body}
                    mij={profile?.id}
                    profileById={profileById}
                  />
                  {/*
                    Eén kaartje, bij de eerste link. Zie `LinkVoorbeeld` voor
                    waarom niet bij alle drie.
                  */}
                  <LinkVoorbeeld url={linksIn(n.body)[0]} />
                </div>
              </article>
            )
          })
        )}
        <div ref={onderkant} />
      </div>

      <div className="je-notities__schrijf">
        {voorstellen.length ? (
          <div className="je-vermeldlijst" role="listbox" aria-label={t('events.notities.vermelden')}>
            {voorstellen.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={i === actief}
                className="je-plainbtn je-vermeldoptie"
                style={{ background: i === actief ? 'var(--accent-quiet)' : 'transparent' }}
                onMouseEnter={() => setActief(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  kies(p)
                }}
              >
                <Avatar profile={p} size={20} />
                <span className="je-vermeldoptie__naam">{p.fullName || p.email}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/*
          Een spiegel achter het tekstvak, en het tekstvak zelf doorzichtig.

          Een `<textarea>` kan geen gekleurd stukje tonen; een invoerveld dat
          dat wél kan (`contenteditable`) brengt zijn eigen ellende mee —
          plakken, selecteren, ongedaan maken, schermlezers. Vandaar deze
          oplossing: precies dezelfde tekst, in precies hetzelfde lettertype en
          dezelfde breedte, eronder getekend met een pil rond de namen. Omdat
          het dezelfde letters zijn, staat de pil exact waar de naam staat.

          Het meescrollen moet met de hand: de spiegel heeft geen schuifbalk.
        */}
        <div className="je-vermeldveld">
          <div className="je-vermeldveld__spiegel" aria-hidden="true" ref={spiegel}>
            {ruweStukken(tekst, gekozen).map((stuk, i) =>
              stuk.soort === 'naam' ? (
                <mark key={i} className="je-vermeldpil">{`@${stuk.naam}`}</mark>
              ) : (
                <span key={i}>{stuk.tekst}</span>
              )
            )}
            {/* Een afsluitende regel, anders knipt de browser een tekst die op
                een enter eindigt een regel te kort af. */}
            {'\n'}
          </div>
          <Textarea
            ref={veld}
            className="je-vermeldveld__invoer"
            value={tekst}
            onChange={(e) => {
              setTekst(e.target.value)
              volg(e.target.value, e.target.selectionStart)
            }}
            // Ook bij klikken en pijltjes verschuift de cursor; zonder dit blijft
            // de lijst openstaan terwijl er allang ergens anders getypt wordt.
            onSelect={(e) => volg(e.target.value, e.target.selectionStart)}
            onScroll={(e) => {
              if (spiegel.current) spiegel.current.scrollTop = e.target.scrollTop
            }}
            onBlur={() => setTimeout(() => setVraag(null), 140)}
            placeholder={t('events.notities.plaatshouder')}
            rows={tekst ? 4 : 2}
            aria-label={t('events.notities.toevoegen')}
            onKeyDown={opToets}
          />
        </div>
        <div className="je-notities__knop">
          <span className="je-muted-caption">{t('events.notities.vermeld_hint')}</span>
          <Acties plaats="rij" hoofd={{ label: t('events.notities.bewaren'), bezig, uit: !tekst.trim(), onClick: plaats }} />
        </div>
      </div>
    </aside>
  )
}

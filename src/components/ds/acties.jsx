import { useEffect, useState } from 'react'
import { cn } from '@lib/cn'
import { useTaal } from '@context/taal-context'
import { Button, Dialog, IconButton } from './index'

/**
 * Het actiekader: elke call to action in JE Plan gaat hierdoor.
 *
 * ── Waarom één kader ──────────────────────────────────────────────────────
 * Er stonden 227 knoppen in de app, en hun rang hing af van wie ze schreef.
 * "Annuleren" was op het ene scherm stil en op het andere een omlijnde knop;
 * een hoofdactie zonder `variant` werd via de oude laag ongemerkt secundair;
 * verwijderen was het ene keer rood en het andere keer grijs. Wie de app
 * gebruikt, leert zo nooit waar hij moet kijken. Nu beslist de plek van een
 * actie in dit kader over haar uiterlijk, niet de schrijver.
 *
 * ── De rangen ─────────────────────────────────────────────────────────────
 * - **hoofd**: waarvoor dit scherm, deze dialoog of deze lade er is. Hooguit
 *   één per plek, en dat is hier een vorm en geen afspraak: er is één prop.
 *   Altijd rechts, gevuld (`primary`).
 * - **tweede**: andere zinnige stappen. Omlijnd (`secondary`), links van de
 *   hoofdactie.
 * - **terug**: annuleren, sluiten, terug. Stil (`ghost`), het verst van de
 *   hoofdactie aan de rechterkant.
 * - **gevaar**: wat iets weghaalt of onomkeerbaar maakt. Vraagt altijd eerst
 *   bevestiging, en staat apart links: nooit naast de hoofdactie, waar je er
 *   per ongeluk op drukt. Rood omlijnd; `toon: 'stil'` waar een rustiger
 *   alternatief (archiveren) de gewone keuze is en het rood alleen afschrikt.
 * - **uitleg**: een korte stille regel links (bewaard om 14:02, nog 3 velden).
 *
 * ── De plekken ────────────────────────────────────────────────────────────
 * `voet` (onderaan een dialoog of lade), `kop` (rechts in een paginakop), `rij`
 * (in een formulier of een sectie, kleiner), `leeg` (gecentreerd in een lege
 * toestand) en `stapel` (onder elkaar over de volle breedte, op het
 * aanmeldscherm of een foutmelding over het hele scherm). Op een smalle telefoon stapelt `voet` zich, met de hoofdactie
 * bovenaan en over de volle breedte: daar zit je duim.
 *
 * Een actie is een object: `{ label, onClick, icon, bezig, uit, vraag, … }`.
 * `bezig` toont een draaiertje en zet de knop uit, `uit` zet hem alleen uit,
 * `vraag` laat eerst bevestigen. Alles wat er verder in staat (`as`, `to`,
 * `type`, `title`, `aria-*`) gaat naar de knop.
 */
export function Acties({ hoofd, tweede = [], terug, gevaar, uitleg, plaats = 'voet', className }) {
  const { t } = useTaal()
  const size = plaats === 'rij' ? 'sm' : 'md'
  const tweedes = (Array.isArray(tweede) ? tweede : [tweede]).filter(Boolean)
  const terugActie = terug === true ? {} : terug

  const links = gevaar || uitleg
  return (
    <div className={cn('je-acties', `je-acties--${plaats}`, className)}>
      {links ? (
        <div className="je-acties__links">
          {gevaar ? <GevaarKnop toon="vol" {...gevaar} size={size} /> : null}
          {uitleg ? <span className="je-acties__uitleg">{uitleg}</span> : null}
        </div>
      ) : null}
      <div className="je-acties__rechts">
        {terugActie ? (
          <ActieKnop actie={{ label: t('alg.annuleren'), ...terugActie }} variant="ghost" size={size} />
        ) : null}
        {tweedes.map((actie, i) => (
          <ActieKnop key={actie.key ?? actie.label ?? i} actie={actie} variant="secondary" size={size} />
        ))}
        {hoofd ? <ActieKnop actie={hoofd} variant="primary" size={size} /> : null}
      </div>
    </div>
  )
}

function ActieKnop({ actie, variant, size }) {
  const { label, icon, iconRight, bezig = false, uit = false, vraag, onClick, key: _key, ...rest } = actie
  // Een actie met een `vraag` vraagt eerst bevestiging, welke rang ze ook heeft:
  // archiveren is geen gevaar (het is terug te halen), maar wel iets om niet per
  // ongeluk te doen.
  const klik = vraag && onClick ? async (e) => (await bevestig(vraag, { knop: label })) && onClick(e) : onClick
  return (
    <Button
      variant={variant}
      size={size}
      iconLeft={icon}
      iconRight={iconRight}
      loading={bezig}
      disabled={uit}
      onClick={klik}
      {...rest}
    >
      {label}
    </Button>
  )
}

/**
 * De ene plek waar JE Plan om bevestiging vraagt.
 *
 * Een eigen venster in de stijl van JE Plan, en niet meer dat van de browser:
 * "Definitief verwijderen?" in een grijs systeemvenster las als een melding van
 * Chrome en niet van de tool, en het kon niet zeggen wat de knop doet. Het
 * venster staat één keer in de app (`BevestigHost`); `bevestig` geeft een
 * belofte die ja of nee wordt. Staat er geen host (een publieke pagina), dan
 * valt het terug op het venster van de browser, zodat een vraag nooit zomaar
 * wegvalt.
 *
 * `knop` is het woord op de bevestigknop ("Verwijderen"), `gevaar` kleurt hem
 * rood.
 */
let vraagNaarHost = null

export function bevestig(vraag, { knop, gevaar = false } = {}) {
  if (vraagNaarHost) return new Promise((antwoord) => vraagNaarHost({ vraag, knop, gevaar, antwoord }))
  return Promise.resolve(typeof window !== 'undefined' && window.confirm(vraag))
}

/** Het venster achter `bevestig`. Eén keer, hoog in de app. */
export function BevestigHost() {
  const { t } = useTaal()
  const [open, setOpen] = useState(null)

  useEffect(() => {
    vraagNaarHost = (verzoek) =>
      setOpen((vorig) => {
        // Een tweede vraag terwijl de eerste openstaat: de eerste is nee.
        vorig?.antwoord(false)
        return verzoek
      })
    return () => {
      vraagNaarHost = null
    }
  }, [])

  const sluit = (ja) => {
    open?.antwoord(ja)
    setOpen(null)
  }

  if (!open) return null
  return (
    <Dialog
      open
      onClose={() => sluit(false)}
      width={480}
      title={t('alg.zeker')}
      footer={
        <Acties
          terug={{ onClick: () => sluit(false) }}
          hoofd={{ label: open.knop || t('alg.doorgaan'), onClick: () => sluit(true), ...(open.gevaar ? { variant: 'danger' } : {}) }}
        />
      }
    >
      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{open.vraag}</p>
    </Dialog>
  )
}

/**
 * Een gevaarlijke actie: vraagt eerst of je het zeker weet.
 *
 * `toon="stil"` (standaard) is voor in een rij of naast een item: een stille
 * knop die pas bij aanwijzen of focus rood kleurt, zodat een lijst met tien
 * keer "verwijderen" niet schreeuwt. De vraag erna draagt het gewicht. `toon="vol"` is de gevaarlijke actie van een hele dialoog of
 * lade, en zet `Acties` zelf via `gevaar`.
 */
export function GevaarKnop({
  label,
  vraag,
  onConfirm,
  toon = 'stil',
  size = 'sm',
  bezig = false,
  uit = false,
  icon,
  iconLeft,
  className,
  ...rest
}) {
  const klik = async () => {
    if (await bevestig(vraag, { knop: label || rest['aria-label'], gevaar: true })) onConfirm?.()
  }
  // Alleen een pictogram (een kruisje naast een reactie, een prullenbak in een
  // kop): dan een echte IconButton, met het label voor de schermlezer uit
  // `aria-label`. Vroeger stond hier een tekstknop met "✕" erin, met de hand
  // tot pictogram verkleind.
  if (!label && (icon || iconLeft)) {
    const { 'aria-label': naam, ...overig } = rest
    return (
      <IconButton
        {...overig}
        icon={icon ?? iconLeft}
        label={naam}
        size={size}
        disabled={uit || bezig}
        className={cn('je-iconbtn--gevaar', className)}
        onClick={klik}
      />
    )
  }
  return (
    <Button
      {...rest}
      variant={toon === 'vol' ? 'danger' : 'ghost'}
      size={size}
      iconLeft={icon ?? iconLeft}
      loading={bezig}
      disabled={uit}
      className={cn(toon === 'stil' && 'je-btn--gevaar-stil', className)}
      onClick={klik}
    >
      {label}
    </Button>
  )
}

/**
 * Bladeren door een periode: vorige, nu, volgende.
 *
 * Stond vijf keer los in de app, elke keer net anders: tekstpijltjes in een
 * omlijnde knop op het rooster, pictogrammen op de werklast, "Vandaag" of
 * "Deze week" of niets in het midden. Dit is bediening en geen call to action,
 * dus het staat in `PageHeader` onder `bediening` en nooit in `Acties`.
 *
 * Elk deel is `{ label, onClick, uit }`; het label van de pijltjes is wat een
 * schermlezer hoort ("Vorige week"), dat van `nu` staat op de knop.
 */
export function PeriodeKiezer({ vorige, nu, volgende, className }) {
  return (
    <div className={cn('je-periode', className)} role="group">
      {vorige ? (
        <IconButton icon="chevron-left" variant="outline" size="sm" label={vorige.label} onClick={vorige.onClick} disabled={vorige.uit} />
      ) : null}
      {nu ? (
        <Button variant="secondary" size="sm" onClick={nu.onClick} disabled={nu.uit}>
          {nu.label}
        </Button>
      ) : null}
      {volgende ? (
        <IconButton icon="chevron-right" variant="outline" size="sm" label={volgende.label} onClick={volgende.onClick} disabled={volgende.uit} />
      ) : null}
    </div>
  )
}

/**
 * Een knop die aan of uit staat: een gekozen taal, de lijst die openstaat, een
 * lopende timer. Dat is een toestand en geen call to action, en hoort dus niet
 * in `Acties`; het uiterlijk zegt "aan" (gevuld) en `aria-pressed` zegt het
 * tegen een schermlezer. `stop` maakt de aan-toestand rood, voor iets dat loopt
 * en dat je stopt (een timer).
 */
export function Schakelknop({ aan = false, stop = false, size = 'sm', children, ...rest }) {
  return (
    <Button variant={aan ? (stop ? 'danger' : 'primary') : 'secondary'} size={size} aria-pressed={aan} {...rest}>
      {children}
    </Button>
  )
}

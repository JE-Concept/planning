import { useMemo, useState } from 'react'
import { Button, Icon, Input } from '@components/ds'
import { Spinner } from '@ui/index'
import { useTaal } from '@context/TaalProvider'
import { meldAanMetCode, usePloegLijst } from '@data/ploeg'

/**
 * Aanmelden met je naam en vier cijfers.
 *
 * ── Waarom eerst een naam en dan pas cijfers ──────────────────────────────
 * Omdat dat is hoe iemand het zelf zou zeggen: ik ben Lotte, en mijn code is
 * 4821. Eén veld waarin je allebei moet typen, is een veld waarin je een fout
 * kunt maken die je niet ziet.
 *
 * ── Waarom er uitleg staat over wat je níét moet kiezen ───────────────────
 * Omdat je hier een code kiest in plaats van er een invult, en dat is het
 * enige moment waarop die waarschuwing past: vier cijfers zijn de vorm van
 * een bankcode, en wie hier die van zijn kaart invult, zet hem op een scherm
 * waar het bureau hem kan inkijken.
 */
export default function CodeAanmelden({ onTerug }) {
  const { t } = useTaal()
  const { mensen, laadt, fout: lijstFout } = usePloegLijst()
  const [zoek, setZoek] = useState('')
  const [wie, setWie] = useState(null)
  const [code, setCode] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState(null)

  const gevonden = useMemo(() => {
    const woorden = zoek.toLowerCase().trim().split(/\s+/).filter(Boolean)
    return mensen.filter((m) => woorden.every((w) => m.naam.toLowerCase().includes(w))).slice(0, 8)
  }, [mensen, zoek])

  const meld = async () => {
    if (code.length !== 4 || bezig) return
    setBezig(true)
    setFout(null)
    try {
      await meldAanMetCode({ medewerkerId: wie.id, code })
    } catch (err) {
      /*
        De server stuurt een sleutel en geen zin: dit scherm staat in twee
        talen, en een melding die uit een functie komt zou anders altijd
        Nederlands zijn. Wat we niet herkennen, tonen we zoals het kwam.
      */
      const sleutel = String(err?.message ?? '')
      setFout(sleutel.startsWith('ploeg.') ? t(sleutel) : sleutel || t('ploeg.fout.algemeen'))
      setCode('')
    } finally {
      setBezig(false)
    }
  }

  if (!wie) {
    return (
      <div className="je-codeaanmelden">
        <p className="je-muted-caption">{t('ploeg.kies_naam')}</p>
        <Input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder={t('ploeg.zoek')}
          aria-label={t('ploeg.zoek')}
        />
        {laadt ? (
          <Spinner />
        ) : lijstFout ? (
          <p className="je-fout">{t('ploeg.fout.lijst')}</p>
        ) : (
          <div className="je-codeaanmelden__namen" role="listbox" aria-label={t('ploeg.kies_naam')}>
            {gevonden.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected="false"
                className="je-plainbtn je-codeaanmelden__naam"
                onClick={() => {
                  setWie(m)
                  setFout(null)
                }}
              >
                {m.naam}
              </button>
            ))}
            {!gevonden.length ? <p className="je-muted-caption">{t('ploeg.niemand')}</p> : null}
          </div>
        )}
        <Button variant="ghost" size="sm" iconLeft="arrow-left" onClick={onTerug}>
          {t('ploeg.terug')}
        </Button>
      </div>
    )
  }

  return (
    <div className="je-codeaanmelden">
      <p style={{ font: 'var(--type-h4)', margin: 0 }}>{wie.naam}</p>
      <p className="je-muted-caption">{t('ploeg.typ_code')}</p>

      {/*
        Eén veld en geen vier vakjes. Vier vakjes zijn mooier en breken het
        plakken, de cijfertoetsen van een telefoon en elke schermlezer.
      */}
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => e.key === 'Enter' && meld()}
        aria-label={t('ploeg.code')}
        className="je-codeveld"
      />

      {fout ? (
        <p className="je-fout">
          <Icon name="alert-triangle" size={14} /> {fout}
        </p>
      ) : null}

      <p className="je-muted-caption">{t('ploeg.eerste_keer')}</p>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button onClick={meld} loading={bezig} disabled={code.length !== 4}>
          {t('ploeg.aanmelden')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setWie(null)
            setCode('')
            setFout(null)
          }}
        >
          {t('ploeg.andere_naam')}
        </Button>
      </div>
    </div>
  )
}

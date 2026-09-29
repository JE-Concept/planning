import { useState } from 'react'
import { Button, Dialog, Switch } from '@components/ds'
import { useAuth } from '@context/AuthProvider'
import { useToast } from '@context/ToastProvider'
import { pushIngesteld, pushMogelijk, pushStaatAan } from '@lib/push'
import { KANALEN, SOORT_UITLEG, voorkeurenVan, zetVoorkeur } from '@data/meldingen'

/**
 * Welke berichten je wil, en langs welke weg.
 *
 * Per persoon en niet per toestel: dit gaat over wat je wil weten, niet over
 * waar het aankomt. Het aan- en uitzetten van meldingen op dít toestel staat
 * ernaast in hetzelfde menu, want dat is wél per toestel.
 *
 * Er staat bij wat er van elk bericht te verwachten is. "Toewijzing" zegt
 * niets; "zodra iemand je aan een taak toevoegt" wel — en wie weet wanneer een
 * bericht komt, zet het minder snel helemaal uit.
 */
export default function MeldingsVoorkeuren({ open, onClose }) {
  const { uid, profile } = useAuth()
  const toast = useToast()
  const [bezig, setBezig] = useState(null)

  const huidig = voorkeurenVan(profile)
  // Het profiel komt live binnen, dus na het schrijven staat het vakje vanzelf
  // goed. Tot die tijd blijft het even uit, om te voorkomen dat een dubbelklik
  // twee schrijfbeurten wordt.
  const zet = async (soort, kanaal, aan) => {
    setBezig(`${soort}.${kanaal}`)
    try {
      await zetVoorkeur(uid, soort, kanaal, aan)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Meldingen"
      width={560}
      footer={
        <Button variant="primary" onClick={onClose}>
          Klaar
        </Button>
      }
    >
      <div className="je-meldpref">
        <p className="je-meldpref__intro">
          Wat je wil horen, en hoe. Dit geldt voor jou, op al je toestellen.
        </p>

        <ul className="je-meldpref__lijst">
          {SOORT_UITLEG.map((soort) => (
            <li key={soort.key} className="je-meldpref__rij">
              <span className="je-meldpref__tekst">
                <span className="je-meldpref__titel">{soort.titel}</span>
                <span className="je-meldpref__uitleg">{soort.uitleg}</span>
              </span>
              <span className="je-meldpref__schakelaars">
                {KANALEN.map((kanaal) => (
                  <Switch
                    key={kanaal.key}
                    label={kanaal.label}
                    checked={huidig[soort.key][kanaal.key]}
                    disabled={bezig === `${soort.key}.${kanaal.key}`}
                    onChange={(e) => zet(soort.key, kanaal.key, e.target.checked)}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>

        {/* Een schakelaar die aanstaat terwijl er niets aankomt, is erger dan
            geen schakelaar: dan zoekt iemand de fout bij zichzelf. */}
        {pushMogelijk() && !pushIngesteld() ? (
          <p className="je-meldpref__waarschuwing">
            Meldingen op je toestel zijn voor deze installatie nog niet ingesteld. Tot dat gebeurt
            komt alles per e-mail binnen.
          </p>
        ) : null}
        {pushIngesteld() && pushMogelijk() && !pushStaatAan() ? (
          <p className="je-meldpref__waarschuwing">
            Meldingen staan nog uit op dit toestel. Zet ze aan via “Meldingen aanzetten” in dit
            menu, anders komt alleen de e-mail aan.
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

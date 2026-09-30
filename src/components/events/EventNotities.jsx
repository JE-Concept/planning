import { useEffect, useRef, useState } from 'react'
import { formatDateTime } from '@lib/dates'
import { Button, Hex, IconButton, Textarea, initialsOf } from '@components/ds'
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
 * Wie er een melding van krijgt, staat in `functions/notify.js`: de uitvoerders
 * van het event en iedereen die er eerder op reageerde — behalve de schrijver
 * zelf. Dat is wat een notitie tot een bericht maakt in plaats van een briefje
 * dat toevallig gevonden wordt.
 */
export default function EventNotities({ ev, compact = false }) {
  const { t } = useTaal()
  const { profile } = useAuth()
  const { profileById } = useWorkspace()
  const toast = useToast()
  const notities = useComments({ taskId: ev.id })

  const [tekst, setTekst] = useState('')
  const [bezig, setBezig] = useState(false)
  const onderkant = useRef(null)

  // Naar de laatste notitie zodra er een bijkomt. Bij het openen van het event
  // ook: wat je wil zien is wat er als laatste gezegd is.
  useEffect(() => {
    onderkant.current?.scrollIntoView({ block: 'nearest' })
  }, [notities.length])

  const plaats = async () => {
    const schoon = tekst.trim()
    if (!schoon || bezig) return
    setBezig(true)
    try {
      await addComment({ taskId: ev.id, body: schoon, author: profile })
      setTekst('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBezig(false)
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
            const vanMij = n.authorId === profile?.id
            return (
              <article key={n.id} className="je-notitie">
                <Hex size={22}>{initialsOf(auteur ?? { fullName: n.authorName })}</Hex>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="je-notitie__kop">
                    <span className="je-notitie__wie">{auteur?.fullName ?? n.authorName}</span>
                    <span className="je-muted-caption">{n.createdAt ? formatDateTime(n.createdAt) : ''}</span>
                    {vanMij ? (
                      <IconButton
                        icon="trash-2"
                        label={t('events.notities.notitie_weg')}
                        size="sm"
                        variant="bare"
                        onClick={() => {
                          if (window.confirm(t('events.notities.notitie_weg_vraag')))
                            deleteComment(n).catch((err) => toast.error(err.message))
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="je-notitie__tekst">{n.body}</div>
                </div>
              </article>
            )
          })
        )}
        <div ref={onderkant} />
      </div>

      <div className="je-notities__schrijf">
        <Textarea
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          placeholder={t('events.notities.plaatshouder')}
          rows={tekst ? 4 : 2}
          aria-label={t('events.notities.toevoegen')}
          // Verzenden met Ctrl/Cmd+Enter: wie hier de hele dag in werkt, typt
          // sneller dan hij naar een knop grijpt. Enter alleen blijft een
          // nieuwe regel — een notitie is vaker drie regels dan één.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              plaats()
            }
          }}
        />
        <div className="je-notities__knop">
          <Button size="sm" onClick={plaats} loading={bezig} disabled={!tekst.trim()}>
            {t('events.notities.bewaren')}
          </Button>
        </div>
      </div>
    </aside>
  )
}

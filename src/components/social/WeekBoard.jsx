import { useMemo } from 'react'
import { cn } from '@lib/cn'
import { dayKey, formatDay, isToday } from '@lib/dates'
import { GEEN_KANAAL, channelMeta, kanaalRijen } from '@lib/social-channels'
import { bucketPerDagEnKanaal, telPerKanaal, weekDagen } from '@lib/social-planning'
import { useTaal } from '@context/TaalProvider'
import PostCard from './PostCard'

/**
 * De contentkalender van één week: per dag én per kanaal.
 *
 * De maandweergave beantwoordt "wanneer gaat er iets uit"; deze beantwoordt de
 * vraag die er in de week zelf toe doet — wat staat er dinsdag op Facebook, en
 * waar zit er een gat. Vandaar kanalen als rijen: een week met vier posts die
 * alle vier op Instagram staan ziet er in een maandrooster vol uit en is het
 * niet.
 *
 * Een post op twee kanalen staat in twee rijen. Dat is bedoeld: het is
 * dezelfde post, maar het is twee keer iets dat online komt.
 */
export default function WeekBoard({ week, posts, brandById, onOpen, onAdd, drag }) {
  const dagen = useMemo(() => weekDagen(week), [week])
  const rijen = useMemo(() => kanaalRijen(posts), [posts])
  const perKanaal = useMemo(() => bucketPerDagEnKanaal(posts), [posts])
  const tellers = useMemo(() => telPerKanaal(posts), [posts])

  return (
    <div className="je-weekboard">
      <div className="je-weekboard__rooster" style={{ '--dagen': dagen.length }}>
        <div className="je-weekboard__hoek" />
        {dagen.map((dag) => (
          <div
            key={dayKey(dag)}
            className={cn('je-weekboard__dagkop', isToday(dag) && 'je-weekboard__dagkop--vandaag')}
          >
            {formatDay(dag)}
          </div>
        ))}

        {rijen.map((kanaalKey) => {
          const kanaal = channelMeta(kanaalKey)
          const perDag = perKanaal[kanaalKey] ?? {}

          return (
            <Rij
              key={kanaalKey}
              kanaal={kanaal}
              aantal={tellers[kanaalKey] ?? 0}
              dagen={dagen}
              perDag={perDag}
              brandById={brandById}
              onOpen={onOpen}
              onAdd={onAdd}
              drag={drag}
            />
          )
        })}
      </div>
    </div>
  )
}

function Rij({ kanaal, aantal, dagen, perDag, brandById, onOpen, onAdd, drag }) {
  const { t } = useTaal()

  return (
    <>
      <div className="je-weekboard__kanaal">
        <span
          aria-hidden="true"
          className="je-weekboard__stip"
          style={{ background: kanaal.color }}
        />
        <span className="je-weekboard__kanaalnaam">{kanaal.label}</span>
        <span className="je-weekboard__teller">{aantal}</span>
      </div>

      {dagen.map((dag) => {
        const key = dayKey(dag)
        const dagPosts = perDag[key] ?? []
        // Een lege cel in de rij "nog geen kanaal" is geen gat dat gevuld moet
        // worden — daar hoort geen plusje.
        const kanAanmaken = kanaal.key !== GEEN_KANAAL

        return (
          <div
            key={key}
            className={cn(
              'je-weekboard__cel',
              isToday(dag) && 'je-weekboard__cel--vandaag',
              drag?.over === key && 'je-weekboard__cel--doel'
            )}
            onDragOver={(e) => {
              e.preventDefault()
              drag?.onOver?.(key)
            }}
            onDragLeave={() => drag?.onLeave?.(key)}
            onDrop={() => drag?.onDrop?.(dag)}
            onDoubleClick={kanAanmaken ? () => onAdd?.(dag, kanaal.key) : undefined}
          >
            {dagPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                brand={brandById[post.brandId]}
                dragging={drag?.id === post.id}
                onOpen={onOpen}
                onDragStart={drag?.onStart}
                onDragEnd={drag?.onEnd}
              />
            ))}

            {kanAanmaken ? (
              <button
                type="button"
                className="je-weekboard__plus"
                onClick={() => onAdd?.(dag, kanaal.key)}
                aria-label={t('social.post.toevoegen_op_kanaal', { dag: key, kanaal: kanaal.label })}
              >
                +
              </button>
            ) : null}
          </div>
        )
      })}
    </>
  )
}

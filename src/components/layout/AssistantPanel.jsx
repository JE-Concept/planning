import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hex, Icon, IconButton, Tag } from '@components/ds'
import { SUGGESTIONS, useAssistant } from '@context/AssistantProvider'

/** Het paneel rechts (schermvullend op een telefoon) met het gesprek. */
export default function AssistantPanel() {
  const { messages, busy, ask, setOpen } = useAssistant()
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, busy])

  const send = () => {
    if (!draft.trim() || busy) return
    ask(draft)
    setDraft('')
  }

  return (
    <aside className="je-chat" aria-label="Assistent">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-4)',
          padding: 'var(--space-5) var(--space-6)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <Hex size={34} tone="ink">
          <Icon name="sparkles" size={16} />
        </Hex>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="je-eyebrow">Assistent</div>
          <div className="je-muted-caption" style={{ marginTop: 4 }}>
            Beantwoordt vragen en voert acties uit in de planning.
          </div>
        </div>
        <IconButton icon="x" label="Sluiten" size="sm" onClick={() => setOpen(false)} />
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 'var(--space-5) var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {messages.map((m, i) => {
          const user = m.role === 'user'
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: user ? 'flex-end' : 'flex-start', gap: 'var(--space-2)' }}>
              <div
                style={{
                  maxWidth: '88%',
                  padding: 'var(--space-4) var(--space-5)',
                  background: user ? 'var(--navy-700)' : 'var(--navy-50)',
                  color: user ? 'var(--white)' : 'var(--text-1)',
                  border: `1px solid ${user ? 'var(--navy-700)' : 'var(--border-hairline)'}`,
                  borderRadius: 4,
                  font: 'var(--type-body-sm)',
                  whiteSpace: 'pre-wrap',
                  textWrap: 'pretty',
                }}
              >
                {m.text}
              </div>
              {(m.actions ?? []).map((a, j) => (
                <div
                  key={j}
                  style={{
                    maxWidth: '88%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 2,
                    font: 'var(--type-caption)',
                    color: 'var(--text-1)',
                  }}
                >
                  <span style={{ color: a.ok ? 'var(--success)' : 'var(--warning)', display: 'flex' }}>
                    <Icon name={a.ok ? 'check-circle' : 'alert-triangle'} size={14} />
                  </span>
                  <span style={{ flex: 1, fontWeight: 400 }}>{a.text}</span>
                  {a.eventId ? (
                    <button
                      type="button"
                      className="je-plainbtn"
                      style={{ font: 'var(--type-caption)', color: 'var(--text-accent)' }}
                      onClick={() => navigate(`/events/${a.eventId}`)}
                    >
                      Openen
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )
        })}

        {busy ? (
          <div className="je-muted-caption" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Icon name="loader" size={14} className="animate-spin" />
            Even kijken in de planning
          </div>
        ) : null}

        {messages.length === 1 && !busy ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            <span className="je-caps">Probeer</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {SUGGESTIONS.map((s) => (
                <Tag key={s} selectable onClick={() => ask(s)}>
                  {s}
                </Tag>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: 'var(--space-4) var(--space-6) var(--space-5)',
          borderTop: '1px solid var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 2,
            padding: '4px 4px 4px var(--space-4)',
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
            placeholder="Vraag of opdracht"
            aria-label="Bericht aan de assistent"
            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: 'var(--type-body-sm)', color: 'var(--text-1)', height: 36, boxShadow: 'none' }}
          />
          <IconButton icon="arrow-up" label="Versturen" variant="accent" size="sm" disabled={!draft.trim() || busy} onClick={send} />
        </div>
        <span className="je-muted-caption" style={{ color: 'var(--text-3)' }}>
          De assistent kan zich vergissen. Acties zie je meteen in de planning.
        </span>
      </div>
    </aside>
  )
}

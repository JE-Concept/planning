import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@lib/firebase'
import { addDays, dayKey, huidigeLocaleVan, startOfDay } from '@lib/dates'
import { PIPELINE, labelOf } from '@lib/pipeline'
import { leesFunctieFout } from '@lib/functie-fout'
import { huidigeTaalVan, tekst } from '@lib/i18n'
import { useAuth } from '@context/AuthProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { addEventTask, eventDateOf, isDone, moveEvent, toggleTaskDone, useEvents } from '@data/events'
import { startTimer } from '@data/time'

/**
 * De assistent uit het design: vragen over de planning, en acties erin.
 *
 * Het model draait in een Cloud Function (`assistant`); de tools draaien hier,
 * in de browser, met de rechten van wie aan het typen is. Wat de assistent
 * doet, doet hij dus als jij — en de regels die voor jou gelden (de
 * Firestore-rules, de offerteregel) gelden voor hem.
 */

const AssistantContext = createContext(null)
const functions = getFunctions(app, 'europe-west1')
const callAssistant = httpsCallable(functions, 'assistant', { timeout: 120_000 })

const GREETING = (name) => tekst('assistent.groet', { naam: name })

/*
  De voorbeeldvragen staan er niet om leuk te staan: ze laten zien wat de
  assistent kan. Daarom gaan ze mee met de taal — een Engelse gebruiker die op
  een Nederlandse zin klikt, stuurt een vraag die hij zelf niet geschreven zou
  hebben.

  Een functie en geen vaste lijst: zo wordt de tekst opgezocht op het moment van
  tekenen, en neemt een taalwissel ze mee.
*/
export const suggesties = () => [1, 2, 3, 4].map((n) => tekst(`assistent.tip${n}`))

const datumTekst = (nu) =>
  new Intl.DateTimeFormat(huidigeLocaleVan(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(nu)

export function AssistantProvider({ children }) {
  const { profile, uid } = useAuth()
  const { profiles, eventStatuses, eventsList } = useWorkspace()
  const { events, tasks, eventById } = useEvents()
  const navigate = useNavigate()
  const firstName = (profile?.fullName || profile?.email || '').split(/[\s@]/)[0]

  // null = de standaard van het scherm; een keuze op een breed scherm wordt
  // onthouden in deze browser.
  const [open, setOpenState] = useState(() => {
    try {
      const v = localStorage.getItem('je-assistent-open')
      return v === null ? null : v === '1'
    } catch {
      return null
    }
  })
  const setOpen = useCallback((next) => {
    setOpenState((cur) => {
      const v = typeof next === 'function' ? next(cur) : next
      try {
        if (v === null) localStorage.removeItem('je-assistent-open')
        else if (window.matchMedia('(min-width: 1000px)').matches) localStorage.setItem('je-assistent-open', v ? '1' : '0')
      } catch {
        /* geen opslag: dan geldt de standaard */
      }
      return v
    })
  }, [])
  const [messages, setMessages] = useState([{ role: 'assistant', text: GREETING(firstName) }])
  const [busy, setBusy] = useState(false)
  const apiHistory = useRef([])

  // De tools lezen altijd de gegevens van nu, niet die van toen de vraag
  // gesteld werd: de assistent kan zelf dingen veranderen tussen twee stappen.
  const live = useRef({})
  live.current = { events, tasks, eventById, profiles, eventStatuses, eventsList, uid }

  useEffect(() => {
    setMessages((m) => (m.length === 1 ? [{ role: 'assistant', text: GREETING(firstName) }] : m))
  }, [firstName])

  const team = useMemo(
    () => profiles.filter((p) => p.active !== false && p.role !== 'staff' && p.role !== 'guest'),
    [profiles]
  )

  const ask = useCallback(
    async (raw) => {
      const text = (raw ?? '').trim()
      if (!text || busy) return
      setOpenState(true)
      setBusy(true)
      setMessages((m) => [...m, { role: 'user', text }])

      const actions = []
      const L = () => live.current
      const findEvent = (q) => {
        if (!q) return null
        const n = String(q).toLowerCase().trim()
        const evs = L().events
        return (
          evs.find((e) => e.id === q) ||
          evs.find((e) => e.name.toLowerCase() === n) ||
          evs.find((e) => e.name.toLowerCase().includes(n) || n.includes(e.name.toLowerCase())) ||
          evs.find((e) => (e.customerName ?? '').toLowerCase().includes(n)) ||
          null
        )
      }
      const nameOf = (id) => L().profiles.find((p) => p.id === id)?.fullName ?? id
      const taskLine = (t) => ({
        id: t.id,
        titel: t.title,
        event: L().eventById[t.parentId]?.name ?? null,
        persoon: (t.assignees ?? []).map(nameOf),
        deadline: t.dueDate ? dayKey(t.dueDate) : null,
        afgerond: isDone(t),
        prioriteit: t.priority === 1 ? 'Urgent' : t.priority === 2 ? 'Hoog' : null,
      })

      const tools = [
        {
          name: 'taken_opvragen',
          description: 'Geeft taken terug, optioneel gefilterd op persoon, periode en/of event.',
          input_schema: {
            type: 'object',
            properties: {
              persoon: { type: 'string', enum: team.map((p) => p.id), description: 'profiel-id' },
              periode: { type: 'string', enum: ['te_laat', 'vandaag', 'deze_week', 'alles_open', 'alles'] },
              event: { type: 'string', description: 'naam of id van het event' },
            },
          },
          run: async ({ persoon, periode = 'alles_open', event }) => {
            const ev = event ? findEvent(event) : null
            const today = startOfDay()
            const diff = (t) => (t.dueDate ? Math.round((startOfDay(t.dueDate) - today) / 864e5) : Infinity)
            let ts = L().tasks.filter(
              (t) => (!persoon || (t.assignees ?? []).includes(persoon)) && (!ev || t.parentId === ev.id)
            )
            if (periode === 'te_laat') ts = ts.filter((t) => !isDone(t) && diff(t) < 0)
            if (periode === 'vandaag') ts = ts.filter((t) => !isDone(t) && diff(t) <= 0)
            if (periode === 'deze_week') ts = ts.filter((t) => !isDone(t) && diff(t) <= 6)
            if (periode === 'alles_open') ts = ts.filter((t) => !isDone(t))
            return JSON.stringify(ts.slice(0, 60).map(taskLine))
          },
        },
        {
          name: 'taak_aanmaken',
          description: 'Maakt een nieuwe taak aan bij een event.',
          input_schema: {
            type: 'object',
            properties: {
              event: { type: 'string' },
              titel: { type: 'string' },
              persoon: { type: 'string', enum: team.map((p) => p.id) },
              deadline: { type: 'string', description: 'YYYY-MM-DD' },
              prioriteit: { type: 'string', enum: ['Hoog', 'Urgent'] },
            },
            required: ['event', 'titel', 'persoon'],
          },
          run: async ({ event, titel, persoon, deadline, prioriteit }) => {
            const ev = findEvent(event)
            if (!ev) {
              actions.push({ ok: false, text: `Event "${event}" niet gevonden` })
              return 'Fout: event niet gevonden.'
            }
            const due = /^\d{4}-\d{2}-\d{2}$/.test(deadline ?? '')
              ? new Date(`${deadline}T12:00:00`)
              : addDays(startOfDay(), 3)
            await addEventTask({
              event: ev,
              list: L().eventsList,
              title: titel,
              assignee: persoon,
              dueDate: due,
              priority: prioriteit === 'Urgent' ? 1 : prioriteit === 'Hoog' ? 2 : null,
            })
            actions.push({
              ok: true,
              text: `Taak aangemaakt: ${titel} · ${nameOf(persoon).split(' ')[0]} · ${dayKey(due)}`,
              eventId: ev.id,
            })
            return `OK: taak aangemaakt bij ${ev.name}.`
          },
        },
        {
          name: 'status_wijzigen',
          description: 'Zet een event op een andere status in de pijplijn.',
          input_schema: {
            type: 'object',
            properties: {
              event: { type: 'string' },
              status: { type: 'string', enum: PIPELINE.map((p) => p.key) },
            },
            required: ['event', 'status'],
          },
          run: async ({ event, status }) => {
            const ev = findEvent(event)
            if (!ev) return 'Fout: event onbekend.'
            await moveEvent(ev, status, L().eventStatuses)
            actions.push({ ok: true, text: `${ev.name} staat nu op ${labelOf(status, L().eventStatuses)}`, eventId: ev.id })
            return 'OK'
          },
        },
        {
          name: 'taak_afvinken',
          description: 'Markeert een taak als afgerond (of weer open).',
          input_schema: {
            type: 'object',
            properties: { taak_id: { type: 'string' }, afgerond: { type: 'boolean' } },
            required: ['taak_id'],
          },
          run: async ({ taak_id, afgerond = true }) => {
            const t = L().tasks.find((x) => x.id === taak_id)
            if (!t) return 'Fout: taak niet gevonden.'
            if (isDone(t) !== afgerond) {
              await toggleTaskDone(t, { event: L().eventById[t.parentId], statuses: L().eventStatuses })
            }
            actions.push({ ok: true, text: `${afgerond ? 'Afgevinkt' : 'Heropend'}: ${t.title}`, eventId: t.parentId })
            return 'OK'
          },
        },
        {
          name: 'timer_starten',
          description: 'Start de tijdregistratie op een taak.',
          input_schema: { type: 'object', properties: { taak_id: { type: 'string' } }, required: ['taak_id'] },
          run: async ({ taak_id }) => {
            const t = L().tasks.find((x) => x.id === taak_id) ?? L().events.find((x) => x.id === taak_id)
            if (!t) return 'Fout: taak niet gevonden.'
            await startTimer({ uid: L().uid, task: t, list: L().eventsList })
            actions.push({ ok: true, text: `Timer loopt op ${t.title}` })
            return 'OK'
          },
        },
        {
          name: 'event_openen',
          description: 'Opent de fiche van een event in het scherm.',
          input_schema: { type: 'object', properties: { event: { type: 'string' } }, required: ['event'] },
          run: async ({ event }) => {
            const ev = findEvent(event)
            if (!ev) return 'Fout: niet gevonden.'
            navigate(`/events/${ev.id}`)
            return 'OK'
          },
        },
      ]

      const evLine = (e) => ({
        id: e.id,
        naam: e.name,
        klant: e.customerName ?? null,
        concept: e.concept ?? null,
        datum: eventDateOf(e) ? dayKey(eventDateOf(e)) : null,
        status: e.statusName,
        pax: e.pax ?? null,
        offerte_eur: e.quoteAmount ?? null,
        team: (e.assignees ?? []).map(nameOf),
      })

      const system = [
        'Je bent de assistent in JE Plan, de interne planningstool van JE Concept (events en horeca, Tongeren–Borgloon).',
        `Vandaag is het ${datumTekst(new Date())}. Je praat met ${profile?.fullName ?? 'een teamlid'} (profiel-id ${uid}).`,
        `Team: ${team.map((p) => `${p.id}=${p.fullName ?? p.email}`).join(', ')}.`,
        `Statuspijplijn in volgorde: ${PIPELINE.map((p) => `${p.key} (${labelOf(p.key, L().eventStatuses)})`).join(', ')}.`,
        `Events: ${JSON.stringify(L().events.filter((e) => e.statusName !== 'complete').map(evLine))}`,
        // De assistent antwoordt in de taal waarin je de tool gezet hebt. Een
        // Nederlands antwoord op een Engelse vraag is geen Engelse tool.
        huidigeTaalVan() === 'en'
          ? 'Rules: answer in British English, informally, short (5 lines at most). No markdown, no emoji, no exclamation marks. Lists with a dash are fine. Amounts as € 1,234, dates as 12 October.'
          : 'Regels: antwoord in Belgisch Nederlands, jij-vorm, kort (hoogstens 5 regels). Geen markdown, geen emoji, geen uitroeptekens. Lijstjes met een streepje mogen. Bedragen als € 1.234, data als 12 oktober.',
        'Gebruik de tools om taken op te vragen of acties uit te voeren; verzin nooit gegevens. Bevestig een uitgevoerde actie in één zin. Vraag om verduidelijking als een event of persoon onduidelijk is.',
      ].join('\n')

      const history = [...apiHistory.current, { role: 'user', content: text }]
      let reply = ''
      try {
        for (let step = 0; step < 6; step++) {
          const { data } = await callAssistant({
            system,
            messages: history,
            tools: tools.map(({ run: _run, ...t }) => t),
          })
          const content = Array.isArray(data?.content) ? data.content : null
          if (!content) throw new Error('geen antwoord')
          history.push({ role: 'assistant', content })
          reply = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
          const uses = content.filter((b) => b.type === 'tool_use')
          if (data.stop_reason !== 'tool_use' || uses.length === 0) break
          const results = []
          for (const use of uses) {
            const tool = tools.find((t) => t.name === use.name)
            let out
            try {
              out = tool ? await tool.run(use.input ?? {}) : 'Fout: onbekende tool.'
            } catch (err) {
              out = `Fout: ${err.message}`
              actions.push({ ok: false, text: err.message })
            }
            results.push({ type: 'tool_result', tool_use_id: use.id, content: String(out) })
          }
          history.push({ role: 'user', content: results })
        }
        apiHistory.current = history.slice(-24)
      } catch (err) {
        reply =
          err?.code === 'functions/resource-exhausted'
            ? 'Even rustig: probeer het over een minuutje opnieuw.'
            : import.meta.env.MODE === 'demo'
              ? 'De assistent werkt enkel in de live app: in deze demo is er geen verbinding met Claude.'
              : // "Dat lukte niet" liet iemand zoeken naar een fout die er niet
                // is: zolang de sleutel ontbreekt, staat de assistent simpelweg
                // niet uitgerold. Dat hoort erbij te staan.
                leesFunctieFout(err, 'De assistent')
      }

      setMessages((m) => [...m, { role: 'assistant', text: reply || tekst('assistent.gedaan'), actions }])
      setBusy(false)
    },
    [busy, team, profile, uid, navigate]
  )

  /*
    Staat de assistent er wel?

    Zonder de Claude-sleutel wordt de functie niet uitgerold, en dan kreeg wie
    op de knop drukte enkel "nog niet uitgerold… ANTHROPIC_API_KEY". Daar kan
    een medewerker niets mee. Eén keer per sessie vragen we het na met een ping
    die het model niet aanroept; zolang het antwoord niet binnen is of nee is,
    staat de knop er niet.
  */
  const [beschikbaar, setBeschikbaar] = useState(() => {
    try {
      const v = sessionStorage.getItem('je-assistent-beschikbaar')
      return v === null ? null : v === '1'
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (!uid || beschikbaar !== null) return undefined
    let geldig = true
    const onthoud = (ja) => {
      if (!geldig) return
      setBeschikbaar(ja)
      try {
        sessionStorage.setItem('je-assistent-beschikbaar', ja ? '1' : '0')
      } catch {
        // Geen opslag: dan vragen we het bij de volgende keer laden opnieuw.
      }
    }
    callAssistant({ ping: true })
      .then(() => onthoud(true))
      .catch((err) => onthoud(!['functions/not-found', 'functions/internal'].includes(err?.code)))
    return () => {
      geldig = false
    }
  }, [uid, beschikbaar])

  const value = useMemo(
    () => ({ open, setOpen, messages, busy, ask, beschikbaar: beschikbaar === true }),
    [open, setOpen, messages, busy, ask, beschikbaar]
  )
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function useAssistant() {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant moet binnen <AssistantProvider> gebruikt worden.')
  return ctx
}

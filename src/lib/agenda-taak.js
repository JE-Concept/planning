import { isPipelineList } from './pipeline'
import { addDays, fromDateInput, startOfDay, toDateInput } from './dates'

/**
 * Van een besproken agendapunt naar een taak.
 *
 * Wat er op een overleg besproken wordt, gebeurt pas wanneer het ergens staat
 * met een naam en een datum erbij. Tot nu toe eindigde een punt bij "Besproken"
 * en verdween het in de lijst van afgehandelde punten — de helft van wat er
 * afgesproken werd, werd nergens anders opgeschreven.
 *
 * Het rekenwerk staat hier los van het scherm, want dit is precies het soort
 * ding dat stil scheefgaat: een taak op het verkeerde bord, zonder status of
 * met een deadline die een dag verschoof.
 */

/** Hoeveel dagen een actiepunt standaard krijgt. Een week: het volgende overleg. */
export const STANDAARD_TERMIJN = 7

/**
 * Het bord waar een actiepunt op hoort.
 *
 * Niet de eventlijst: daar staan dossiers met een pijplijn van aanvraag tot
 * factuur, en "prijzen verhuurmateriaal herzien" is geen dossier. Wel de
 * takenlijst — dezelfde waar de verslagen van het overleg en hun actiepunten
 * al op landen, zodat alles van een overleg bij elkaar staat.
 *
 * Er staat geen id hardgecodeerd: lijsten worden hernoemd en opnieuw
 * aangemaakt, en een id in code is een stille storing zodra dat gebeurt.
 */
export function kiesTakenlijst(lijsten) {
  const bruikbaar = (lijsten ?? []).filter((l) => l && !l.archived && l.kind !== 'social')
  return (
    bruikbaar.find((l) => l.kind === 'tasks' && !isPipelineList(l)) ??
    bruikbaar.find((l) => !isPipelineList(l)) ??
    bruikbaar[0] ??
    null
  )
}

/**
 * De kolom waarin een nieuw actiepunt begint: de eerste die "open" betekent.
 *
 * Valt terug op de eerste kolom van het bord. Een taak zonder status komt op
 * geen enkel bord terecht, en dat is precies hoe werk verdwijnt.
 */
export function beginstatus(lijst) {
  const statussen = [...(lijst?.statuses ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return statussen.find((s) => s.kind === 'open') ?? statussen[0] ?? null
}

/** De deadline die het scherm voorstelt: over een week, als dag zonder tijd. */
export function standaardDeadline(nu = new Date()) {
  return toDateInput(addDays(startOfDay(nu), STANDAARD_TERMIJN))
}

/**
 * De taak zoals ze weggeschreven wordt.
 *
 * De titel komt van het punt en de omschrijving eronder blijft staan: wie de
 * taak drie weken later opent, wil kunnen lezen waarover het ging zonder het
 * verslag erbij te zoeken. `agendaItemId` houdt de twee aan elkaar, zodat een
 * punt niet per ongeluk twee taken oplevert.
 *
 * De deadline gaat door `fromDateInput()`: een dag zonder tijd wordt het midden
 * van die dag bewaard, anders schuift hij in Brussel een dag terug.
 */
export function taakUitAgendapunt({ item, lijst, status, titel, eigenaar, deadline }) {
  if (!item || !lijst) return null

  const naam = (titel ?? item.titel ?? '').trim()
  if (!naam) return null

  const omschrijving = (item.omschrijving ?? '').trim()

  return {
    list: lijst,
    status,
    title: naam,
    description: omschrijving
      ? `${omschrijving}\n\n— uit het agendapunt van het teamoverleg`
      : 'Uit het agendapunt van het teamoverleg.',
    assignees: eigenaar ? [eigenaar] : [],
    dueDate: fromDateInput(deadline),
    agendaItemId: item.id,
    meetingId: item.meetingId ?? null,
  }
}

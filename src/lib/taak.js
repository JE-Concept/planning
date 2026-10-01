/**
 * Wat een taak is, los van waar ze vandaan komt.
 *
 * Stond in `@data/events`, en dat betekende dat elk scherm dat alleen wilde
 * weten of een taak af is, de hele Firebase-SDK meesleepte. Voor de
 * eventkaarten — die ook op de klantenpagina's getekend worden — is dat het
 * verschil tussen een halve megabyte en niets.
 *
 * `@data/events` geeft dit door, zodat de tientallen bestanden die het al
 * importeren niets hoeven te veranderen.
 */

/**
 * Of een taak af is.
 *
 * `open === false` en niet `!open`: een taak waarvan het veld ontbreekt — en
 * die zijn er, uit de migratie — is niet afgerond maar onbekend, en die hoort
 * open te staan tot iemand haar afvinkt.
 */
export function isDone(task) {
  return task?.open === false
}

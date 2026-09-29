/**
 * De Nederlandse teksten — de bron.
 *
 * Eén platte lijst met puntjes in de sleutel in plaats van geneste objecten. Dat
 * leest minder mooi maar zoekt beter: `grep 'nav.tasks'` vindt de tekst en het
 * gebruik ervan in één keer, en dat is wat je doet wanneer je iets wil wijzigen.
 *
 * De sleutel zegt waar het staat, niet wat er staat. `alg.opslaan` blijft kloppen
 * wanneer de knop ooit "Bewaren" gaat heten; `alg.bewaren` niet.
 *
 * Meervoud: zet naast `x` ook `x_een` en `x_meer`, en geef `aantal` mee.
 */
export const nl = {
  // ── Algemeen ─────────────────────────────────────────────────────────────
  'alg.opslaan': 'Bewaren',
  'alg.annuleren': 'Annuleren',
  'alg.sluiten': 'Sluiten',
  'alg.verwijderen': 'Verwijderen',
  'alg.archiveren': 'Archiveren',
  'alg.toevoegen': 'Toevoegen',
  'alg.aanmaken': 'Aanmaken',
  'alg.aanpassen': 'Aanpassen',
  'alg.zoeken': 'Zoeken',
  'alg.laden': 'Even geduld…',
  'alg.herladen': 'Herladen',
  'alg.opnieuw': 'Opnieuw proberen',
  'alg.vandaag': 'Vandaag',
  'alg.morgen': 'Morgen',
  'alg.gisteren': 'Gisteren',
  'alg.niemand': 'Niemand',
  'alg.geen': 'Geen',
  'alg.alles': 'Alles',
  'alg.taak_een': '{aantal} taak',
  'alg.taak_meer': '{aantal} taken',
  'alg.persoon_een': '{aantal} persoon',
  'alg.persoon_meer': '{aantal} personen',
  'alg.dag_een': '{aantal} dag',
  'alg.dag_meer': '{aantal} dagen',

  // ── Navigatie ────────────────────────────────────────────────────────────
  'nav.hoofdnavigatie': 'Hoofdnavigatie',
  'nav.dashboard': 'Dashboard',
  'nav.events': 'Events',
  'nav.bord': 'Bord',
  'nav.kalender': 'Kalender',
  'nav.klanten': 'Klanten',
  'nav.socials': 'Socials',
  'nav.tasks': 'Tasks',
  'nav.werklast': 'Werklast',
  'nav.goals': 'Goals',
  'nav.bistro': 'Bistro',
  'nav.openensluiten': 'Openen & sluiten',
  'nav.registraties': 'Registraties',
  'nav.team': 'Team',
  'nav.teamoverleg': 'Teamoverleg',
  'nav.rooster': 'Rooster',
  'nav.uren': 'Uren',
  'nav.instellingen': 'Instellingen',
  'nav.meer': 'Meer',

  // ── De schil ─────────────────────────────────────────────────────────────
  'schil.werkruimte_laadt': 'Werkruimte laden…',
  'schil.laadt_niet_titel': 'De werkruimte laadt niet',
  'schil.laadt_niet_tekst':
    'Er ging iets mis bij het ophalen van de lijsten en de mensen. Herlaad de pagina; blijft het staan, geef dan deze melding door: {fout}',
  'schil.duurt_te_lang_titel': 'Dit duurt te lang',
  'schil.duurt_te_lang_tekst':
    'De gegevens die op dit toestel bewaard zijn, antwoorden niet. Opnieuw beginnen lost het op — er gaat niets verloren, want alles staat ook online.',
  'schil.opnieuw_beginnen': 'Opnieuw beginnen',
  'schil.nieuwe_versie': 'Er staat een nieuwe versie van JE Plan klaar.',
  'schil.assistent': 'Assistent',
  'schil.afmelden': 'Afmelden',

  // ── Timer ────────────────────────────────────────────────────────────────
  'timer.titel': 'Timer',
  'timer.start': 'Start',
  'timer.starten': 'Timer starten',
  'timer.stoppen': 'Timer stoppen',
  'timer.stop_en_boek': 'Stop en boek',
  'timer.losse_tijd': 'Losse tijd',
  'timer.leeg': 'Start een timer vanaf een taak, of boek tijd op een kostenplaats.',
  'timer.week_geboekt': 'Deze week geboekt: {tijd}',
  'timer.gestopt': 'Gestopt — {tijd} geboekt.',
  'timer.te_kort': 'Te kort, niets geboekt.',
  'timer.loopt': 'Timer loopt.',
  'timer.waaraan': 'Waaraan werk je',
  'timer.waaraan_hint': 'Zonder omschrijving is een boeking achteraf niet te plaatsen.',
  'timer.factureerbaar': 'Factureerbaar',
  'timer.naar_de_klant': 'Naar de klant',
  'timer.intern_standaard': 'Losse tijd staat standaard op intern.',

  // ── Aanmelden ────────────────────────────────────────────────────────────
  'login.aanmelden': 'Aanmelden',
  'login.met_google': 'Aanmelden met Google',
  'login.ander_account': 'Met een ander account aanmelden',
  'login.geen_toegang': '{wie} heeft geen toegang. Vraag een beheerder om een uitnodiging.',
  'login.dit_account': 'Dit account',
  'login.enkel_voor': 'Enkel voor @jeconcept.be en @kenjeklanten.be, of op uitnodiging.',
  'login.technische_melding': 'Technische melding',
  'login.niet_ingesteld':
    'De Firebase-configuratie ontbreekt in deze build. Zet de VITE_FIREBASE_* variabelen en deploy opnieuw.',
  'login.vastgelopen':
    'JE Plan krijgt geen antwoord van de opgeslagen gegevens op dit toestel. Dat gebeurt als een eerder tabblad niet netjes afgesloten werd. Opnieuw beginnen lost het op — er gaat niets verloren.',

  // ── Taal ─────────────────────────────────────────────────────────────────
  'taal.titel': 'Taal',
  'taal.kiezen': 'Taal kiezen',
  'taal.uitleg': 'Geldt voor jou, op al je toestellen.',

  // ── Accountmenu ──────────────────────────────────────────────────────────
  'menu.installeren': 'Installeren op dit toestel',
  'menu.welke_meldingen': 'Welke meldingen ik krijg',
  'menu.push_aanzetten': 'Meldingen aanzetten',
  'menu.push_uitzetten': 'Meldingen uitzetten',
  'menu.push_aan': 'Meldingen staan aan op dit toestel.',
  'menu.push_uit': 'Meldingen staan uit op dit toestel.',
  'menu.push_geblokkeerd': 'De browser blokkeert meldingen. Zet ze aan bij de site-instellingen.',
  'menu.push_geblokkeerd_kort': 'De browser blokkeert meldingen voor deze site.',
  'menu.push_niet_ingesteld': 'Meldingen zijn nog niet ingesteld voor deze installatie.',
  'menu.push_niet_ingesteld_kort': 'Nog niet ingesteld voor deze installatie.',
  'menu.push_mislukt': 'Meldingen lukken niet op dit toestel.',
  'menu.meer': 'Meer',
  'menu.sneltoetsen': 'Sneltoetsen',

  // ── Rollen ───────────────────────────────────────────────────────────────
  'rol.owner': 'Eigenaar',
  'rol.admin': 'Beheerder',
  'rol.member': 'Lid',
  'rol.staff': 'Personeel',
  'rol.guest': 'Gast',
}

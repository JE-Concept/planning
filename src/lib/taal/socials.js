/**
 * De teksten van de socials: de contentkalender, de posts en hun review.
 *
 * De kanalen staan er niet in. Instagram, Facebook en TikTok heten overal zo,
 * en "Socials", "Caption", "Preview" en "Review" zegt dit team ook in het
 * Nederlands — die vertalen zou het scherm onherkenbaar maken voor wie er
 * dagelijks op werkt.
 *
 * De standen van het eventbord ("Social content ready" en de twee andere)
 * komen uit de kolommen van de database en blijven daarom staan zoals ze daar
 * staan.
 */
export default {

  // ── De pagina ──────────────────────────────────────────────────────────
  'social.kop.events': { nl: 'Events met social content', en: 'Events with social content' },
  'social.kop.week': {
    nl: '{aantal} posts in week {week} · {van} – {tot}',
    en: '{aantal} posts in week {week} · {van} – {tot}',
  },
  'social.kop.maand': { nl: '{aantal} posts in {maand}', en: '{aantal} posts in {maand}' },
  'social.tab.week': { nl: 'Week', en: 'Week' },
  'social.tab.posts': { nl: 'Posts', en: 'Posts' },

  'social.week.vorige': { nl: 'Vorige week', en: 'Previous week' },
  'social.week.deze': { nl: 'Deze week', en: 'This week' },
  'social.week.volgende': { nl: 'Volgende week', en: 'Next week' },
  'social.maand.vorige': { nl: 'Vorige maand', en: 'Previous month' },
  'social.maand.volgende': { nl: 'Volgende maand', en: 'Next month' },
  'social.post.nieuw': { nl: 'Post', en: 'Post' },
  'social.post.toevoegen_op': { nl: 'Post toevoegen op {dag}', en: 'Add a post on {dag}' },
  'social.post.toevoegen_op_kanaal': {
    nl: 'Post toevoegen op {dag} voor {kanaal}',
    en: 'Add a post on {dag} for {kanaal}',
  },

  // ── Filters ────────────────────────────────────────────────────────────
  'social.filter.project': { nl: 'Filter op project', en: 'Filter by project' },
  'social.filter.alle_projecten': { nl: 'Alle projecten', en: 'All projects' },
  'social.filter.wacht_op_review': { nl: 'Wacht op review ({aantal})', en: 'Waiting for review ({aantal})' },
  'social.filter.alles_tonen': { nl: 'Alles tonen', en: 'Show everything' },

  // ── De kalender ────────────────────────────────────────────────────────
  'social.geen_merk': {
    nl: 'Maak eerst een concept aan bij Instellingen.',
    en: 'Create a concept under Settings first.',
  },
  'social.in_te_plannen': { nl: 'Nog in te plannen ({aantal})', en: 'Still to schedule ({aantal})' },
  'social.onderwerp.plaatshouder': { nl: 'Onderwerp toevoegen…', en: 'Add a subject…' },
  'social.onderwerp.label': { nl: 'Onderwerp toevoegen', en: 'Add a subject' },
  'social.onderwerp.enter': { nl: 'Enter zet het bij {wie}', en: 'Enter hands it to {wie}' },
  'social.onderwerp.enter_niemand': {
    nl: 'Enter zet het bij niemand',
    en: 'Enter hands it to nobody',
  },
  'social.alles_ingepland': { nl: 'Alles staat ingepland.', en: 'Everything is scheduled.' },
  'social.posts.leeg.titel': { nl: 'Nog geen posts deze maand', en: 'No posts this month yet' },
  'social.posts.leeg.tekst': { nl: 'Voeg er een toe in de kalender.', en: 'Add one on the calendar.' },

  // ── De standen van een post ────────────────────────────────────────────

  // ── De kaart ───────────────────────────────────────────────────────────
  'social.kaart.label': { nl: '{titel} — {status}', en: '{titel} — {status}' },
  'social.kaart.label_kanalen': {
    nl: '{titel} — {status} — {kanalen}',
    en: '{titel} — {status} — {kanalen}',
  },
  'social.kaart.publicatiedatum': { nl: 'Publicatiedatum', en: 'Publication date' },
  'social.kaart.van_event': {
    nl: 'Overgenomen van het event — nog geen eigen publicatiedatum',
    en: 'Taken from the event — no publication date of its own yet',
  },

  // ── De post ────────────────────────────────────────────────────────────
  'social.post.geen_datum_klein': { nl: 'nog geen publicatiedatum', en: 'no publication date yet' },
  'social.post.bekijk_publicatie': { nl: 'Bekijk de publicatie', en: 'View the post online' },
  'social.post.niet_gepubliceerd': { nl: 'Nog niet gepubliceerd', en: 'Not published yet' },
  'social.post.verwijder_vraag': { nl: 'Deze post verwijderen?', en: 'Delete this post?' },
  'social.veld.titel': { nl: 'Titel', en: 'Title' },
  'social.veld.merk': { nl: 'Concept', en: 'Concept' },
  'social.veld.status': { nl: 'Status', en: 'Status' },
  'social.veld.publiceren_op': { nl: 'Publiceren op', en: 'Publish on' },
  'social.veld.publiceren_op_hint': {
    nl: 'Overgenomen van het event. Pas aan voor een eigen publicatiemoment.',
    en: 'Taken from the event. Change it to give the post its own moment.',
  },
  'social.veld.verantwoordelijke': { nl: 'Verantwoordelijke', en: 'Responsible' },
  'social.veld.kanalen': { nl: 'Kanalen', en: 'Channels' },
  'social.veld.ontwerp_link': { nl: 'Link naar het ontwerp', en: 'Link to the design' },
  'social.veld.ontwerp_openen': { nl: 'Ontwerp openen', en: 'Open the design' },
  'social.veld.caption': { nl: 'Caption', en: 'Caption' },
  'social.veld.hashtags': { nl: 'Hashtags', en: 'Hashtags' },
  'social.veld.publicatie_link': { nl: 'Link naar de publicatie', en: 'Link to the published post' },
  'social.veld.notities': { nl: 'Interne notities', en: 'Internal notes' },
  'social.caption.tekens': { nl: '{aantal} tekens', en: '{aantal} characters' },
  'social.caption.te_lang': {
    nl: '{aantal} tekens — te lang voor {kanaal} (max {max})',
    en: '{aantal} characters — too long for {kanaal} (max {max})',
  },
  'social.caption.plaatshouder': {
    nl: 'De tekst zoals hij online komt…',
    en: 'The text the way it goes online…',
  },

  // ── Feedback op een post ───────────────────────────────────────────────
  'social.feedback.kop': { nl: 'Feedback ({aantal})', en: 'Feedback ({aantal})' },
  'social.feedback.plaatshouder': { nl: 'Feedback geven…', en: 'Give feedback…' },
  'social.feedback.plaatsen': { nl: 'Plaatsen', en: 'Post' },
  'social.feedback.verwijderen': { nl: 'Reactie verwijderen', en: 'Delete comment' },
  'social.feedback.verwijder_vraag': { nl: 'Reactie verwijderen?', en: 'Delete this comment?' },

  // ── De preview ─────────────────────────────────────────────────────────
  'social.preview.kop': { nl: 'Preview', en: 'Preview' },
  'social.preview.voorbeeld_voor': { nl: 'Voorbeeld voor {kanaal}', en: 'Preview for {kanaal}' },
  'social.preview.geen_tekst': { nl: 'Nog geen tekst.', en: 'No text yet.' },
  'social.preview.gaat_online': { nl: 'Gaat online op {datum}', en: 'Goes online on {datum}' },
  'social.preview.gaat_online_van_event': {
    nl: 'Gaat online op {datum} — overgenomen van het event',
    en: 'Goes online on {datum} — taken from the event',
  },
  'social.preview.geen_datum': { nl: 'Nog geen publicatiedatum', en: 'No publication date yet' },
  'social.preview.beeld': { nl: 'Beeld {verhouding}', en: 'Image {verhouding}' },
  'social.preview.tekens': { nl: ' · {aantal}/{max} tekens', en: ' · {aantal}/{max} characters' },
  'social.preview.hashtags': { nl: ' · {aantal}/{max} hashtags', en: ' · {aantal}/{max} hashtags' },
  'social.preview.te_lang': {
    nl: 'De tekst is te lang voor {kanaal}; wat erboven staat valt weg.',
    en: 'The text is too long for {kanaal}; whatever runs over is cut off.',
  },
  'social.preview.te_veel_tags': {
    nl: '{kanaal} plaatst er maar {max}; de rest verdwijnt.',
    en: '{kanaal} only takes {max}; the rest is dropped.',
  },

  // ── Tijd op een post ───────────────────────────────────────────────────
  'social.tijd.kop': { nl: 'Tijd', en: 'Time' },
  'social.tijd.aan_event': {
    nl: 'De tijd komt op het event te staan waar deze post aan hangt.',
    en: 'The time lands on the event this post hangs from.',
  },
  'social.tijd.op_merk': {
    nl: 'Deze post hangt niet aan een event; de tijd wordt geboekt op het concept.',
    en: 'This post hangs from no event; the time is logged against the concept.',
  },

  // ── Het project onder een post ─────────────────────────────────────────
  'social.project.kop': { nl: 'Project', en: 'Project' },
  'social.project.gekoppeld': { nl: 'Gekoppeld project', en: 'Linked project' },
  'social.project.wijzigen': { nl: 'Wijzigen', en: 'Change' },
  'social.project.losmaken': { nl: 'Losmaken', en: 'Unlink' },
  'social.project.koppelen': { nl: 'Aan een project hangen', en: 'Hang it on a project' },
  'social.project.zoek_plaatshouder': { nl: 'Zoek een taak…', en: 'Search for a task…' },
  'social.project.zoek_label': { nl: 'Zoek een project', en: 'Search for a project' },
  'social.project.geen_taken': { nl: 'Geen open taken gevonden.', en: 'No open tasks found.' },

  // ── De review ──────────────────────────────────────────────────────────
  'social.review.kop': { nl: 'Review', en: 'Review' },
  'social.review.gevraagd': { nl: 'Review gevraagd', en: 'Review asked' },
  'social.review.ronde': { nl: 'ronde {aantal}', en: 'round {aantal}' },
  'social.review.door': { nl: 'Nakijken door', en: 'Checked by' },
  'social.review.wie_dan_ook': { nl: 'Wie dan ook', en: 'Anyone' },
  'social.review.notitie_plaatshouder': {
    nl: 'Wat moet de ontwerper weten?',
    en: 'What does the designer need to know?',
  },
  'social.review.vragen': { nl: 'Review vragen', en: 'Ask for review' },
  'social.review.goedkeuren': { nl: 'Goedkeuren', en: 'Approve' },
  'social.review.aanpassing_vragen': { nl: 'Aanpassing vragen', en: 'Ask for changes' },
  'social.review.bezig': { nl: 'Bezig…', en: 'Working…' },
  'social.review.wacht_op': { nl: 'Wacht op {wie}', en: 'Waiting for {wie}' },
  'social.review.wacht_op_sinds': { nl: 'Wacht op {wie} sinds {sinds}', en: 'Waiting for {wie} since {sinds}' },
  'social.review.beslissingen': { nl: 'Beslissingen', en: 'Decisions' },

  // ── Het eventbord ──────────────────────────────────────────────────────
  'social.bord.los_plaatshouder': { nl: 'Los socialwerk, zonder event', en: 'Loose social work, without an event' },
  'social.bord.nieuwe_taak': { nl: 'Nieuwe socialtaak', en: 'New social task' },
  'social.bord.leeg.titel': { nl: 'Nog geen social content', en: 'No social content yet' },
  'social.bord.leeg.tekst': {
    nl: 'Een event komt hier vanzelf op te staan zodra het op “ready to invoice” komt. Eerder kan ook: zet het aan in het event zelf. Werk dat los van een event staat, voeg je hier toe.',
    en: 'An event turns up here by itself once it reaches “ready to invoice”. Sooner works too: switch it on in the event. Work that stands apart from an event, you add here.',
  },
  'social.bord.sleep_hier': { nl: 'Sleep hier een event naartoe', en: 'Drag an event over here' },
  // Opruimen: van het socialbord af, niet van het eventbord. Zie `isSociaalGearchiveerd`.
  'social.bord.opruimen': { nl: 'Voorbij en gepost archiveren ({aantal})', en: 'Archive past and posted ({aantal})' },
  'social.bord.opruimen_vraag': {
    nl: '{aantal} kaarten van events vóór vandaag of al gepost van het socialbord halen? Het event zelf blijft staan, en je zet ze terug vanuit het archief.',
    en: 'Remove {aantal} cards for events before today or already posted from the social board? The event itself stays, and you can restore them from the archive.',
  },
  'social.bord.archief': { nl: 'Archief ({aantal})', en: 'Archive ({aantal})' },
  'social.bord.archief_uitleg': {
    nl: 'Gearchiveerd van het socialbord. Sleep een kaart naar een kolom om ze terug te zetten.',
    en: 'Archived from the social board. Drag a card to a column to restore it.',
  },
  'social.bord.archief_leeg': { nl: 'Het archief is leeg', en: 'The archive is empty' },
  'social.bord.opgeruimd': { nl: 'Alles is opgeruimd', en: 'Everything is cleared' },
  'social.bord.opgeruimd_tekst': {
    nl: 'Wat voorbij of gepost was, staat in het archief. Nieuwe events komen hier vanzelf op.',
    en: 'What was past or posted is in the archive. New events turn up here by themselves.',
  },
  'social.bord.alles_terug': { nl: 'Alles terugzetten', en: 'Restore all' },
  'social.bord.alles_terug_vraag': {
    nl: '{aantal} kaarten terug op het socialbord zetten?',
    en: 'Put {aantal} cards back on the social board?',
  },
  'social.bord.gearchiveerd': { nl: '{aantal} kaarten gearchiveerd', en: '{aantal} cards archived' },
  'social.bord.teruggezet': { nl: '{aantal} kaarten teruggezet', en: '{aantal} cards restored' },

  // ── Het event zoals de socialrol het opent ─────────────────────────────
  'social.event.geen_naam': { nl: 'Event zonder naam', en: 'Event without a name' },
  'social.event.stand': { nl: 'Stand van de content', en: 'Content stage' },
  'social.event.posts': { nl: 'Posts van dit event', en: 'Posts for this event' },
  'social.event.geen_posts': {
    nl: 'Nog geen post voor dit event.',
    en: 'No post for this event yet.',
  },
  'social.event.weg': { nl: 'Dit event staat niet meer op het bord', en: 'This event is no longer on the board' },
  'social.event.weg_uitleg': {
    nl: 'Het is gearchiveerd, of er hoeft geen content meer van te komen.',
    en: 'It has been archived, or no content is expected from it any more.',
  },
}

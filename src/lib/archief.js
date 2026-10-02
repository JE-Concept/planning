/**
 * Wanneer een event van het bord af is — maar alleen het getal.
 *
 * De regel zelf staat niet meer hier. Ze stond vroeger in de browser, en dus
 * moest die eerst élk event ophalen — ook het trouwfeest van twee jaar geleden
 * — om er daarna de helft van te verbergen. Dat werkt bij tachtig events en
 * niet bij vijfhonderd: een tragere start, meer geheugen op een telefoon, en
 * Firestore rekent per gelezen document, elke keer dat iemand de app opent.
 *
 * Nu beslist de server het en schrijft hij het antwoord op het document
 * (`afgesloten`, `afgeslotenJaar`); de app vraagt alleen nog wat er níét op
 * staat. De regel staat voluit, met de redenering erbij, in
 * `functions/archief-stand.js`.
 *
 * Wat hier overblijft is het getal dat het scherm uitspreekt: "events die meer
 * dan zestig dagen geleden afgerond zijn". Dat hoort hetzelfde getal te zijn
 * als waar de server mee rekent, anders staat er een zin op het scherm die
 * niet klopt — `tests/archief.test.js` bewaakt dat.
 *
 * Archiveren is alleen een kwestie van waar iets getoond wordt. Er wordt niets
 * verplaatst en zeker niets gewist: een event draagt offertebedragen en
 * facturatiegegevens, en die horen te blijven bestaan, ook als niemand ze nog
 * nodig heeft.
 */

export const ARCHIEF_NA_DAGEN = 60

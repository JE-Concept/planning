# De assistent en het samenvatten van een overleg aanzetten

Twee onderdelen van JE Plan praten met Claude:

- **de assistent** in de rechterkolom, die vragen over de planning beantwoordt en
  taken kan aanmaken of verzetten;
- **Transcript samenvatten** bij Teamoverleg, dat van een uitgeschreven overleg
  een verslag met actiepunten maakt.

De code ervoor staat er al, in `functions-meetings/`. Ze wordt alleen niet
uitgerold zolang de Claude-sleutel ontbreekt — en dat is met opzet.

## Waarom ze apart staan

Een functions-uitrol faalt in zijn geheel op een ontbrekend geheim. Stonden deze
twee bij de andere functies, dan zou een ontbrekende sleutel ook `ensureProfile`
meeslepen, en dan kan niemand meer inloggen. Dat is één keer gebeurd; sindsdien
staan ze in een eigen codebase die overgeslagen mag worden.

Het gevolg is wel dat de knoppen in het scherm staan terwijl er nog niets achter
zit. De app zegt dat nu met zoveel woorden in plaats van "internal" — dat laatste
leest als een fout in de applicatie, terwijl er alleen iets niet ingesteld is.

## Stap 1 — een sleutel maken

1. Ga naar de [Anthropic Console](https://console.anthropic.com/settings/keys).
2. **Create key**. Geef hem een naam waaraan je later ziet waar hij vandaan komt,
   bijvoorbeeld `je-plan-productie`.
3. Kopieer de waarde. Ze begint met `sk-ant-` en is maar één keer te zien.

Zet een verbruikslimiet op de organisatie als die er nog niet is
(Console → Settings → Limits). Deze twee functies zijn zuinig — een samenvatting
kost een paar cent — maar een limiet is goedkoper dan een verrassing.

## Stap 2 — de sleutel bij het project zetten

De sleutel gaat naar Secret Manager van het Firebase-project, niet naar GitHub:
alleen de functies hebben hem nodig.

Met de Firebase CLI, op een machine waar je aangemeld bent:

```
firebase functions:secrets:set ANTHROPIC_API_KEY --project je-planning
```

De opdracht vraagt om de waarde. Plak de sleutel en bevestig.

Zonder terminal kan het ook via de Google Cloud console:
**Security → Secret Manager → Create secret**, met als naam exact
`ANTHROPIC_API_KEY` en de sleutel als waarde. Zet je hem later opnieuw, dan wordt
dat een nieuwe versie van hetzelfde geheim.

## Stap 3 — opnieuw uitrollen

De uitrol kijkt of het geheim bestaat. Bestaat het, dan worden de overlegfuncties
meegenomen; bestaat het niet, dan slaat hij ze over met een waarschuwing en gaat
de rest gewoon live.

Draai de go-live workflow, of push naar `main`. In het logboek van de uitrol staat
daarna ofwel de uitrol van `functions:meetings`, ofwel de regel *"Geheim
ANTHROPIC_API_KEY bestaat niet — overlegfuncties overgeslagen."*

## Stap 4 — nakijken

1. Open JE Plan en klik rechtsboven op **Assistent**.
2. Vraag: *Wat moet ik vandaag doen?*
3. Komt er antwoord, dan staat het goed. Staat er "De assistent is nog niet
   uitgerold", dan is stap 2 of 3 nog niet gebeurd.

Voor het samenvatten: Teamoverleg → **Transcript samenvatten**, plak een
uitgeschreven overleg van minstens tweehonderd tekens en kies een datum.

## Wat het doet, en wat niet

De assistent voert zijn acties niet zelf uit op de server. Het scherm doet dat,
onder jouw naam en langs dezelfde Firestore-regels als wanneer je het zelf
aanklikt. Een taak die de assistent aanmaakt kan dus nooit meer dan jij zelf mag.

Het transcript gaat naar Anthropic om samengevat te worden. Wil je dat voor een
bepaald overleg niet, gebruik de samenvatting dan niet en typ het verslag zelf.

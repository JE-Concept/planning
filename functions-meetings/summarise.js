import Anthropic from '@anthropic-ai/sdk'

/**
 * Van transcript naar samenvatting en actiepunten.
 *
 * Het model levert één vaste JSON-vorm, afgedwongen met structured outputs.
 * Zonder dat schema wordt elke variatie in de uitvoer hier een parseerfout, en
 * een overleg dat stil mislukt is erger dan geen samenvatting.
 *
 * Wat het niet doet: beslissen wie iets moet doen. Het model stelt een naam
 * voor uit wat er gezegd is; de koppeling naar een echt profiel gebeurt hier,
 * en wat niet eenduidig matcht blijft zonder toewijzing. Een actiepunt bij de
 * verkeerde persoon verdwijnt uit het zicht van wie het wél moest doen.
 */

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['titel', 'samenvatting', 'deelnemers', 'actiepunten'],
  properties: {
    titel: { type: 'string', description: 'Kort onderwerp van het overleg, zonder datum.' },
    samenvatting: {
      type: 'array',
      description: 'De besproken punten, elk met het onderwerp vooraan.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['onderwerp', 'tekst'],
        properties: {
          onderwerp: { type: 'string' },
          tekst: { type: 'string' },
        },
      },
    },
    deelnemers: {
      type: 'array',
      description: 'Wie er aan het woord is geweest, zoals ze in het transcript staan.',
      items: { type: 'string' },
    },
    actiepunten: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['taak', 'verantwoordelijke'],
        properties: {
          taak: { type: 'string', description: 'Eén concrete actie, beginnend met een werkwoord.' },
          verantwoordelijke: { type: 'string', description: 'De naam zoals genoemd, of "onbekend".' },
          vervaldatum: { type: 'string', description: 'JJJJ-MM-DD, of leeg als er niets is afgesproken.' },
        },
      },
    },
  },
}

const SYSTEM = `Je vat teamoverleg samen voor JE Concept, een Belgisch events- en horecabedrijf.

Schrijf in het Nederlands. Wees zakelijk en kort: wie iets zei doet er minder toe
dan wat er beslist is.

Voor de samenvatting: één punt per onderwerp dat echt besproken is. Geen
inleiding, geen herhaling van het vorige punt, en niets dat niet in het
transcript staat.

Voor de actiepunten: alleen wat iemand daadwerkelijk op zich nam of kreeg
toegewezen. Een losse suggestie is geen actiepunt. Schrijf ze als opdracht, niet
als verslag. Staat er geen verantwoordelijke of geen datum, laat het dan leeg —
een gegokte naam is erger dan geen naam.`

export async function summariseTranscript({ apiKey, transcript, datum }) {
  const client = new Anthropic({ apiKey })

  // Streamen omdat een transcript lang is en een gewone aanroep dan tegen de
  // HTTP-timeout van de SDK loopt.
  const stream = client.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      { role: 'user', content: `Overleg van ${datum}. Hieronder het transcript.\n\n${transcript}` },
    ],
  })

  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') {
    throw new Error(
      `Het model weigerde deze samenvatting (${message.stop_details?.category ?? 'onbekend'}).`
    )
  }

  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Het model gaf geen samenvatting terug.')

  return JSON.parse(text)
}

import Anthropic from '@anthropic-ai/sdk'

/**
 * De assistent: één beurt van het model.
 *
 * De functie voert zelf niets uit in de planning. Ze geeft het model de vraag,
 * het gesprek en de beschrijving van de tools, en stuurt het antwoord terug —
 * tekst, of een verzoek om een tool te gebruiken. De app voert die tool uit
 * met de rechten van wie aan het typen is, en komt terug met het resultaat.
 *
 * Zo kan de assistent nooit meer dan de persoon zelf: de Firestore-regels
 * gelden voor elke actie, en een fout in een prompt kan geen beheerdersrechten
 * opleveren die de functie toevallig had.
 */

export const MODEL = 'claude-opus-5'

const MAX_TOOLS = 12
const MAX_MESSAGES = 40
const MAX_SYSTEM = 60_000

/** Alleen wat het model mag zien: naam, beschrijving, schema. */
function cleanTools(tools = []) {
  return tools.slice(0, MAX_TOOLS).map((t) => ({
    name: String(t.name).slice(0, 64),
    description: String(t.description ?? '').slice(0, 1000),
    input_schema: t.input_schema ?? { type: 'object', properties: {} },
  }))
}

/** Rollen en inhoud zoals de API ze verwacht; de rest valt weg. */
function cleanMessages(messages = []) {
  return messages
    .slice(-MAX_MESSAGES)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: m.content }))
}

export async function assistantTurn({ apiKey, system, messages, tools }) {
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: String(system ?? '').slice(0, MAX_SYSTEM),
    tools: cleanTools(tools),
    messages: cleanMessages(messages),
  })
  return {
    content: response.content,
    stop_reason: response.stop_reason,
  }
}

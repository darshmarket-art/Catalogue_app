/**
 * Reads a jewellery photo and lists its stones (groups, counts, rough sizes) with a Gemini model on Vertex AI, for the detail sheet.
 * Same credentials as aiRender.ts. The numbers are estimates: the photo has no scale, so sizes are judged from the piece itself.
 */
import { googleToken, projectId } from './cloudStats';
import { cleanSpec, type StoneSpec } from '../shared/stoneSpec';

export const specPrompt = (hint: { title?: string; category?: string; grossWt?: number }) =>
  'You are a jewellery gemmologist reading ONE product photograph. List the diamonds or other stones you can see, as groups, for a trade catalogue sheet. ' +
  (hint.title || hint.category ? `The design is called "${hint.title ?? ''}" in the "${hint.category ?? ''}" collection${hint.grossWt ? `, and weighs about ${hint.grossWt} g in total` : ''}. ` : '') +
  'For each group give: a short name saying where the stones are, the setting (Pavé, Micro-pavé, Prong, Bezel, Channel, Cluster, Flush), the shape, the number of stones as a minimum and maximum ' +
  '(an exact count when you can count them, a range when they are too small or dense to count), and the diameter of ONE stone in millimetres as a minimum and maximum. ' +
  'There is no scale in the photo, so judge size from the piece itself: use visible parts such as chain links, jump rings, prongs and the overall proportions of this type of jewellery ' +
  '(a pendant is about 20 to 35 mm tall, a ring band about 3 to 6 mm wide, a stud or drop earring about 10 to 25 mm). Tiny pavé stones are usually 1.0 to 1.5 mm. Be honest: widen the ranges when unsure. ' +
  'Count only stones you can see; do not guess at the back. Ignore the gold, enamel and any text. Also give the piece type, the metal colours (for example "Yellow gold with white gold stone settings") ' +
  'and up to 5 short design features (for example "Peacock feather motif", "Matte-finish leaf", "Curved pavé band"). If there are no stones, return no groups.';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    pieceType: { type: 'STRING' },
    metal: { type: 'STRING' },
    features: { type: 'ARRAY', items: { type: 'STRING' } },
    groups: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, setting: { type: 'STRING' }, shape: { type: 'STRING' },
          countMin: { type: 'INTEGER' }, countMax: { type: 'INTEGER' }, mmMin: { type: 'NUMBER' }, mmMax: { type: 'NUMBER' }
        },
        required: ['name', 'setting', 'shape', 'countMin', 'countMax', 'mmMin', 'mmMax']
      }
    }
  },
  required: ['pieceType', 'metal', 'features', 'groups']
};

/** Sends the photo and returns the cleaned stone spec. Throws an Error with a short, safe message on any failure. */
export async function analyseStones(image: Buffer, mimeType: string, hint: Parameters<typeof specPrompt>[0] = {}): Promise<StoneSpec> {
  const model = process.env.AI_SPEC_MODEL || 'gemini-2.5-flash';
  const loc = process.env.AI_SPEC_LOCATION || process.env.AI_RENDER_LOCATION || 'global';
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
  const res = await fetch(`https://${host}/v1/projects/${await projectId()}/locations/${loc}/publishers/google/models/${model}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: image.toString('base64') } }, { text: specPrompt(hint) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
    }),
    signal: AbortSignal.timeout(60_000)
  });
  if (res.status === 401 || res.status === 403) throw new Error('the server is not allowed to use Vertex AI (grant roles/aiplatform.user)');
  if (!res.ok) throw new Error(`Google returned ${res.status}`);
  const j: any = await res.json().catch(() => ({}));
  const raw = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
  try {
    return cleanSpec(JSON.parse(raw));
  } catch {
    throw new Error('the AI did not return a readable answer');
  }
}

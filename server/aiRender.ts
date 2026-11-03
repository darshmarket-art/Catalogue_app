/**
 * "AI render": a plain photo of a piece re-drawn as a precise, CAD-style studio render by a Gemini image model on Vertex AI.
 * Uses the Cloud Run service account (same token as cloudStats.ts); needs roles/aiplatform.user on that account.
 * Off unless AI_RENDER_ENABLED=true. The original photo is always kept by the caller; this file only talks to Google.
 */
import { googleToken, projectId } from './cloudStats';
import { STYLE_IDS, type ModelShot, type Placement, type StyleId } from '../shared/aiStyles';

/** Shared by every style: the piece must stay exactly the same, only the presentation changes. */
export const KEEP_IDENTICAL =
  'Keep the jewellery identical to the reference: the same outline and shape, the same proportions, the same number, size, cut, colour and placement of every stone, ' +
  'the same engraving, filigree, openwork and cut-outs, the same metal colour. Do not add, remove, simplify, straighten or restyle any part of the piece. ' +
  'Do not add other jewellery, text or watermark, and ignore any watermark or text on the reference. Change only the presentation.';

/** The default CAD-style prompt. */
export const RENDER_PROMPT =
  'The attached photo is the exact reference of one jewellery design. Re-create it as a detailed, precise CAD-style studio render of THIS piece: ' +
  'the same viewpoint, framing, size and position in the frame. ' + KEEP_IDENTICAL + ' Do not add props or hands. ' +
  'Presentation: a clean seamless light-grey studio backdrop, soft diffused luxury studio lighting, crisp polished metal with ' +
  'sharp clean edges, clear sparkling stones, fine surface detail in sharp focus, and a subtle soft shadow beneath.';

const PLACE_TEXT: Record<Placement, string> = {
  finger: 'worn on a finger of a hand resting naturally, the hand and skin in deep shadow',
  neck: 'worn at the neck and collarbone of a model, shoulders only, face not shown',
  ear: 'worn on the ear in profile with the hair tucked back, face mostly out of frame',
  wrist: 'worn on the wrist and forearm, the arm resting, skin in deep shadow',
  ankle: 'worn on an ankle and foot, skin in deep shadow',
  forehead: 'worn at the forehead and hair parting, the face cropped below the eyes and not shown',
  nose: 'worn on the side of the nose as a close detail, the rest of the face out of frame'
};

const look = (text: string) => 'The attached photo is the exact reference of one jewellery design. Make a premium product photograph of THIS piece. ' + text + ' ' + KEEP_IDENTICAL;

/** One prompt per style id. */
export const STYLES: Record<StyleId, (placement?: Placement) => string> = {
  cad: () => RENDER_PROMPT,
  silk: () => look('Presentation: the piece laid on tastefully folded silk cloth, soft side light, a gentle natural shadow, the jewellery in full sharp contrast and focus.'),
  'studio-dark': () => look('Presentation: the piece on a black, deep glossy surface, a controlled spotlight, a glossy reflection beneath, high contrast, the jewellery brightest and sharpest.'),
  editorial: () => look('Presentation: an editorial still life on natural stone, marble or velvet with one subtle, understated prop; soft directional light, shallow depth of field, the jewellery in sharp focus.'),
  giftbox: () => look('Presentation: the piece resting in an open luxury presentation box with a soft lining, gentle light, the jewellery clearly the hero.'),
  festive: () => look('Presentation: a festive setting with polished brass, fresh flowers and the warm glow of a diya, rich warm light, the jewellery in full sharp contrast.'),
  'on-model': (p = 'neck') =>
    look(`Presentation: the piece ${PLACE_TEXT[p]}. Hermes-style low-key editorial light: the model and skin in deep shadow, dark and low contrast, no face visible, ` +
      'while the jewellery is lit in FULL contrast, perfectly sharp and detailed. The body must not hide or change any part of the piece.'),
  macro: () => look('Presentation: a tight macro close-up showing the texture of the stones and the metal, shallow depth of field, crisp detail, soft light.'),
  'black-necklace': () => BASE_STYLES['black-necklace']!,
  'ring-hand-women': () => BASE_STYLES['ring-hand-women']!,
  'ring-hand-men': () => BASE_STYLES['ring-hand-men']!,
  'model-base': () => BASE_PROMPTS['neck-women'] // never used as is: the route picks BASE_PROMPTS[shot]
};

/** Keeps the background of the approved base shot, and the person, exactly as they are. */
const KEEP_BASE =
  'IMAGE 1 is the approved base shot: keep its person, hand or neck, pose, skin tone, lighting, framing and PURE BLACK background pixel-identical; change nothing in it except adding the jewellery. ' +
  'IMAGE 2 is the product photo: the jewellery piece to place, and it must be identical in design. Take ONLY the piece from image 2, never its background, hands or props. ' +
  'The jewellery is lit in FULL contrast, perfectly sharp and exact; the person stays in deep shadow, low-key and dark, and the background stays pure black (no grey, gradient, glow or vignette). ' + KEEP_IDENTICAL;

const onBase = (what: string) => 'Two images follow. ' + what + ' ' + KEEP_BASE;

/** Recipes that take two images (base shot first, product second). */
const BASE_STYLES: Partial<Record<StyleId, string>> = {
  'black-necklace': onBase('Place the necklace, chain, pendant or neck piece from image 2 on the neck and collarbone of the model in image 1, resting naturally; the body must not hide or change any part of it. Dark low-key editorial, like a Swarovski website photograph.'),
  'ring-hand-women': onBase('Place the ring from image 2 on the correct finger of the hand of the woman in image 1, sitting naturally and fully visible.'),
  'ring-hand-men': onBase('Place the ring from image 2 on the correct finger of the hand of the man in image 1, sitting naturally and fully visible.')
};

/** The one-time prompt that makes a base shot: a person with NO jewellery on a black background. */
export const BASE_PROMPTS: Record<ModelShot, string> = {
  'ring-women': 'A premium low-key editorial photograph of the hand of a refined woman, fingers relaxed and slightly apart, palm down, seen from the front, with NO jewellery, rings, watermark or text. Skin in deep shadow, dark and low contrast, with a soft rim light. The background is pure black.',
  'ring-men': 'A premium low-key editorial photograph of the hand of a man, strong and clean, fingers relaxed and slightly apart, back of the hand toward the camera, with NO jewellery, rings, watermark or text. Skin in deep shadow, dark and low contrast, with a soft rim light. The background is pure black.',
  'neck-women': 'A premium low-key editorial photograph of the neck, collarbone and shoulders, the face not shown (cropped below the lips), with NO jewellery, watermark or text. Skin in deep shadow, dark and low contrast, with a soft rim light on the collarbone. The background is pure black.'
};

/** Styles this server offers: AI_RENDER_STYLES (comma list) or all. */
export const allowedStyles = (): StyleId[] => {
  const list = (process.env.AI_RENDER_STYLES ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return list.length ? STYLE_IDS.filter((x) => list.includes(x)) : [...STYLE_IDS];
};

export const renderEnabled = () => process.env.AI_RENDER_ENABLED === 'true';
/** Renders per store per calendar month (UTC). Every call to Google counts, including failed ones, because failed calls can be billed too. */
export const renderMonthlyCap = () => {
  const n = Number(process.env.AI_RENDER_MONTHLY_CAP ?? 100);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 100;
};

/** An extra reference image sent after the first one. */
export interface RefImage { data: Buffer; mimeType: string }

/**
 * Sends the photo to Vertex AI and returns the rendered image. Throws an Error with a short, safe message on any failure.
 * `extra` images follow the first in order (image 2, 3...); `image` may be null for a text-only request (a base shot).
 */
export async function renderStudio(image: Buffer | null, mimeType: string, prompt = RENDER_PROMPT, extra: RefImage[] = []): Promise<{ data: Buffer; mimeType: string }> {
  const model = process.env.AI_RENDER_MODEL || 'gemini-nano-banana-2.1';
  const loc = process.env.AI_RENDER_LOCATION || 'global';
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
  const project = await projectId();
  const images = [...(image ? [{ data: image, mimeType }] : []), ...extra].map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data.toString('base64') } }));
  const call = async (imageSize?: string) => fetch(`https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [...images, { text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(imageSize ? { imageConfig: { imageSize } } : {}) }
    }),
    // Measured 38-104 s per image on the global endpoint (docs/DESIGN_BENCHMARK.md D0); Cloud Run's default request timeout is 300 s.
    signal: AbortSignal.timeout(150_000)
  });
  // Default output is ~1K, which turns soft when zoomed. Ask for 2K (AI_RENDER_IMAGE_SIZE, '' = model default); if the model rejects the setting, retry once without it.
  const size = process.env.AI_RENDER_IMAGE_SIZE ?? '2K';
  let res = await call(size || undefined);
  if (res.status === 400 && size) res = await call();
  const j: any = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw new Error('the server is not allowed to use Vertex AI (grant roles/aiplatform.user)');
  if (!res.ok) throw new Error(`Google returned ${res.status}`);
  const part = (j?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p?.inlineData?.data);
  if (!part) throw new Error(j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason ? 'the AI declined this photo' : 'the AI returned no image');
  return { data: Buffer.from(part.inlineData.data, 'base64'), mimeType: part.inlineData.mimeType || 'image/png' };
}

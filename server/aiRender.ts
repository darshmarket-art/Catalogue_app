/**
 * "AI render": a plain photo of a piece re-drawn as a precise, CAD-style studio render by a Gemini image model on Vertex AI.
 * Uses the Cloud Run service account (same token as cloudStats.ts); needs roles/aiplatform.user on that account.
 * Off unless AI_RENDER_ENABLED=true. The original photo is always kept by the caller; this file only talks to Google.
 */
import { googleToken, projectId } from './cloudStats';

/** The one prompt. It must keep the piece itself identical: only background, light and finish quality may change. */
export const RENDER_PROMPT =
  'The attached photo is the exact reference of one jewellery design. Re-create it as a detailed, precise CAD-style studio render of THIS piece: ' +
  'the same viewpoint, framing, size and position in the frame. Keep the jewellery identical: the same outline and shape, the same proportions, ' +
  'the same number, size, cut, colour and placement of every stone, the same engraving, filigree, openwork and cut-outs, the same metal colour. ' +
  'Do not add, remove, simplify, straighten or restyle any part of the piece, and do not add other jewellery, props, hands or text. ' +
  'Change only the presentation: a clean seamless light-grey studio backdrop, soft diffused luxury studio lighting, crisp polished metal with ' +
  'sharp clean edges, clear sparkling stones, fine surface detail in sharp focus, and a subtle soft shadow beneath. Ignore any watermark or text on the reference.';

export const renderEnabled = () => process.env.AI_RENDER_ENABLED === 'true';
/** Renders per store per calendar month (UTC). Every call to Google counts, including failed ones, because failed calls can be billed too. */
export const renderMonthlyCap = () => {
  const n = Number(process.env.AI_RENDER_MONTHLY_CAP ?? 100);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 100;
};

/** Sends the photo to Vertex AI and returns the rendered image. Throws an Error with a short, safe message on any failure. */
export async function renderStudio(image: Buffer, mimeType: string): Promise<{ data: Buffer; mimeType: string }> {
  const model = process.env.AI_RENDER_MODEL || 'gemini-nano-banana-2.1';
  const loc = process.env.AI_RENDER_LOCATION || 'global';
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
  const project = await projectId();
  const res = await fetch(`https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: image.toString('base64') } }, { text: RENDER_PROMPT }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    }),
    // Measured 38-104 s per image on the global endpoint (docs/DESIGN_BENCHMARK.md D0); Cloud Run's default request timeout is 300 s.
    signal: AbortSignal.timeout(150_000)
  });
  const j: any = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw new Error('the server is not allowed to use Vertex AI (grant roles/aiplatform.user)');
  if (!res.ok) throw new Error(`Google returned ${res.status}`);
  const part = (j?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p?.inlineData?.data);
  if (!part) throw new Error(j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason ? 'the AI declined this photo' : 'the AI returned no image');
  return { data: Buffer.from(part.inlineData.data, 'base64'), mimeType: part.inlineData.mimeType || 'image/png' };
}

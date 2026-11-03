/** A photo on a form: `ref` is what gets saved, `url` is what is shown. */
export interface PhotoItem {
  ref: string;
  url: string;
  /** Set on an AI render made in this session: the uploaded photo it came from (always kept). */
  original?: { ref: string; url: string };
  /** Set when the owner reverted an AI render: the render, so they can switch back. */
  render?: { ref: string; url: string };
}

/** What POST /photos/render returns. */
export interface RenderResult {
  ref: string;
  url: string;
  style?: string;
  original: { ref: string; url: string };
}

/** The owner accepted a render: the photo with `ref` becomes the render, and keeps its original (the file the form had) for "Revert to original". */
export const acceptRender = (photos: PhotoItem[], ref: string, out: RenderResult): PhotoItem[] =>
  photos.map((p) => (p.ref === ref ? { ref: out.ref, url: out.url, original: { ref: out.original.ref, url: out.original.url } } : p));

/** Why "Enhance to CAD render" is unavailable, from the server's status; null when it can be used. */
export const enhanceBlocked = (s: { enabled: boolean; cap: number; left: number } | null): string | null =>
  !s ? null : !s.enabled ? 'AI render is switched off on this server.' : s.left <= 0 ? `This store has used its ${s.cap} AI renders for this month.` : null;

/** Shows the other version of a photo that has an AI render: render to original, or back. */
export const swapRender = (p: PhotoItem): PhotoItem =>
  p.original ? { ...p.original, render: { ref: p.ref, url: p.url } } : p.render ? { ...p.render, original: { ref: p.ref, url: p.url } } : p;

/** A photo on a form: `ref` is what gets saved, `url` is what is shown. */
export interface PhotoItem {
  ref: string;
  url: string;
  /** Set on an AI render made in this session: the uploaded photo it came from (always kept). */
  original?: { ref: string; url: string };
  /** Set when the owner reverted an AI render: the render, so they can switch back. */
  render?: { ref: string; url: string };
}

/** Shows the other version of a photo that has an AI render: render to original, or back. */
export const swapRender = (p: PhotoItem): PhotoItem =>
  p.original ? { ...p.original, render: { ref: p.ref, url: p.url } } : p.render ? { ...p.render, original: { ref: p.ref, url: p.url } } : p;

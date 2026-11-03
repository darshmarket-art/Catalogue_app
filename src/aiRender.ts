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
  /** Set by the server: lets the app tell it whether the owner kept the render, and shows the new balance. */
  renderId?: string;
  credits?: { balance: number; charged: number };
}

/** What GET /photos/render says about the store's AI credits. Prices are the server's; the app only shows them. */
export interface RenderCredits { balance: number; free: boolean; low: boolean; prices: Record<string, number> }
export interface RenderStatus { enabled: boolean; cap: number; used?: number; left: number; styles?: string[]; offReason?: 'server' | 'paused' | 'store' | null; credits?: RenderCredits }

/** GET /ai-credits. */
export interface AiCreditsInfo {
  balance: number; free: boolean; enabled: boolean; low: boolean; prices: Record<string, number>;
  lastTopup: { at: number; amount: number } | null;
  recent: Array<{ id: string; ts: number; style: string; outcome: string; price: number; refunded: number; kept: boolean | null }>;
  topups: Array<{ ts: number; amount: number; kind: string }>;
}

/** "Rs 120": 1 credit is Rs 1. */
export const rs = (n: number) => `Rs ${n.toLocaleString('en-IN')}`;
/** The cheapest style this store can still pay for? False when it cannot afford any (free stores always can). */
export const cannotAfford = (c: RenderCredits | undefined | null, ids?: string[] | null) =>
  !!c && !c.free && c.balance < Math.min(...Object.entries(c.prices).filter(([k]) => !ids || ids.includes(k)).map(([, v]) => v), Infinity);

/** The owner accepted a render: the photo with `ref` becomes the render, and keeps its original (the file the form had) for "Revert to original". */
export const acceptRender = (photos: PhotoItem[], ref: string, out: RenderResult): PhotoItem[] =>
  photos.map((p) => (p.ref === ref ? { ref: out.ref, url: out.url, original: { ref: out.original.ref, url: out.original.url } } : p));

/** Why "AI Enhance" is unavailable, from the server's status; null when it can be used. */
export const enhanceBlocked = (s: Pick<RenderStatus, 'enabled' | 'cap' | 'left' | 'offReason' | 'credits' | 'styles'> | null): string | null =>
  !s ? null
    : !s.enabled ? (s.offReason === 'paused' ? 'AI render is paused by Antarixs for now.' : s.offReason === 'store' ? 'AI render is switched off for this store.' : 'AI render is switched off on this server.')
    : s.left <= 0 ? `This store has used its ${s.cap} AI renders for this month.`
    : cannotAfford(s.credits, s.styles) ? `You have ${rs(s.credits!.balance)} of AI credits, not enough for a render.`
    : null;

/** Shows the other version of a photo that has an AI render: render to original, or back. */
export const swapRender = (p: PhotoItem): PhotoItem =>
  p.original ? { ...p.original, render: { ref: p.ref, url: p.url } } : p.render ? { ...p.render, original: { ref: p.ref, url: p.url } } : p;

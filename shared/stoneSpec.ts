/**
 * The detail sheet's stone table. The AI only reads the photo (groups of stones, how many, roughly how big); the carat figures are worked out here,
 * the same way on the server and in the owner's editor, so a corrected count or size changes the weight at once.
 */
export interface StoneGroup {
  /** Where the stones are, e.g. "Curved pavé band". */
  name: string;
  /** Setting, e.g. "Pavé", "Prong", "Bezel", "Channel". */
  setting: string;
  shape: string;
  countMin: number;
  countMax: number;
  /** Diameter of one stone in mm (a range because the photo has no scale). */
  mmMin: number;
  mmMax: number;
}

export interface StoneSpec {
  pieceType: string;
  metal: string;
  /** Short design notes for the sheet, e.g. "Peacock feather motif". */
  features: string[];
  groups: StoneGroup[];
}

/** Carats of one round brilliant of this diameter: about 6.5 mm is 1 ct, and weight grows with the cube of the width. */
export const caratOf = (mm: number) => 0.0037 * mm ** 3;

export interface StoneTotals { countMin: number; countMax: number; ctMin: number; ctMax: number }

export const groupCt = (g: Pick<StoneGroup, 'countMin' | 'countMax' | 'mmMin' | 'mmMax'>) => ({ min: g.countMin * caratOf(g.mmMin), max: g.countMax * caratOf(g.mmMax) });

export function totalsOf(groups: StoneGroup[]): StoneTotals {
  return groups.reduce<StoneTotals>((t, g) => {
    const c = groupCt(g);
    return { countMin: t.countMin + g.countMin, countMax: t.countMax + g.countMax, ctMin: t.ctMin + c.min, ctMax: t.ctMax + c.max };
  }, { countMin: 0, countMax: 0, ctMin: 0, ctMax: 0 });
}

/** "56" or "56 to 64". */
export const countText = (min: number, max: number) => (min === max ? String(min) : `${min}–${max}`);
/** "0.30" or "0.30–0.55" carats; "under 0.01" for a speck. */
export const ctText = (min: number, max: number) => {
  const f = (n: number) => n.toFixed(2);
  if (max < 0.01) return '< 0.01';
  return f(min) === f(max) ? f(min) : `${f(min)}–${f(max)}`;
};
export const mmText = (min: number, max: number) => {
  const f = (n: number) => String(Math.round(n * 10) / 10);
  return f(min) === f(max) ? f(min) : `${f(min)}–${f(max)}`;
};

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Cleans anything that came from the model or the editor into safe, bounded values. Never throws. */
export function cleanSpec(raw: unknown): StoneSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const groups = (Array.isArray(r.groups) ? r.groups : []).slice(0, 8).map((g: any): StoneGroup => {
    const a = Math.round(num(g?.countMin, 0, 2000, 0));
    const b = Math.round(num(g?.countMax, 0, 2000, a));
    const m1 = num(g?.mmMin, 0.5, 15, 1);
    const m2 = num(g?.mmMax, 0.5, 15, m1);
    return { name: text(g?.name, 40) || 'Stones', setting: text(g?.setting, 24), shape: text(g?.shape, 16) || 'Round', countMin: Math.min(a, b), countMax: Math.max(a, b), mmMin: Math.min(m1, m2), mmMax: Math.max(m1, m2) };
  }).filter((g) => g.countMax > 0);
  return {
    pieceType: text(r.pieceType, 40),
    metal: text(r.metal, 80),
    features: (Array.isArray(r.features) ? r.features : []).map((f) => text(f, 60)).filter(Boolean).slice(0, 5),
    groups
  };
}

/** AI render styles, shared by the owner's picker and the server (which owns the prompts). */
export const STYLE_IDS = ['cad', 'silk', 'studio-dark', 'editorial', 'giftbox', 'festive', 'on-model', 'macro', 'black-necklace', 'ring-hand-women', 'ring-hand-men', 'model-base'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const STYLE_INFO: Record<StyleId, { name: string; blurb: string }> = {
  cad: { name: 'CAD studio', blurb: 'Clean light-grey studio render, crisp metal and stones.' },
  silk: { name: 'Silk cloth', blurb: 'Laid on folded silk with soft side light.' },
  'studio-dark': { name: 'Dark studio', blurb: 'Black surface, spotlight, glossy reflection.' },
  editorial: { name: 'Editorial', blurb: 'Stone, marble or velvet still life with one prop.' },
  giftbox: { name: 'Gift box', blurb: 'Resting in an open presentation box.' },
  festive: { name: 'Festive', blurb: 'Brass, flowers and diya glow for festive banners.' },
  'on-model': { name: 'Worn on model', blurb: 'Worn, model in shadow, jewellery in full light.' },
  macro: { name: 'Macro close-up', blurb: 'Tight view of stone and metal texture.' },
  'black-necklace': { name: 'Black necklace', blurb: 'Worn on a model, all-black background, jewellery in full light.' },
  'ring-hand-women': { name: "Ring on woman's hand", blurb: "Your saved woman's hand, black background; only the ring changes." },
  'ring-hand-men': { name: "Ring on man's hand", blurb: "Your saved man's hand, black background; only the ring changes." },
  'model-base': { name: 'Model shot', blurb: 'The reusable person for the recipes above (one-time).' }
};

export const PLACEMENTS = ['finger', 'neck', 'ear', 'wrist', 'ankle', 'forehead', 'nose'] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const PLACEMENT_LABEL: Record<Placement, string> = { finger: 'Finger', neck: 'Neck', ear: 'Ear', wrist: 'Wrist', ankle: 'Ankle', forehead: 'Forehead', nose: 'Nose' };

/** Where a piece is worn, from its collection tag (custom tags work by keyword). null = no body part, so "Worn on model" starts unavailable. */
export const placementForTag = (tag?: string | null): Placement | null => {
  const t = (tag ?? '').toLowerCase();
  const rules: Array<[RegExp, Placement]> = [
    [/nose|nath|laung/, 'nose'], [/anklet|payal|toe/, 'ankle'], [/tikka|maang|matha|head|forehead/, 'forehead'],
    [/earring|jhumk|chandbali|stud|\btops\b|bali/, 'ear'], [/bangle|bracelet|kada|kangan|cuff/, 'wrist'],
    [/ring/, 'finger'], [/necklace|chain|pendant|haar|mangalsutra|choker|locket/, 'neck']
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? null;
};

/** Reusable base shots (a hand or a neck, no jewellery, black background). Made once per store, approved by the owner, then sent with every product photo so the person never changes. */
export const MODEL_SHOTS = ['ring-women', 'ring-men', 'neck-women'] as const;
export type ModelShot = (typeof MODEL_SHOTS)[number];
export const SHOT_LABEL: Record<ModelShot, string> = { 'ring-women': "Woman's hand", 'ring-men': "Man's hand", 'neck-women': "Woman's neck" };
/** Recipe styles that need an approved base shot, and which one. */
export const SHOT_OF: Partial<Record<StyleId, ModelShot>> = { 'black-necklace': 'neck-women', 'ring-hand-women': 'ring-women', 'ring-hand-men': 'ring-men' };
/** The recipe that suits a collection tag (neck pieces and rings only; the owner can switch ring gender). */
export const recipeForTag = (tag?: string | null): StyleId | null => { const p = placementForTag(tag); return p === 'neck' ? 'black-necklace' : p === 'finger' ? 'ring-hand-women' : null; };

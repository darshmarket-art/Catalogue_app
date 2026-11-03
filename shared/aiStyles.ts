/** AI render styles, shared by the owner's picker and the server (which owns the prompts). */
export const STYLE_IDS = ['cad', 'silk', 'studio-dark', 'editorial', 'giftbox', 'festive', 'on-model', 'macro'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const STYLE_INFO: Record<StyleId, { name: string; blurb: string }> = {
  cad: { name: 'CAD studio', blurb: 'Clean light-grey studio render, crisp metal and stones.' },
  silk: { name: 'Silk cloth', blurb: 'Laid on folded silk with soft side light.' },
  'studio-dark': { name: 'Dark studio', blurb: 'Black surface, spotlight, glossy reflection.' },
  editorial: { name: 'Editorial', blurb: 'Stone, marble or velvet still life with one prop.' },
  giftbox: { name: 'Gift box', blurb: 'Resting in an open presentation box.' },
  festive: { name: 'Festive', blurb: 'Brass, flowers and diya glow for festive banners.' },
  'on-model': { name: 'Worn on model', blurb: 'Worn, model in shadow, jewellery in full light.' },
  macro: { name: 'Macro close-up', blurb: 'Tight view of stone and metal texture.' }
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

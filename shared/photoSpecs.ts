/** How each kind of store photo should be shaped, so it looks the same on every phone. Banners and collections are strict (cropped to fit); designs are advised. */
export type PhotoKind = 'banner' | 'collection' | 'design';

export interface PhotoSpec {
  label: string;
  /** width / height */
  ratio: number;
  /** Output size of the saved photo. */
  w: number;
  h: number;
  /** Smallest accepted source photo. */
  minW: number;
  minH: number;
  strict: boolean;
  tip: string;
}

export const PHOTO_SPECS: Record<PhotoKind, PhotoSpec> = {
  banner: { label: 'Banner', ratio: 2, w: 1600, h: 800, minW: 1200, minH: 600, strict: true, tip: 'Banner photos are 2:1 (wide), 1600 x 800 px. Keep the subject in the centre; the edges can be cut on small phones.' },
  collection: { label: 'Collection', ratio: 1, w: 1200, h: 1200, minW: 800, minH: 800, strict: true, tip: 'Collection photos are square (1:1), 1200 x 1200 px. Keep the piece centred.' },
  design: { label: 'Design', ratio: 1, w: 1200, h: 1200, minW: 800, minH: 800, strict: false, tip: 'Design photos look best square (1:1), 1200 x 1200 px, on a plain background.' }
};

const TOLERANCE = 0.05;

/** 'small' = below the minimum, 'ratio' = wrong shape (more than 5% off), 'ok' otherwise. */
export function fitCheck(width: number, height: number, spec: PhotoSpec): 'ok' | 'small' | 'ratio' {
  if (width < spec.minW || height < spec.minH) return 'small';
  return Math.abs(width / height / spec.ratio - 1) > TOLERANCE ? 'ratio' : 'ok';
}

export interface CropView {
  /** the photo's natural size */
  nw: number;
  nh: number;
  /** the crop frame on screen */
  cw: number;
  ch: number;
  /** 1 = the photo just covers the frame; larger zooms in */
  zoom: number;
  /** top-left of the photo inside the frame (<= 0) */
  ox: number;
  oy: number;
}

/** On-screen scale of the photo. */
export const cropScale = (v: Pick<CropView, 'nw' | 'nh' | 'cw' | 'ch' | 'zoom'>) => Math.max(v.cw / v.nw, v.ch / v.nh) * v.zoom;

/** Keeps the photo covering the whole frame. */
export function clampOffset(v: CropView): { ox: number; oy: number } {
  const s = cropScale(v);
  return { ox: Math.min(0, Math.max(v.cw - v.nw * s, v.ox)), oy: Math.min(0, Math.max(v.ch - v.nh * s, v.oy)) };
}

/** The part of the original photo that sits inside the frame. */
export function sourceRect(v: CropView): { sx: number; sy: number; sw: number; sh: number } {
  const s = cropScale(v);
  const { ox, oy } = clampOffset(v);
  return { sx: -ox / s || 0, sy: -oy / s || 0, sw: v.cw / s, sh: v.ch / s };
}

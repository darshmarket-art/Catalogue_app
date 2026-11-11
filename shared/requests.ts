/** Client requests (private viewing, bespoke, 48-hour reserve): the words both sides share. */
export const REQUEST_KINDS = ['viewing', 'bespoke', 'reserve'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const REQUEST_STATUSES = ['new', 'confirmed', 'done', 'declined'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const RESERVE_HOURS = 48;
/** How long a shared selection link stays open. */
export const SHARE_DAYS = 14;

export interface ClientRequest {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  createdAt: string;
  clientName: string;
  clientPhone: string;
  firmName?: string | null;
  guest?: boolean;
  pieces: Array<{ sku: string; title: string }>;
  note?: string;
  adminNote?: string;
  // viewing
  where?: 'boutique' | 'video';
  date?: string;
  time?: string;
  occasion?: string;
  // bespoke
  piece?: string;
  metal?: string;
  stones?: string[];
  neededBy?: string;
  budget?: string;
  // reserve
  expiresAt?: string;
}

/** A piece on a shared selection page. Weights only when the sharer chose to show them. */
export interface SharedPiece { sku: string; title: string; titleHi?: string; category: string; image: string; images: string[]; purity?: string; netWt?: number; grossWt?: number }
export interface SharedSelection { brand: string; by: string; note: string; showWeights: boolean; expiresAt: string; pieces: SharedPiece[] }

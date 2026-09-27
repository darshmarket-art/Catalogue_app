import { merchant } from './merchant';
import { jewelleryPack } from './sectors/jewellery';

// One entry per supported sector; the merchant's config chooses which one this deployment uses.
const PACKS = { jewellery: jewelleryPack } as const;

export const sector = PACKS[merchant.sector];

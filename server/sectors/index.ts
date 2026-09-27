import type { MerchantConfig } from '../merchant';
import { jewelleryPack, type SectorPack } from './jewellery';

// One entry per supported sector. Adding a sector means adding a pack here and a matching one in src/sectors.
const PACKS: Record<MerchantConfig['sector'], SectorPack> = {
  jewellery: jewelleryPack
};

export const getSectorPack = (sector: MerchantConfig['sector']): SectorPack => PACKS[sector];
export type { SectorPack };

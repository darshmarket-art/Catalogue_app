import crypto from 'crypto';
import { loadMerchant, type MerchantConfig } from './merchant';

export type StoreKind = 'firestore' | 'file' | 'memory';

export interface Config {
  port: number;
  merchant: MerchantConfig;
  isProduction: boolean;
  jwtSecret: string;
  masterProvisioningKey: string | null;
  storeKind: StoreKind;
  dataFile: string;
  seedDemoCatalogue: boolean;
  rateLimit: { auth: number; adminRegister: number; api: number; analytics: number };
}

const MIN_JWT_SECRET_LENGTH = 32;
const MIN_MASTER_KEY_LENGTH = 16;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProduction = env.NODE_ENV === 'production';
  const problems: string[] = [];

  let jwtSecret = env.JWT_SECRET?.trim() || '';
  if (isProduction) {
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      problems.push(`JWT_SECRET must be set and at least ${MIN_JWT_SECRET_LENGTH} characters`);
    }
  } else if (!jwtSecret) {
    // Ephemeral per-process secret: dev sessions simply end on restart.
    jwtSecret = crypto.randomBytes(48).toString('hex');
  }

  const masterKey = env.MASTER_PROVISIONING_KEY?.trim() || null;
  if (isProduction && (!masterKey || masterKey.length < MIN_MASTER_KEY_LENGTH)) {
    problems.push(`MASTER_PROVISIONING_KEY must be set and at least ${MIN_MASTER_KEY_LENGTH} characters`);
  }

  const requestedStore = env.STORE as StoreKind | undefined;
  const storeKind: StoreKind = requestedStore ?? (isProduction ? 'firestore' : 'file');
  if (!['firestore', 'file', 'memory'].includes(storeKind)) {
    problems.push(`STORE must be one of firestore, file, memory (got "${storeKind}")`);
  }
  if (isProduction && storeKind !== 'firestore') {
    problems.push('STORE must be "firestore" in production: local storage is wiped on every Cloud Run restart');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid server configuration:\n - ${problems.join('\n - ')}`);
  }

  return {
    port: env.PORT ? parseInt(env.PORT, 10) : 3000,
    merchant: loadMerchant(env),
    isProduction,
    jwtSecret,
    masterProvisioningKey: masterKey,
    storeKind,
    dataFile: env.DATA_FILE || 'data/local-db.json',
    seedDemoCatalogue: env.SEED_DEMO_CATALOGUE ? env.SEED_DEMO_CATALOGUE === 'true' : !isProduction,
    rateLimit: { auth: 10, adminRegister: 5, api: 1000, analytics: 300 }
  };
}

import crypto from 'crypto';
import { loadMerchant, type MerchantConfig } from './merchant';

export type StoreKind = 'firestore' | 'file' | 'memory';

export interface Config {
  port: number;
  /** The default store's seed config (merchants/<id>/merchant.json); the live copy is the store record. */
  merchant: MerchantConfig;
  /** Store served when the address names none (the existing run.app URL). */
  defaultStore: string;
  /** Stores live at [store].baseDomain. */
  baseDomain: string;
  /** How long a store record is cached, in ms. */
  storeCacheMs: number;
  isProduction: boolean;
  minAppVersion: string;
  latestAppVersion: string;
  jwtSecret: string;
  masterProvisioningKey: string | null;
  storeKind: StoreKind;
  dataFile: string;
  seedDemoCatalogue: boolean;
  /** Cloud Storage bucket for photos and merchant.json. Unset in development (files go to uploadsDir). */
  storageBucket: string | null;
  uploadsDir: string;
  /** WhatsApp Cloud API settings; null when unset (dev logs codes, production refuses to send). */
  whatsapp: { token: string; phoneNumberId: string; template: string; language: string; apiVersion: string } | null;
  /** Meta utility template for owner order alerts; null = no WhatsApp alerts. */
  orderTemplate: string | null;
  /** WhatsApp alerts allowed per store per day. */
  alertDailyCap: number;
  /** Web Push VAPID keys; null = web push off. */
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  /** OTP sends allowed per store per day. */
  otpDailyCap: number;
  /** TEMPORARY: when set, every OTP request uses this fixed 6-digit code and nothing is sent. Remove once WhatsApp is live. */
  staticOtp: string | null;
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

  const merchant = loadMerchant({ ...env, MERCHANT: env.DEFAULT_STORE || env.MERCHANT });
  return {
    port: env.PORT ? parseInt(env.PORT, 10) : 3000,
    merchant,
    defaultStore: merchant.id,
    baseDomain: (env.BASE_DOMAIN?.trim() || 'antarixs.com').toLowerCase(),
    storeCacheMs: env.STORE_CACHE_MS ? parseInt(env.STORE_CACHE_MS, 10) : env.NODE_ENV === 'test' ? 0 : 15000,
    isProduction,
    minAppVersion: env.MIN_APP_VERSION || '0.0.0',
    latestAppVersion: env.LATEST_APP_VERSION || '0.0.0',
    jwtSecret,
    masterProvisioningKey: masterKey,
    storeKind,
    dataFile: env.DATA_FILE || 'data/local-db.json',
    seedDemoCatalogue: env.SEED_DEMO_CATALOGUE ? env.SEED_DEMO_CATALOGUE === 'true' : !isProduction,
    storageBucket: env.STORAGE_BUCKET?.trim() || null,
    uploadsDir: env.UPLOADS_DIR || 'data/uploads',
    whatsapp:
      env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_OTP_TEMPLATE
        ? {
            token: env.WHATSAPP_TOKEN.trim(),
            phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID.trim(),
            template: env.WHATSAPP_OTP_TEMPLATE.trim(),
            language: env.WHATSAPP_OTP_LANGUAGE?.trim() || 'en',
            apiVersion: env.WHATSAPP_API_VERSION?.trim() || 'v21.0'
          }
        : null,
    orderTemplate: env.WHATSAPP_ORDER_TEMPLATE?.trim() || null,
    alertDailyCap: env.ALERT_DAILY_CAP ? parseInt(env.ALERT_DAILY_CAP, 10) : 200,
    vapid:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? { publicKey: env.VAPID_PUBLIC_KEY.trim(), privateKey: env.VAPID_PRIVATE_KEY.trim(), subject: env.VAPID_SUBJECT?.trim() || 'mailto:admin@antarixs.com' }
        : null,
    staticOtp: /^\d{6}$/.test(env.OTP_STATIC_CODE ?? '') ? env.OTP_STATIC_CODE! : null,
    otpDailyCap: env.OTP_DAILY_CAP ? parseInt(env.OTP_DAILY_CAP, 10) : 500,
    rateLimit: { auth: 10, adminRegister: 5, api: 1000, analytics: 300 }
  };
}

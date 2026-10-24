import path from 'path';

/** Fixed by tests/e2e/server.ts. */
export const STORE_ID = 'bhakti';
export const STATIC_CODE = '123456';
export const MASTER_KEY = 'e2e-master-provisioning-key';
export const OWNER = { email: 'owner@example.com', password: 'OwnerPass@2026' };

export const BASE = () => `http://localhost:${process.env.PW_PORT}`;

/** Where screenshots and findings go: <RESPONSIVE_SCRATCH>/<RESPONSIVE_OUT>/. Keep it outside the repo for baselines (see README). */
export const outDir = () => path.resolve(process.env.RESPONSIVE_SCRATCH || path.join('test-results', 'responsive'), process.env.RESPONSIVE_OUT || 'before');

const on = (v?: string) => v === '1' || v === 'true';
/** Overflow and covered-input failures are recorded in findings.json instead of failing the test. */
export const REPORT_ONLY = () => on(process.env.RESPONSIVE_REPORT_ONLY);
/** Tap-target, small-text and clipped-text lists never fail a test unless these are set. */
export const STRICT_TARGETS = () => on(process.env.RESPONSIVE_STRICT_TARGETS);
export const STRICT_TEXT = () => on(process.env.RESPONSIVE_STRICT_TEXT);

export interface Sessions {
  buyer: { token: string; phone: string };
  owner: { token: string };
}
export const sessions = () => JSON.parse(process.env.PW_SESSIONS || '{}') as Sessions;

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Config } from './config';
import type { Store } from './store';
import { HttpError, audit, handler } from './http';
import { logger } from './logger';

export const APP_BUILDS_PER_DAY = 3;
const GITHUB_API = 'https://api.github.com';

export interface AppBuildSettings { token: string; repo: string; ref: string; workflow: string }

/** Reads GITHUB_APP_BUILD_TOKEN, APP_BUILD_REPO (owner/repo), APP_BUILD_REF (default main). Null when not connected. */
export function appBuildFrom(env: NodeJS.ProcessEnv): AppBuildSettings | null {
  const token = env.GITHUB_APP_BUILD_TOKEN?.trim();
  const repo = env.APP_BUILD_REPO?.trim();
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { token, repo, ref: env.APP_BUILD_REF?.trim() || 'main', workflow: 'android.yml' };
}

/**
 * Asks GitHub to run the store Android APK workflow for one store. GitHub answers 204 with no run id,
 * so the owner sees "requested" and the build's result is in the repo's Actions tab.
 */
export async function dispatchAppBuild(s: AppBuildSettings, storeId: string, apiBase: string, fetchFn: typeof fetch = fetch): Promise<void> {
  const res = await fetchFn(`${GITHUB_API}/repos/${s.repo}/actions/workflows/${s.workflow}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: s.ref, inputs: { store_id: storeId, api_base: apiBase } })
  });
  if (res.status !== 204) {
    logger.error('App build dispatch failed', { storeId, status: res.status });
    throw new HttpError(502, 'Could not start the app build. Please try again later.');
  }
}

/** Store owner asks for this store's Android app to be built. Only the store's own id is sent; nothing from the body is trusted. */
export function appBuildRoutes(config: Config, store: Store, requireAdmin: RequestHandler, settings: AppBuildSettings | null = appBuildFrom(process.env), fetchFn: typeof fetch = fetch, now: () => number = Date.now) {
  const router = Router();

  router.get('/', requireAdmin, handler(async (_req, res) => {
    const day = new Date(now()).toISOString().slice(0, 10);
    const used = (await store.get<{ count: number }>('appBuildDaily', day))?.count ?? 0;
    res.json({ status: 'success', data: { connected: Boolean(settings), storeId: config.merchant.id, remainingToday: Math.max(0, APP_BUILDS_PER_DAY - used) } });
  }));

  router.post('/', requireAdmin, handler(async (req, res) => {
    if (!settings) throw new HttpError(503, 'App builds are not connected on the platform yet.');
    const day = new Date(now()).toISOString().slice(0, 10);
    const used = (await store.get<{ count: number }>('appBuildDaily', day))?.count ?? 0;
    if (used >= APP_BUILDS_PER_DAY) throw new HttpError(429, `This store has already asked for ${APP_BUILDS_PER_DAY} app builds today. Please try again tomorrow.`);
    const storeId = config.merchant.id;
    const apiBase = `https://${storeId}.${config.baseDomain}`;
    await dispatchAppBuild(settings, storeId, apiBase, fetchFn);
    await store.increment('appBuildDaily', day, { count: 1 });
    await audit(store, req, 'APP_BUILD_REQUESTED', `Android app build requested for ${storeId}.`);
    res.status(202).json({ status: 'success', message: 'Your app build has started. It takes a few minutes; the APK appears in the build results.' });
  }));

  return router;
}

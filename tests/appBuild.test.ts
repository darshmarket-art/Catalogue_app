import { describe, expect, it } from 'vitest';
import { APP_BUILDS_PER_DAY, appBuildFrom, dispatchAppBuild } from '../server/appBuild';

const settings = { token: 't0k', repo: 'darshmarket-art/Catalogue_app', ref: 'main', workflow: 'android.yml' };

describe('app build settings', () => {
  it('is off until the token and repo are set', () => {
    expect(appBuildFrom({})).toBeNull();
    expect(appBuildFrom({ GITHUB_APP_BUILD_TOKEN: 'x' })).toBeNull();
    expect(appBuildFrom({ GITHUB_APP_BUILD_TOKEN: 'x', APP_BUILD_REPO: 'not a repo' })).toBeNull();
  });

  it('defaults the ref to main', () => {
    expect(appBuildFrom({ GITHUB_APP_BUILD_TOKEN: 'x', APP_BUILD_REPO: 'o/r' })).toEqual({ token: 'x', repo: 'o/r', ref: 'main', workflow: 'android.yml' });
    expect(appBuildFrom({ GITHUB_APP_BUILD_TOKEN: 'x', APP_BUILD_REPO: 'o/r', APP_BUILD_REF: 'store-app-workflow' })?.ref).toBe('store-app-workflow');
  });

  it('allows three builds a day per store', () => {
    expect(APP_BUILDS_PER_DAY).toBe(3);
  });
});

describe('dispatchAppBuild', () => {
  it('posts the store id and api base to the workflow dispatch API', async () => {
    let url = ''; let init: RequestInit = {};
    const fake = (async (u: string, i: RequestInit) => { url = u; init = i; return new Response(null, { status: 204 }); }) as typeof fetch;
    await dispatchAppBuild(settings, 'acme', 'https://acme.antarixs.com', fake);
    expect(url).toBe('https://api.github.com/repos/darshmarket-art/Catalogue_app/actions/workflows/android.yml/dispatches');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0k');
    expect(JSON.parse(init.body as string)).toEqual({ ref: 'main', inputs: { store_id: 'acme', api_base: 'https://acme.antarixs.com' } });
  });

  it('turns a GitHub refusal into a friendly error without leaking the token', async () => {
    const fake = (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch;
    await expect(dispatchAppBuild(settings, 'acme', 'https://acme.antarixs.com', fake)).rejects.toMatchObject({ status: 502 });
  });
});

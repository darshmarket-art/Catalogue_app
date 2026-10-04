// Pure helpers for the per-store Android build (see scripts/build-store-app.ts and docs/android-addon.md).

/** com.antarixs.<store>: lowercase letters/digits only; every Java package segment must start with a letter. */
export function appIdFor(storeId: string): string {
  const s = storeId.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s) throw new Error(`Cannot make an app id from "${storeId}"`);
  return `com.antarixs.${/^[0-9]/.test(s) ? 's' + s : s}`;
}

/** Store id as used in URLs and merchants/<id>; same rule as server/merchant.ts. */
export const validStoreId = (id: string) => /^[a-z0-9-]{2,40}$/.test(id);

/** Accepts the live GET /api/config body ({data: merchant}), a store export ({store:{merchant}}) or a bare merchant. */
export function merchantFrom(json: any): any {
  const m = json?.data ?? json?.store?.merchant ?? json?.merchant ?? json;
  if (!m?.brand?.name) throw new Error('No merchant/brand found in the store data');
  return m;
}

/** Everything the native build needs, derived from the store's merchant config. */
export function nativeBuildValues(storeId: string, merchant: any, apiBase: string) {
  if (!validStoreId(storeId)) throw new Error(`Invalid store id "${storeId}"`);
  const colors = merchant.theme?.colors ?? {};
  return {
    appId: appIdFor(storeId),
    appName: String(merchant.brand.name),
    env: { MERCHANT: storeId, VITE_STORE: storeId, VITE_API_BASE: apiBase.replace(/\/+$/, '') },
    themeColor: colors.surface ?? '#f7f1e8',
    splashColor: colors.surface ?? '#f7f1e8',
    logoUrl: merchant.brand.logoUrl as string | undefined
  };
}

/** The merchants/<id>/merchant.json the existing build reads: the store's own config with the generated app id. */
export const merchantFileFor = (storeId: string, merchant: any) => ({
  ...merchant,
  id: storeId,
  android: { ...(merchant.android ?? {}), packageName: appIdFor(storeId), sha256CertFingerprints: merchant.android?.sha256CertFingerprints ?? [] }
});

/** Launcher icon sizes (px) per Android density folder. */
export const LAUNCHER_SIZES: Record<string, number> = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

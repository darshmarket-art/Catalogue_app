/** Store ids are the subdomain: [store].antarixs.com. Shared by the server (resolution) and signup (Phase 6). */
export const RESERVED_STORE_NAMES = new Set([
  'www', 'console', 'api', 'app', 'admin', 'auth', 'login', 'signup', 'static', 'assets', 'media', 'cdn', 'mail',
  'support', 'help', 'status', 'docs', 'blog', 'dashboard', 'billing', 'antarixs', 'staging', 'test', 'dev', 'demo', 'localhost'
]);

const STORE_NAME = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

/** 3 to 30 characters: lowercase letters, digits and inner hyphens. Says nothing about reserved names. */
export const isValidStoreName = (s: string) => STORE_NAME.test(s);
export const isReservedStoreName = (s: string) => RESERVED_STORE_NAMES.has(s);
/** A name a new store may claim. */
export const isAvailableStoreName = (s: string) => isValidStoreName(s) && !isReservedStoreName(s);

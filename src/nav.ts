/** Back from anywhere in a store goes to its home; on home the first press only asks, a second press within 2 seconds leaves. */
export const EXIT_WINDOW_MS = 2000;

export type BackAction = 'home' | 'ask' | 'leave';

export function backAction<S extends string>(screen: S, home: S, lastAskAt: number, now: number): BackAction {
  if (screen !== home) return 'home';
  return now - lastAskAt < EXIT_WINDOW_MS ? 'leave' : 'ask';
}

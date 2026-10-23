import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/*
 * Haptics for the Android app, after Apple's "Designing Audio-Haptic Experiences": a buzz must be caused by something the person did,
 * land on the same frame as what they see, and be rare enough to mean something. So only a few moments use it:
 * adding a design to the order, placing the order, and a sign-in code being accepted or rejected.
 * An older install of the app has no Haptics plugin, so every call checks first and never throws. The web stays silent.
 */
const buzz = (play: () => Promise<void>) => {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Haptics')) return;
  try {
    play().catch(() => {});
  } catch {
    // no vibration on this phone; what the person sees still tells them
  }
};

/** A light knock: something was added. */
export const tap = () => buzz(() => Haptics.impact({ style: ImpactStyle.Light }));
/** Something important finished well (order placed, signed in). */
export const success = () => buzz(() => Haptics.notification({ type: NotificationType.Success }));
/** Something was refused (a wrong or expired code). */
export const warning = () => buzz(() => Haptics.notification({ type: NotificationType.Warning }));

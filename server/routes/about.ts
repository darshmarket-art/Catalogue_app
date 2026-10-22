import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Store } from '../store';
import { audit, handler, parse } from '../http';

const field = (max: number) => z.string().trim().max(max).optional();

/** The owner's "About us" page. Every field is optional; empty ones are simply not shown. */
export const aboutSchema = z.object({
  ownerName: field(100),
  ownerRole: field(80),
  story: field(2000),
  address: field(300),
  phone: field(40),
  /** "lat,lng" of the place picked on Google Maps, so map links open the exact spot. */
  mapPin: z.string().trim().regex(/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/, 'Pick the place on the map again.').optional().or(z.literal('')),
  email: field(120).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email address.'),
  openingHours: field(160),
  gstin: field(15),
  /** Hindi versions for buyers who use the app in Hindi. */
  ownerRoleHi: field(80),
  storyHi: field(2000),
  addressHi: field(300),
  openingHoursHi: field(160),
  website: field(200).refine((v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v)), 'The website must start with http:// or https://')
});

export type About = z.infer<typeof aboutSchema>;

/** The About us phone is the store's WhatsApp number: digits only, a 10-digit Indian number gets 91. Null when it is not a phone number. */
export const whatsappOf = (phone?: string) => {
  const d = (phone ?? '').replace(/[^0-9]/g, '').replace(/^0(?=\d{10}$)/, '').replace(/^(\d{10})$/, '91$1');
  return d.length >= 11 && d.length <= 15 ? d : null;
};

export function aboutRoutes(store: Store, readGuard: RequestHandler, requireAdmin: RequestHandler, onSaved?: (about: About) => Promise<void>) {
  const router = Router();

  router.get(
    '/',
    readGuard,
    handler(async (_req, res) => {
      const doc = await store.get<{ about?: About }>('settings', 'about');
      res.json({ status: 'success', data: doc?.about ?? {} });
    })
  );

  router.put(
    '/',
    requireAdmin,
    handler(async (req, res) => {
      const body = parse(aboutSchema, req.body);
      const about = Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === 'string' && v !== ''));
      await store.set('settings', 'about', { id: 'about', about, updatedAt: new Date().toISOString() });
      await onSaved?.(about);
      await audit(store, req, 'ABOUT_US_UPDATED', 'About us page updated.');
      res.json({ status: 'success', data: about });
    })
  );

  return router;
}

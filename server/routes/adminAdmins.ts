import { Router } from 'express';
import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import type { Store } from '../store';
import { user } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { adminAddSchema, adminResetSchema } from '../schemas';

const BCRYPT_ROUNDS = 12;

const view = (a: Record<string, any>) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  createdAt: a.createdAt,
  mustChangePassword: Boolean(a.mustChangePassword)
});

/** The store's admin accounts: every admin is a full admin. Add one with a temporary password, remove one (never the last), or reset a colleague's password. */
export function adminAdminRoutes(store: Store, requireAdmin: RequestHandler) {
  const router = Router();
  router.use(requireAdmin);

  router.get(
    '/',
    handler(async (_req, res) => {
      const admins = (await store.list('admins')).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      res.json({ status: 'success', count: admins.length, data: admins.map(view) });
    })
  );

  router.post(
    '/',
    handler(async (req, res) => {
      const body = parse(adminAddSchema, req.body);
      const me = user(res);
      const admin = {
        id: newId('adm'),
        name: body.name || 'Administrator',
        email: body.email,
        password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
        role: 'owner',
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        addedBy: me.id
      };
      if (!(await store.create('admins', admin.email, admin))) throw new HttpError(409, 'An admin with this email already exists.');
      await audit(store, req, 'ADMIN_ADDED', `${me.name} added admin ${admin.name} (${admin.email}).`);
      res.status(201).json({ status: 'success', message: 'Admin added. They sign in with the temporary password and set their own.', data: view(admin) });
    })
  );

  router.delete(
    '/:email',
    handler(async (req, res) => {
      const me = user(res);
      const email = String(req.params.email).toLowerCase();
      if (email === me.id) throw new HttpError(400, 'You cannot remove your own account. Ask another admin to remove it.');
      const target = await store.get('admins', email);
      if (!target) throw new HttpError(404, 'Admin not found.');
      if ((await store.list('admins')).length <= 1) throw new HttpError(409, 'A store must keep at least one admin.');
      await store.delete('admins', email);
      await audit(store, req, 'ADMIN_REMOVED', `${me.name} removed admin ${target.name} (${email}).`);
      res.json({ status: 'success', message: 'Admin removed. Their session no longer works.' });
    })
  );

  // Sets a temporary password for a colleague who is locked out; they must choose their own at the next sign-in.
  router.post(
    '/:email/reset-password',
    handler(async (req, res) => {
      const me = user(res);
      const email = String(req.params.email).toLowerCase();
      if (email === me.id) throw new HttpError(400, 'Use "Change password" for your own account.');
      const target = await store.get('admins', email);
      if (!target) throw new HttpError(404, 'Admin not found.');
      const { password } = parse(adminResetSchema, req.body);
      await store.update('admins', email, { password: await bcrypt.hash(password, BCRYPT_ROUNDS), mustChangePassword: true });
      await audit(store, req, 'ADMIN_PASSWORD_RESET_BY_ADMIN', `${me.name} set a temporary password for ${target.name} (${email}).`);
      res.json({ status: 'success', message: 'Temporary password set. They must change it at their next sign-in.' });
    })
  );

  return router;
}

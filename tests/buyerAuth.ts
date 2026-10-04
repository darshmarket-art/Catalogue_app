import request from 'supertest';

/** Buyers sign in with a WhatsApp code only. Test apps set OTP_STATIC_CODE to this, so no message is sent. */
export const STATIC_CODE = '123456';

/** Signs a buyer in (creating the account the first time) the way the app does; returns the verify response (`body.token`, `body.user`). */
export async function otpBuyer(app: any, body: { phone: string; firmName?: string; ownerName?: string; marketHub?: string }, headers: Record<string, string> = {}) {
  await request(app).post('/api/auth/retailer/request-otp').set(headers).send({ phone: body.phone });
  return request(app).post('/api/auth/retailer/verify-otp').set(headers).send({ ...body, code: STATIC_CODE });
}

// api/quota/unlock.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import redis from '../../src/lib/kv';
import { getClientIp, getDeviceId, todayISO } from '../../src/lib/id';

// Minutos de ventana tras pago aprobado (1 consulta gratis)
const PAID_WINDOW_SECONDS = 5 * 60; // 5 min

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const ip = getClientIp(req);
    const device = getDeviceId(req) || ip;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const endpoint = String(body.endpoint || '').trim() || 'default';

    const day = todayISO();
    const baseKey = `q:${endpoint}:${device}:${day}`;
    const unlockKey = `unlock:${baseKey}`;

    // Coloca un “pase” de pago para la siguiente consulta
    await redis.set(unlockKey, '1', { ex: PAID_WINDOW_SECONDS });

    res.status(200).json({ ok: true, unlocked: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}

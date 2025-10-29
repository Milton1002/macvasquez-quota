// api/quota/check-consume.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import redis from '../../src/lib/kv';
import { getClientIp, getDeviceId, todayISO, secondsUntilTomorrowUTC } from '../../src/lib/id';

const DAILY_LIMIT = 3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const ip = getClientIp(req);
    const device = getDeviceId(req) || ip;

    // Body: { endpoint: "vehicular" | "nombres" | ... }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const endpoint = String(body.endpoint || '').trim() || 'default';

    const day = todayISO();
    const baseKey = `q:${endpoint}:${device}:${day}`;
    const unlockKey = `unlock:${baseKey}`;

    // ¿Pago aprobado (desbloqueo temporal)? => permite 1 consulta sin consumir cuota
    const unlocked = await redis.get<number | string>(unlockKey);
    if (unlocked) {
      await redis.del(unlockKey); // se consume el "pase" de pago
      const current = Number(await redis.get<number>(baseKey)) || 0;
      res.status(200).json({
        allowed: true,
        reason: 'paid',
        remaining: Math.max(0, DAILY_LIMIT - current),
        ip
      });
      return;
    }

    // Lectura de uso actual
    const current = Number(await redis.get<number>(baseKey)) || 0;

    if (current >= DAILY_LIMIT) {
      res.status(200).json({ allowed: false, reason: 'limit', remaining: 0, ip });
      return;
    }

    // Incrementar y asegurar expiración a medianoche UTC
    const next = await redis.incr(baseKey);
    if (next === 1) {
      await redis.expire(baseKey, secondsUntilTomorrowUTC());
    }

    res.status(200).json({
      allowed: true,
      reason: 'quota',
      remaining: Math.max(0, DAILY_LIMIT - next),
      ip
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}

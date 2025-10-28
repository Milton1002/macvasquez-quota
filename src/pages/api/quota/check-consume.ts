// src/pages/api/quota/check-consume.ts
import kv from '../../../../lib/kv';
import { getContext, keys, json } from '../../../../lib/id';

const DAILY_LIMIT = 3;
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { deviceId, dayKey } = getContext(req);
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || '').toLowerCase();

  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);

  const { countKey, unlockKey } = keys(dayKey, endpoint, deviceId);

  // ¿ya está desbloqueado por pago hoy?
  const isUnlocked = (await kv.get<string>(unlockKey)) === '1';
  if (isUnlocked) {
    return json({ allowed: true, reason: 'paid', remaining: Infinity });
  }

  // cuota: lee contador
  const current = Number((await kv.get<number>(countKey)) || 0);
  if (current >= DAILY_LIMIT) {
    return json({ allowed: false, reason: 'limit', remaining: 0 });
  }

  // INCR atómico + TTL (27h)
  const next = await kv.incr(countKey);
  if (next === 1) await kv.expire(countKey, 27 * 3600);

  const remaining = Math.max(DAILY_LIMIT - next, 0);
  return json({ allowed: true, reason: 'quota', remaining });
}

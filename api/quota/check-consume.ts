export const config = { runtime: 'edge' };

import kv from '@/src/lib/kv';
import { getIdentity } from '@/src/lib/id';

type Body = { endpoint?: 'vehicular' | 'nombres' };

function k(day: string, endpoint: string, id: string) {
  return {
    count: `q:${endpoint}:${day}:${id}:count`,
    unlock: `q:${endpoint}:${day}:${id}:unlock`,
  };
}

const LIMITS: Record<string, number> = {
  vehicular: 3,
  nombres: 3,
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });

  const { id, ip, dayKey } = getIdentity(req);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const endpoint = body.endpoint;
  if (!endpoint || !(endpoint in LIMITS)) {
    return json({ error: 'endpoint requerido' }, 400);
  }

  const keys = k(dayKey, endpoint, id);

  // ¿Está desbloqueado por pago?
  const unlocked = await kv.get<string>(keys.unlock);
  if (unlocked === '1') {
    return json({ allowed: true, reason: 'paid', remaining: 0, ip });
  }

  // Contador de uso por día
  const limit = LIMITS[endpoint];
  const current = (await kv.get<number>(keys.count)) ?? 0;

  if (current < limit) {
    const newVal = await kv.incr(keys.count);
    if (newVal === 1) {
      // primer uso del día → expira en ~24h
      await kv.expire(keys.count, 24 * 60 * 60);
    }
    const remaining = Math.max(0, limit - newVal);
    return json({ allowed: true, reason: 'quota', remaining, ip });
  }

  return json({ allowed: false, reason: 'limit', remaining: 0, ip });
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

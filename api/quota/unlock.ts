export const config = { runtime: 'edge' };

import kv from '@/src/lib/kv';
import { getIdentity } from '@/src/lib/id';

type Body = { endpoint?: 'vehicular' | 'nombres' };

function k(day: string, endpoint: string, id: string) {
  return {
    unlock: `q:${endpoint}:${day}:${id}:unlock`,
  };
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });

  const { id, dayKey } = getIdentity(req);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const endpoint = body.endpoint;
  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);

  const { unlock } = k(dayKey, endpoint, id);

  // marcamos desbloqueo válido por ~27h (tolerancia a husos horarios)
  await kv.set(unlock, '1', { ex: 27 * 60 * 60 });

  return json({ ok: true, unlocked: true });
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

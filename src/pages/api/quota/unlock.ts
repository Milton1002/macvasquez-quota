// src/pages/api/quota/unlock.ts
import kv from '../../../../lib/kv';
import { getContext, keys, json } from '../../../../lib/id';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { deviceId, dayKey } = getContext(req);
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || '').toLowerCase();

  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);

  const { unlockKey } = keys(dayKey, endpoint, deviceId);
  await kv.set(unlockKey, '1', { ex: 27 * 3600 });

  return json({ ok: true, unlocked: true });
}

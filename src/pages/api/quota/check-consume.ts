export const config = { runtime: 'edge' };

const DAILY_LIMIT = 3;

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { deviceId, dayKey } = getContext(req);
  const { endpoint } = await req.json().catch(() => ({})) as { endpoint?: string };
  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);

  const { countKey, unlockKey } = keys(dayKey, endpoint, deviceId);

  const isUnlocked = (await kvGet(unlockKey)) === '1';
  if (isUnlocked) return json({ allowed: true, reason: 'paid', remaining: Infinity });

  const current = Number((await kvGet(countKey)) || 0);
  if (current >= DAILY_LIMIT) return json({ allowed: false, reason: 'limit', remaining: 0 });

  const next = await kvIncr(countKey);
  if (next === 1) await kvExpire(countKey, 27 * 3600);

  return json({ allowed: true, reason: 'quota', remaining: Math.max(DAILY_LIMIT - next, 0) });
}

/* === utilidades mínimas inline (para evitar imports) === */
import { parse } from 'cookie';
async function kvFetch(path: string, init?: RequestInit) {
  const base = process.env.KV_REST_API_URL!;
  const token = process.env.KV_REST_API_TOKEN!;
  const headers = { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' };
  const r = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init?.headers||{}) }});
  return r;
}
async function kvGet(key: string) {
  const r = await kvFetch(`/get/${encodeURIComponent(key)}`);
  if (!r.ok) return null;
  const j = await r.json().catch(()=>null);
  return j?.result ?? null;
}
async function kvIncr(key: string) {
  const r = await kvFetch(`/incr/${encodeURIComponent(key)}`, { method: 'POST' });
  const j = await r.json();
  return j?.result ?? 0;
}
async function kvExpire(key: string, seconds: number) {
  await kvFetch(`/expire/${encodeURIComponent(key)}/${seconds}`, { method: 'POST' });
}
function json(data: any, init: number|ResponseInit = 200) {
  const status = typeof init === 'number' ? init : (init as ResponseInit).status || 200;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    }
  });
}
function getContext(req: Request) {
  const url = new URL(req.url);
  let deviceId = req.headers.get('x-device-id') || url.searchParams.get('deviceId') || '';
  const cookies = parse(req.headers.get('cookie') || '');
  if (!deviceId && cookies.deviceId) deviceId = cookies.deviceId;
  if (!deviceId) deviceId = crypto.randomUUID();
  const d = new Date(), dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { deviceId, dayKey, url };
}
function keys(dayKey: string, endpoint: string, deviceId: string) {
  const base = `${dayKey}:${endpoint}:${deviceId}`;
  return { countKey: `quota:${base}`, unlockKey: `unlock:${base}` };
}

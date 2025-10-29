export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { dayKey, id } = getIdentity(req);

  const { endpoint } = await safeJson(req);
  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);
  
  const { unlockKey } = keys(dayKey, endpoint, id);
  await kvSet(unlockKey, '1', 27 * 3600); // válido ~1 día

  return json({ ok: true, unlocked: true });
}

/* ===================== Utils ===================== */

function json(data: any, init: number | ResponseInit = 200) {
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

async function safeJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

function uuid() {
  // @ts-ignore
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getIdentity(req: Request) {
  const url = new URL(req.url);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
          || req.headers.get('x-real-ip') || '';
  const deviceHeader = req.headers.get('x-device-id') || '';
  const deviceQuery = url.searchParams.get('deviceId') || '';
  const deviceId = deviceHeader || deviceQuery || ip || uuid();

  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return { dayKey, id: deviceId };
}

function keys(dayKey: string, endpoint: string, id: string) {
  const base = `${dayKey}:${endpoint}:${id}`;
  return {
    countKey: `quota:${base}`,
    unlockKey: `unlock:${base}`
  };
}

function kvHeaders() {
  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN no configurados');
  return { base, token };
}

async function kvFetch(path: string, init?: RequestInit) {
  const { base, token } = kvHeaders();
  const headers = { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' };
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  return res;
}

async function kvSet(key: string, value: string, exSeconds?: number) {
  const body = exSeconds ? { value, ex: exSeconds } : { value };
  await kvFetch(`/set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(body) });
}

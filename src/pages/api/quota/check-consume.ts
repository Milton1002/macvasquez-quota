export const config = { runtime: 'edge' };

// === Configura tu límite aquí ===
const DAILY_LIMIT = 3;

/**
 * Body esperado: { "endpoint": "vehicular" | "nombres" }
 * Headers opcionales:
 *   - x-device-id: ID persistido por tu front (recomendado)
 *
 * Respuestas:
 *   - 200 { allowed:true, reason:"quota"|"paid", remaining:n }
 *   - 200 { allowed:false, reason:"limit", remaining:0 }
 */
export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1) Identidad por prioridad: x-device-id > query deviceId > IP > random
  const { dayKey, id, ip } = getIdentity(req);

  // 2) Leer endpoint del body
  const { endpoint } = await safeJson(req);
  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);

  // 3) Armar claves en KV
  const { countKey, unlockKey } = keys(dayKey, endpoint, id);

  // 4) ¿Ya está desbloqueado por pago?
  const unlocked = await kvGet(unlockKey);
  if (unlocked === '1') {
    return json({ allowed: true, reason: 'paid', remaining: Infinity });
  }

  // 5) Contador diario
  const current = Number((await kvGet(countKey)) || 0);
  if (current >= DAILY_LIMIT) {
    return json({ allowed: false, reason: 'limit', remaining: 0, ip });
  }

  // 6) Incrementar y poner TTL si es el primer uso
  const next = await kvIncr(countKey);
  if (next === 1) {
    // TTL ~ 27h para cubrir husos y no cortar justo a medianoche
    await kvExpire(countKey, 27 * 3600);
  }

  return json({
    allowed: true,
    reason: 'quota',
    remaining: Math.max(DAILY_LIMIT - next, 0),
    ip
  });
}

/* ===================== Utils (sin dependencias) ===================== */

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

function getIdentity(req: Request) {
  const url = new URL(req.url);
  const xfwd = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  const ip = xfwd || req.headers.get('x-real-ip') || '';
  const deviceHeader = req.headers.get('x-device-id') || '';
  const deviceQuery = url.searchParams.get('deviceId') || '';
  const deviceId = deviceHeader || deviceQuery || ip || crypto.randomUUID();

  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return { dayKey, id: deviceId, ip };
}

function keys(dayKey: string, endpoint: string, id: string) {
  const base = `${dayKey}:${endpoint}:${id}`;
  return {
    countKey: `quota:${base}`,
    unlockKey: `unlock:${base}`
  };
}

// ======== Upstash REST helpers (KV_REST_API_URL / KV_REST_API_TOKEN) ========

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

async function kvGet(key: string): Promise<string | null> {
  const r = await kvFetch(`/get/${encodeURIComponent(key)}`);
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j?.result ?? null;
}

async function kvIncr(key: string): Promise<number> {
  const r = await kvFetch(`/incr/${encodeURIComponent(key)}`, { method: 'POST' });
  const j = await r.json().catch(() => null);
  return Number(j?.result ?? 0);
}

async function kvExpire(key: string, seconds: number) {
  await kvFetch(`/expire/${encodeURIComponent(key)}/${seconds}`, { method: 'POST' });
}

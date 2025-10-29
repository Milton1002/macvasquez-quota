export const config = { runtime: 'edge' };

type Json = Record<string, unknown>;
const json = (o: Json, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

const DAY_MS = 24 * 60 * 60 * 1000;
const now = () => Date.now();
const dayKey = () => new Date(now()).toISOString().slice(0, 10); // YYYY-MM-DD

const kv = globalThis as unknown as {
  // @ts-ignore – simula KV; en tu proyecto real esto apunta a Upstash/Redis/Vercel KV
  __mem?: Map<string, { v: string; exp: number }>;
};
kv.__mem ??= new Map();

const kvGet = async (k: string) => {
  const r = kv.__mem!.get(k);
  if (!r) return null;
  if (r.exp && r.exp < now()) { kv.__mem!.delete(k); return null; }
  return r.v;
};
const kvIncr = async (k: string, ttlSec: number) => {
  const r = await kvGet(k);
  const n = (r ? parseInt(r, 10) : 0) + 1;
  kv.__mem!.set(k, { v: String(n), exp: now() + ttlSec * 1000 });
  return n;
};
const kvSet = async (k: string, v: string, ttlSec: number) => {
  kv.__mem!.set(k, { v, exp: now() + ttlSec * 1000 });
};

const getIdentity = (req: Request) => {
  const h = req.headers;
  // **ÚNICA forma de calcular el id, igual en todas las rutas**
  const dev = (h.get('x-device-id') || 'anon').trim().toLowerCase();
  const ip =
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    // fallback para pruebas locales
    '0.0.0.0';
  return `${dev}@${ip}`;
};

const k = {
  unlock: (d: string, ep: string, id: string) => `u:${d}:${ep}:${id}`,
  count: (d: string, ep: string, id: string) => `c:${d}:${ep}:${id}`,
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as any));
  const endpoint = String(body?.endpoint || '');
  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);

  const id = getIdentity(req);
  const d = dayKey();

  // 1) ¿está desbloqueado por pago?
  const paid = await kvGet(k.unlock(d, endpoint, id));
  if (paid) {
    return json({ allowed: true, reason: 'paid', remaining: 0, ip: id.split('@')[1] });
  }

  // 2) cuota
  const LIMIT = 3;
  const count = await kvIncr(k.count(d, endpoint, id), 27 * 3600); // 27h de TTL
  const remaining = Math.max(0, LIMIT - count);

  if (count <= LIMIT) {
    return json({ allowed: true, reason: 'quota', remaining, ip: id.split('@')[1] });
  }
  return json({ allowed: false, reason: 'limit', remaining: 0, ip: id.split('@')[1] });
}

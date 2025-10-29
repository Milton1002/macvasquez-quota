export const config = { runtime: 'edge' };

type Json = Record<string, unknown>;
const json = (o: Json, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

const now = () => Date.now();
const dayKey = () => new Date(now()).toISOString().slice(0, 10);

const kv = globalThis as unknown as {
  __mem?: Map<string, { v: string; exp: number }>;
};
kv.__mem ??= new Map();

const kvSet = async (k: string, v: string, ttlSec: number) => {
  kv.__mem!.set(k, { v, exp: now() + ttlSec * 1000 });
};

const getIdentity = (req: Request) => {
  const h = req.headers;
  const dev = (h.get('x-device-id') || 'anon').trim().toLowerCase();
  const ip =
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0';
  return `${dev}@${ip}`;
};

const k = {
  unlock: (d: string, ep: string, id: string) => `u:${d}:${ep}:${id}`,
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as any));
  const endpoint = String(body?.endpoint || '');
  if (!endpoint) return json({ error: 'endpoint requerido' }, 400);

  const id = getIdentity(req);
  const d = dayKey();

  // Desbloqueo válido ~1 día (27h de margen)
  await kvSet(k.unlock(d, endpoint, id), '1', 27 * 3600);

  return json({ ok: true, unlocked: true });
}

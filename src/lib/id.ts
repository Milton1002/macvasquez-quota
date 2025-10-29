// src/lib/id.ts
export function getIdentity(req: Request) {
  const idHeader = req.headers.get('x-device-id') || '';
  // toma el primer IP de X-Forwarded-For
  const xff = req.headers.get('x-forwarded-for') || '';
  const ip = (xff.split(',')[0] || '').trim();
  const id = idHeader || ip || 'anon';
  const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return { id, ip, dayKey };
}

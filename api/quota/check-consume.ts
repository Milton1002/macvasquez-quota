export const config = { runtime: "edge" };

import { kv, ttlUntilEndOfDay } from "../lib/kv";
import { getContext, json } from "../lib/id";

const DAILY_LIMIT = 3;

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { deviceId, dayKey, ip } = getContext(req);

  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const endpoint = (body.endpoint || "").trim().toLowerCase();
  if (!endpoint) return json({ error: "endpoint requerido" }, 400);

  const prefix = `quota:${dayKey}:${endpoint}`;
  const devKey = `${prefix}:count:${deviceId}`;
  const permitKey = `${prefix}:permit:${deviceId}`;

  // Si ya tiene permiso (pagó), pasa directo
  if (await kv.get(permitKey)) {
    return json({ allowed: true, reason: "paid", remaining: 0, ip });
  }

  // Lógica normal de conteo
  const current = (await kv.get<number>(devKey)) || 0;
  if (current >= DAILY_LIMIT) {
    return json({ allowed: false, reason: "limit", remaining: 0, ip });
  }

  const next = await kv.incr(devKey);
  if (next === 1) await kv.expire(devKey, ttlUntilEndOfDay());

  return json({
    allowed: true,
    reason: "quota",
    remaining: DAILY_LIMIT - next,
    ip,
  });
}

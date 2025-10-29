export const config = { runtime: "edge" };

import { kv, ttlUntilEndOfDay } from "../lib/kv";
import { getContext, json } from "../lib/id";

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { deviceId, dayKey } = getContext(req);

  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const endpoint = (body.endpoint || "").trim().toLowerCase();
  if (!endpoint) return json({ error: "endpoint requerido" }, 400);

  const prefix = `quota:${dayKey}:${endpoint}`;
  const devKey = `${prefix}:count:${deviceId}`;
  const permitKey = `${prefix}:permit:${deviceId}`;

  // Otorga permiso válido hasta fin de día
  await kv.set(permitKey, "1", { ex: ttlUntilEndOfDay() });
  await kv.del(devKey);

  return json({ ok: true, unlocked: true });
}

export const config = { runtime: "edge" };

import { kvGet, kvIncrWithTtl } from "@/lib/kv";
import { getIdentity, dayKey } from "@/lib/id";

const LIMIT = 3;
const TTL = 27 * 3600;

const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { id, ip } = getIdentity(req);
  const day = dayKey();

  let body: any = {};
  try { body = await req.json(); } catch {}
  const endpoint = String(body?.endpoint || "");
  if (!endpoint) return json({ error: "endpoint requerido" }, 400);

  // 1. ¿ya pagó?
  const paid = await kvGet(`u:${day}:${endpoint}:${id}`);
  if (paid) return json({ allowed: true, reason: "paid", remaining: 0, ip });

  // 2. cuota
  const used = await kvIncrWithTtl(`c:${day}:${endpoint}:${id}`, TTL);
  const remaining = Math.max(0, LIMIT - used);
  if (used <= LIMIT) return json({ allowed: true, reason: "quota", remaining, ip });

  return json({ allowed: false, reason: "limit", remaining: 0, ip });
}

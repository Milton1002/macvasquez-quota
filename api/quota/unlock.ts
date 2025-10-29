export const config = { runtime: "edge" };

import { kvSet } from "@/lib/kv";
import { getIdentity, dayKey } from "@/lib/id";

const TTL = 27 * 3600;

const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { id } = getIdentity(req);
  const day = dayKey();

  let body: any = {};
  try { body = await req.json(); } catch {}
  const endpoint = String(body?.endpoint || "");
  if (!endpoint) return json({ error: "endpoint requerido" }, 400);

  await kvSet(`u:${day}:${endpoint}:${id}`, "1", TTL);
  return json({ ok: true, unlocked: true });
}

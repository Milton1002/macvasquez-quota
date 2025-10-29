// src/lib/kv.ts
const URL = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

if (!URL || !TOKEN) {
  console.warn("❌ Falta configurar UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN");
}

async function upstash<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash error ${res.status}`);
  return res.json();
}

export async function kvGet(key: string): Promise<string | null> {
  const r = await upstash<{ result: string | null }>(`/get/${encodeURIComponent(key)}`);
  return r.result;
}

export async function kvSet(key: string, value: string, ttlSec?: number): Promise<true> {
  if (ttlSec && ttlSec > 0) {
    await upstash(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?ex=${ttlSec}`, { method: "POST" });
  } else {
    await upstash(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, { method: "POST" });
  }
  return true;
}

export async function kvIncrWithTtl(key: string, ttlSec: number): Promise<number> {
  const r = await upstash<{ result: number }>(`/incr/${encodeURIComponent(key)}`, { method: "POST" });
  if (r.result === 1 && ttlSec > 0) {
    await upstash(`/expire/${encodeURIComponent(key)}/${ttlSec}`, { method: "POST" });
  }
  return r.result;
}

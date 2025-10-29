import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error("Faltan variables de entorno: UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN");
}

export const kv = new Redis({ url, token });

export function ttlUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - now.getTime()) / 1000);
}

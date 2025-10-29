// src/lib/kv.ts
// Wrapper que funciona con @vercel/kv (KV_*) o @upstash/redis (UPSTASH_REDIS_*)
// y expone una interfaz kv.get/kv.set/kv.incr/kv.expire homogénea para Edge.

type KVLike = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
};

let kv: KVLike;

// Prioridad 1: Vercel KV (@vercel/kv)
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vercel = require('@vercel/kv');
  kv = vercel.kv as KVLike;
} else {
  // Prioridad 2: Upstash Redis (@upstash/redis)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Redis } = require('@upstash/redis');

  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

  if (!url || !token) {
    throw new Error(
      'Faltan variables de entorno para KV/Upstash. Define KV_REST_API_URL/KV_REST_API_TOKEN o UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.'
    );
  }

  const redis = new Redis({ url, token });

  kv = {
    async get<T = unknown>(key: string) {
      const v = await redis.get<T | null>(key);
      return (v ?? null) as T | null;
    },
    async set(key: string, value: unknown, opts?: { ex?: number }) {
      if (opts?.ex) {
        await redis.set(key, value as any, { ex: opts.ex });
      } else {
        await redis.set(key, value as any);
      }
    },
    async incr(key: string) {
      return await redis.incr(key);
    },
    async expire(key: string, seconds: number) {
      await redis.expire(key, seconds);
    },
  };
}

export default kv;

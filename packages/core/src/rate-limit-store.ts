import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";

/**
 * The few Redis commands the store needs. ioredis satisfies this as is.
 * For node-redis, wrap the camelCase methods: `{ incr: (k) => c.incr(k), pexpire: (k, ms) => c.pExpire(k, ms), ... }`.
 */
export interface RedisLike {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

/**
 * Shared rate-limit counters in Redis, so every app instance enforces the same limit.
 * Fixed window per key. If Redis fails, the error is passed to the request, so choose how to fail with your own wrapper.
 */
export function redisRateLimitStore(client: RedisLike, prefix = "rhea:rl:"): Store {
  let windowMs = 60_000;
  return {
    prefix,
    init(options: Options) {
      windowMs = options.windowMs;
    },
    async increment(key: string): Promise<ClientRateLimitInfo> {
      const k = prefix + key;
      const totalHits = await client.incr(k);
      let ttl = totalHits === 1 ? -1 : await client.pttl(k);
      // First hit, or a key that lost its expiry: start the window now so counters can never live forever.
      if (ttl < 0) {
        await client.pexpire(k, windowMs);
        ttl = windowMs;
      }
      return { totalHits, resetTime: new Date(Date.now() + ttl) };
    },
    async decrement(key: string) {
      await client.decr(prefix + key);
    },
    async resetKey(key: string) {
      await client.del(prefix + key);
    },
  };
}

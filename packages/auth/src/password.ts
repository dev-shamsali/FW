import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** scrypt cost parameters. The defaults meet the OWASP minimum for scrypt (N=2^17, r=8, p=1) and use about 128 MiB per hash. */
export interface PasswordOptions {
  /** CPU/memory cost, a power of two. Default 131072 (2^17). */
  cost?: number;
  blockSize?: number;
  parallelism?: number;
}

const DEFAULTS = { cost: 1 << 17, blockSize: 8, parallelism: 1 } as const;
const KEY_LEN = 64;
const SALT_LEN = 16;
/** Longer passwords are refused before hashing so a huge input cannot be used to burn CPU. */
export const MAX_PASSWORD_LENGTH = 1024;
const PREFIX = "scrypt";

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r + 1024 * 1024 };
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, KEY_LEN, options, (e, key) => (e ? reject(e) : resolve(key))));
}

function check(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length === 0) throw new TypeError("Password must be a non-empty string");
  if (password.length > MAX_PASSWORD_LENGTH) throw new RangeError(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
}

/** Hashes a password. The result is a self-describing string: `scrypt$N$r$p$salt$hash`. Store it as is. */
export async function hashPassword(password: string, options: PasswordOptions = {}): Promise<string> {
  check(password);
  const { cost, blockSize, parallelism } = { ...DEFAULTS, ...options };
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt, cost, blockSize, parallelism);
  return [PREFIX, cost, blockSize, parallelism, salt.toString("base64"), key.toString("base64")].join("$");
}

function parse(hash: string) {
  const parts = hash.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;
  const [, n, r, p, salt, key] = parts as [string, string, string, string, string, string];
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (![N, R, P].every(Number.isSafeInteger) || N < 2 || (N & (N - 1)) !== 0 || R < 1 || P < 1) return null;
  const saltBuf = Buffer.from(salt, "base64");
  const keyBuf = Buffer.from(key, "base64");
  if (saltBuf.length === 0 || keyBuf.length !== KEY_LEN) return null;
  return { N, R, P, salt: saltBuf, key: keyBuf };
}

let dummy: Promise<string> | undefined;

/**
 * Checks a password against a stored hash. Never throws for a wrong password or a malformed hash: it returns false.
 * Pass `null` when the user does not exist. It then spends the same time on a dummy hash, so response time does not reveal which emails are registered.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return false;
  const parsed = typeof hash === "string" ? parse(hash) : null;
  if (!parsed) {
    dummy ??= hashPassword("rhea-timing-equaliser");
    const d = parse(await dummy)!;
    await derive(password, d.salt, d.N, d.R, d.P);
    return false;
  }
  // Refuse costs far above anything this library produces, so a tampered hash cannot make the server allocate gigabytes.
  if (parsed.N > 1 << 20 || parsed.R > 32 || parsed.P > 16) return false;
  const key = await derive(password, parsed.salt, parsed.N, parsed.R, parsed.P);
  return timingSafeEqual(key, parsed.key);
}

/** True when a stored hash uses weaker parameters than the current defaults. Re-hash it after a successful login. */
export function needsRehash(hash: string, options: PasswordOptions = {}): boolean {
  const parsed = parse(hash);
  if (!parsed) return true;
  const { cost, blockSize, parallelism } = { ...DEFAULTS, ...options };
  return parsed.N < cost || parsed.R < blockSize || parsed.P < parallelism;
}

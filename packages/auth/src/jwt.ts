import { SignJWT, errors, jwtVerify } from "jose";
import { UnauthorizedError } from "@rheajs/core";

export interface JwtConfig {
  /** Signing secret, at least 32 bytes. Generate one with `openssl rand -base64 48`. Never commit it. */
  secret: string | Uint8Array;
  /** Required. Written to `iss` and checked on verify. */
  issuer: string;
  /** Required. Written to `aud` and checked on verify. */
  audience: string;
  /** Token lifetime. Default "15m". Keep access tokens short. */
  expiresIn?: string | number;
  /** Allowed clock difference in seconds. Default 5. */
  clockToleranceSec?: number;
}

export interface TokenClaims {
  /** Subject: the user id. */
  sub: string;
  /** Roles granted to the subject. */
  roles?: string[];
  /** Any extra non-sensitive claims. JWTs are signed, not encrypted: anyone holding one can read it. */
  [claim: string]: unknown;
}

export interface Jwt {
  sign(claims: TokenClaims, options?: { expiresIn?: string | number }): Promise<string>;
  /** Returns the verified claims, or throws UnauthorizedError (code TOKEN_EXPIRED or INVALID_TOKEN). */
  verify(token: string): Promise<TokenClaims>;
}

const MIN_SECRET_BYTES = 32;
const ALG = "HS256";
const RESERVED = new Set(["iss", "aud", "exp", "iat", "nbf", "jti"]);

/** Creates a signer and verifier. Only HS256 is accepted on verify, so a token cannot choose its own algorithm. */
export function createJwt(config: JwtConfig): Jwt {
  const key = typeof config.secret === "string" ? new TextEncoder().encode(config.secret) : config.secret;
  if (key.byteLength < MIN_SECRET_BYTES) throw new Error(`JWT secret must be at least ${MIN_SECRET_BYTES} bytes`);
  if (!config.issuer || !config.audience) throw new Error("JWT issuer and audience are required");
  const { issuer, audience } = config;

  return {
    async sign(claims, options = {}) {
      if (typeof claims.sub !== "string" || claims.sub === "") throw new TypeError("Token claims need a non-empty string sub");
      const extra: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(claims)) if (!RESERVED.has(k) && k !== "sub") extra[k] = v;
      return new SignJWT(extra)
        .setProtectedHeader({ alg: ALG, typ: "JWT" })
        .setSubject(claims.sub)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(options.expiresIn ?? config.expiresIn ?? "15m")
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALG],
          issuer,
          audience,
          clockTolerance: config.clockToleranceSec ?? 5,
          requiredClaims: ["sub", "exp"],
        });
        return payload as TokenClaims;
      } catch (e) {
        if (e instanceof errors.JWTExpired) throw new UnauthorizedError("Token expired", { code: "TOKEN_EXPIRED" });
        throw new UnauthorizedError("Invalid token", { code: "INVALID_TOKEN" });
      }
    },
  };
}

/**
 * Rhea.js authentication. Made by Shams Ali Shaikh.
 * @packageDocumentation
 */
export { hashPassword, verifyPassword, needsRehash, MAX_PASSWORD_LENGTH, type PasswordOptions } from "./password.js";
export { isCommonPassword } from "./common-passwords.js";
export { createJwt, type Jwt, type JwtConfig, type TokenClaims } from "./jwt.js";
export { authenticate, optionalAuth, requireRole, type AuthUser } from "./guards.js";
export {
  createRefreshTokens,
  createMemoryRefreshStore,
  type IssuedRefreshToken,
  type RefreshConfig,
  type RefreshRecord,
  type RefreshTokens,
  type RefreshTokenStore,
} from "./refresh.js";
export { assertAllowedOrigin, clearRefreshCookie, noStore, readCookie, requireAllowedOrigin, setRefreshCookie, type RefreshCookieOptions } from "./cookie.js";
export { createLockout, type Lockout, type LockoutConfig, type LockoutState } from "./lockout.js";

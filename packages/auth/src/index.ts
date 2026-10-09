/**
 * Rhea.js authentication. Made by Shams Ali Shaikh.
 * @packageDocumentation
 */
export { hashPassword, verifyPassword, needsRehash, MAX_PASSWORD_LENGTH, type PasswordOptions } from "./password.js";
export { createJwt, type Jwt, type JwtConfig, type TokenClaims } from "./jwt.js";
export { authenticate, optionalAuth, requireRole, type AuthUser } from "./guards.js";

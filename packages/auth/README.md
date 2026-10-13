# @rheajs/auth

Authentication for **Rhea.js**: password hashing, JWT access tokens and route guards.

Made by Shams Ali Shaikh. MIT licensed. Stable 1.x: semantic versioning applies. It has not had an independent security review; see SECURITY_AUDIT.md in the repository.

```ts
import { createJwt, hashPassword, verifyPassword, authenticate, requireRole } from "@rheajs/auth";
```

- `hashPassword`, `verifyPassword`, `needsRehash`: scrypt (N=2^17, r=8, p=1), random salt, constant-time compare, bounded input.
- `createJwt`: HS256 access tokens with required issuer and audience, short default lifetime, and a pinned algorithm.
- `authenticate`, `optionalAuth`, `requireRole`: Express middleware that read `Authorization: Bearer` and set `req.user`.

Needs `@rheajs/core` as a peer. Full guide: https://rhea.devcodehub.cloud/docs/authentication/

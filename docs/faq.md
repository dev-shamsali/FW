# FAQ

**Does Rhea.js replace Express?** No. It runs on Express 5 and exposes it as `app.express`.

**Is it production-ready?** It is released as stable (1.0) and its author runs it in production. What it does not have is an independent security review, and it is young: few people have used it. Read [SECURITY_AUDIT.md](https://github.com/dev-shamsali/FW/blob/main/SECURITY_AUDIT.md), try it on a staging environment, and decide for your own risk level. For anything handling money or health data, get your own review.

**Why not NestJS, Fastify or Hono?** They are good choices. Rhea.js targets teams that want Express compatibility plus a fixed project layout and security defaults, without decorators or dependency injection. We have not benchmarked against them and make no speed claims.

**Does it include auth?** No. Authentication is planned as an optional plugin.

**Which databases are supported?** `create` can set up MongoDB (official driver) or MySQL (`mysql2`) with pooling, a readiness endpoint and clean shutdown. Core itself is database-agnostic and there is no ORM. See [Databases](databases.html).

**Can I use JavaScript instead of TypeScript?** Yes. `create` asks for TypeScript or JavaScript, and for ES Modules or CommonJS. Generators follow your choice. Both CommonJS and ESM JavaScript projects are tested on Node.js 20, 22 and later in this repository.

**Why is `rhea` not the npm package name?** The name `rhea` on npm is an unrelated existing package. Rhea.js publishes under different names (`@rheajs/*`, `create-rhea`). Check the repository for the final names.

**Who makes it?** Shams Ali Shaikh.

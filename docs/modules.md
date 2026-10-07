# Modules

A module is a folder in `src/modules/` with a router exported for registration.

```bash
rhea generate module blog-posts
```

creates:

```text
src/modules/blog-posts/
  blog-posts.types.ts
  blog-posts.schema.ts
  blog-posts.repository.ts   in-memory; swap for a database
  blog-posts.service.ts
  blog-posts.controller.ts
  blog-posts.routes.ts
tests/integration/blog-posts.test.ts
```

and adds the router to `src/modules/index.ts` through the `// rhea:imports` and `// rhea:modules` markers. If you removed the markers, the CLI prints the two lines to add by hand.

Names are lowercase with hyphens. The singular form is derived naively (`categories` becomes `Category`, `users` becomes `User`): rename types if the derived name is wrong.

Generate single files with `rhea generate controller|service|route|middleware|validator <name>`.

import type { Names } from "../names.js";

export type Files = Record<string, string>;

const fill = (t: string, n: Names): string =>
  t
    .replaceAll("__KEBAB__", n.kebab)
    .replaceAll("__PASCAL__", n.pascal)
    .replaceAll("__CAMEL__", n.camel)
    .replaceAll("__SP__", n.singularPascal)
    .replaceAll("__SC__", n.singularCamel)
    .replaceAll("__SU__", n.singularUpper);

const T = {
  types: `export interface __SP__ {
  id: string;
  name: string;
  createdAt: string;
}

export interface Create__SP__Input {
  name: string;
}
`,
  schema: `import { z } from "@rheajs/core";

export const create__SP__Schema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const __SC__IdParams = z.object({
  id: z.uuid(),
});
`,
  repository: `import { randomUUID } from "node:crypto";
import type { Create__SP__Input, __SP__ } from "./__KEBAB__.types.js";

// In-memory store. Replace with a database adapter when you add one.
const items = new Map<string, __SP__>();

export const __CAMEL__Repository = {
  findAll: (): __SP__[] => [...items.values()],
  findById: (id: string): __SP__ | undefined => items.get(id),
  create(input: Create__SP__Input): __SP__ {
    const item: __SP__ = { id: randomUUID(), name: input.name, createdAt: new Date().toISOString() };
    items.set(item.id, item);
    return item;
  },
  delete: (id: string): boolean => items.delete(id),
};
`,
  service: `import { NotFoundError } from "@rheajs/core";
import { __CAMEL__Repository } from "./__KEBAB__.repository.js";
import type { Create__SP__Input, __SP__ } from "./__KEBAB__.types.js";

export const __CAMEL__Service = {
  list: (): __SP__[] => __CAMEL__Repository.findAll(),
  get(id: string): __SP__ {
    const item = __CAMEL__Repository.findById(id);
    if (!item) throw new NotFoundError("__SP__ not found", { code: "__SU___NOT_FOUND" });
    return item;
  },
  create: (input: Create__SP__Input): __SP__ => __CAMEL__Repository.create(input),
  remove(id: string): void {
    if (!__CAMEL__Repository.delete(id)) throw new NotFoundError("__SP__ not found", { code: "__SU___NOT_FOUND" });
  },
};
`,
  controller: `import { sendSuccess, type Request, type Response } from "@rheajs/core";
import { __CAMEL__Service } from "./__KEBAB__.service.js";

export const __CAMEL__Controller = {
  list(_req: Request, res: Response) {
    sendSuccess(res, __CAMEL__Service.list());
  },
  get(req: Request, res: Response) {
    sendSuccess(res, __CAMEL__Service.get(String(req.params["id"])));
  },
  create(req: Request, res: Response) {
    sendSuccess(res, __CAMEL__Service.create(req.body), "Created", 201);
  },
  remove(req: Request, res: Response) {
    __CAMEL__Service.remove(String(req.params["id"]));
    sendSuccess(res, null, "Deleted");
  },
};
`,
  routes: `import { Router, validate } from "@rheajs/core";
import { __CAMEL__Controller } from "./__KEBAB__.controller.js";
import { create__SP__Schema, __SC__IdParams } from "./__KEBAB__.schema.js";

export const __CAMEL__Router = Router();

__CAMEL__Router.get("/", __CAMEL__Controller.list);
__CAMEL__Router.get("/:id", validate({ params: __SC__IdParams }), __CAMEL__Controller.get);
__CAMEL__Router.post("/", validate(create__SP__Schema), __CAMEL__Controller.create);
__CAMEL__Router.delete("/:id", validate({ params: __SC__IdParams }), __CAMEL__Controller.remove);
`,
  test: `import type { RheaApp } from "@rheajs/core";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("/__KEBAB__", () => {
  let app: RheaApp;
  beforeAll(async () => {
    app = await buildApp().ready();
  });

  it("creates, reads and deletes", async () => {
    const created = await request(app.express).post("/__KEBAB__").send({ name: "first" });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect((await request(app.express).get("/__KEBAB__/" + id)).body.data.name).toBe("first");
    expect((await request(app.express).delete("/__KEBAB__/" + id)).status).toBe(200);
    expect((await request(app.express).get("/__KEBAB__/" + id)).status).toBe(404);
  });

  it("validates input", async () => {
    const res = await request(app.express).post("/__KEBAB__").send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
`,
  middleware: `import type { NextFunction, Request, Response } from "@rheajs/core";

export function __CAMEL__(_req: Request, _res: Response, next: NextFunction): void {
  // TODO: implement. Call next() to continue, or next(new SomeAppError()) to stop.
  next();
}
`,
  validator: `import { z } from "@rheajs/core";

export const create__SP__Schema = z.object({
  // TODO: describe the request body
});

export type Create__SP__Dto = z.infer<typeof create__SP__Schema>;
`,
};

export const moduleFiles = (n: Names): Files => ({
  [`src/modules/${n.kebab}/${n.kebab}.types.ts`]: fill(T.types, n),
  [`src/modules/${n.kebab}/${n.kebab}.schema.ts`]: fill(T.schema, n),
  [`src/modules/${n.kebab}/${n.kebab}.repository.ts`]: fill(T.repository, n),
  [`src/modules/${n.kebab}/${n.kebab}.service.ts`]: fill(T.service, n),
  [`src/modules/${n.kebab}/${n.kebab}.controller.ts`]: fill(T.controller, n),
  [`src/modules/${n.kebab}/${n.kebab}.routes.ts`]: fill(T.routes, n),
  [`tests/integration/${n.kebab}.test.ts`]: fill(T.test, n),
});

export const singleFile = (kind: string, n: Names): Files => {
  switch (kind) {
    case "controller":
      return { [`src/modules/${n.kebab}/${n.kebab}.controller.ts`]: fill(T.controller, n) };
    case "service":
      return { [`src/modules/${n.kebab}/${n.kebab}.service.ts`]: fill(T.service, n) };
    case "route":
      return { [`src/modules/${n.kebab}/${n.kebab}.routes.ts`]: fill(T.routes, n) };
    case "middleware":
      return { [`src/middleware/${n.kebab}.ts`]: fill(T.middleware, n) };
    case "validator":
      return { [`src/modules/${n.kebab}/${n.kebab}.schema.ts`]: fill(T.validator, n) };
    default:
      return {};
  }
};

export const registration = (n: Names) => ({
  importLine: `import { ${n.camel}Router } from "./${n.kebab}/${n.kebab}.routes.js";`,
  entryLine: `  { path: "/${n.kebab}", router: ${n.camel}Router },`,
});

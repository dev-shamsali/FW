import type { Names } from "../names.js";
import type { Database, ProjectOptions } from "./options.js";
import { syntax, tidy, type Syntax } from "./syntax.js";

export type Files = Record<string, string>;
export type Part = "types" | "schema" | "repository" | "service" | "controller" | "routes";

/** Which other parts a part imports. Generating a part also creates any of these that are missing. */
const DEPS: Record<Part, Part[]> = {
  types: [],
  schema: [],
  repository: ["types"],
  service: ["repository", "types"],
  controller: ["service", "repository", "types"],
  routes: ["controller", "schema", "service", "repository", "types"],
};

/** TypeScript has a types file. JavaScript does not, so it is dropped from the dependency list. */
export const partDeps = (part: Part, o: ProjectOptions): Part[] => DEPS[part].filter((p) => o.language === "ts" || p !== "types");
export const allParts = (o: ProjectOptions): Part[] =>
  (["types", "schema", "repository", "service", "controller", "routes"] as Part[]).filter((p) => o.language === "ts" || p !== "types");

export const partPath = (part: Part, n: Names, o: ProjectOptions): string => `src/modules/${n.kebab}/${n.kebab}.${part}.${syntax(o).ext}`;

const dbHint = (db: Database): string =>
  db === "mongodb"
    ? "Replace with MongoDB queries using getDb() from src/config/database."
    : db === "mysql"
      ? "Replace with MySQL queries using getPool() from src/config/database."
      : "Replace with your database.";

function render(part: Part, s: Syntax, n: Names): string {
  const { t, imp, impType, rel, exp } = s;
  const SP = n.singularPascal;
  const SC = n.singularCamel;
  const C = n.camel;
  const K = n.kebab;
  const repo = `${C}Repository`;
  const service = `${C}Service`;
  const typesFrom = rel(`./${K}.types`);
  const types = `Create${SP}Input`;

  switch (part) {
    case "types":
      return `export interface ${SP} {
  id: string;
  name: string;
  createdAt: string;
}

export interface ${types} {
  name: string;
}
`;
    case "schema":
      return `${imp(["z"], "@rheajs/core")}

const create${SP}Schema = z.object({
  name: z.string().trim().min(1).max(100),
});

const ${SC}IdParams = z.object({
  id: z.uuid(),
});

${exp([`create${SP}Schema`, `${SC}IdParams`])}
`;
    case "repository":
      return `${imp(["randomUUID"], "node:crypto")}
${impType([types, SP], typesFrom)}

// In-memory store. ${dbHint(s.o.database)}
const items = new Map${t(`<string, ${SP}>`)}();

const ${repo} = {
  findAll: ()${t(`: ${SP}[]`)} => [...items.values()],
  findById: (id${t(": string")})${t(`: ${SP} | undefined`)} => items.get(id),
  create(input${t(`: ${types}`)})${t(`: ${SP}`)} {
    const item${t(`: ${SP}`)} = { id: randomUUID(), name: input.name, createdAt: new Date().toISOString() };
    items.set(item.id, item);
    return item;
  },
  delete: (id${t(": string")})${t(": boolean")} => items.delete(id),
};

${exp([repo])}
`;
    case "service":
      return `${imp(["NotFoundError"], "@rheajs/core")}
${imp([repo], rel(`./${K}.repository`))}
${impType([types, SP], typesFrom)}

const ${service} = {
  list: ()${t(`: ${SP}[]`)} => ${repo}.findAll(),
  get(id${t(": string")})${t(`: ${SP}`)} {
    const item = ${repo}.findById(id);
    if (!item) throw new NotFoundError("${SP} not found", { code: "${n.singularUpper}_NOT_FOUND" });
    return item;
  },
  create: (input${t(`: ${types}`)})${t(`: ${SP}`)} => ${repo}.create(input),
  remove(id${t(": string")})${t(": void")} {
    if (!${repo}.delete(id)) throw new NotFoundError("${SP} not found", { code: "${n.singularUpper}_NOT_FOUND" });
  },
};

${exp([service])}
`;
    case "controller":
      return `${imp(["sendSuccess"], "@rheajs/core")}
${impType(["Request", "Response"], "@rheajs/core")}
${imp([service], rel(`./${K}.service`))}

const ${C}Controller = {
  list(_req${t(": Request")}, res${t(": Response")}) {
    sendSuccess(res, ${service}.list());
  },
  get(req${t(": Request")}, res${t(": Response")}) {
    sendSuccess(res, ${service}.get(String(req.params["id"])));
  },
  create(req${t(": Request")}, res${t(": Response")}) {
    sendSuccess(res, ${service}.create(req.body), "Created", 201);
  },
  remove(req${t(": Request")}, res${t(": Response")}) {
    ${service}.remove(String(req.params["id"]));
    sendSuccess(res, null, "Deleted");
  },
};

${exp([`${C}Controller`])}
`;
    case "routes":
      return `${imp(["Router", "validate"], "@rheajs/core")}
${imp([`${C}Controller`], rel(`./${K}.controller`))}
${imp([`create${SP}Schema`, `${SC}IdParams`], rel(`./${K}.schema`))}

const ${C}Router = Router();

${C}Router.get("/", ${C}Controller.list);
${C}Router.get("/:id", validate({ params: ${SC}IdParams }), ${C}Controller.get);
${C}Router.post("/", validate(create${SP}Schema), ${C}Controller.create);
${C}Router.delete("/:id", validate({ params: ${SC}IdParams }), ${C}Controller.remove);

${exp([`${C}Router`])}
`;
  }
}

/** One part plus the parts it depends on. Existing files are skipped by the caller. */
export function partFile(part: Part, n: Names, o: ProjectOptions): [string, string] {
  return [partPath(part, n, o), tidy(render(part, syntax(o), n))];
}

export function moduleTest(n: Names, o: ProjectOptions): [string, string] {
  const s = syntax(o);
  const K = n.kebab;
  return [
    `tests/integration/${K}.test.${s.testExt}`,
    tidy(`${s.ts ? 'import type { RheaApp } from "@rheajs/core";' : ""}
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("/${K}", () => {
  let app${s.t(": RheaApp")};
  beforeAll(async () => {
    app = await buildApp().ready();
  });

  it("creates, reads and deletes", async () => {
    const created = await request(app.express).post("/${K}").send({ name: "first" });
    expect(created.status).toBe(201);
    const id${s.t(": string")} = created.body.data.id;
    expect((await request(app.express).get("/${K}/" + id)).body.data.name).toBe("first");
    expect((await request(app.express).delete("/${K}/" + id)).status).toBe(200);
    expect((await request(app.express).get("/${K}/" + id)).status).toBe(404);
  });

  it("validates input", async () => {
    const res = await request(app.express).post("/${K}").send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
`),
  ];
}

export function moduleFiles(n: Names, o: ProjectOptions): Files {
  const files: Files = Object.fromEntries(allParts(o).map((p) => partFile(p, n, o)));
  const [tp, tc] = moduleTest(n, o);
  files[tp] = tc;
  return files;
}

export function middlewareFile(n: Names, o: ProjectOptions): Files {
  const s = syntax(o);
  return {
    [`src/middleware/${n.kebab}.${s.ext}`]: tidy(`${s.impType(["NextFunction", "Request", "Response"], "@rheajs/core")}

function ${n.camel}(_req${s.t(": Request")}, _res${s.t(": Response")}, next${s.t(": NextFunction")})${s.t(": void")} {
  // TODO: implement. Call next() to continue, or next(new SomeAppError()) to stop.
  next();
}

${s.exp([n.camel])}
`),
  };
}

/** Lines added to src/modules/index.* when a module is generated. */
export const registration = (o: ProjectOptions, n: Names) => {
  const s = syntax(o);
  return {
    importLine: s.imp([`${n.camel}Router`], s.rel(`./${n.kebab}/${n.kebab}.routes`)),
    entryLine: `  { path: "/${n.kebab}", router: ${n.camel}Router },`,
  };
};

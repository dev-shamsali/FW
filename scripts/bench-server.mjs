// Server side of scripts/bench.mjs. Usage: node scripts/bench-server.mjs <scenario> <port>
import express from "express";
import { createApp, Router, sendSuccess, validate, z } from "@rheajs/core";
import { authenticate, createJwt } from "@rheajs/auth";

const [scenario, port] = [process.argv[2], Number(process.argv[3])];
const jwt = createJwt({ secret: "b".repeat(48), issuer: "bench", audience: "bench" });
const body = z.object({ email: z.email(), age: z.number().int().min(0) });
// The limit is raised so the benchmark measures the pipeline, not the 429 path.
const rhea = () => createApp({ env: "production", handleSignals: false, rateLimit: { limit: 1_000_000_000 } });

if (scenario === "express") {
  const app = express();
  app.disable("x-powered-by");
  app.get("/hello", (_req, res) => res.json({ success: true, data: { hello: "world" } }));
  app.post("/users", express.json(), (req, res) => res.json({ success: true, data: req.body }));
  app.listen(port, "127.0.0.1");
} else {
  const app = rhea();
  app.mount(
    "/hello",
    Router().get("/", (_q, r) => sendSuccess(r, { hello: "world" })),
  );
  app.mount(
    "/users",
    Router().post("/", validate(body), (req, r) => sendSuccess(r, req.body)),
  );
  app.mount(
    "/me",
    Router().get("/", authenticate(jwt), (req, r) => sendSuccess(r, req.user)),
  );
  console.log("TOKEN=" + (await jwt.sign({ sub: "u1", roles: ["user"] })));
  await app.start(port, "127.0.0.1");
}

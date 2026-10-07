import type { RequestHandler, Router } from "express";
import type { HookFn, HookName } from "./lifecycle.js";
import type { Logger } from "./logger.js";

/** Narrow surface handed to plugins. Plugins never receive framework internals. */
export interface PluginContext {
  readonly logger: Logger;
  readonly production: boolean;
  addMiddleware(handler: RequestHandler): void;
  mount(path: string, router: Router): void;
  onHook(name: HookName, fn: HookFn): void;
}

export interface Plugin {
  name: string;
  setup(ctx: PluginContext): void | Promise<void>;
}

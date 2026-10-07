export type HookName = "beforeInit" | "init" | "afterInit" | "beforeStart" | "afterStart" | "beforeShutdown" | "afterShutdown";
export type HookFn = () => void | Promise<void>;

export class Hooks {
  private map = new Map<HookName, HookFn[]>();

  on(name: HookName, fn: HookFn): void {
    const list = this.map.get(name);
    if (list) list.push(fn);
    else this.map.set(name, [fn]);
  }

  /** Runs hooks in registration order. Shutdown hooks all run even if one throws. */
  async run(name: HookName, opts: { continueOnError?: boolean; onError?: (e: unknown) => void } = {}): Promise<void> {
    for (const fn of this.map.get(name) ?? []) {
      try {
        await fn();
      } catch (e) {
        if (!opts.continueOnError) throw e;
        opts.onError?.(e);
      }
    }
  }
}

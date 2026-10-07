#!/usr/bin/env node
import { run } from "@rheajs/cli";

process.exitCode = await run(["create", ...process.argv.slice(2)]);

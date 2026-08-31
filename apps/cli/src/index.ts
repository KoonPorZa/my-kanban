#!/usr/bin/env node

import { runCli } from './commands.js';
import { ConfigStore } from './config-store.js';
import { MacOsKeychain } from './keychain.js';
import { inspectProject } from './mcp-client.js';
import { checkClient, launch, readSecret } from './runtime.js';

try {
  const exitCode = await runCli(process.argv.slice(2), {
    keychain: new MacOsKeychain(),
    store: new ConfigStore(),
    inspect: inspectProject,
    readSecret,
    checkClient,
    launch,
    stdout: console.log,
    stderr: console.error,
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'kanban failed');
  process.exitCode = 1;
}

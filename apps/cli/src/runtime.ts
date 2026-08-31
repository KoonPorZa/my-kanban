import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export async function readSecret(prompt: string) {
  if (!process.stdin.isTTY) throw new Error('Token input requires an interactive terminal');
  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise<string>((resolve, reject) => {
    let secret = '';
    const finish = (error?: Error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stderr.write('\n');
      if (error) reject(error);
      else resolve(secret);
    };
    const onData = (chunk: string) => {
      if (chunk === '\u0003') finish(new Error('Cancelled'));
      else if (chunk === '\r' || chunk === '\n') finish();
      else if (chunk === '\u007f') secret = secret.slice(0, -1);
      else secret += chunk;
    };
    process.stdin.on('data', onData);
  });
}

export async function checkClient(client: 'codex' | 'claude') {
  if (client === 'codex') {
    try {
      const path = join(homedir(), '.codex', 'config.toml');
      await access(path);
      const config = await readFile(path, 'utf8');
      return (
        config.includes('[mcp_servers.my_kanban]') &&
        config.includes('bearer_token_env_var = "KANBAN_MCP_TOKEN"')
      );
    } catch {
      return false;
    }
  }

  const result = spawnSync('claude', ['mcp', 'get', 'my-kanban'], { stdio: 'ignore' });
  return result.status === 0;
}

export function launch(command: 'codex' | 'claude', args: string[], token: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, KANBAN_MCP_TOKEN: token },
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

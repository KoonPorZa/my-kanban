import { spawn } from 'node:child_process';

const KEYCHAIN_SERVICE = 'com.koonporza.my-kanban';

export class MacOsKeychain {
  async save(alias: string, token: string) {
    await runSecurity(
      ['add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', alias, '-w'],
      keychainPasswordInput(token)
    );
  }

  async get(alias: string) {
    return (
      await runSecurity(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', alias, '-w'])
    ).trim();
  }

  async remove(alias: string) {
    await runSecurity(['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', alias]);
  }
}

export function keychainPasswordInput(token: string) {
  return `${token}\n${token}\n`;
}

function runSecurity(args: string[], input?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('/usr/bin/security', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `security exited with code ${code}`));
    });
    child.stdin.end(input);
  });
}

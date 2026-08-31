import type { CliDependencies } from './types.js';

const DEFAULT_URL = 'https://kanban.koonporza.com/mcp';

export async function runCli(argv: string[], dependencies: CliDependencies) {
  const [command, action, alias, ...rest] = argv;

  if (command === 'project' && action === 'add' && alias) {
    const url = option(rest, '--url') ?? DEFAULT_URL;
    const token = (await dependencies.readSecret('MCP token: ')).trim();
    if (!token) throw new Error('Token is required');
    const context = await dependencies.inspect(url, token);
    await dependencies.keychain.save(alias, token);
    await dependencies.store.upsert({ alias, url, ...context });
    dependencies.stdout(`Saved ${alias} → ${context.projectName}`);
    return 0;
  }

  if (command === 'project' && action === 'list') {
    const projects = await dependencies.store.list();
    if (!projects.length) dependencies.stdout('No saved Projects.');
    for (const project of projects) {
      dependencies.stdout(
        `${project.alias}\t${project.projectName}\texpires ${project.expiresAt}\tlast used ${project.lastUsedAt ?? 'never'}`
      );
    }
    return 0;
  }

  if (command === 'project' && action === 'remove' && alias) {
    await dependencies.keychain.remove(alias);
    await dependencies.store.remove(alias);
    dependencies.stdout(`Removed ${alias} from this Mac.`);
    return 0;
  }

  if ((command === 'codex' || command === 'claude') && action) {
    const project = await dependencies.store.get(action);
    if (!project) throw new Error(`Unknown Project alias: ${action}`);
    const token = await dependencies.keychain.get(action);
    const context = await dependencies.inspect(project.url, token);
    await dependencies.store.upsert({ ...project, ...context });
    if (!(await dependencies.checkClient(command))) {
      dependencies.stderr(setupInstructions(command, project.url));
      return 2;
    }
    const separator = rest.indexOf('--');
    const childArgs = separator >= 0 ? rest.slice(separator + 1) : rest;
    return dependencies.launch(command, childArgs, token);
  }

  dependencies.stderr(usage());
  return 2;
}

function option(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function setupInstructions(client: 'codex' | 'claude', url: string) {
  if (client === 'codex') {
    return `Add this user-level configuration to ~/.codex/config.toml:\n\n[mcp_servers.my_kanban]\nurl = "${url}"\nbearer_token_env_var = "KANBAN_MCP_TOKEN"`;
  }
  return `Run this once:\n\nclaude mcp add --transport http --scope user my-kanban ${url} --header 'Authorization: Bearer \${KANBAN_MCP_TOKEN}'`;
}

function usage() {
  return [
    'Usage:',
    '  kanban project add <alias> [--url <mcp-url>]',
    '  kanban project list',
    '  kanban project remove <alias>',
    '  kanban codex <alias> [-- <args>]',
    '  kanban claude <alias> [-- <args>]',
  ].join('\n');
}

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { ProjectAlias } from './types.js';

export class ConfigStore {
  constructor(
    private readonly path = join(
      process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
      'my-kanban',
      'projects.json'
    )
  ) {}

  async list() {
    return this.read();
  }

  async get(alias: string) {
    return (await this.read()).find((project) => project.alias === alias) ?? null;
  }

  async upsert(project: ProjectAlias) {
    const projects = (await this.read()).filter((item) => item.alias !== project.alias);
    projects.push(project);
    await this.write(projects.sort((left, right) => left.alias.localeCompare(right.alias)));
  }

  async remove(alias: string) {
    await this.write((await this.read()).filter((project) => project.alias !== alias));
  }

  private async read(): Promise<ProjectAlias[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as unknown;
      return Array.isArray(parsed) ? (parsed as ProjectAlias[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async write(projects: ProjectAlias[]) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(projects, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
  }
}

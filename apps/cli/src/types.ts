export type ProjectAlias = {
  alias: string;
  url: string;
  projectId: string;
  projectName: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type ProjectContext = Omit<ProjectAlias, 'alias' | 'url'>;

export type CliDependencies = {
  keychain: {
    save(alias: string, token: string): Promise<void>;
    get(alias: string): Promise<string>;
    remove(alias: string): Promise<void>;
  };
  store: {
    list(): Promise<ProjectAlias[]>;
    get(alias: string): Promise<ProjectAlias | null>;
    upsert(project: ProjectAlias): Promise<void>;
    remove(alias: string): Promise<void>;
  };
  inspect(url: string, token: string): Promise<ProjectContext>;
  readSecret(prompt: string): Promise<string>;
  checkClient(client: 'codex' | 'claude'): Promise<boolean>;
  launch(command: 'codex' | 'claude', args: string[], token: string): Promise<number>;
  stdout(message: string): void;
  stderr(message: string): void;
};

# Kanban helper CLI

The macOS `kanban` helper opens a Codex CLI or Claude Code CLI process with one
Project-scoped My Kanban MCP token. An alias is local metadata only; the server
always derives the Project boundary from the bearer token.

## Build and use locally

```sh
corepack pnpm cli:build
corepack pnpm --dir apps/cli link --global
kanban project add personal --url http://localhost:8083/mcp
kanban project list
kanban codex personal
kanban claude personal -- --continue
kanban project remove personal
```

`project add` reads the token through hidden terminal input and validates it
against `get_context` before saving. The secret is stored in macOS Keychain under
service `com.koonporza.my-kanban`. The metadata file
`~/.config/my-kanban/projects.json` is mode `0600` and never contains a token.
`project remove` deletes only the local credential; revoke the server token from
the Web UI when access must stop.

## One-time client configuration

Codex must have this user-level entry in `~/.codex/config.toml`:

```toml
[mcp_servers.my_kanban]
url = "https://kanban.koonporza.com/mcp"
bearer_token_env_var = "KANBAN_MCP_TOKEN"
```

For local development, temporarily change `url` to
`http://localhost:8083/mcp`. Configure Claude once with:

```sh
claude mcp add --transport http --scope user my-kanban \
  https://kanban.koonporza.com/mcp \
  --header 'Authorization: Bearer ${KANBAN_MCP_TOKEN}'
```

The helper checks the corresponding user-level configuration before launch and
injects `KANBAN_MCP_TOKEN` only into the selected child process tree. It does not
read Git state or create repository-local client configuration.

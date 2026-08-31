# My Kanban

My Kanban is a private personal Kanban and Scrum application. The repository is
a pnpm workspace with a Next.js frontend, a NestJS API, and PostgreSQL through
Prisma. The current foundation includes the adapted Kanban board from Minimal
TypeScript v7, local database migrations, health endpoints, and production
builds. The current MVP also includes Project-scoped Remote MCP access for AI
clients and a macOS helper CLI.

> **Note:** This is a preview application under active development. Google
> login, PostgreSQL-backed sessions, and owner-scoped Board API persistence are
> locally verified together with the MCP vertical slice. Railway and Cloudflare
> production deployment has not started yet.

## Repository structure

The workspace keeps deployable applications separate from generated or shared
tooling.

```text
apps/web/             Next.js App Router and Minimal Kanban UI
apps/api/             NestJS Express API and Prisma schema
apps/cli/             macOS Project-scoped Codex/Claude launcher
packages/api-client/  Generated OpenAPI client target
packages/config/      Shared tool configuration target
.railway/              Railway TypeScript Infrastructure as Code
.github/workflows/     Continuous integration checks
spec/                 Product, architecture, data, and infrastructure specs
compose.yaml          Local PostgreSQL 16 service
```

## Prerequisites

Install the following tools before you start local development.

- Node.js 22 or newer
- Corepack with pnpm 10.26.2
- Colima
- Docker CLI with Docker Compose

## Local setup

Use the following sequence to install the workspace and initialize PostgreSQL.

1. Install dependencies.

   ```sh
   corepack pnpm install --frozen-lockfile
   ```

2. Create local environment files when they don't exist.

   ```sh
   cp .env.example .env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Start Colima and PostgreSQL.

   ```sh
   colima start
   corepack pnpm db:up
   ```

4. Apply database migrations.

   ```sh
   corepack pnpm db:migrate
   ```

5. Start Web and API development servers.

   ```sh
   corepack pnpm dev
   ```

Open `http://localhost:8083/auth/jwt/sign-in` and continue with an allowed Google
account. The API listens on `http://localhost:3001`, and the Web service proxies
`/api/*` and `/mcp` to the API. Manage Project tokens at
`http://localhost:8083/dashboard/mcp-access`.

## MCP access

Each MCP access token is bound to exactly one Project for 90 days. The raw
secret appears only once when created; the database stores only its prefix and
SHA-256 hash. Revocation takes effect on the next MCP request.

The public client endpoint is `/mcp` on the Web service. Local clients use
`http://localhost:8083/mcp`; production will use
`https://kanban.koonporza.com/mcp`. The server exposes Project/Column reads and
full Task create, read, update, move, archive, and restore access. It does not
allow Project/Column mutation or hard delete. `create_tasks` accepts at most ten
items and rolls the entire batch back if any item is invalid.

Build and run the macOS helper from the repository:

```sh
corepack pnpm cli:build
corepack pnpm --dir apps/cli link --global
kanban project add personal --url http://localhost:8083/mcp
kanban project list
kanban codex personal
kanban claude personal
```

The helper reads the token without echoing it, verifies the bound Project,
stores the secret in macOS Keychain, and keeps only non-secret metadata in
`~/.config/my-kanban/projects.json`. See
[the helper CLI guide](./apps/cli/README.md) for one-time Codex and Claude MCP
configuration.

## Git workflow

All changes follow Gitflow. Start features from `develop`, merge verified work
back into `develop`, and reserve `main` for releases. See the
[contribution guide](./CONTRIBUTING.md) for branch names and validation rules.

## Validation

Run the workspace checks before you commit a change.

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Regenerate the OpenAPI artifact and Orval client after changing API DTOs or
controllers.

```sh
corepack pnpm api:generate
```

The API exposes liveness at `/health/live`, readiness at `/health/ready`, and
Swagger UI at `/api/docs`.

GitHub Actions runs the same formatting, type, lint, test, and build checks with
PostgreSQL 16 for pushes and pull requests targeting `develop` or `main`.

## Specifications

Use these documents as the source of truth for product and technical decisions.

- [Product requirements](./spec/spec-design-personal-kanban-scrum-board.md)
- [System architecture](./spec/spec-architecture-kanban-system.md)
- [Technology stack](./spec/spec-architecture-technology-stack.md)
- [PostgreSQL data specification](./spec/spec-data-kanban-postgresql.md)
- [Railway deployment specification](./spec/spec-infrastructure-railway-deployment.md)
- [MCP task management specification](./spec/spec-integration-mcp-task-management.md)
- [Implementation status](./spec/implementation-status.md)

## Deployment boundary

The target production topology is Railway `web`, `api`, and `Postgres` services,
with `kanban.koonporza.com` on the Web service through Cloudflare. The desired
state is defined in [the Railway IaC guide](./.railway/README.md), but no Railway
project, service, database, domain, or Cloudflare record has been created or
changed yet.

The Remote MCP endpoint uses the same public Web domain at
`https://kanban.koonporza.com/mcp`; the NestJS API and PostgreSQL remain private
Railway services. The macOS `kanban` helper loads one Project token from Keychain
for each Codex CLI or Claude Code session without binding to Git.

## Next steps

Create or link the production Railway project, review the IaC plan, set sealed
Google/session variables, and connect the Web and API services to `main`. Then
deploy API and Web, add the Railway-provided CNAME/TXT records to Cloudflare,
and run the production login, Board, MCP, network, log, and backup smoke checks.
The remaining manual local MCP UI test is deferred and does not block this
release-readiness phase.

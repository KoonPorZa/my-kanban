# My Kanban

My Kanban is a private personal Kanban and Scrum application. The repository is
a pnpm workspace with a Next.js frontend, a NestJS API, and PostgreSQL through
Prisma. The current foundation includes the adapted Kanban board from Minimal
TypeScript v7, local database migrations, health endpoints, and production
builds.

> **Note:** This is a preview application under active development. The board
> currently uses an in-browser TanStack Query adapter. Google login and
> PostgreSQL-backed sessions are locally verified. Board API persistence is
> next; Project-scoped Remote MCP access is specified but not implemented yet.

## Repository structure

The workspace keeps deployable applications separate from generated or shared
tooling.

```text
apps/web/             Next.js App Router and Minimal Kanban UI
apps/api/             NestJS Express API and Prisma schema
packages/api-client/  Generated OpenAPI client target
packages/config/      Shared tool configuration target
spec/                 Product, architecture, data, and infrastructure specs
compose.yaml          Local PostgreSQL 16 service
```

## Prerequisites

Install the following tools before you start local development.

- Node.js 20 or newer
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
`/api/*` to the API.

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

The API exposes liveness at `/health/live`, readiness at `/health/ready`, and
Swagger UI at `/api/docs`.

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
with `kanban.koonporza.com` on the Web service through Cloudflare. No Railway or
Cloudflare resource has been created or changed yet. Production deployment
starts only after the local authentication and persistence slice is complete
and the owner explicitly requests deployment.

The approved Remote MCP endpoint will use the same public Web domain at
`https://kanban.koonporza.com/mcp`; the NestJS API and PostgreSQL remain private
Railway services. A planned macOS `kanban` helper will load one Project token
from Keychain for each Codex CLI or Claude Code session without binding to Git.

## Next steps

The next vertical slice adds shared Board application services, owner-scoped
Project and Issue endpoints, API persistence, and the generated Orval client.
The MCP adapter, Project-token UI, and helper CLI follow on top of those shared
services.

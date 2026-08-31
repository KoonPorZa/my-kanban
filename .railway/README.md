# Railway infrastructure

This directory defines the production Railway project as TypeScript
Infrastructure as Code (IaC). The configuration creates the `web`, `api`, and
`Postgres` resources, keeps API and database traffic private, runs Prisma
migrations before API deployment, and attaches `kanban.koonporza.com` only to
the Web service.

> **Warning:** `railway config apply` changes external infrastructure. Review a
> fresh plan before you apply it. Never add secrets to `railway.ts`.

## Local validation

Validate the TypeScript authoring file without contacting Railway.

```sh
corepack pnpm railway:validate
```

The workspace requires Node.js 22 or newer for the official `railway` IaC
package. Railway CLI 5.42.1 or newer is also required for planning and applying
the configuration.

## Configuration boundary

The IaC file manages the following non-secret desired state.

- It creates one Railway project graph with `web`, `api`, and `Postgres`.
- It pins Railpack to Node.js 22 and installs with the frozen pnpm lockfile.
- It builds both applications from the shared monorepo root.
- It runs `prisma migrate deploy` before each API deployment.
- It checks Web at `/health/live` and API at `/health/ready`.
- It places one production replica of each application in Singapore.
- It references PostgreSQL and the API through Railway private networking.
- It preserves Google OAuth, email allowlist, and session secrets already held
  by Railway.

The file intentionally omits a GitHub source. This prevents the first
infrastructure apply from deploying an application before required secrets are
set. Connect both services to `KoonPorZa/my-kanban` on `main` only after the
variables are complete.

## Production workflow

Use this sequence from a release commit on `main`.

1. Link the repository to the target Railway project and `production`
   environment.
2. Run `railway config plan` and review every create, update, and delete.
3. Run `railway config apply` only after the plan matches the release intent.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `ALLOWED_GOOGLE_EMAILS`, and `SESSION_SECRET` on the `api` service through
   Railway sealed variables.
5. Connect both application services to `KoonPorZa/my-kanban` on `main`.
6. Deploy `api` first, wait for a terminal successful status, and then deploy
   `web`.
7. Add the CNAME and TXT records returned for `kanban.koonporza.com` to
   Cloudflare.
8. Verify HTTPS, Google login, Board persistence, the MCP endpoint, private
   networking, logs, and database backups.

## Next steps

Create or link the production Railway project, review the first IaC plan, and
set sealed variables before connecting either service to GitHub.

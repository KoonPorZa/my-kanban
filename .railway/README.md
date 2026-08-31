# Railway infrastructure

This directory defines the production Railway project as TypeScript
Infrastructure as Code (IaC). The configuration creates the `web`, `api`, and
`Postgres` resources, keeps API and database traffic private, and runs Prisma
migrations before API deployment. Register `kanban.koonporza.com` on the Web
service after the first deployment because Railway IaC doesn't support custom
domain registration.

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
- It fixes the private API port at `3001` so the Web rewrite resolves reliably.
- It preserves Google OAuth, email allowlist, and session secrets already held
  by Railway.
- It keeps both application services connected to `KoonPorZa/my-kanban` on
  `main` and waits for GitHub checks.
- It intentionally omits the custom domain because Railway rejects domain
  registration from TypeScript IaC.

The GitHub source is now part of desired state because production secrets are
complete and both services already deploy from `main`. For a fresh project, set
the sealed variables before the first apply or temporarily remove the source
entries during bootstrap.

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
7. Register `kanban.koonporza.com` on the `web` service with Railway CLI or the
   Railway dashboard.
8. Add the CNAME and TXT records returned for `kanban.koonporza.com` to
   Cloudflare.
9. Verify HTTPS, Google login, Board persistence, the MCP endpoint, private
   networking, logs, and database backups.

## Next steps

Production is provisioned and connected to `main`. Before Phase 2, complete the
credential-gated checks and recovery actions in
[`spec/production-closeout.md`](../spec/production-closeout.md). Do not apply a
Postgres region change until a restorable backup exists and the downtime window
has been accepted.

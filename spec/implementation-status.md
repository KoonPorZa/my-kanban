---
title: Personal Kanban Implementation Status
version: 1.8
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [implementation, status, phase-0, kanban]
---

# Introduction

เอกสารนี้บันทึกสถานะ implementation เทียบกับ PRD และ specifications ณ วันที่
August 31, 2026 Foundation, Google authentication, Board persistence,
Project-scoped Remote MCP Phase 1A, MVP release-readiness และ production deploy
ผ่าน automated verification ตามรายการด้านล่างแล้ว งาน credential-gated และ recovery
ที่ยังค้างบันทึกไว้ใน `production-closeout.md`

## 1. Completed foundation

รายการต่อไปนี้มี implementation และ verification ใน local workspace แล้ว

- pnpm workspace มี `apps/web`, `apps/api`, `apps/cli`, `packages/api-client` และ
  `packages/config`
- Next.js starter อยู่ใน `apps/web` และ production build ผ่าน
- Kanban board จาก
  `~/Minimal_TypeScript_v7.0.0/next-ts/src/sections/kanban` ถูก adapt เข้า
  `apps/web/src/sections/kanban`
- Kanban route พร้อมใช้งานที่ `/dashboard/kanban`
- NestJS ใช้ default Express adapter พร้อม validation, Helmet, CORS, Swagger และ
  graceful shutdown hooks
- API มี `/health/live` และ `/health/ready`; readiness ตรวจ PostgreSQL จริง
- Prisma มี migration แรกสำหรับ User, identity, session, Workspace, Project,
  Board Column และ Issue
- PostgreSQL 16 ทำงานผ่าน Colima และ Docker Compose
- Web, API และ packages ผ่าน typecheck, lint และ production build
- API health unit test และ local health smoke test ผ่าน
- Google OIDC ใช้ state, nonce, verified email และ `ALLOWED_GOOGLE_EMAILS`
- Session ID cookie เก็บสถานะฝั่ง PostgreSQL ใน `http_sessions`
- Auth guard ป้องกัน endpoint โดย default และตรวจ allowlist ซ้ำทุก request
- Login ครั้งแรกสร้าง Owner, Workspace, Project และ default columns ใน transaction
- Google callback, session cookie, `/api/v1/me`, profile UI และ logout ผ่าน browser
  verification ด้วย account ใน allowlist
- Google authentication merge เข้า `develop` ที่ commit `13f36d0`
- Repository ใช้ Gitflow โดย MCP specification พัฒนาผ่าน
  `feature/mcp-requirements` ก่อน merge เข้า `develop`
- Project, Board และ Issue modules ใช้ owner-scoped repository/application-service
  boundary ร่วมกัน
- Board columns และ Issues persist ใน PostgreSQL พร้อม BIGINT gap ranking, soft archive
  และ optimistic version checks
- REST API รองรับ Board aggregate, task create/update/move/archive และ column
  create/update/move/clear/archive
- OpenAPI artifact สร้างจาก NestJS source และ Orval สร้าง Axios/TanStack Query client
  แบบ deterministic
- Kanban UI ใช้ generated client, optimistic rollback, refetch ทุก 15 วินาที และ
  refetch เมื่อ window focus

## 2. Board persistence implementation

Temporary local adapter ถูกแทนด้วย API-backed adapter แล้ว Board ที่โหลดจาก
`GET /api/v1/projects/:projectId/board` เป็น source of truth และ mutation ทุกชนิดที่อยู่
ใน MVP ส่งผ่าน generated client ไป application services ก่อน persist ใน PostgreSQL

Surface สำหรับ assignee, comment และ attachment ถูกตัดออกตามขอบเขต single-user MVP
ส่วน priority, label, description, checklist และ drag-and-drop ยังอยู่ใน UI baseline

## 3. Completed MCP Phase 1A

MCP vertical slice มี implementation บน `feature/mcp-task-access` และผ่าน local
protocol/integration verification แล้ว

- Production endpoint ใช้ Streamable HTTP ที่
  `https://kanban.koonporza.com/mcp` ผ่าน Web proxy ไป private NestJS API
- NestJS ใช้ official `@modelcontextprotocol/sdk` version `1.30.0` และสร้าง transport
  แยกต่อ MCP session
- Access token หนึ่งรายการผูก Project เดียว, อายุคงที่ 90 วัน, แสดง raw token ครั้งเดียว
  และ revoke แยกรายการได้
- Prisma migration เพิ่ม `mcp_access_tokens`, `mutation_idempotency` และ
  `mcp_audit_events`; raw token ไม่ถูก persist
- MCP อ่าน Project/Columns และทำ Task read/create/update/move/archive/restore ได้ แต่
  แก้ Project/Columns หรือ hard delete ไม่ได้
- `create_tasks` รับได้ไม่เกิน 10 รายการและทำงานแบบ atomic; mutation อื่นทำทีละ Task
- Mutation ใช้ version check, idempotency key และ audit log ทุกครั้ง
- Web มีหน้า `/dashboard/mcp-access` สำหรับสร้าง token, แสดง secret ครั้งเดียว, list,
  revoke และดู audit events
- Web `/mcp` proxy ส่ง bearer, MCP protocol และ session headers ไป private API
- Board refetch ทุก 15 วินาทีและเมื่อ browser กลับมา focus
- macOS helper CLI `kanban` เก็บ token ใน Keychain และเปิด Codex/Claude session แบบ
  Project-scoped โดยไม่ผูก Git repository
- MCP session revalidate bearer token ทุก request, lock token ต่อ session, ตรวจ Origin,
  rate limit 60 requests/minute และ prune idle session หลังหนึ่งชั่วโมง

## 4. Completed MVP release readiness

Release-readiness มี source-controlled configuration, production safeguards และ
Railway/Cloudflare resources ที่ใช้งานจริงแล้ว

- `.railway/railway.ts` กำหนด `web`, `api` และ `Postgres` เป็น Railway TypeScript
  Infrastructure as Code ในไฟล์เดียว
- IaC pin Node.js 22, Railpack, frozen pnpm install, Singapore region, private
  references, Prisma pre-deploy migration และ healthchecks
- Web มี `/health/live` ที่ตอบ HTTP `200` โดยไม่ redirect ส่วน API ใช้
  `/health/ready` ที่ตรวจ PostgreSQL
- NestJS production logger ใช้ JSON และ request log มี request ID, method, path ที่
  ไม่มี query string, status และ duration โดยไม่เก็บ headers หรือ body
- GitHub Actions รัน PostgreSQL 16 migrations, format, typecheck, lint, test และ build
  บน push/pull request ของ `develop` และ `main`
- Root typecheck ตรวจ Railway IaC ด้วย official `railway` package
- Railway CLI version `5.45.10` link กับ Project `my-kanban` และ environment
  `production` แล้ว
- Manual local MCP UI test ถูก defer ตามคำสั่งผู้ใช้และไม่ block phase นี้

## 5. Completed vertical slices

งานต่อไปนี้เสร็จและผ่าน automated verification แล้ว

1. เพิ่ม Project, Board และ Issue NestJS modules พร้อม owner scoping
2. สร้าง OpenAPI artifact และ Orval Axios/TanStack Query client
3. เปลี่ยน temporary local adapter เป็น API persistence พร้อม optimistic rollback
4. เพิ่ม PostgreSQL integration tests และ Supertest HTTP tests
5. เพิ่ม Project-token REST API, generated Orval client และ management UI
6. เพิ่ม Streamable HTTP MCP adapter ที่ reuse Boards/Issues services
7. เพิ่ม idempotency reservation, atomic batch และ mutation audit trail
8. เพิ่ม Web proxy และ macOS Keychain helper CLI

Authenticated browser smoke ของหน้า MCP access ถูก defer ตามคำสั่งผู้ใช้ ส่วน actual
Codex และ Claude CLI smoke เรียก `get_context` ผ่าน Web `/mcp` สำเร็จ Automated
protocol, mutation และ HTTP proxy smoke ผ่านแล้ว

## 6. Verification record

Foundation มี evidence ล่าสุดดังนี้

| Check                             | Result                               |
| --------------------------------- | ------------------------------------ |
| `corepack pnpm railway:validate`  | Passed                               |
| `corepack pnpm typecheck`         | Passed                               |
| `corepack pnpm lint`              | Passed                               |
| `corepack pnpm test`              | Passed; API 23, Web 3, CLI 4 tests   |
| `corepack pnpm build`             | Passed for Web, API, client, and CLI |
| `corepack pnpm api:generate`      | Passed; deterministic output         |
| `corepack pnpm format:check`      | Passed                               |
| `prisma validate`                 | Passed                               |
| `prisma migrate deploy`           | Passed; 3 migrations, none pending   |
| `GET /health/live`                | `200 {"status":"ok"}`                |
| `GET /health/ready`               | `200 {"status":"ready"}`             |
| Swagger JSON                      | Served from `/api/docs-json`         |
| `GET /api/v1/me` without session  | `401`                                |
| `GET /api/v1/auth/google`         | `302` with state and nonce           |
| Google callback in browser        | Passed with allowed account          |
| Authenticated profile UI          | Displays Google name/email/avatar    |
| Direct `POST /mcp`, invalid token | `401`, MCP JSON-RPC error            |
| Web proxy `POST /mcp`             | Preserves `401` and bearer challenge |
| MCP protocol integration          | 7 cases passed against PostgreSQL    |
| Production Web root               | `200` over verified HTTPS            |
| Production Web liveness           | `200`                                |
| Production API unauthenticated    | `401` through same-origin proxy      |
| Production MCP missing/invalid    | `401` through public Web proxy       |
| Google OAuth production redirect  | Correct HTTPS callback               |
| API/Postgres public exposure      | No domain and no TCP proxy           |
| Production credential log scan    | No token/header pattern found        |
| Railway deployment status         | Web, API, Postgres `SUCCESS`         |
| Railway production region         | All services in Singapore            |
| Post-region Prisma deploy         | 3 migrations, none pending           |

## 7. Deployment status

Railway production มี `web`, `api` และ `Postgres` online โดย Web มี custom domain
`kanban.koonporza.com` และ Railway-generated domain
`web-production-4f560e.up.railway.app` ที่รอลบหลัง Owner ยืนยัน exact domain API และ
PostgreSQL ไม่มี public domain/TCP proxy Certificate ของ custom domain valid และ Google
login ผ่าน browser แล้ว

Web, API และ Postgres อยู่ Singapore region เดียวกันแล้ว การย้าย Postgres deployment
`58ae38a5-9724-449c-bb16-07877c793939` สำเร็จและ API pre-deploy ตรวจพบ migration
ครบ 3 รายการโดยไม่มี migration ค้าง Volume เดิมยัง mount อยู่และ application smoke
ผ่านหลังย้าย

Railway plan ปัจจุบันไม่รองรับ volume backup/PITR Product Owner ยอมรับการข้าม backup
ก่อน Phase 2 เพราะยังไม่มีข้อมูลใช้งานที่ต้องเก็บ การเปิด backup หรือ logical export
ก่อนมีข้อมูลสำคัญเป็น hardening task ใน Phase 3

## 8. Next steps

ปิด checklist ใน `production-closeout.md`: authenticated Board persistence,
Cloudflare SSL mode และ public bypass domain จากนั้นจึงเริ่ม Phase 2: Scrum MVP
Product Owner เลื่อน MCP mutation, revoke และ project-isolation acceptance ไว้ภายหลัง
รายการนี้ยังไม่ผ่านและต้องทดสอบก่อนประกาศ MCP production-ready

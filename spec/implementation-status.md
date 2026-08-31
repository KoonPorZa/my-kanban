---
title: Personal Kanban Implementation Status
version: 1.4
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [implementation, status, phase-0, kanban]
---

# Introduction

เอกสารนี้บันทึกสถานะ implementation เทียบกับ PRD และ specifications ณ วันที่
August 31, 2026 Foundation, Google authentication, Board persistence และ
Project-scoped Remote MCP Phase 1A ผ่าน local automated verification แล้ว

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

## 4. Completed vertical slices

งานต่อไปนี้เสร็จและผ่าน automated verification แล้ว

1. เพิ่ม Project, Board และ Issue NestJS modules พร้อม owner scoping
2. สร้าง OpenAPI artifact และ Orval Axios/TanStack Query client
3. เปลี่ยน temporary local adapter เป็น API persistence พร้อม optimistic rollback
4. เพิ่ม PostgreSQL integration tests และ Supertest HTTP tests
5. เพิ่ม Project-token REST API, generated Orval client และ management UI
6. เพิ่ม Streamable HTTP MCP adapter ที่ reuse Boards/Issues services
7. เพิ่ม idempotency reservation, atomic batch และ mutation audit trail
8. เพิ่ม Web proxy และ macOS Keychain helper CLI

Authenticated browser smoke ของหน้า MCP access และ manual Codex/Claude launch ยังไม่
ได้รันใน execution environment นี้ Automated protocol tests และ HTTP proxy smoke ผ่านแล้ว

## 5. Verification record

Foundation มี evidence ล่าสุดดังนี้

| Check                             | Result                               |
| --------------------------------- | ------------------------------------ |
| `corepack pnpm typecheck`         | Passed                               |
| `corepack pnpm lint`              | Passed                               |
| `corepack pnpm test`              | Passed; API 21, Web 2, CLI 4 tests   |
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

## 6. Deployment status

ยังไม่มีการ provision หรือแก้ไข Railway และ Cloudflare resource Local implementation
พร้อมเป็นฐานสำหรับ target topology ที่มี Railway `web`, `api` และ `Postgres` services
โดย public domain มีเพียง `kanban.koonporza.com`

## 7. Next steps

รัน authenticated browser smoke ของ MCP access UI และ manual helper smoke กับ Codex
และ Claude Code โดยใช้ local endpoint จากนั้นเตรียม Railway environment variables,
deploy migration/Web/private API/PostgreSQL และผูก Cloudflare domain ตามคำสั่งผู้ใช้

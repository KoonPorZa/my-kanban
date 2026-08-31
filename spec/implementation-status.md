---
title: Personal Kanban Implementation Status
version: 1.3
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [implementation, status, phase-0, kanban]
---

# Introduction

เอกสารนี้บันทึกสถานะ implementation เทียบกับ PRD และ specifications ณ วันที่
August 31, 2026 Foundation, Google authentication และ Board API persistence ผ่าน
local verification แล้ว Remote MCP requirements ได้รับอนุมัติแล้วและเป็น phase ถัดไป

## 1. Completed foundation

รายการต่อไปนี้มี implementation และ verification ใน local workspace แล้ว

- pnpm workspace มี `apps/web`, `apps/api`, `packages/api-client` และ
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

## 3. Approved MCP requirements

MCP scope ถูก crystallize แล้วใน specification แยก แต่ยังไม่มี schema, endpoint, UI
หรือ helper CLI implementation

- Production endpoint ใช้ Streamable HTTP ที่
  `https://kanban.koonporza.com/mcp` ผ่าน Web proxy ไป private NestJS API
- Access token หนึ่งรายการผูก Project เดียว, อายุคงที่ 90 วัน, แสดง raw token ครั้งเดียว
  และ revoke แยกรายการได้
- MCP อ่าน Project/Columns และทำ Task read/create/update/move/archive/restore ได้ แต่
  แก้ Project/Columns หรือ hard delete ไม่ได้
- `create_tasks` รับได้ไม่เกิน 10 รายการและทำงานแบบ atomic; mutation อื่นทำทีละ Task
- Mutation ใช้ version check, idempotency key และ audit log ทุกครั้ง
- Board refetch ทุก 15 วินาทีและเมื่อ browser กลับมา focus
- macOS helper CLI `kanban` เก็บ token ใน Keychain และเปิด Codex/Claude session แบบ
  Project-scoped โดยไม่ผูก Git repository

## 4. Completed Board persistence slice

งานต่อไปนี้เสร็จและผ่าน automated verification แล้ว

1. เพิ่ม Project, Board และ Issue NestJS modules พร้อม owner scoping
2. สร้าง OpenAPI artifact และ Orval Axios/TanStack Query client
3. เปลี่ยน temporary local adapter เป็น API persistence พร้อม optimistic rollback
4. เพิ่ม PostgreSQL integration tests และ Supertest HTTP tests

Authenticated browser smoke ยังไม่ได้รันซ้ำใน execution environment นี้เพราะไม่มี
browser runtime ให้ attach แต่ production build และ HTTP-level behavior ผ่านแล้ว

## 5. Verification record

Foundation มี evidence ล่าสุดดังนี้

| Check                            | Result                              |
| -------------------------------- | ----------------------------------- |
| `corepack pnpm typecheck`        | Passed                              |
| `corepack pnpm lint`             | Passed                              |
| `corepack pnpm test`             | Passed; API 14 and Web 1 test       |
| `corepack pnpm build`            | Passed for Web, API, and API client |
| `corepack pnpm api:generate`     | Passed; deterministic output        |
| `corepack pnpm format:check`     | Passed                              |
| `prisma validate`                | Passed                              |
| `prisma migrate deploy`          | Passed; 2 migrations, none pending  |
| `GET /health/live`               | `200 {"status":"ok"}`               |
| `GET /health/ready`              | `200 {"status":"ready"}`            |
| Swagger JSON                     | Served from `/api/docs-json`        |
| `GET /api/v1/me` without session | `401`                               |
| `GET /api/v1/auth/google`        | `302` with state and nonce          |
| Google callback in browser       | Passed with allowed account         |
| Authenticated profile UI         | Displays Google name/email/avatar   |

## 6. Deployment status

ยังไม่มีการ provision หรือแก้ไข Railway และ Cloudflare resource Local implementation
พร้อมเป็นฐานสำหรับ target topology ที่มี Railway `web`, `api` และ `Postgres` services
โดย public domain มีเพียง `kanban.koonporza.com`

## 7. Next steps

เริ่ม Phase 1A ด้วย MCP token/schema/audit migration แล้วเพิ่ม Streamable HTTP adapter
ที่ reuse Board และ Issues application services ชุดปัจจุบัน จากนั้นทำ Project-token UI,
Web `/mcp` proxy และ macOS helper CLI เมื่อ local MCP acceptance tests ผ่านจึงเริ่ม
Railway deployment ตามคำสั่งผู้ใช้

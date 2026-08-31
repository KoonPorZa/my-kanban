---
title: Personal Kanban Implementation Status
version: 1.2
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [implementation, status, phase-0, kanban]
---

# Introduction

เอกสารนี้บันทึกสถานะ implementation เทียบกับ PRD และ specifications ณ วันที่
August 31, 2026 Foundation และ Google authentication ผ่าน local verification แล้ว แต่
Phase 0 ยังไม่เสร็จจนกว่า Board API จะ persist ข้อมูลจริง Remote MCP requirements
ได้รับอนุมัติแล้วและยังไม่ได้ implement

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

## 2. Temporary implementation

Kanban UI ใช้ temporary local adapter เพื่อให้ตรวจ interaction และ visual baseline
ได้ก่อน API modules พร้อม Adapter นี้ใช้ TanStack Query cache แต่ยังไม่ persist ข้อมูล
หลัง reload และยังไม่ถือว่า requirements ด้าน persistence ผ่าน

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

## 4. Pending Phase 0 work

งานต่อไปนี้ต้องเสร็จก่อนปิด Phase 0

1. เพิ่ม Project, Board และ Issue NestJS modules พร้อม owner scoping
2. สร้าง OpenAPI artifact และ Orval TanStack Query client
3. เปลี่ยน temporary local adapter เป็น API persistence พร้อม optimistic rollback
4. เพิ่ม API integration และ browser smoke tests

## 5. Verification record

Foundation มี evidence ล่าสุดดังนี้

| Check                            | Result                              |
| -------------------------------- | ----------------------------------- |
| `corepack pnpm typecheck`        | Passed                              |
| `corepack pnpm lint`             | Passed                              |
| `corepack pnpm test`             | Passed; API 5 and Web 1 test        |
| `corepack pnpm build`            | Passed for Web, API, and API client |
| `prisma validate`                | Passed                              |
| `prisma migrate dev --name init` | Applied to local PostgreSQL         |
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

ทำ Board read/write application services เป็น business-logic boundary ร่วมสำหรับ REST
และ MCP ก่อน จากนั้นเพิ่ม API persistence, MCP token/schema/adapter และ helper CLI
ตามลำดับ เมื่อ local acceptance tests ผ่านจึงเริ่ม Railway deployment ตามคำสั่งผู้ใช้

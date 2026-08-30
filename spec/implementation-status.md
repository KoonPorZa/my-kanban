---
title: Personal Kanban Implementation Status
version: 1.1
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [implementation, status, phase-0, kanban]
---

# Introduction

เอกสารนี้บันทึกสถานะ implementation เทียบกับ PRD และ specifications ณ วันที่
August 31, 2026 Foundation และ authentication implementation พร้อมแล้ว แต่ Phase 0
ยังไม่เสร็จจนกว่า Google callback จะผ่าน manual verification และ Board API จะ persist
ข้อมูลจริง

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
- Repository ใช้ Gitflow โดยงานปัจจุบันอยู่บน `feature/google-auth`

## 2. Temporary implementation

Kanban UI ใช้ temporary local adapter เพื่อให้ตรวจ interaction และ visual baseline
ได้ก่อน API modules พร้อม Adapter นี้ใช้ TanStack Query cache แต่ยังไม่ persist ข้อมูล
หลัง reload และยังไม่ถือว่า requirements ด้าน persistence ผ่าน

Surface สำหรับ assignee, comment และ attachment ถูกตัดออกตามขอบเขต single-user MVP
ส่วน priority, label, description, checklist และ drag-and-drop ยังอยู่ใน UI baseline

## 3. Pending Phase 0 work

งานต่อไปนี้ต้องเสร็จก่อนปิด Phase 0

1. ยืนยัน Google callback และ session cookie ผ่าน browser ด้วย account ใน allowlist
2. เพิ่ม Project, Board และ Issue NestJS modules พร้อม owner scoping
3. สร้าง OpenAPI artifact และ Orval TanStack Query client
4. เปลี่ยน temporary local adapter เป็น API persistence พร้อม optimistic rollback
5. เพิ่ม API integration และ browser smoke tests

## 4. Verification record

Foundation มี evidence ล่าสุดดังนี้

| Check                            | Result                              |
| -------------------------------- | ----------------------------------- |
| `corepack pnpm typecheck`        | Passed                              |
| `corepack pnpm lint`             | Passed                              |
| `corepack pnpm test`             | Passed; API has 5 tests             |
| `corepack pnpm build`            | Passed for Web, API, and API client |
| `prisma validate`                | Passed                              |
| `prisma migrate dev --name init` | Applied to local PostgreSQL         |
| `GET /health/live`               | `200 {"status":"ok"}`               |
| `GET /health/ready`              | `200 {"status":"ready"}`            |
| Swagger JSON                     | Served from `/api/docs-json`        |
| `GET /api/v1/me` without session | `401`                               |
| `GET /api/v1/auth/google`        | `302` with state and nonce          |

## 5. Deployment status

ยังไม่มีการ provision หรือแก้ไข Railway และ Cloudflare resource Local implementation
พร้อมเป็นฐานสำหรับ target topology ที่มี Railway `web`, `api` และ `Postgres` services
โดย public domain มีเพียง `kanban.koonporza.com`

## 6. Next steps

ยืนยัน login ผ่าน browser แล้วเชื่อม Board read/write path ตั้งแต่ Web proxy ผ่าน
NestJS ไป PostgreSQL เมื่อ local acceptance tests ผ่านจึงเริ่ม Railway deployment
ตามคำสั่งผู้ใช้

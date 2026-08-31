---
title: Personal Kanban Railway Deployment Specification
version: 1.3
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [infrastructure, railway, cloudflare, postgresql, deployment]
---

# Introduction

เอกสารนี้กำหนด topology และ deployment contract สำหรับ Personal Kanban and Scrum
Board ทุก runtime component ต้อง deploy ใน Railway Project เดียวกัน โดยใช้
`kanban.koonporza.com` เป็น public Web และ Remote MCP entry point ที่จัดการ DNS ผ่าน
Cloudflare ส่วน API และ PostgreSQL ใช้ Railway private networking เท่านั้น

## 1. Purpose & scope

ข้อกำหนดนี้ครอบคลุม Railway Project, services, environments, build commands,
variables, domain, Cloudflare DNS, healthchecks, migration, deployment sequence,
backup และ rollback สำหรับ MVP เอกสารนี้ไม่ได้อนุญาตให้สร้างหรือแก้ Railway
resources จนกว่าผู้ใช้จะสั่ง deploy โดยตรง

### 1.1 Production topology

Production ต้องใช้ topology ต่อไปนี้

```text
Internet
  -> Cloudflare DNS and optional proxy
  -> https://kanban.koonporza.com
  -> Railway web service (Next.js)
  -> Railway private network
  -> Railway api service (NestJS + Express)
  -> Railway private network
  -> Railway PostgreSQL service

Codex CLI or Claude Code
  -> HTTPS Streamable HTTP /mcp with Bearer token
  -> https://kanban.koonporza.com/mcp
  -> Railway web service transparent proxy
  -> Railway private api service
```

## 2. Definitions

คำต่อไปนี้ใช้ตาม Railway resource model

- **Project**: Container ของ services และ environments สำหรับ `my-kanban`
- **Environment**: Configuration plane ที่แยก variables และ resources ของแต่ละ stage
- **Service**: Deployable unit ได้แก่ `web`, `api` และ `Postgres`
- **Railpack**: Railway builder ที่ตรวจภาษาและ framework จาก source
- **Railway IaC**: TypeScript desired state ใน `.railway/railway.ts` ที่ใช้ plan
  และ apply ระดับ Project
- **Reference variable**: Railway variable ที่อ้างค่าจาก service อื่น
- **Private domain**: Internal DNS ภายใต้ `railway.internal`
- **Custom domain**: Domain ที่ผู้ใช้เป็นเจ้าของและผูกกับ Railway service
- **Pre-deploy command**: Command ที่ต้องผ่านก่อน Railway สลับ traffic
- **Healthcheck**: HTTP endpoint ที่ Railway ใช้ยืนยัน deployment readiness
- **Remote MCP**: Streamable HTTP endpoint ที่ AI client ใช้จัดการ Task ของ Project
  ตาม bearer token

## 3. Requirements, constraints & guidelines

Infrastructure ต้องลด public surface, ใช้ configuration ที่ทำซ้ำได้ และป้องกัน
deployment ที่ schema ไม่พร้อม

### 3.1 Railway resource requirements

Resource ทั้งหมดต้องอยู่ใน Railway Project เดียวกันเพื่อใช้ private network และ
reference variables

- **INF-001**: Project ต้องชื่อ `my-kanban` หรือชื่อที่ผู้ใช้ยืนยันตอน provision
- **INF-002**: Project ต้องมี service `web`, `api` และ `Postgres`
- **INF-003**: Production ต้องอยู่ region Singapore เมื่อ Railway plan รองรับ
- **INF-004**: `web` และ `api` ต้อง build จาก repository revision เดียวกัน
- **INF-005**: `Postgres` ต้องใช้ persistent volume ที่ Railway provision ให้
- **INF-006**: Production database ต้องไม่มี public TCP proxy
- **INF-007**: API ต้องไม่มี public domain ใน MVP
- **INF-008**: Web service เป็น public entry point เพียง service เดียว
- **INF-009**: Desired state ของ `web`, `api` และ `Postgres` ต้องอยู่ใน
  `.railway/railway.ts` ไฟล์เดียว และห้ามใช้ `railway.json` หรือ `railway.toml`
  ควบคู่กัน
- **INF-010**: Custom domain ต้อง register แยกด้วย Railway CLI หรือ dashboard
  หลัง Web deployment เพราะ Railway TypeScript IaC ไม่รองรับ domain registration

### 3.2 Environment requirements

MVP เริ่มด้วย production environment เดียวเพื่อลดค่าใช้จ่ายและภาระดูแล

- **ENV-001**: ต้องมี `production` environment
- **ENV-002**: MVP ยังไม่สร้าง `staging`; เพิ่มเมื่อผู้ใช้อนุมัติ requirement ใหม่
- **ENV-003**: Local development ต้องใช้ PostgreSQL ผ่าน Colima และ Docker Compose
- **ENV-004**: Local และ test ห้ามใช้ production database credentials
- **ENV-005**: Custom domain `kanban.koonporza.com` ต้องผูกกับ production `web`
  เท่านั้น
- **ENV-006**: Automated deploy จาก main branch ใช้ production checks และ approval
  policy ที่ repository กำหนด โดยไม่ต้องมี staging ใน MVP

### 3.3 Build and runtime requirements

Repository เป็น shared pnpm monorepo จึงต้อง build จาก repository root และ scope
command ด้วย package name

- **BLD-001**: Railway builder ต้องใช้ Railpack
- **BLD-002**: Node.js ต้องใช้ version 22 ขึ้นไป และ Railway ต้อง pin
  `RAILPACK_NODE_VERSION=22`
- **BLD-003**: Install ต้องใช้ frozen `pnpm-lock.yaml`
- **BLD-004**: Web build command ต้องเป็น `pnpm --filter @my-kanban/web build`
- **BLD-005**: Web start command ต้องเป็น `pnpm --filter @my-kanban/web start`
- **BLD-006**: API build command ต้องเป็น `pnpm --filter @my-kanban/api build`
- **BLD-007**: API start command ต้องเป็น `pnpm --filter @my-kanban/api start:prod`
- **BLD-008**: API ต้อง listen ที่ `0.0.0.0:$PORT`
- **BLD-009**: Web ต้อง listen ที่ Railway-provided `PORT`
- **BLD-010**: Watch patterns ต้องแยก Web และ API เพื่อลด deployment ที่ไม่เกี่ยวข้อง

### 3.4 Networking requirements

Traffic ภายใน Railway ต้องใช้ private DNS และ `http` ตาม Railway private network
contract ส่วน traffic จาก browser ต้องใช้ HTTPS

- **NET-001**: Web ต้องตั้ง `API_INTERNAL_URL` จาก API reference variable
- **NET-002**: ค่าแนะนำคือ
  `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}`
- **NET-003**: API ต้องตั้ง `DATABASE_URL` เป็น `${{Postgres.DATABASE_URL}}`
- **NET-004**: Browser ต้องไม่เห็น `API_INTERNAL_URL` หรือ `DATABASE_URL`
- **NET-005**: Web ต้อง forward `/api/v1/*` ไป API private URL
- **NET-006**: ห้ามสร้าง `api.koonporza.com` ใน MVP
- **NET-007**: ห้ามเปิด public access ของ PostgreSQL เพื่อแก้ปัญหา local connection
- **NET-008**: Web ต้อง forward `GET`, `POST` และ `DELETE` ที่ `/mcp` ไป API private
  URL โดยรักษา streaming response
- **NET-009**: Proxy ต้องส่งต่อ `Authorization`, `MCP-Protocol-Version`,
  `Mcp-Session-Id`, `Last-Event-ID` และ response headers ที่ protocol กำหนด
- **NET-010**: ห้ามสร้าง `mcp.koonporza.com`; MCP ใช้ public Web domain เดียวกับ UI
- **NET-011**: Web proxy และ Railway ต้องไม่ buffer Streamable HTTP response จนทำให้
  protocol timeout

### 3.5 Domain and Cloudflare requirements

Frontend production ต้องเปิดที่ `kanban.koonporza.com` และใช้ DNS records ที่
Railway สร้างให้จริง ห้ามเดา target hostname

- **DOM-001**: เพิ่ม `kanban.koonporza.com` เป็น custom domain ของ `web` service
- **DOM-002**: เพิ่มทั้ง CNAME และ TXT ownership record ใน Cloudflare ตามค่าที่
  Railway คืนมา
- **DOM-003**: Railway ต้องแสดง domain status เป็น verified ก่อนเปิด production
- **DOM-004**: ถ้าเปิด Cloudflare proxy ต้องใช้ SSL/TLS mode `Full` ตาม Railway
  guidance ไม่ใช้ `Flexible` หรือ `Full (Strict)`
- **DOM-005**: Cloudflare Universal SSL ต้องเปิดใช้งาน
- **DOM-006**: Domain verification record ต้องไม่ถูกแก้หรือลบหลัง deploy
- **DOM-007**: API และ PostgreSQL ต้องไม่มี Cloudflare DNS record

### 3.6 Deployment and migration requirements

Deployment ต้องป้องกัน application revision ที่ใช้ schema ไม่ตรงกัน

- **DEP-001**: API pre-deploy command ต้องรัน Prisma production migration
- **DEP-002**: Migration ต้องจบด้วย exit code 0 ก่อน API deployment รับ traffic
- **DEP-003**: API healthcheck path ต้องเป็น `/health/ready`
- **DEP-004**: Web healthcheck path ต้องเป็น `/health/live`
- **DEP-005**: Railway ต้องสลับ traffic เมื่อ healthcheck ตอบ HTTP `200` เท่านั้น
- **DEP-006**: Deploy แบบ detached ต้อง poll deployment จนเป็น `SUCCESS` ก่อนรายงาน
- **DEP-007**: ถ้า API deploy ล้มเหลว Web revision เดิมต้องยังใช้งานกับ API เดิมได้
- **DEP-008**: Breaking API change ต้อง deploy แบบ backward-compatible อย่างน้อย
  หนึ่ง revision

### 3.7 Secret and variable requirements

Secret ต้องอยู่ใน Railway variables เท่านั้นและห้ามมี prefix ที่ expose ไป client

- **SEC-001**: `DATABASE_URL` ต้องมีเฉพาะ API service
- **SEC-002**: `GOOGLE_CLIENT_SECRET` และ `SESSION_SECRET` ต้องเป็น sealed variables
- **SEC-003**: `ALLOWED_GOOGLE_EMAILS` ต้องกำหนดเฉพาะ API และห้าม expose ไป client
- **SEC-004**: `APP_ORIGIN` ต้องเป็น `https://kanban.koonporza.com` ใน production
- **SEC-005**: ห้ามตั้ง secret ด้วยชื่อที่ขึ้นต้น `NEXT_PUBLIC_`
- **SEC-006**: Secret ต้องไม่ commit ใน `.env`, source, migration หรือ documentation
- **SEC-007**: `GOOGLE_CALLBACK_URL` ต้องตรงกับ callback ที่ลงทะเบียนทุกตัวอักษร
- **SEC-008**: Raw MCP token ต้องไม่อยู่ใน Railway variables เพราะสร้างและ revoke
  เป็นราย Project ใน Web UI
- **SEC-009**: Web/API access log ต้อง redact `Authorization`, `Mcp-Session-Id` และ
  query/header ที่อาจมี credential
- **SEC-010**: `/mcp` ต้องรับเฉพาะ HTTPS จาก public client และ API private hop เท่านั้น
- **SEC-011**: Production API log ต้องเป็น JSON, มี request ID, method, path ที่ไม่มี
  query string, status และ duration โดยห้าม log request headers หรือ body

### 3.8 Backup and recovery requirements

Recovery ต้องครอบคลุมทั้ง database-level failure และ user-level mistake

- **BKP-001**: Production ต้องเปิด Railway database backup ที่เหมาะกับ plan ก่อนมี
  ข้อมูลจริง
- **BKP-002**: Application JSON export ต้องทำงานแยกจาก Railway backup
- **BKP-003**: ต้องทดสอบ restore ไป isolated environment อย่างน้อยไตรมาสละครั้ง
- **BKP-004**: ห้ามทดสอบ restore โดย overwrite production database
- **BKP-005**: Recovery procedure ต้องบันทึก recovery point และ verification result

## 4. Interfaces & data contracts

ส่วนนี้กำหนด variables, commands และ DNS inputs ที่แต่ละ service ต้องใช้

### 4.1 Service variable matrix

Variable ต้องกำหนดเฉพาะ service ที่จำเป็น

| Variable                | Web      | API      | Source                                                     |
| ----------------------- | -------- | -------- | ---------------------------------------------------------- |
| `NODE_ENV`              | Required | Required | Literal `production`                                       |
| `PORT`                  | No       | Required | Literal `3001`                                             |
| `APP_ORIGIN`            | No       | Required | `https://kanban.koonporza.com`                             |
| `API_INTERNAL_URL`      | Required | No       | API private reference                                      |
| `NEXT_PUBLIC_AUTH_SKIP` | Required | No       | Literal `false`                                            |
| `DATABASE_URL`          | No       | Required | Postgres reference                                         |
| `GOOGLE_CLIENT_ID`      | No       | Required | Google OAuth client                                        |
| `GOOGLE_CLIENT_SECRET`  | No       | Required | Sealed secret                                              |
| `GOOGLE_CALLBACK_URL`   | No       | Required | `https://kanban.koonporza.com/api/v1/auth/google/callback` |
| `ALLOWED_GOOGLE_EMAILS` | No       | Required | Sealed comma-separated allowlist                           |
| `SESSION_SECRET`        | No       | Required | Sealed secret                                              |
| `SESSION_TTL_SECONDS`   | No       | Optional | Default `604800`                                           |
| `RAILPACK_NODE_VERSION` | Required | Required | Literal `22`                                               |
| `RAILPACK_INSTALL_CMD`  | Required | Required | `pnpm install --frozen-lockfile`                           |

### 4.2 Railway service configuration

ค่าต่อไปนี้เป็น desired state และต้อง resolve service ID ก่อน apply จริง

| Service    | Builder       | Build                                | Start                                     | Healthcheck     |
| ---------- | ------------- | ------------------------------------ | ----------------------------------------- | --------------- |
| `web`      | Railpack      | `pnpm --filter @my-kanban/web build` | `pnpm --filter @my-kanban/web start`      | `/health/live`  |
| `api`      | Railpack      | `pnpm --filter @my-kanban/api build` | `pnpm --filter @my-kanban/api start:prod` | `/health/ready` |
| `Postgres` | Managed image | Railway-managed                      | Railway-managed                           | Railway-managed |

API pre-deploy command ต้องเป็นคำสั่ง workspace ที่รัน `prisma migrate deploy` ใน
package API คือ `pnpm --filter @my-kanban/api prisma:deploy` Desired state ทั้งหมด
อยู่ใน `.railway/railway.ts`; TypeScript config ต้องผ่าน
`corepack pnpm railway:validate` ก่อน plan ทุกครั้ง

### 4.3 Cloudflare DNS contract

DNS values ต้องนำจาก Railway custom-domain response ไม่ใช้ค่าตัวอย่างเป็นค่าจริง

| Type  | Name                  | Value                            | Proxy                      |
| ----- | --------------------- | -------------------------------- | -------------------------- |
| CNAME | `kanban`              | Railway-provided target          | Proxied after verification |
| TXT   | Railway-provided name | Railway-provided ownership value | DNS record only            |

ขั้นตอน domain setup ต้องเป็นลำดับดังนี้

1. Deploy Web และยืนยัน Railway-provided domain ใช้งานได้
2. เพิ่ม `kanban.koonporza.com` ใน Railway Web service
3. คัดลอก CNAME และ TXT ที่ Railway คืนมาเข้า Cloudflare ให้ตรงทุกตัวอักษร
4. รอ Railway แสดง ownership verified และ certificate/domain status พร้อม
5. เปิด Cloudflare proxy สำหรับ CNAME หากต้องการ proxy feature
6. ตั้ง Cloudflare SSL/TLS เป็น `Full` และยืนยัน Universal SSL
7. เปิด `https://kanban.koonporza.com` และตรวจ redirect, cookie และ API proxy

### 4.4 Local development contract

Local environment ต้องจำลอง network path สำคัญโดยไม่สร้าง Railway staging service

- Colima เป็น container runtime และ Docker Compose provision เฉพาะ PostgreSQL
- Next.js Web และ NestJS API รันบน host ผ่าน pnpm เพื่อใช้ hot reload
- Browser เข้า Web ที่ `http://localhost:8083` และเรียก API ผ่าน same-origin proxy
- MCP client local test เรียก `http://localhost:8083/mcp` ผ่าน Web proxy เดียวกัน
- PostgreSQL image ต้อง pin major version เดียวกับ Railway production
- Local Google callback ต้องลงทะเบียนแยกจาก production callback
- `.env.example` ระบุเฉพาะชื่อ variable และ placeholder โดยไม่มี secret จริง

## 5. Acceptance criteria

Infrastructure พร้อม production เมื่อเงื่อนไขต่อไปนี้ผ่านทั้งหมด

- **AC-001**: Given ผู้ใช้เปิด `https://kanban.koonporza.com`, When DNS resolve,
  Then Cloudflare/Railway ต้องส่ง HTTPS response จาก Web service
- **AC-002**: Given Browser เปิด DevTools, When ใช้งาน Board, Then request ต้องไป
  `/api/v1/*` บน `kanban.koonporza.com` และไม่มี private hostname ใน client
- **AC-003**: Given API เรียก PostgreSQL, When ตรวจ connection source, Then ต้องใช้
  private `DATABASE_URL` และ database ไม่มี public TCP proxy
- **AC-004**: Given migration ล้มเหลว, When deploy API, Then deployment ต้องไม่เป็น
  `SUCCESS` และ revision ก่อนหน้าต้องยังรับ traffic
- **AC-005**: Given API ต่อฐานข้อมูลไม่ได้, When Railway เรียก `/health/ready`, Then
  endpoint ต้องไม่ตอบ `200`
- **AC-006**: Given deployment แบบ detached, When สถานะยัง `BUILDING`, Then ห้าม
  รายงานว่า deploy สำเร็จ
- **AC-007**: Given Cloudflare proxy เปิด, When ตรวจ SSL configuration, Then mode
  ต้องเป็น `Full` และหน้าเว็บต้องไม่มี redirect loop
- **AC-008**: Given production backup, When restore ไป isolated environment, Then
  Owner login และ Project sample ต้องอ่านได้
- **AC-009**: Given MCP client ส่ง valid Project token ไป `/mcp`, When initialize
  Streamable HTTP session, Then request ต้องผ่าน Web ไป private API โดยไม่มี public API
  domain
- **AC-010**: Given token หมดอายุหรือถูก revoke, When เรียก `/mcp`, Then ต้องถูกปฏิเสธ
  โดยไม่ส่ง raw token เข้า application log
- **AC-011**: Given MCP response แบบ stream, When ผ่าน Web และ Cloudflare, Then client
  ต้องอ่าน protocol response และ session headers ได้ครบ
- **AC-012**: Given API ทำงานใน production, When Railway เก็บ stdout/stderr, Then
  HTTP request log ต้องเป็น JSON, มี `x-request-id` และไม่มี Authorization,
  MCP session header หรือ query credential

## 6. Test automation strategy

Infrastructure verification ต้องมีทั้ง static config checks และ deployed smoke tests

- CI provision PostgreSQL 16, apply Prisma migrations และรัน format, typecheck,
  lint, test และ build บน Node.js 22
- `corepack pnpm typecheck` validate `.railway/railway.ts` ด้วย official Railway
  TypeScript package
- CI ตรวจ pnpm lockfile, workspace filters และ production builds
- CI สร้าง OpenAPI client ก่อน Web build
- CI apply database migrations กับ disposable PostgreSQL
- Post-deploy smoke test ตรวจ Web root, login page และ API readiness
- DNS smoke test ตรวจ CNAME, TXT verification status และ HTTPS certificate
- Security smoke test ยืนยันว่า API และ PostgreSQL ไม่มี public endpoint
- MCP smoke test initialize session, list tools, read Project และ create/archive/restore
  Task ผ่าน public `/mcp`
- MCP security smoke test ครอบคลุม missing, invalid, expired และ revoked bearer token
- Log scan ยืนยันว่า token และ Authorization header ไม่ปรากฏใน Web/API logs
- Recovery test restore backup ไป temporary environment และตรวจ row counts

## 7. Rationale & context

การให้ Web เป็น public entry point เดียวลด CORS, cookie-domain complexity และ API
attack surface Next.js ทำหน้าที่ BFF proxy ขณะที่ NestJS และ PostgreSQL สื่อสารผ่าน
Railway private network ซึ่งเข้ารหัสและไม่ออก public internet

Cloudflare ยังคงเป็น DNS authority ของ `koonporza.com` และสามารถ proxy subdomain
ระดับแรกได้ Railway ต้องได้รับทั้ง CNAME และ TXT ownership record ก่อน route custom
domain ได้ การตั้ง SSL/TLS mode ใช้ `Full` ตาม Railway Cloudflare guidance ปัจจุบัน

## 8. Dependencies & external integrations

Production พึ่ง platform ภายนอกสองระบบและรองรับ MCP client ที่ผู้ใช้เลือก

### External systems

Railway เป็น compute, network และ database platform ส่วน Cloudflare เป็น DNS และ
optional edge proxy

- **EXT-001**: Railway Project และ environments
- **EXT-002**: Cloudflare DNS zone `koonporza.com`

### Third-party services

Codex CLI และ Claude Code เข้าถึง Issue content ได้เฉพาะเมื่อผู้ใช้เปิด session ด้วย
Project token ที่ยังใช้งานได้

- **SVC-001**: Codex CLI Remote MCP client
- **SVC-002**: Claude Code Remote MCP client

### Infrastructure dependencies

ทุก service ต้องอยู่ใน Railway environment เดียวกันต่อ stage

- **INF-DEP-001**: `web`, `api` และ `Postgres`
- **INF-DEP-002**: Railway private networking และ reference variables
- **INF-DEP-003**: Railway custom-domain verification และ certificate routing

### Data dependencies

Deploy API พึ่ง migration history ที่ตรงกับ revision

- **DAT-001**: Prisma migration files
- **DAT-002**: PostgreSQL backup และ application export

### Technology platform dependencies

Build พึ่ง Node.js และ pnpm version ที่ pin ใน repository

- **PLT-001**: Railpack Node.js build support
- **PLT-002**: Cloudflare CNAME และ TXT records

### Compliance dependencies

ไม่มี regulatory requirement เฉพาะใน MVP

- **COM-001**: TLS และ secret handling เป็น security baseline บังคับ

## 9. Examples & edge cases

Operation ต้องเตรียมรับกรณีต่อไปนี้

- CNAME resolve แล้วแต่ TXT ไม่ครบ Railway อาจตอบ `404`
- Cloudflare proxy เปิดก่อน domain verification อาจทำให้ตรวจ certificate ยากขึ้น
- Cloudflare ใช้ `Full (Strict)` ตามค่าเดิมของ zone อาจไม่ทำงานตาม Railway guidance
- Web revision ใหม่เรียก API contract ใหม่ก่อน API deploy ต้องถูกป้องกันด้วย compatibility
- Prisma migration ใช้เวลานานกว่า healthcheck timeout ต้อง fail อย่างปลอดภัย
- API start ก่อน PostgreSQL ready ต้อง retry connection แบบ bounded แล้ว fail readiness
- เปลี่ยนชื่อ Railway service ทำให้ reference variable เดิมใช้ไม่ได้
- Restore production backup ต้องทำใน isolated local/test database และห้ามใช้
  production session secret
- Cloudflare หรือ Web proxy buffer response ทำให้ MCP initialize timeout ต้องตรวจ
  response streaming และ protocol headers ก่อนเพิ่ม timeout
- MCP client disconnect ระหว่าง mutation ต้อง retry ด้วย idempotency key เดิม
- Token ถูก revoke ขณะ session เปิดอยู่ request ถัดไปต้องถูกปฏิเสธทันที

## 10. Validation criteria

ก่อนประกาศ deploy สำเร็จต้องมี evidence ต่อไปนี้

- Railway deployment ล่าสุดของ Web และ API มีสถานะ `SUCCESS`
- `https://kanban.koonporza.com` ตอบผ่าน HTTPS และ domain status verified
- `/health/ready` ตอบ `200` จาก network ภายในที่ Railway ใช้
- Google login, session, logout และ authenticated Board request ผ่าน smoke test
- Remote MCP initialize, tool discovery และ Project-scoped Task mutation ผ่าน
  `https://kanban.koonporza.com/mcp`
- API และ PostgreSQL ไม่มี public domain หรือ TCP proxy
- Web/API logs ไม่มี raw MCP token หรือ Authorization header
- Production migration version ตรงกับ application revision
- Backup policy เปิดและมี restore rehearsal record

## 11. Related specifications / further reading

เอกสารนี้อ้างอิง architecture, data contract และเอกสารทางการของ platform

- [Product requirements](./spec-design-personal-kanban-scrum-board.md)
- [System architecture](./spec-architecture-kanban-system.md)
- [Technology stack specification](./spec-architecture-technology-stack.md)
- [PostgreSQL data specification](./spec-data-kanban-postgresql.md)
- [MCP task management](./spec-integration-mcp-task-management.md)
- [Railway working with domains](https://docs.railway.com/networking/domains/working-with-domains)
- [Railway private networking](https://docs.railway.com/networking/private-networking)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Railway healthchecks](https://docs.railway.com/deployments/healthchecks)
- [Railway Infrastructure as Code](https://docs.railway.com/infrastructure-as-code)
- [Cloudflare DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)

## 12. Next steps

Production resources, custom domain, Google login, private network, healthchecks,
migrations และ deployment จาก `main` พร้อมใช้งานแล้ว หลักฐานและงานที่ต้องปิดก่อน
Phase 2 อยู่ใน [production closeout record](./production-closeout.md)

Postgres volume ปัจจุบันอยู่ `sfo` ต่างจาก Singapore desired state ห้าม apply region
change จนกว่าจะมี manual recovery point ที่ยืนยันได้และ restore rehearsal ผ่าน เพราะ
การย้ายมี downtime และความเสี่ยงต่อข้อมูลถ้า volume ไม่ถูกย้ายอย่างถูกต้อง

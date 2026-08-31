---
title: Personal Kanban Technology Stack
version: 1.3
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [architecture, tech-stack, nextjs, nestjs, prisma, postgresql, railway]
---

# Introduction

เอกสารนี้บันทึก technology stack ที่เลือกหลังการสัมภาษณ์ product owner สำหรับ
Personal Kanban and Scrum Board ระบบนี้สร้างเพื่อใช้งานส่วนตัว เลือกโครงสร้างที่
ดูแลง่ายและเป็นมาตรฐาน โดยยังแยก Next.js Web, NestJS API และ PostgreSQL ออกจากกัน
บน Railway ตามความต้องการของผู้ใช้

## 1. Purpose & scope

ข้อกำหนดนี้กำหนด framework, libraries, repository tooling, authentication,
testing และ local development stack ที่อนุญาตสำหรับ MVP รายละเอียด business
requirements, SQL schema และ deployment topology อยู่ใน specifications ที่เกี่ยวข้อง

### 1.1 Final decision summary

Stack ต่อไปนี้เป็นข้อสรุปที่ต้องใช้ในการ implementation

| Layer            | Selected technology                                        |
| ---------------- | ---------------------------------------------------------- |
| Repository       | pnpm workspace monorepo                                    |
| Runtime          | Node.js LTS และ TypeScript strict mode                     |
| Web              | Next.js App Router และ Minimal TypeScript v7 components    |
| Server state     | TanStack Query                                             |
| Forms            | React Hook Form และ Zod                                    |
| Drag and drop    | dnd-kit                                                    |
| API              | NestJS บน default Express adapter                          |
| API style        | REST JSON และ Swagger/OpenAPI                              |
| MCP              | Official TypeScript SDK และ Streamable HTTP                |
| API client       | Orval generated TypeScript client และ TanStack Query hooks |
| Authentication   | Passport, `@nestjs/passport` และ `passport-google-oidc`    |
| Session          | `express-session` และ `connect-pg-simple`                  |
| Authorization    | Email allowlist จาก API environment variable               |
| ORM              | Prisma ORM และ Prisma Migrate                              |
| Database         | PostgreSQL                                                 |
| Logging          | Pino ผ่าน NestJS integration                               |
| Unit tests       | Vitest                                                     |
| Web tests        | Testing Library และ Vitest                                 |
| API tests        | Nest testing utilities, Supertest และ Vitest               |
| End-to-end tests | Playwright                                                 |
| Local containers | Colima, Docker CLI และ Docker Compose                      |
| Helper CLI       | Node.js TypeScript CLI และ macOS Keychain                  |
| Production       | Railway Web, API และ PostgreSQL services                   |
| DNS              | Cloudflare สำหรับ `kanban.koonporza.com`                   |

## 2. Definitions

คำต่อไปนี้ใช้เพื่อแบ่งหน้าที่ของเทคโนโลยีใน stack

- **Server state**: ข้อมูลจาก API ที่มี cache, stale state และ mutation lifecycle
- **UI state**: สถานะชั่วคราวใน browser เช่น drawer, selection และ filter draft
- **OIDC**: OpenID Connect protocol ที่ใช้ยืนยันตัวตนผ่าน Google
- **Authorization Code flow**: OAuth server flow ที่ backend แลก code เป็น token
- **Session store**: PostgreSQL table ที่เก็บ server-side login session
- **Generated client**: Client code ที่สร้างจาก OpenAPI document
- **Monorepo**: Repository เดียวที่มีหลาย application packages
- **Supporting package**: Library ที่ช่วย framework ที่เลือกโดยไม่เพิ่ม service ใหม่
- **Minimal source**: Component, layout และ theme ต้นแบบจาก
  `~/Minimal_TypeScript_v7.0.0/next-ts/src`
- **Streamable HTTP**: Remote MCP transport สำหรับ request และ session lifecycle
- **Project-scoped token**: Bearer token อายุ 90 วันที่ bind Project เดียว

## 3. Requirements, constraints & guidelines

ข้อกำหนดนี้ล็อก framework boundary แต่ให้ implementation เลือก patch version ล่าสุด
ที่เข้ากันได้และบันทึก exact version ใน `pnpm-lock.yaml`

### 3.1 Runtime and repository requirements

Monorepo ต้องใช้ tooling จำนวนน้อยและ build แต่ละ application แยกได้

- **STK-001**: Repository ต้องใช้ pnpm workspace โดยมี `apps/web`, `apps/api` และ
  `apps/cli`
- **STK-002**: ห้ามเพิ่ม Turborepo ใน MVP จนกว่า build time แสดงความจำเป็น
- **STK-003**: Node.js major version ต้อง pin ให้ตรงกันใน local, CI และ Railway
- **STK-004**: TypeScript ต้องเปิด strict mode ใน Web, API และ generated client
- **STK-005**: Package version ต้อง lock ด้วย `pnpm-lock.yaml`
- **STK-006**: Shared packages ต้องจำกัดที่ generated API client และ tool config
- **STK-007**: Frontend ห้าม import NestJS module, Prisma type หรือ backend entity
- **STK-008**: Railway ใช้ `production` environment เดียวใน MVP และยังไม่สร้าง staging

### 3.2 Web stack requirements

Web stack ต้องใช้ component และ form infrastructure ที่มีอยู่ก่อนเพิ่ม library ใหม่

- **WEB-001**: Web ต้องใช้ Next.js App Router และ React ที่ starter ติดตั้งไว้
- **WEB-002**: UI component foundation ต้องใช้ MUI, theme และ component conventions
  จาก Minimal TypeScript v7
- **WEB-003**: Server state ต้องใช้ TanStack Query
- **WEB-004**: Query key ต้องสร้างจาก factory กลางตาม resource และ owner scope
- **WEB-005**: Mutation ที่ใช้ optimistic update ต้องมี snapshot และ rollback handler
- **WEB-006**: UI state ต้องใช้ React state หรือ context ก่อนเพิ่ม global state library
- **WEB-007**: MVP ห้ามเพิ่ม Zustand, Redux หรือ MobX
- **WEB-008**: Form ต้องใช้ React Hook Form และ Zod schema
- **WEB-009**: Board interaction ต้องใช้ dnd-kit และมี keyboard alternative
- **WEB-010**: API calls ต้องผ่าน generated Orval client
- **WEB-011**: Web ต้องเรียก same-origin `/api/v1/*` เท่านั้น
- **WEB-012**: ก่อนสร้าง UI ใหม่ ต้องตรวจและ reuse หรือ adapt component จาก
  `~/Minimal_TypeScript_v7.0.0/next-ts/src/components`
- **WEB-013**: Layout และ navigation ต้อง reuse หรือ adapt จาก
  `~/Minimal_TypeScript_v7.0.0/next-ts/src/layouts`
- **WEB-014**: Theme tokens, component overrides และ styling conventions ต้องอ้างอิง
  `~/Minimal_TypeScript_v7.0.0/next-ts/src/theme`
- **WEB-015**: Component ที่นำมาใช้ต้อง copy หรือ adapt เข้า repository นี้ ห้ามมี
  runtime import หรือ build dependency ไปยัง absolute path ภายใต้ home directory
- **WEB-016**: สร้าง reusable component ใหม่ได้เฉพาะเมื่อไม่มี Minimal component ที่
  เหมาะสม และต้องบันทึกเหตุผลใน implementation task หรือ code review
- **WEB-017**: Kanban UI ต้องเริ่มจาก implementation ที่มีอยู่ใน
  `~/Minimal_TypeScript_v7.0.0/next-ts/src/sections/kanban` และ adapt เข้ามาที่
  `apps/web/src/sections/kanban` โดยรักษา visual language และ interaction หลัก
- **WEB-018**: Data adapter เดิมของ Minimal ที่ใช้ SWR, Axios และ mock data ต้องถูก
  แทนด้วย TanStack Query และ Orval client ก่อนถือว่า Kanban persistence เสร็จสมบูรณ์
- **WEB-019**: MVP ต้องตัด collaboration-only surface ได้แก่ assignee, comment และ
  attachment ออกจาก Issue detail จนกว่าจะมี requirement ใหม่
- **WEB-020**: Board query ต้องใช้ TanStack Query refetch interval 15 วินาทีและ
  refetch on window focus เพื่อรับ MCP mutations

### 3.3 API stack requirements

API ต้องใช้ conventions มาตรฐานของ NestJS บน Express และเป็น modular monolith

- **API-001**: API ต้องใช้ NestJS default Express adapter
- **API-002**: ห้ามติดตั้ง Fastify adapter ใน MVP
- **API-003**: Controller ต้องรับและคืน REST JSON DTO
- **API-004**: DTO validation ต้องใช้ `class-validator` และ `class-transformer`
- **API-005**: OpenAPI ต้องสร้างด้วย `@nestjs/swagger`
- **API-006**: Orval ต้องสร้าง TypeScript client และ TanStack Query hooks จาก
  OpenAPI artifact
- **API-007**: API ต้องใช้ Helmet, explicit CORS policy และ request throttling
- **API-008**: Structured logging ต้องใช้ Pino ผ่าน NestJS integration
- **API-009**: API ต้องใช้ built-in dependency injection และ module boundaries
- **API-010**: ห้ามเพิ่ม CQRS package ใน MVP
- **API-011**: MCP transport ต้องใช้ official `@modelcontextprotocol/sdk`
- **API-012**: MCP adapter ต้องอยู่ใน NestJS `McpModule` และใช้ Streamable HTTP
- **API-013**: MCP tools ต้องเรียก application services เดียวกับ REST controllers
- **API-014**: `McpModule` ห้าม inject Prisma service เพื่อทำ Task mutation โดยตรง
- **API-015**: MCP tool schema ต้อง reuse หรือ derive จาก domain DTO validation

### 3.4 Authentication requirements

Authentication ต้องใช้ Google OIDC server flow และ server-side session โดยไม่มี
password, registration form หรือ JWT token ใน browser

- **AUT-001**: Google login ต้องใช้ Authorization Code server flow
- **AUT-002**: OAuth request ต้องใช้ `state`, `nonce` และ HTTPS callback ใน production
- **AUT-003**: Scope ต้องจำกัดที่ `openid`, `email` และ `profile`
- **AUT-004**: API ต้องตรวจ Google issuer, audience, signature, expiry และ nonce
- **AUT-005**: API ต้องยอมรับเฉพาะ email ที่ Google ยืนยันแล้ว
- **AUT-006**: Email ต้องอยู่ใน `ALLOWED_GOOGLE_EMAILS` หลัง normalize lowercase
- **AUT-007**: Allowlist ต้องรองรับหลาย email ที่เป็นบัญชีของ Owner คนเดียว
- **AUT-008**: Email ที่ผ่าน allowlist ต้อง map ไป Owner principal เดียวกัน
- **AUT-009**: Google adapter ต้องใช้ Passport, `@nestjs/passport` และ
  `passport-google-oidc`
- **AUT-010**: Session ต้องใช้ `express-session` กับ `connect-pg-simple`
- **AUT-011**: ห้ามใช้ default in-memory session store ใน production
- **AUT-012**: Cookie ต้องชื่อ `kanban.sid` และตั้ง `HttpOnly`, `Secure` กับ
  `SameSite=Lax` ใน production
- **AUT-013**: Session อายุไม่เกิน 7 วันและ logout ต้องลบ session ฝั่ง server
- **AUT-014**: Auth guard ต้องตรวจ allowlist ซ้ำทุก request เพื่อ revoke email ที่ถูก
  นำออกจาก environment โดยไม่ต้องรอ session หมดอายุ
- **AUT-015**: Production callback ต้องเป็น
  `https://kanban.koonporza.com/api/v1/auth/google/callback`
- **AUT-016**: API ต้องตั้ง Express `trust proxy` ให้ secure cookie ทำงานหลัง Railway
  และ Next.js proxy
- **AUT-017**: MCP authentication ต้องใช้ high-entropy bearer token ที่ผูกกับ
  Project เดียว ไม่ใช้ Google browser cookie
- **AUT-018**: MCP token ต้อง hash ด้วย Node.js `crypto`, แสดงครั้งเดียวและหมดอายุ
  คงที่ 90 วัน
- **AUT-019**: MCP token ต้องส่งผ่าน `Authorization` header และห้ามอยู่ใน URL
- **AUT-020**: MCP MVP ไม่ต้อง implement OAuth authorization server

### 3.5 Data stack requirements

Prisma เป็น database access boundary หลักและ PostgreSQL เป็น source of truth

- **DBS-001**: API ต้องใช้ Prisma Client สำหรับ application query ทั่วไป
- **DBS-002**: Schema change ต้องใช้ Prisma Migrate และ commit migration SQL
- **DBS-003**: Production ต้องใช้ `prisma migrate deploy`
- **DBS-004**: Raw SQL ใช้ได้เฉพาะ parameterized query ที่ Prisma แสดงไม่ได้ชัดเจน
- **DBS-005**: Session store table ต้องสร้างผ่าน migration ที่อยู่ใน source control
- **DBS-006**: PostgreSQL major version ของ local ต้องตรงกับ Railway production
- **DBS-007**: Docker image ต้อง pin major version ห้ามใช้ tag `latest`

### 3.6 Testing stack requirements

Testing stack ต้องใช้ Vitest เป็น test runner หลักเพื่อลดจำนวน runner ใน monorepo

- **TST-001**: Pure domain และ utility tests ต้องใช้ Vitest
- **TST-002**: React component tests ต้องใช้ Testing Library กับ Vitest DOM
- **TST-003**: NestJS unit tests ต้องใช้ `@nestjs/testing` กับ Vitest
- **TST-004**: API HTTP integration tests ต้องใช้ Supertest
- **TST-005**: API integration tests ต้องใช้ PostgreSQL จริงใน Docker
- **TST-006**: End-to-end browser tests ต้องใช้ Playwright
- **TST-007**: E2E ต้องครอบคลุม Google auth boundary ด้วย test-only auth seam ห้าม
  เรียก Google จริงในทุก CI run
- **TST-008**: Production smoke test ต้องตรวจ login redirect, session, Board query และ
  API readiness
- **TST-009**: MCP integration tests ต้องใช้ PostgreSQL จริงและอย่างน้อยสอง Project
- **TST-010**: CLI tests ต้อง mock macOS Keychain command และ child process spawn

### 3.7 Local development requirements

Local development ต้องใช้ Colima เป็น container runtime บนเครื่อง macOS นี้

- **DEV-001**: Developer ต้องเริ่ม Colima ก่อนใช้ Docker Compose
- **DEV-002**: Docker Compose ต้อง provision PostgreSQL เท่านั้นใน MVP
- **DEV-003**: Web และ API ต้องรันด้วย pnpm บน host เพื่อให้ hot reload เร็ว
- **DEV-004**: Local Web ใช้ port `8083` และ API ใช้ port ที่ไม่ชนกัน
- **DEV-005**: Local browser ต้องเรียก API ผ่าน Web proxy เหมือน production
- **DEV-006**: Local Google callback ต้องลงทะเบียนแยกจาก production callback
- **DEV-007**: `.env.example` ต้องระบุชื่อ variable โดยไม่มี secret จริง
- **DEV-008**: Local database data ต้องอยู่ใน named Docker volume
- **DEV-009**: MCP local endpoint ต้องผ่าน Web proxy path `/mcp` เหมือน production
- **DEV-010**: Helper CLI development รองรับ macOS เท่านั้นใน MVP

### 3.8 Explicit non-goals

เทคโนโลยีต่อไปนี้ห้ามเพิ่มใน MVP หากไม่มี requirement ใหม่ที่ผู้ใช้อนุมัติ

- **NON-001**: Redis หรือ distributed cache
- **NON-002**: Message broker, queue หรือ background worker service
- **NON-003**: WebSocket, Server-Sent Events หรือ realtime sync
- **NON-004**: Offline-first database หรือ service worker synchronization
- **NON-005**: Object storage และ file upload
- **NON-006**: Email, push หรือ in-app notification infrastructure
- **NON-007**: Collaboration, membership และ role management
- **NON-008**: GraphQL
- **NON-009**: Separate public API domain
- **NON-010**: Additional global frontend state library
- **NON-011**: Separate MCP service หรือ public MCP subdomain
- **NON-012**: Linux และ Windows credential-store support
- **NON-013**: MCP OAuth server, prompts, resources หรือ server push

### 3.9 Decision boundary

Implementation สามารถเลือก supporting packages และ compatible versions ได้ภายใน
ข้อจำกัดนี้โดยไม่ต้องขออนุมัติเพิ่ม

- **DEC-001**: เลือก patch/minor version ที่เข้ากันได้และ pin ใน lockfile ได้
- **DEC-002**: เลือก Google OIDC adapter, PostgreSQL session store และ CSRF helper
  ที่รองรับ NestJS Express ได้
- **DEC-003**: เลือก Pino integration และ OpenAPI generation scripts ได้
- **DEC-004**: เลือก Docker Compose layout และ test database naming ได้
- **DEC-005**: ห้ามเปลี่ยน framework, ORM, database หรือเพิ่ม Railway service โดยไม่
  ขออนุมัติผู้ใช้
- **DEC-006**: เลือก minor/patch version ของ MCP SDK ที่เข้ากับ Node.js ที่ pin ได้
- **DEC-007**: ใช้ Node.js built-ins สำหรับ argument parsing, hashing และ child
  process ก่อนเพิ่ม CLI framework หรือ native Keychain package

## 4. Interfaces & data contracts

ส่วนนี้กำหนด environment variables และ build-time artifacts ที่เชื่อมแต่ละ layer

### 4.1 Authentication variables

Auth variables อยู่ใน API service เท่านั้น ยกเว้น public application origin

| Variable                | Required | Purpose                                    |
| ----------------------- | -------- | ------------------------------------------ |
| `APP_ORIGIN`            | Yes      | Canonical Web origin                       |
| `GOOGLE_CLIENT_ID`      | Yes      | Google OAuth client identifier             |
| `GOOGLE_CLIENT_SECRET`  | Yes      | Google OAuth client secret                 |
| `GOOGLE_CALLBACK_URL`   | Yes      | Exact registered callback URL              |
| `ALLOWED_GOOGLE_EMAILS` | Yes      | Comma-separated normalized email allowlist |
| `SESSION_SECRET`        | Yes      | Signs session ID cookie                    |
| `SESSION_TTL_SECONDS`   | No       | Defaults to 604800 seconds                 |

`ALLOWED_GOOGLE_EMAILS` ต้อง parse เป็น set โดย trim whitespace, lowercase และตัด
ค่าว่าง ห้าม log ค่าเต็มของ allowlist ใน production

MCP raw token ไม่ใช่ environment variable ของ Railway Token ถูกสร้างจาก
cryptographically secure random bytes, แสดงครั้งเดียวและเก็บเฉพาะ hash ใน
PostgreSQL

### 4.2 API client generation contract

OpenAPI artifact เป็น interface ระหว่าง API กับ Web และต้องสร้างแบบ deterministic

```text
NestJS decorators and DTOs
  -> openapi.json
  -> Orval
  -> packages/api-client/src/generated
  -> TanStack Query hooks in apps/web
```

CI ต้อง fail เมื่อ generated artifacts ไม่ตรงกับ source หรือมี breaking contract
ที่ยังไม่ได้อนุมัติ

### 4.3 Local service contract

Local development ใช้ host processes กับ PostgreSQL container

```text
Browser
  -> http://localhost:8083
  -> Next.js Web on host
  -> http://localhost:<api-port>
  -> NestJS API on host
  -> PostgreSQL in Colima/Docker Compose
```

### 4.4 Package layout

Package names เป็น contract สำหรับ pnpm filters และ Railway commands

```text
apps/web                 @my-kanban/web
apps/api                 @my-kanban/api
apps/cli                 @my-kanban/cli
packages/api-client      @my-kanban/api-client
packages/config          @my-kanban/config
```

## 5. Acceptance criteria

Technology stack ถือว่าล็อกและพร้อม implement เมื่อเกณฑ์ต่อไปนี้ผ่าน

- **AC-001**: Given monorepo checkout ใหม่, When รัน pnpm install, Then Web, API และ
  api-client dependencies ต้อง resolve จาก lockfile เดียว
- **AC-002**: Given OpenAPI เปลี่ยน, When รัน generator, Then Orval client และ
  TanStack Query hooks ต้องอัปเดตแบบ deterministic
- **AC-003**: Given Google email ไม่อยู่ใน allowlist, When callback สำเร็จจาก Google,
  Then API ต้องปฏิเสธโดยไม่สร้าง session
- **AC-004**: Given email ถูกนำออกจาก allowlist, When session เดิมเรียก API ครั้งถัดไป,
  Then API ต้องลบ session และตอบ `401`
- **AC-005**: Given production session, When ตรวจ cookie, Then ต้องมี `HttpOnly`,
  `Secure` และ `SameSite=Lax`
- **AC-006**: Given PostgreSQL container ใน Colima ทำงาน, When เริ่ม Web และ API บน
  host, Then login callback และ business API ต้องทำงานผ่าน Web proxy
- **AC-007**: Given API DTO เปลี่ยนแบบ breaking, When CI ตรวจ OpenAPI, Then build ต้อง
  fail ก่อน Railway deploy
- **AC-008**: Given test suite, When รัน unit, integration และ E2E, Then ต้องใช้ Vitest,
  PostgreSQL Docker และ Playwright ตามระดับที่กำหนด
- **AC-009**: Given dependency graph ของ MVP, When ตรวจ services, Then ต้องไม่มี Redis,
  worker, WebSocket หรือ object storage dependency
- **AC-010**: Given UI feature ใหม่, When ตรวจ implementation, Then ต้องมีหลักฐานว่า
  reuse หรือ adapt Minimal component ก่อนสร้าง reusable component ใหม่
- **AC-011**: Given production build หรือ Railway build, When resolve Web imports,
  Then ต้องไม่มี import ที่ชี้ไป `~/Minimal_TypeScript_v7.0.0` หรือ absolute home path
- **AC-012**: Given MCP token ของ Project A, When เรียก Task ของ Project B, Then API
  ต้องไม่คืนข้อมูลหรือทำ mutation
- **AC-013**: Given `create_tasks` มากกว่า 10 รายการ, When เรียก MCP, Then request ต้อง
  fail ก่อนเริ่ม transaction
- **AC-014**: Given `kanban codex work`, When helper เปิด child process, Then token
  ต้องมาจาก macOS Keychain alias `work` และไม่ถูกเขียนลงไฟล์

## 6. Test automation strategy

Stack validation ต้องพิสูจน์ว่า tooling ทำงานร่วมกันก่อนเริ่ม feature จำนวนมาก

- สร้าง smoke test สำหรับ Next.js BFF proxy ไป NestJS Express
- สร้าง auth integration test สำหรับ verified email และ allowlist rejection
- สร้าง session persistence test ที่ restart API แล้ว session ยัง valid
- สร้าง OpenAPI generation test และ generated-client typecheck
- สร้าง Prisma migration test บน PostgreSQL Docker
- สร้าง Playwright test-only login seam ที่เปิดเฉพาะ test environment
- สร้าง component smoke tests สำหรับ Minimal components ที่ถูก adapt ใน Kanban UI
- รัน lint, typecheck, unit, integration, E2E และ production build ใน CI

## 7. Rationale & context

NestJS Express ถูกเลือกตามคำตัดสินของผู้ใช้และเป็น default adapter ของ NestJS จึง
ใช้ session middleware กับ ecosystem มาตรฐานได้ตรงไปตรงมา PostgreSQL-backed session
เหมาะกับผู้ใช้คนเดียวและ revoke ได้ทันทีโดยไม่ต้องออกแบบ access/refresh JWT pair

Google OIDC ลดการจัดเก็บ password และ email allowlist จำกัดผู้ใช้โดยไม่เพิ่มระบบ
registration หรือ role TanStack Query เหมาะกับ server state และ optimistic Board
mutation ขณะที่ React state/context เพียงพอกับ UI state ของ MVP

Streamable HTTP ทำให้ Codex และ Claude Code ใช้ production MCP endpoint เดียวกัน
ได้ Project-scoped token ทำหน้าที่เป็น capability ที่จำกัด domain scope ตั้งแต่
connection เริ่ม ส่วน macOS Keychain ลดการเก็บ long-lived token ใน repository หรือ
shell history

Vitest เป็น runner เดียวสำหรับ Web และ API unit tests ส่วน Supertest และ Playwright
ครอบคลุม HTTP กับ browser boundary Colima กับ Docker Compose ทำให้ local PostgreSQL
ใกล้เคียง Railway โดยไม่ containerize hot-reload processes ทั้งหมด

## 8. Dependencies & external integrations

Stack นี้พึ่ง identity, hosting และ DNS providers ที่กำหนด

### External systems

ระบบภายนอกเป็น platform infrastructure และ identity เท่านั้น

- **EXT-001**: Google OpenID Connect
- **EXT-002**: Railway Web, API และ PostgreSQL services
- **EXT-003**: Cloudflare DNS zone `koonporza.com`

### Third-party services

Google ได้รับเฉพาะข้อมูล authentication scopes ที่กำหนด

- **SVC-001**: Google Identity สำหรับ login
- **SVC-002**: Model Context Protocol สำหรับ AI Task management

### Infrastructure dependencies

Production และ local ใช้ PostgreSQL major version เดียวกัน

- **INF-001**: Railway private networking
- **INF-002**: Colima และ Docker Compose สำหรับ local PostgreSQL

### Data dependencies

Application revision พึ่ง migration และ generated API artifacts

- **DAT-001**: Prisma schema และ migrations
- **DAT-002**: OpenAPI document และ Orval-generated client

### Technology platform dependencies

Exact versions ต้องบันทึกใน manifests และ lockfile ไม่ใช่เอกสารนี้

- **PLT-001**: Node.js LTS
- **PLT-002**: pnpm
- **PLT-003**: TypeScript
- **PLT-004**: Official MCP TypeScript SDK
- **PLT-005**: macOS `/usr/bin/security`

### Compliance dependencies

ระบบไม่เก็บ Google access token หากไม่จำเป็นต่อ login session

- **COM-001**: Google OAuth consent และ privacy configuration

## 9. Examples & edge cases

Implementation ต้องรองรับกรณีต่อไปนี้

- Google คืน email ที่ยังไม่ verified ต้องปฏิเสธ
- Allowlist มีตัวพิมพ์ใหญ่หรือ whitespace ต้อง normalize ก่อนเทียบ
- Google account หลายรายการใน allowlist ต้อง map ไป Owner Workspace เดียวกัน
- Session store database ขาดการเชื่อมต่อต้อง fail readiness
- API restart ต้องไม่ทำให้ session ที่ยังไม่หมดอายุหาย
- OAuth callback ผ่าน Next proxy ต้องรักษา `Set-Cookie` และ redirect
- Secure cookie บน localhost ต้องใช้ environment-specific setting
- Generated client เก่ากว่า OpenAPI ต้องถูกตรวจใน CI
- Colima หยุดทำงานต้องแสดง database connection error ที่แก้ไขได้
- MCP token หมดอายุหรือถูก revoke ระหว่าง session ต้อง fail request ถัดไป
- MCP batch retry ด้วย idempotency key เดิมต้องไม่สร้าง Task ซ้ำ
- Helper CLI เปิดจาก non-Git directory ต้องทำงานเหมือนเดิม

## 10. Validation criteria

ก่อนเริ่ม feature implementation ต้องมีหลักฐานดังนี้

- pnpm workspace install, lint และ typecheck ผ่าน
- Next.js และ NestJS production builds ผ่าน
- PostgreSQL Docker Compose ทำงานผ่าน Colima
- Prisma migration แรก apply และ rollback ด้วย test isolation ได้
- Google login ผ่าน Web proxy ด้วย email ที่ allowlist
- Email ที่ไม่ allowlist และ session ที่ revoke ถูกปฏิเสธ
- OpenAPI และ Orval generation ทำซ้ำแล้วไม่มี diff
- UI component inventory ระบุ Minimal component ที่ใช้กับแต่ละ Kanban surface
- Web source ไม่มี absolute import ไป `~/Minimal_TypeScript_v7.0.0`
- Vitest, Supertest และ Playwright smoke tests ผ่าน
- Railway configuration ไม่มี public API หรือ public PostgreSQL endpoint
- MCP cross-Project isolation, atomic batch และ audit tests ผ่าน
- Codex กับ Claude Code เชื่อม `/mcp` ด้วย token คนละ Project ได้
- macOS Keychain ไม่มี raw token หลัง `kanban project remove`

## 11. Related specifications / further reading

เอกสารนี้เป็น technology decision source of truth และต้องใช้ร่วมกับ specifications
ต่อไปนี้

- [Product requirements](./spec-design-personal-kanban-scrum-board.md)
- [System architecture](./spec-architecture-kanban-system.md)
- [PostgreSQL data specification](./spec-data-kanban-postgresql.md)
- [Railway deployment specification](./spec-infrastructure-railway-deployment.md)
- [MCP task management integration](./spec-integration-mcp-task-management.md)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [OpenAI Codex configuration reference](https://developers.openai.com/codex/config-reference)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [NestJS sessions](https://docs.nestjs.com/techniques/session)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Passport Google OIDC strategy](https://www.passportjs.org/packages/passport-google-oidc/)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Vitest](https://vitest.dev/guide/)
- [Playwright](https://playwright.dev/docs/intro)
- [Colima](https://github.com/abiosoft/colima)

## 12. Next steps

Foundation repository, Kanban persistence, generated client และ local PostgreSQL
พร้อมแล้ว ขั้นตอนถัดไปคือเพิ่ม MCP adapter ที่ reuse application services เดียวกับ REST

1. เพิ่ม MCP token, idempotency และ audit schema
2. เพิ่ม `McpModule` พร้อม Streamable HTTP transport
3. เพิ่ม Project-token UI และ Web `/mcp` proxy
4. เพิ่ม `apps/cli` สำหรับ macOS Keychain, Codex และ Claude Code
5. เพิ่ม MCP integration/security tests
6. Deploy และตรวจ Railway หลังผู้ใช้สั่ง deploy โดยตรง

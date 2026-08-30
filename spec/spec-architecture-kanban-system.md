---
title: Personal Kanban System Architecture
version: 1.2
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [architecture, nextjs, nestjs, express, prisma, postgresql, railway]
---

# Introduction

เอกสารนี้กำหนดสถาปัตยกรรมของ Personal Kanban and Scrum Board ที่ deploy บน
Railway ใช้ `kanban.koonporza.com` เป็น public frontend domain ใช้ PostgreSQL เป็น
source of truth และแยก frontend กับ backend ออกจากกันอย่างชัดเจน สถาปัตยกรรมนี้
ให้ความสำคัญกับความเรียบง่ายสำหรับผู้ใช้คนเดียว พร้อมรักษา boundary ที่รองรับการ
เพิ่ม collaboration ในอนาคตได้

## 1. Purpose & scope

ข้อกำหนดนี้ครอบคลุม framework decision, service boundaries, request flow,
authentication, API conventions, repository structure และ operational behavior
สำหรับ MVP โดยไม่ลงรายละเอียด SQL schema ซึ่งกำหนดใน data specification แยกต่างหาก

### 1.1 Architecture decision

ระบบต้องใช้ stack ต่อไปนี้เป็น baseline สำหรับการพัฒนา

- **Frontend**: Next.js App Router, React, TypeScript และ Minimal TypeScript v7
  component system บน MUI
- **Backend**: NestJS บน default Express adapter
- **API style**: REST JSON ภายใต้ prefix `/api/v1`
- **API contract**: OpenAPI ที่สร้างจาก backend source
- **Database**: PostgreSQL
- **ORM and migration**: Prisma ORM และ Prisma Migrate
- **Package manager**: pnpm workspace
- **Hosting**: Railway services สำหรับ `web`, `api` และ `Postgres`
- **Validation**: Runtime validation ที่ API boundary และ typed generated client

### 1.2 Backend framework comparison

การเลือก backend พิจารณาจากความเร็วในการพัฒนา ความชัดเจนของ domain boundary
การทดสอบ API และต้นทุนการดูแลบน Railway

| ตัวเลือก               | ข้อดี                                                     | ข้อจำกัด                                                     | ผลตัดสิน                     |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| Next.js Route Handlers | deploy service เดียวและ shared types ง่าย                 | UI กับ domain ผูกกันและโตยากเมื่อ transaction ซับซ้อน        | ไม่เลือกเป็น primary backend |
| NestJS + Express       | module, DI, guard, validation, session และ OpenAPI ชัดเจน | มีโครงสร้างและ boilerplate มากกว่า                           | **เลือกใช้**                 |
| NestJS + Fastify       | throughput สูงและมี adapter อย่างเป็นทางการ               | session middleware ต้องใช้ adapter-specific integration      | ไม่เลือกตามข้อกำหนดผู้ใช้    |
| Hono                   | API เล็กและ portable                                      | ecosystem สำหรับ modular business application บางกว่า NestJS | ไม่เลือกสำหรับ MVP           |

NestJS ใช้ Express เป็น default adapter และสร้าง OpenAPI document จาก application
metadata ได้ ส่วน Prisma มี NestJS recipe อย่างเป็นทางการและรองรับ PostgreSQL
โดยตรง การรวมกันนี้รองรับ server-side session ด้วย middleware ecosystem มาตรฐาน
และลดจำนวน conventions ที่ต้องออกแบบเอง

## 2. Definitions

คำต่อไปนี้มีความหมายเฉพาะในสถาปัตยกรรมนี้

- **Web service**: Next.js application ที่ render UI และเป็น public entry point
- **API service**: NestJS application ที่ถือ business rules และเข้าถึง PostgreSQL
- **BFF**: Backend for Frontend layer ใน Next.js ที่ forward `/api/*` ไป API service
- **Source of truth**: PostgreSQL state ที่ถือเป็นข้อมูลจริงเมื่อเกิดความขัดแย้ง
- **DTO**: Data Transfer Object ที่กำหนด request และ response ของ API
- **Aggregate**: กลุ่มข้อมูลที่ต้องเปลี่ยนพร้อมกันใน transaction เดียว
- **Optimistic update**: การอัปเดต UI ก่อน server ตอบ โดยต้อง rollback ได้
- **Idempotency**: การเรียก command ซ้ำแล้วไม่สร้างผลลัพธ์ซ้ำ
- **Owner**: ผู้ใช้คนเดียวที่ได้รับสิทธิ์เข้าถึง Workspace ใน MVP

## 3. Requirements, constraints & guidelines

ข้อกำหนดต่อไปนี้เป็น boundary บังคับสำหรับ implementation ทุก phase

### 3.1 Service boundaries

แต่ละ service ต้องมีหน้าที่ชัดเจนและไม่เข้าถึงข้อมูลข้าม boundary โดยตรง

- **ARC-001**: Web service ต้องรับผิดชอบ presentation, navigation, browser state
  และ optimistic UI เท่านั้น
- **ARC-002**: API service ต้องเป็นเจ้าของ authentication, authorization,
  business rules, transaction และ persistence
- **ARC-003**: Web service ต้องไม่เชื่อม PostgreSQL โดยตรง
- **ARC-004**: PostgreSQL ต้องรับ connection จาก API service เท่านั้น
- **ARC-005**: Browser ต้องเรียก API ผ่าน same-origin path `/api/v1/*` บน Web
  service
- **ARC-006**: Web service ต้อง forward API traffic ไป API service ผ่าน Railway
  private network
- **ARC-007**: API service ไม่ต้องมี public domain ใน MVP

### 3.2 Backend module boundaries

NestJS modules ต้องจัดตาม domain capability ไม่ใช่ตามชนิดไฟล์ระดับ global

- **MOD-001**: `AuthModule` ต้องดูแล Google login, callback, session และ logout
- **MOD-002**: `ProjectsModule` ต้องดูแล Workspace, Project และ Project settings
- **MOD-003**: `BoardsModule` ต้องดูแล Column, rank, WIP และ board query
- **MOD-004**: `IssuesModule` ต้องดูแล Issue, checklist, label และ blocked state
- **MOD-005**: `SprintsModule` ต้องดูแล planning, start, complete และ velocity
- **MOD-006**: `BackupModule` ต้องดูแล export, import validation และ merge
- **MOD-007**: `HealthModule` ต้องให้ liveness และ readiness endpoints
- **MOD-008**: Module ต้องสื่อสารผ่าน public service interface และห้าม import
  internal repository ของ module อื่น

### 3.3 API and contract requirements

API ต้องเป็น versioned REST contract ที่ตรวจสอบและสร้าง client ได้

- **API-001**: Endpoint ทุกตัวต้องอยู่ใต้ `/api/v1`
- **API-002**: Request body, path parameter และ query parameter ต้อง validate ก่อน
  เข้า application service
- **API-003**: API ต้องตอบ error ด้วยรูปแบบเดียวกันทุก module
- **API-004**: Mutation ต้องรองรับ optimistic concurrency ด้วย `version`
- **API-005**: Mutation ที่ retry ได้ต้องรับ `Idempotency-Key`
- **API-006**: List endpoint ต้องใช้ cursor pagination เมื่อผลลัพธ์อาจเกิน 100 รายการ
- **API-007**: OpenAPI document ต้องสร้างจาก source และตรวจ breaking change ใน CI
- **API-008**: Web service ต้องใช้ generated API client หรือ shared generated types
  จาก OpenAPI ห้ามเขียน response type ซ้ำด้วยมือ
- **API-009**: Date-time ต้องส่งเป็น ISO 8601 UTC และแปลง timezone ที่ UI เท่านั้น
- **API-010**: ID ภายนอกทั้งหมดต้องเป็น UUID

### 3.4 Authentication and authorization requirements

แม้ MVP มีผู้ใช้คนเดียว ระบบที่เปิดผ่านอินเทอร์เน็ตต้องยืนยันตัวตนและป้องกันข้อมูล

- **AUT-001**: Production ต้องไม่มี anonymous access ไปยัง business endpoint
- **AUT-002**: ระบบต้องมี Owner principal เพียงหนึ่งรายใน MVP
- **AUT-003**: Login ต้องใช้ Google OpenID Connect Authorization Code server flow
- **AUT-004**: API ต้องรับเฉพาะ Google email ที่ verified และอยู่ใน
  `ALLOWED_GOOGLE_EMAILS`
- **AUT-005**: Email ใน allowlist หลายรายการต้อง map ไป Owner principal เดียวกัน
- **AUT-006**: Session ต้องเก็บฝั่ง server ใน PostgreSQL และ browser ถือเฉพาะ
  session ID cookie
- **AUT-007**: Cookie ต้องตั้ง `HttpOnly`, `Secure` และ `SameSite=Lax` ใน production
- **AUT-008**: ทุก query ต้อง scope ด้วย `ownerId` หรือ `workspaceId` ฝั่ง server
- **AUT-009**: Auth endpoint ต้องมี rate limit, OAuth `state`/`nonce` และ generic error
- **AUT-010**: Logout ต้องทำลาย session ฝั่ง server
- **AUT-011**: Auth guard ต้องตรวจ email allowlist ซ้ำทุก request เพื่อ revoke ได้ทันที
- **AUT-012**: MVP ต้องไม่มี local password, registration form หรือ JWT browser flow

### 3.5 Consistency and transaction requirements

Command ที่กระทบ Board หรือ Sprint ต้องรักษา invariant แม้มี retry หรือ request ซ้ำ

- **TXN-001**: การ reorder Issue ต้อง commit rank changes ใน transaction เดียว
- **TXN-002**: การเริ่ม Sprint ต้องตรวจและสร้าง Active Sprint state ใน transaction
  เดียว
- **TXN-003**: การ complete Sprint ต้องคำนวณ velocity, ปิด Sprint และย้ายงานค้าง
  ใน transaction เดียว
- **TXN-004**: Import แบบ replace ต้อง validate ทั้ง payload ก่อนเริ่ม transaction
- **TXN-005**: Version conflict ต้องตอบ HTTP `409` พร้อม current version
- **TXN-006**: Optimistic UI ต้อง rollback และ refetch aggregate เมื่อ server ปฏิเสธ

### 3.6 Observability and lifecycle requirements

Service ต้องเปิดเผยข้อมูลเพียงพอสำหรับวินิจฉัยปัญหาโดยไม่รั่วเนื้อหางาน

- **OPS-001**: API ต้อง log แบบ structured JSON ใน production
- **OPS-002**: Request log ต้องมี request ID, method, route, status และ duration
- **OPS-003**: Log ต้องไม่บันทึก password, token, cookie, Issue description หรือ
  database connection string
- **OPS-004**: API ต้อง handle `SIGTERM` และปิด HTTP กับ database connection อย่าง
  ปลอดภัย
- **OPS-005**: `/health/live` ต้องตอบเมื่อ process ทำงาน
- **OPS-006**: `/health/ready` ต้องตอบ `200` เฉพาะเมื่อ service รับ request และ
  เชื่อม PostgreSQL ได้

### 3.7 Constraints and guidelines

ข้อจำกัดนี้ช่วยคุมขนาดระบบและลด abstraction ที่ยังไม่จำเป็น

- **CON-001**: MVP ต้องไม่ใช้ microservices เพิ่มจาก Web และ API
- **CON-002**: MVP ต้องไม่ใช้ message broker, Redis หรือ background worker
- **CON-003**: API ต้องเริ่มเป็น modular monolith
- **CON-004**: ห้ามสร้าง repository abstraction ที่ไม่มี alternate implementation
- **CON-005**: ห้ามใช้ GraphQL ใน MVP
- **GUD-001**: ใช้ synchronous transaction สำหรับ business command ก่อนเพิ่ม queue
- **GUD-002**: แยก domain rule จาก controller และ ORM mapping
- **GUD-003**: ใช้ database constraint ปกป้อง invariant ที่บังคับได้ใน PostgreSQL
- **GUD-004**: Pin runtime และ package manager version ใน source control
- **GUD-005**: Frontend ต้อง reuse หรือ adapt component, layout และ theme จาก
  `~/Minimal_TypeScript_v7.0.0/next-ts/src` โดย copy source ที่ใช้เข้า repository

## 4. Interfaces & data contracts

ส่วนนี้กำหนด request path, error envelope และ endpoint groups ระดับระบบ รายละเอียด
field ของ entity อยู่ใน data specification

### 4.1 Request flow

Production request ต้องไหลผ่านเส้นทางเดียวเพื่อให้ cookie และ authorization
มี boundary ชัดเจน

```text
Browser
  -> HTTPS Web domain on Railway
  -> Next.js /api/v1/* BFF proxy
  -> Railway private network
  -> NestJS API
  -> Railway private network
  -> PostgreSQL
```

### 4.2 Error envelope

Error response ต้องใช้ contract นี้สำหรับ error ที่ client จัดการได้

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Array<{
      field?: string;
      reason: string;
    }>;
  };
};
```

### 4.3 Endpoint groups

Endpoint groups ต่อไปนี้เป็น surface ขั้นต่ำของ MVP

| Method   | Path                                  | Purpose                        |
| -------- | ------------------------------------- | ------------------------------ |
| GET      | `/api/v1/auth/google`                 | เริ่ม Google OIDC login        |
| GET      | `/api/v1/auth/google/callback`        | ตรวจ callback และสร้าง session |
| POST     | `/api/v1/auth/logout`                 | ทำลาย session                  |
| GET      | `/api/v1/me`                          | อ่าน Owner profile             |
| GET/POST | `/api/v1/projects`                    | อ่านและสร้าง Project           |
| PATCH    | `/api/v1/projects/:projectId`         | แก้ Project                    |
| GET/POST | `/api/v1/projects/:projectId/issues`  | อ่านและสร้าง Issue             |
| PATCH    | `/api/v1/issues/:issueId`             | แก้ Issue                      |
| POST     | `/api/v1/issues/:issueId/move`        | ย้ายและ reorder Issue          |
| GET/POST | `/api/v1/projects/:projectId/columns` | อ่านและสร้าง Column            |
| GET/POST | `/api/v1/projects/:projectId/sprints` | อ่านและสร้าง Sprint            |
| POST     | `/api/v1/sprints/:sprintId/start`     | เริ่ม Sprint                   |
| POST     | `/api/v1/sprints/:sprintId/complete`  | ปิด Sprint                     |
| GET      | `/api/v1/projects/:projectId/board`   | อ่าน Board aggregate           |
| GET      | `/api/v1/export`                      | export Workspace               |
| POST     | `/api/v1/import`                      | validate และ import Workspace  |
| GET      | `/health/live`                        | process liveness               |
| GET      | `/health/ready`                       | application readiness          |

### 4.4 Repository layout

Repository ต้องเปลี่ยนเป็น shared pnpm workspace เพื่อให้ Railway build แยก service
ได้โดยยังใช้ contracts ร่วมกัน

```text
my-kanban/
├── apps/
│   ├── web/                 # Existing Next.js application
│   └── api/                 # NestJS + Express application
├── packages/
│   ├── api-client/          # Generated OpenAPI client
│   └── config/              # Shared TypeScript and lint config only
├── spec/
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

Business entity types ต้องมาจาก generated API contract ไม่สร้าง shared domain
package ที่ทำให้ frontend import backend internals

## 5. Acceptance criteria

Architecture พร้อมสำหรับ implementation เมื่อเงื่อนไขต่อไปนี้พิสูจน์ได้

- **AC-001**: Given Web และ API ทำงานบน Railway, When Browser เรียก
  `/api/v1/projects`, Then request ต้องไปถึง API ผ่าน Web service โดย API ไม่มี
  public domain
- **AC-002**: Given PostgreSQL ไม่พร้อม, When Railway เรียก `/health/ready`, Then
  API ต้องตอบ non-`200` และ deployment ต้องไม่รับ traffic
- **AC-003**: Given ผู้ใช้ยังไม่ login, When เรียก business endpoint, Then API ต้องตอบ
  `401` โดยไม่คืนข้อมูล domain
- **AC-004**: Given Google email ไม่อยู่ใน allowlist, When callback สำเร็จ, Then API
  ต้องปฏิเสธและไม่สร้าง session
- **AC-005**: Given Issue version ล้าสมัย, When ส่ง mutation, Then API ต้องตอบ `409`
  พร้อม current version
- **AC-006**: Given move command ถูก retry ด้วย idempotency key เดิม, When API รับ
  request ซ้ำ, Then Issue ต้องถูกย้ายเพียงครั้งเดียว
- **AC-007**: Given OpenAPI source เปลี่ยนแบบ breaking, When CI ตรวจ contract, Then
  pipeline ต้องล้มเหลวก่อน deploy
- **AC-008**: Given API ได้รับ `SIGTERM`, When service shutdown, Then request ที่กำลัง
  ทำต้องจบภายใน grace period และ database connection ต้องปิด

## 6. Test automation strategy

การทดสอบ architecture ต้องแยก business correctness ออกจาก framework wiring

- **Unit**: ทดสอบ application services และ domain policies โดย mock I/O boundary
- **Integration**: ทดสอบ NestJS module กับ PostgreSQL จริงใน disposable database
- **Contract**: สร้าง OpenAPI และเปรียบเทียบ breaking changes ใน CI
- **API e2e**: ทดสอบ auth, authorization, validation, concurrency และ transaction
- **Web e2e**: ทดสอบ same-origin session และ BFF proxy ผ่าน browser
- **Shutdown**: ทดสอบ readiness และ graceful shutdown ระหว่าง deploy
- **Security**: ทดสอบ cookie flags, rate limit, owner scope และ log redaction

## 7. Rationale & context

Next.js Route Handlers เหมาะกับ API ขนาดเล็ก แต่ระบบนี้มี command ที่ต้องรักษา
transaction หลาย entity เช่น complete Sprint, import และ reorder การใช้ NestJS
ช่วยแยก controller, application service และ persistence พร้อมมี guard, pipe,
interceptor และ testing utilities ที่เป็น convention เดียวกัน

Express ถูกเลือกตามข้อกำหนดผู้ใช้และเป็น default adapter ของ NestJS จึงใช้
server-side session, Passport strategy และ middleware ecosystem มาตรฐานได้โดยตรง
โดยไม่เพิ่ม adapter-specific integration ที่ไม่จำเป็นสำหรับระบบผู้ใช้คนเดียว

Prisma ถูกเลือกเพราะมี typed client, migration workflow และ NestJS recipe อย่าง
เป็นทางการ หากพบ query ที่ ORM แสดงออกไม่ชัด สามารถใช้ parameterized raw SQL เฉพาะ
repository method นั้นโดยยังคง transaction boundary เดิม

## 8. Dependencies & external integrations

ระบบพึ่ง infrastructure และ platform ต่อไปนี้โดยตรง

### External systems

ระบบภายนอกมี hosting, managed database และ identity provider ใน MVP

- **EXT-001**: Railway platform สำหรับ build, deploy, networking และ environment
- **EXT-002**: Railway PostgreSQL สำหรับ durable relational storage
- **EXT-003**: Google OpenID Connect สำหรับยืนยันตัวตน

### Third-party services

MVP ส่งเฉพาะ authentication scopes ที่จำเป็นไป Google และไม่ส่ง domain data

- **SVC-001**: Google Identity สำหรับ login

### Infrastructure dependencies

Service ต้องอยู่ใน Railway Project และ Environment เดียวกันเพื่อใช้ private network

- **INF-001**: Railway Web service
- **INF-002**: Railway API service
- **INF-003**: Railway PostgreSQL service

### Data dependencies

API พึ่ง schema และ migration ที่อยู่ใน source control

- **DAT-001**: PostgreSQL schema จาก Prisma migration history
- **DAT-002**: OpenAPI artifact ที่สร้างจาก API source

### Technology platform dependencies

Runtime ต้อง pin ให้เหมือนกันระหว่าง local, CI และ Railway

- **PLT-001**: Node.js LTS ที่ project pin ไว้
- **PLT-002**: pnpm version จาก `packageManager`
- **PLT-003**: NestJS default Express adapter
- **PLT-004**: Prisma ORM และ PostgreSQL driver

### Compliance dependencies

ผลิตภัณฑ์ไม่มี regulated data ใน MVP แต่ต้องรักษา privacy baseline

- **COM-001**: OWASP web application controls สำหรับ auth และ session

## 9. Examples & edge cases

กรณีต่อไปนี้ต้องมี behavior ที่กำหนดก่อนเริ่ม implementation

- Web service พร้อมแต่ API ยังไม่ ready ต้องแสดง service unavailable ที่ retry ได้
- API พร้อมแต่ migration ยังไม่ครบต้อง fail readiness
- Session หมดอายุระหว่าง mutation ต้องตอบ `401` โดยไม่ทำ mutation ซ้ำ
- Email ถูกนำออกจาก allowlist ต้องทำลาย session ใน request ถัดไป
- Browser ส่ง move command ซ้ำเพราะ network timeout ต้องไม่ย้าย Issue ซ้ำ
- Web และ API deploy คนละ revision ที่ contract ไม่เข้ากันต้องถูกป้องกันใน CI
- Database transaction conflict ต้อง retry แบบ bounded หรือคืน `409`
- API log formatter ล้มเหลวต้องไม่ทำให้ request หลักล้มเหลว

## 10. Validation criteria

สถาปัตยกรรมนี้ถือว่าผ่านเมื่อมีหลักฐานครบดังนี้

- Web, API และ PostgreSQL รันแยก process ได้ใน local development
- API build และ start ด้วย production command ได้
- OpenAPI document สร้างแบบ deterministic ได้
- API integration tests ใช้ PostgreSQL จริงและผ่าน transaction scenarios
- API รับ traffic ที่ `0.0.0.0:$PORT`
- Railway healthcheck ใช้ `/health/ready` และผ่านก่อน traffic switch
- Browser ไม่เข้าถึง PostgreSQL หรือ Railway private API address โดยตรง
- Secret และ connection string ไม่ปรากฏใน client bundle หรือ logs

## 11. Related specifications / further reading

เอกสารต่อไปนี้กำหนดรายละเอียดที่ architecture นี้อ้างอิง

- [Product requirements](./spec-design-personal-kanban-scrum-board.md)
- [Technology stack specification](./spec-architecture-technology-stack.md)
- [PostgreSQL data specification](./spec-data-kanban-postgresql.md)
- [Railway infrastructure specification](./spec-infrastructure-railway-deployment.md)
- [NestJS session documentation](https://docs.nestjs.com/techniques/session)
- [NestJS OpenAPI documentation](https://docs.nestjs.com/openapi/introduction)
- [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma)
- [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)

## 12. Next steps

Repository foundation และ request path ถึง PostgreSQL พิสูจน์แล้ว ขั้นตอนต่อไปคือ
เพิ่ม authentication และ business modules โดยรักษา service boundary เดิม

1. ทำ Google OIDC, email allowlist และ PostgreSQL session
2. เพิ่ม Project, Board และ Issue modules พร้อม owner scoping
3. สร้าง OpenAPI artifact และ Orval client
4. เชื่อม Kanban UI กับ API และเพิ่ม optimistic rollback
5. เพิ่ม integration และ end-to-end tests
6. ตั้ง Railway services เมื่อผู้ใช้สั่ง deploy โดยตรง

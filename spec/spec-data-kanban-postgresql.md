---
title: Personal Kanban PostgreSQL Data Specification
version: 1.2
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [data, postgresql, prisma, schema, migration]
---

# Introduction

เอกสารนี้กำหนด relational data model สำหรับ Personal Kanban and Scrum Board โดยใช้
PostgreSQL บน Railway เป็น source of truth และ Prisma เป็น ORM กับ migration tool
เป้าหมายคือรักษา domain invariants, รองรับ transaction ของ Board และ Sprint และ
ป้องกันการสูญหายของข้อมูลระหว่าง deploy หรือ retry รวมถึงรองรับ Project-scoped
MCP access token, mutation idempotency และ audit trail

## 1. Purpose & scope

ข้อกำหนดนี้ครอบคลุม table, relation, constraints, indexes, rank strategy,
transaction boundaries, MCP credential metadata, audit retention, migration และ
backup contract สำหรับ MVP ไม่กำหนด UI หรือ HTTP endpoint โดยตรง

## 2. Definitions

คำต่อไปนี้ใช้เฉพาะใน data layer

- **Primary key**: UUID ที่ระบุ record ไม่ซ้ำ
- **Foreign key**: Constraint ที่รักษาความสัมพันธ์ระหว่าง table
- **Soft delete**: การตั้ง `archived_at` โดยไม่ลบ record
- **Hard delete**: การลบ record ออกจาก PostgreSQL จริง
- **Rank**: ค่า `BIGINT` สำหรับเรียง record ภายใน parent เดียวกัน
- **Version**: Integer ที่เพิ่มทุกครั้งเมื่อแก้ record เพื่อป้องกัน lost update
- **Partial unique index**: Unique index ที่ใช้กับ record บางสถานะเท่านั้น
- **Migration**: การเปลี่ยน schema แบบมี version ที่เก็บใน source control
- **MCP access token**: Bearer credential ที่ผูกกับ Project เดียวและเก็บเฉพาะ hash
- **Idempotency record**: ผลลัพธ์ของ mutation key เดิมที่ใช้ป้องกันการทำงานซ้ำ
- **Audit event**: Metadata ของ MCP mutation สำหรับตรวจสอบย้อนหลังโดยไม่เก็บ raw token

## 3. Requirements, constraints & guidelines

Data layer ต้องบังคับ invariant ที่ PostgreSQL ตรวจได้ และส่ง invariant ที่ต้องใช้
หลาย query ให้ application transaction จัดการ

### 3.1 General requirements

ทุก business table ต้องใช้ convention เดียวกัน

- **DAT-001**: Primary key ต้องใช้ UUID ที่สร้างก่อน insert หรือโดย PostgreSQL
- **DAT-002**: Timestamp ต้องใช้ `TIMESTAMPTZ` และเก็บเป็น UTC
- **DAT-003**: Mutable aggregate root ต้องมี `version INTEGER NOT NULL DEFAULT 1`
- **DAT-004**: Business record ต้องมี `created_at` และ `updated_at`
- **DAT-005**: Project, Column และ Issue ต้องใช้ soft delete เป็นค่าเริ่มต้น
- **DAT-006**: Foreign key ต้องระบุ `ON DELETE` behavior ชัดเจนทุก relation
- **DAT-007**: Enum ที่เป็น domain invariant ต้องใช้ PostgreSQL enum หรือ check
  constraint
- **DAT-008**: Text จากผู้ใช้ต้องมี application validation และ database limit
  สำหรับ field ที่มีขอบเขตแน่นอน
- **DAT-009**: Query ทุกตัวที่อ่าน domain data ต้อง scope ด้วย `owner_id` หรือ
  `workspace_id`
- **DAT-010**: MCP query และ mutation ต้อง scope ด้วย `project_id` ที่ resolve จาก
  access token เท่านั้น
- **DAT-011**: Raw MCP token ต้องไม่ถูก persist ใน PostgreSQL, log หรือ audit event
- **DAT-012**: MCP mutation ต้องบันทึก idempotency result และ audit event ใน
  transaction boundary ที่สอดคล้องกับ domain mutation

### 3.2 Rank requirements

Backlog, Board Column, Issue และ checklist ต้อง reorder ได้โดยไม่เขียนทุก record
ในการเคลื่อนไหวทั่วไป

- **RNK-001**: Rank ต้องใช้ `BIGINT` และเริ่มด้วยระยะห่าง 1024
- **RNK-002**: การแทรกระหว่างสอง record ต้องใช้ midpoint เมื่อยังมีช่องว่าง
- **RNK-003**: เมื่อไม่มี midpoint ต้อง rebalance เฉพาะ sibling list ใน transaction
- **RNK-004**: Rank ต้อง unique ภายใน parent และ active scope ที่เกี่ยวข้อง
- **RNK-005**: API ห้ามรับ rank ใหม่จาก client โดยตรง Client ส่ง before/after ID
  และ server คำนวณ rank

### 3.3 Integrity requirements

Constraint ต่อไปนี้ต้องบังคับใน migration หรือ transaction test

- **INT-001**: Workspace ต้องมี Owner ที่มีอยู่จริง
- **INT-002**: Project ต้องอยู่ใน Workspace เดียวกับ Owner context
- **INT-003**: Column ต้องอยู่ใน Project เดียวกับ Issue ที่อ้างถึง
- **INT-004**: Sprint และ Issue ต้องอยู่ใน Project เดียวกันเมื่อ Issue มี Sprint
- **INT-005**: Project หนึ่งมี Active Sprint ได้ไม่เกินหนึ่งรายการ
- **INT-006**: Completed Sprint ต้องมี `completed_at` และ Active Sprint ต้องไม่มี
  `completed_at`
- **INT-007**: Blocked Issue ต้องมี `blocked_reason` ที่ไม่เป็นค่าว่าง
- **INT-008**: Done Issue ต้องมี `completed_at`; Issue ที่ไม่ Done ต้องไม่มี
  `completed_at`
- **INT-009**: WIP limit ต้องเป็น `NULL` หรือ integer มากกว่าศูนย์
- **INT-010**: Story Point ต้องเป็น `NULL` หรือ integer ตั้งแต่ 0 ถึง 100
- **INT-011**: HTTP session ต้องมีวันหมดอายุและห้ามเก็บ Google access token หากไม่จำเป็น
- **INT-012**: Google identity ต้อง unique ด้วยคู่ `provider` และ `provider_subject`
- **INT-013**: Email identity ต้อง normalize lowercase และผ่านการยืนยันจาก Google
- **INT-014**: MCP access token ต้องอ้างถึง Project เดียวและมี `expires_at` เท่ากับ
  `created_at + 90 days`
- **INT-015**: Token ที่หมดอายุหรือมี `revoked_at` ต้องใช้ authenticate ไม่ได้
- **INT-016**: Idempotency key เดิมใน scope เดียวกันต้องใช้กับ request fingerprint
  เดิมเท่านั้น
- **INT-017**: MCP audit event ต้องอ้าง `project_id` และ token ที่เป็นต้นทางเสมอ

### 3.4 Migration requirements

Production schema ต้องเปลี่ยนผ่าน migration เท่านั้น

- **MIG-001**: ห้ามใช้ schema synchronization หรือ `db push` ใน production
- **MIG-002**: Migration file ต้อง commit พร้อม code ที่ต้องใช้ schema นั้น
- **MIG-003**: Railway pre-deploy ต้องรัน `prisma migrate deploy` ก่อนสลับ traffic
- **MIG-004**: Destructive migration ต้องใช้ expand-and-contract อย่างน้อยสอง
  deployment
- **MIG-005**: Migration ต้อง retry ได้หรือ fail โดยไม่ทำ schema ครึ่งหนึ่ง
- **MIG-006**: CI ต้องสร้าง database ว่างและ apply migration ตั้งแต่ต้นได้
- **MIG-007**: Production rollback ต้อง rollback application ก่อน ส่วน schema
  rollback ต้องใช้ forward-fix migration

## 4. Interfaces & data contracts

ตารางต่อไปนี้เป็น logical schema ขั้นต่ำ ชื่อจริงใน Prisma และ PostgreSQL ต้อง map
อย่างชัดเจนและคง contract นี้

### 4.1 Authentication tables

Authentication data แยกจาก domain data เพื่อกำหนด retention และ security ได้ง่าย

#### `users`

Table นี้เก็บ Owner principal เพียงรายเดียวตาม application rule และไม่เก็บ password
หรือข้อมูล credential ของ Google

| Column         | Type         | Rules       |
| -------------- | ------------ | ----------- |
| `id`           | UUID         | Primary key |
| `display_name` | VARCHAR(120) | Required    |
| `avatar_url`   | TEXT         | Nullable    |
| `created_at`   | TIMESTAMPTZ  | Required    |
| `updated_at`   | TIMESTAMPTZ  | Required    |

#### `auth_identities`

Table นี้ผูก Google identity ที่ผ่าน allowlist เข้ากับ Owner principal เดียวกัน

| Column             | Type         | Rules                          |
| ------------------ | ------------ | ------------------------------ |
| `id`               | UUID         | Primary key                    |
| `user_id`          | UUID         | FK `users`, cascade delete     |
| `provider`         | VARCHAR(32)  | Required, `google` in MVP      |
| `provider_subject` | VARCHAR(255) | Required                       |
| `email`            | VARCHAR(320) | Required, normalized lowercase |
| `email_verified`   | BOOLEAN      | Required, must be true         |
| `last_login_at`    | TIMESTAMPTZ  | Nullable                       |
| `created_at`       | TIMESTAMPTZ  | Required                       |
| `updated_at`       | TIMESTAMPTZ  | Required                       |

ต้องมี unique constraint ที่ `(provider, provider_subject)` และ unique index แบบ
case-insensitive บน `email` หลาย identity ที่อยู่ใน allowlist สามารถชี้ `user_id`
เดียวกันได้

#### `http_sessions`

Table นี้เก็บ server-side session สำหรับ `express-session` และ PostgreSQL store

| Column   | Type        | Rules                     |
| -------- | ----------- | ------------------------- |
| `sid`    | VARCHAR     | Primary key               |
| `sess`   | JSONB       | Required, no Google token |
| `expire` | TIMESTAMPTZ | Required, indexed         |

Session table ต้องสร้างผ่าน migration ใน source control และ expired row ต้องลบได้
โดยไม่กระทบ Owner หรือ domain data

### 4.2 MCP access and audit tables

ตารางกลุ่มนี้เก็บ credential metadata, retry result และ mutation trail โดยไม่เก็บ
raw token หรือ snapshot ของรายละเอียด Issue ทั้งก้อน

#### `mcp_access_tokens`

Token แต่ละรายการผูกกับ Project เดียว แยกตาม client/device และ revoke แยกรายการได้

| Column          | Type         | Rules                                    |
| --------------- | ------------ | ---------------------------------------- |
| `id`            | UUID         | Primary key                              |
| `project_id`    | UUID         | FK `projects`, restrict delete, indexed  |
| `created_by_id` | UUID         | FK `users`, restrict delete              |
| `label`         | VARCHAR(80)  | Required                                 |
| `client_type`   | ENUM         | `codex`, `claude`, `other`               |
| `token_prefix`  | VARCHAR(24)  | Required, unique                         |
| `token_hash`    | VARCHAR(128) | Required, unique                         |
| `expires_at`    | TIMESTAMPTZ  | Required, exactly 90 days after creation |
| `last_used_at`  | TIMESTAMPTZ  | Nullable                                 |
| `revoked_at`    | TIMESTAMPTZ  | Nullable                                 |
| `created_at`    | TIMESTAMPTZ  | Required                                 |
| `updated_at`    | TIMESTAMPTZ  | Required                                 |

Raw token แสดงใน Web UI ได้ครั้งเดียวหลังสร้าง จากนั้น lookup ด้วย prefix และ
เปรียบเทียบ hash แบบ constant-time เท่านั้น การ rotate ทำโดยออก token ใหม่แล้ว revoke
รายการเดิม

#### `mutation_idempotency`

Record นี้ป้องกัน retry ของ MCP mutation และออกแบบให้ application service ใช้ร่วมกับ
REST mutation ได้ในอนาคต

| Column                | Type         | Rules                                  |
| --------------------- | ------------ | -------------------------------------- |
| `id`                  | UUID         | Primary key                            |
| `project_id`          | UUID         | FK `projects`, cascade delete, indexed |
| `actor_type`          | ENUM         | `user`, `mcp_token`                    |
| `actor_id`            | UUID         | Required                               |
| `operation`           | VARCHAR(80)  | Required                               |
| `idempotency_key`     | VARCHAR(128) | Required                               |
| `request_fingerprint` | VARCHAR(128) | Required                               |
| `response_status`     | INTEGER      | Required                               |
| `response_body`       | JSONB        | Required; excludes secrets             |
| `expires_at`          | TIMESTAMPTZ  | Required                               |
| `created_at`          | TIMESTAMPTZ  | Required                               |

ต้องมี unique constraint ที่
`(project_id, actor_type, actor_id, operation, idempotency_key)` และ request ที่ใช้ key
เดิมกับ fingerprint ต่างกันต้องถูกปฏิเสธ ไม่ replay ผลลัพธ์เดิมอย่างเงียบ ๆ

#### `mcp_audit_events`

Audit event บันทึกทุก MCP mutation ทั้งสำเร็จ ถูกปฏิเสธ และล้มเหลว เพื่อสืบค้นตาม
Project, token, task และเวลา

| Column            | Type         | Rules                                   |
| ----------------- | ------------ | --------------------------------------- |
| `id`              | UUID         | Primary key                             |
| `project_id`      | UUID         | FK `projects`, restrict delete, indexed |
| `token_id`        | UUID         | FK `mcp_access_tokens`, restrict delete |
| `issue_id`        | UUID         | Nullable FK `issues`, set null          |
| `tool_name`       | VARCHAR(80)  | Required                                |
| `request_id`      | VARCHAR(128) | Required                                |
| `idempotency_key` | VARCHAR(128) | Nullable                                |
| `outcome`         | ENUM         | `success`, `rejected`, `failed`         |
| `changed_fields`  | TEXT[]       | Required, default empty                 |
| `error_code`      | VARCHAR(80)  | Nullable                                |
| `created_at`      | TIMESTAMPTZ  | Required                                |

Audit event ต้องไม่เก็บ raw token, Authorization header หรือ full description และต้อง
เก็บอย่างน้อย 90 วันก่อน maintenance job จะลบ record ที่เกิน retention

### 4.3 Workspace and project tables

Workspace เป็น ownership boundary ส่วน Project เป็น lifecycle boundary ของ Board

#### `workspaces`

Workspace ต้องมี Owner หนึ่งคนใน MVP

| Column              | Type         | Rules                                |
| ------------------- | ------------ | ------------------------------------ |
| `id`                | UUID         | Primary key                          |
| `owner_id`          | UUID         | FK `users`, restrict delete, indexed |
| `name`              | VARCHAR(120) | Required                             |
| `active_project_id` | UUID         | Nullable; validated in transaction   |
| `version`           | INTEGER      | Required                             |
| `created_at`        | TIMESTAMPTZ  | Required                             |
| `updated_at`        | TIMESTAMPTZ  | Required                             |

#### `projects`

Project แยก Kanban หรือ Scrum workflow และใช้ soft delete

| Column             | Type         | Rules                                    |
| ------------------ | ------------ | ---------------------------------------- |
| `id`               | UUID         | Primary key                              |
| `workspace_id`     | UUID         | FK `workspaces`, cascade delete, indexed |
| `name`             | VARCHAR(120) | Required                                 |
| `color`            | VARCHAR(32)  | Required                                 |
| `mode`             | ENUM         | `kanban`, `scrum`                        |
| `active_sprint_id` | UUID         | Nullable; validated in transaction       |
| `version`          | INTEGER      | Required                                 |
| `archived_at`      | TIMESTAMPTZ  | Nullable                                 |
| `created_at`       | TIMESTAMPTZ  | Required                                 |
| `updated_at`       | TIMESTAMPTZ  | Required                                 |

### 4.4 Board and issue tables

Board state ใช้ Column category แทนการเก็บ status string ซ้ำใน Issue

#### `board_columns`

Column ต้องมี rank ที่ unique ต่อ Project สำหรับ record ที่ยังไม่ archive

| Column        | Type        | Rules                                  |
| ------------- | ----------- | -------------------------------------- |
| `id`          | UUID        | Primary key                            |
| `project_id`  | UUID        | FK `projects`, cascade delete, indexed |
| `name`        | VARCHAR(80) | Required                               |
| `category`    | ENUM        | `todo`, `in_progress`, `done`          |
| `rank`        | BIGINT      | Required                               |
| `wip_limit`   | INTEGER     | Nullable, greater than zero            |
| `version`     | INTEGER     | Required                               |
| `archived_at` | TIMESTAMPTZ | Nullable                               |
| `created_at`  | TIMESTAMPTZ | Required                               |
| `updated_at`  | TIMESTAMPTZ | Required                               |

#### `issues`

Issue เป็น aggregate root ของรายละเอียดงานและตำแหน่งบน Board

| Column           | Type         | Rules                                        |
| ---------------- | ------------ | -------------------------------------------- |
| `id`             | UUID         | Primary key                                  |
| `project_id`     | UUID         | FK `projects`, cascade delete, indexed       |
| `sprint_id`      | UUID         | Nullable FK `sprints`, set null on delete    |
| `column_id`      | UUID         | FK `board_columns`, restrict delete, indexed |
| `title`          | VARCHAR(200) | Required, trimmed                            |
| `description`    | TEXT         | Required, default empty                      |
| `type`           | ENUM         | `task`, `story`, `bug`, `chore`              |
| `priority`       | ENUM         | `urgent`, `high`, `medium`, `low`, `none`    |
| `story_points`   | INTEGER      | Nullable, 0 through 100                      |
| `due_date`       | DATE         | Nullable                                     |
| `is_blocked`     | BOOLEAN      | Required, default false                      |
| `blocked_reason` | VARCHAR(500) | Nullable                                     |
| `rank`           | BIGINT       | Required                                     |
| `completed_at`   | TIMESTAMPTZ  | Nullable                                     |
| `version`        | INTEGER      | Required                                     |
| `archived_at`    | TIMESTAMPTZ  | Nullable                                     |
| `created_at`     | TIMESTAMPTZ  | Required                                     |
| `updated_at`     | TIMESTAMPTZ  | Required                                     |

#### `checklist_items`

Checklist item มี lifecycle ตาม Issue และถูกลบพร้อม parent

| Column         | Type         | Rules                                |
| -------------- | ------------ | ------------------------------------ |
| `id`           | UUID         | Primary key                          |
| `issue_id`     | UUID         | FK `issues`, cascade delete, indexed |
| `text`         | VARCHAR(300) | Required                             |
| `is_completed` | BOOLEAN      | Required                             |
| `rank`         | BIGINT       | Required                             |
| `created_at`   | TIMESTAMPTZ  | Required                             |
| `updated_at`   | TIMESTAMPTZ  | Required                             |

### 4.5 Label tables

Label เป็น Project-scoped และใช้ join table เพื่อรองรับ many-to-many

#### `labels`

ชื่อ Label ต้อง unique ต่อ Project แบบ case-insensitive สำหรับ active label

| Column       | Type        | Rules                                  |
| ------------ | ----------- | -------------------------------------- |
| `id`         | UUID        | Primary key                            |
| `project_id` | UUID        | FK `projects`, cascade delete, indexed |
| `name`       | VARCHAR(60) | Required                               |
| `color`      | VARCHAR(32) | Required                               |
| `created_at` | TIMESTAMPTZ | Required                               |
| `updated_at` | TIMESTAMPTZ | Required                               |

#### `issue_labels`

Join table ต้องป้องกันการเพิ่ม Label เดิมให้ Issue ซ้ำ

| Column      | Type      | Rules                       |
| ----------- | --------- | --------------------------- |
| `issue_id`  | UUID      | FK `issues`, cascade delete |
| `label_id`  | UUID      | FK `labels`, cascade delete |
| Primary key | Composite | `issue_id`, `label_id`      |

### 4.6 Sprint table

Sprint เก็บ planning snapshot และผลลัพธ์เมื่อ complete

#### `sprints`

Active Sprint uniqueness ต้องบังคับด้วย partial unique index ต่อ Project

| Column             | Type         | Rules                                  |
| ------------------ | ------------ | -------------------------------------- |
| `id`               | UUID         | Primary key                            |
| `project_id`       | UUID         | FK `projects`, cascade delete, indexed |
| `name`             | VARCHAR(120) | Required                               |
| `goal`             | VARCHAR(500) | Required, default empty                |
| `status`           | ENUM         | `planned`, `active`, `completed`       |
| `start_date`       | DATE         | Required                               |
| `end_date`         | DATE         | Required, not before start             |
| `planned_points`   | INTEGER      | Required, snapshot                     |
| `completed_points` | INTEGER      | Required, default zero                 |
| `version`          | INTEGER      | Required                               |
| `completed_at`     | TIMESTAMPTZ  | Nullable                               |
| `created_at`       | TIMESTAMPTZ  | Required                               |
| `updated_at`       | TIMESTAMPTZ  | Required                               |

### 4.7 Required indexes

Indexes ต้องรองรับ query จริงและตรวจด้วย query plan เมื่อมี fixture 2,000 Issue

- `projects(workspace_id, archived_at)`
- `board_columns(project_id, archived_at, rank)`
- `issues(project_id, archived_at, column_id, rank)`
- `issues(project_id, sprint_id, archived_at, column_id, rank)`
- `issues(project_id, due_date) WHERE archived_at IS NULL`
- `issues(project_id, is_blocked) WHERE is_blocked = true`
- `sprints(project_id, status, start_date DESC)`
- Unique partial index on `sprints(project_id) WHERE status = 'active'`
- Unique `auth_identities(provider, provider_subject)`
- Unique `lower(auth_identities.email)`
- `auth_identities(user_id)`
- `http_sessions(expire)`
- Unique `mcp_access_tokens(token_prefix)`
- Unique `mcp_access_tokens(token_hash)`
- `mcp_access_tokens(project_id, revoked_at, expires_at)`
- Unique
  `mutation_idempotency(project_id, actor_type, actor_id, operation, idempotency_key)`
- `mutation_idempotency(expires_at)`
- `mcp_audit_events(project_id, created_at DESC)`
- `mcp_audit_events(token_id, created_at DESC)`
- `mcp_audit_events(issue_id, created_at DESC) WHERE issue_id IS NOT NULL`

## 5. Acceptance criteria

Schema ถือว่าพร้อมเมื่อ constraint และ transaction behavior ผ่านเกณฑ์ต่อไปนี้

- **AC-001**: Given Google identity เดิม, When login ด้วย `provider_subject` เดิม,
  Then ต้องเชื่อม Owner เดิมและไม่สร้าง identity ซ้ำ
- **AC-002**: Given HTTP session หมดอายุ, When session store cleanup ทำงาน, Then
  ต้องลบเฉพาะ session row โดยไม่กระทบ Owner หรือ domain data
- **AC-003**: Given Project มี Active Sprint, When insert Active Sprint ที่สอง,
  Then PostgreSQL ต้องปฏิเสธ
- **AC-004**: Given Issue version เป็น 3, When update ด้วย expected version 2, Then
  ไม่มี row ถูกแก้และ API สามารถตอบ conflict ได้
- **AC-005**: Given rank สองค่าไม่มี midpoint, When reorder, Then sibling list ต้อง
  rebalance และ move สำเร็จใน transaction เดียว
- **AC-006**: Given complete Sprint transaction ล้มเหลวระหว่างย้ายงานค้าง, When
  transaction rollback, Then Sprint และ Issue ต้องอยู่สถานะก่อนเริ่มทั้งหมด
- **AC-007**: Given database ว่าง, When รัน migration history, Then schema ต้องสร้าง
  สำเร็จโดยไม่ใช้ manual SQL นอก migration
- **AC-008**: Given production-like fixture 2,000 Issue, When อ่าน Board aggregate,
  Then query plan ต้องใช้ indexes ที่กำหนดและผ่าน performance target
- **AC-009**: Given export แล้ว import เข้าฐานข้อมูลว่าง, When เทียบ domain fields,
  Then ข้อมูลที่ผู้ใช้สร้างต้องตรงกันทั้งหมด
- **AC-010**: Given สร้าง MCP token, When อ่าน database, Then ต้องพบเฉพาะ prefix
  และ hash โดย `expires_at` ห่างจาก `created_at` 90 วัน
- **AC-011**: Given token ถูก revoke หรือหมดอายุ, When authenticate, Then lookup ต้อง
  ปฏิเสธ token โดยไม่เปิดเผยว่า prefix ใดมีอยู่จริง
- **AC-012**: Given MCP mutation key เดิมและ fingerprint เดิม, When retry, Then ต้อง
  คืนผลลัพธ์เดิมโดยไม่แก้ Issue ซ้ำ
- **AC-013**: Given MCP mutation สำเร็จหรือถูกปฏิเสธ, When transaction จบ, Then ต้อง
  มี audit event ที่ระบุ Project, token, tool, outcome และเวลา

## 6. Test automation strategy

Data tests ต้องใช้ PostgreSQL จริงเพราะ SQLite ไม่รองรับ constraint, enum, partial
index และ transaction behavior เหมือน production

- Migration test สร้าง database ว่างและ apply migration ทั้งหมด
- Constraint test ลอง insert และ update ข้อมูลผิด invariant
- Repository integration test ทดสอบ query, pagination และ owner scope
- Transaction test inject failure ระหว่าง multi-step command แล้วตรวจ rollback
- Concurrency test ส่ง mutation version เดียวกันพร้อมกันสอง request
- Import/export test ใช้ fixture ครบทุก table และ relation
- Performance test ใช้ `EXPLAIN (ANALYZE, BUFFERS)` ใน test environment
- Token repository test ครอบคลุม hash lookup, expiry, revoke และ Project scope
- Idempotency integration test ครอบคลุม replay และ key reuse ที่ payload ต่างกัน
- Audit test ยืนยันว่า success/rejection/failure ถูกบันทึกและไม่มี secret หรือ full
  Issue description

## 7. Rationale & context

PostgreSQL เหมาะกับ domain นี้เพราะ Sprint completion และ Board reorder ต้องใช้
transaction กับ relational constraints Rank แบบ BIGINT ที่เว้นช่องช่วยลด write
amplification โดยยัง debug และ index ได้ง่ายกว่าค่า rank แบบ opaque string

Schema แยก Owner principal ออกจาก Google identity ทำให้หลาย email ใน allowlist map
เข้าผู้ใช้คนเดียวได้ โดย application ยังจำกัด Owner หนึ่งรายและไม่เพิ่ม role หรือ
membership table ที่อยู่นอก MVP

## 8. Dependencies & external integrations

Data layer พึ่ง component ต่อไปนี้

### External systems

PostgreSQL อยู่บน Railway และไม่เปิด public TCP proxy ใน production

- **EXT-001**: Railway PostgreSQL service

### Third-party services

MCP client เข้าถึง Issue content เฉพาะผ่าน application authorization และไม่เชื่อม
database โดยตรง

- **SVC-001**: Codex CLI หรือ Claude Code ผ่าน Remote MCP endpoint

### Infrastructure dependencies

API ต้องเข้าถึง PostgreSQL ผ่าน Railway private network

- **INF-001**: `DATABASE_URL` ที่ reference จาก PostgreSQL service
- **INF-002**: Database backup policy ของ production environment

### Data dependencies

Migration history เป็น dependency บังคับของ application revision

- **DAT-DEP-001**: Prisma schema และ generated client
- **DAT-DEP-002**: Prisma migration files ใน source control

### Technology platform dependencies

ORM ต้องรองรับ transaction และ PostgreSQL feature ที่ใช้ใน migration

- **PLT-001**: PostgreSQL version ที่ Railway service pin ไว้
- **PLT-002**: Prisma ORM และ Prisma Migrate

### Compliance dependencies

ไม่มี regulated data ใน MVP

- **COM-001**: Retention และ deletion ต้องเป็นไปตามคำสั่งของ Owner

## 9. Examples & edge cases

Data implementation ต้องจัดการกรณีต่อไปนี้อย่างชัดเจน

- Archive Project ต้องไม่ cascade delete Issue
- Hard delete Project ต้องลบ child records ใน transaction ที่ตั้งใจเท่านั้น
- เปลี่ยน Column category เป็น Done ต้องอัปเดต `completed_at` ของ Issue ที่เกี่ยวข้อง
- ย้าย Issue ออกจาก Done ต้องล้าง `completed_at`
- Label จาก Project หนึ่งต้องเพิ่มให้ Issue อีก Project ไม่ได้
- Import timestamp ที่ไม่มี timezone ต้องถูกปฏิเสธ
- HTTP session ที่หมดอายุต้องลบได้โดย maintenance command โดยไม่กระทบ User
- Email ที่ถูกนำออกจาก allowlist ต้องถูกปฏิเสธใน request ถัดไปแม้ session ยังไม่หมดอายุ
- Migration ที่เพิ่ม required column ต้อง backfill ก่อนตั้ง `NOT NULL`
- Prefix ชนกันระหว่างสร้าง token ต้อง generate token ใหม่ก่อนตอบกลับ
- Token หมดอายุระหว่าง long-running mutation ต้องยืนยันสิทธิ์ก่อนเริ่ม transaction และ
  ไม่เริ่ม mutation ใหม่หลังหมดอายุ
- `create_tasks` ล้มเหลวหนึ่งรายการต้อง rollback Issue และ audit success ทั้ง batch
- หลัง batch rollback ต้องเขียน audit failure ด้วย request ID เดิมใน transaction ใหม่
- Idempotency key เดิมแต่ payload ต่างกันต้องตอบ conflict และเขียน audit rejection
- Maintenance job ห้ามลบ audit event ที่อายุยังไม่ถึง 90 วัน

## 10. Validation criteria

ก่อน deploy production ต้องมีหลักฐานดังนี้

- Migration apply จากศูนย์และจาก production predecessor ผ่าน
- Prisma schema, migration SQL และ logical model ตรงกัน
- Foreign key และ indexes ที่กำหนดมีอยู่จริง
- Integration tests ใช้ PostgreSQL version เดียวกับ production
- Database URL ไม่ปรากฏใน browser bundle, test snapshot หรือ logs
- Restore rehearsal จาก backup หรือ export ผ่านอย่างน้อยหนึ่งครั้งก่อนเปิดใช้งานจริง
- Token table ไม่มี column ที่เก็บ raw credential และ backup ไม่สามารถกู้ raw token ได้
- MCP mutation retry ไม่สร้าง Issue ซ้ำและ audit event เชื่อมกลับ Project/token ได้
- Retention job ลบเฉพาะ idempotency/audit record ที่เกิน policy

## 11. Related specifications / further reading

เอกสารนี้ต้องใช้ร่วมกับ architecture และ infrastructure specifications

- [Product requirements](./spec-design-personal-kanban-scrum-board.md)
- [System architecture](./spec-architecture-kanban-system.md)
- [Technology stack specification](./spec-architecture-technology-stack.md)
- [Railway deployment](./spec-infrastructure-railway-deployment.md)
- [MCP task management](./spec-integration-mcp-task-management.md)
- [Railway PostgreSQL documentation](https://docs.railway.com/databases/postgresql)
- [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma)

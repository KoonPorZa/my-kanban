---
title: MVP Completion and Recovery Specification
version: 1.1
date_created: 2026-09-01
last_updated: 2026-09-01
owner: Product owner
tags: [mvp, phase-3, kanban, recovery, accessibility]
---

# Introduction

เอกสารนี้กำหนด Phase 3 ซึ่งเป็นงานสุดท้ายก่อน Personal Kanban/Scrum Board จะถือว่า
ครบ MVP ตาม `spec-design-personal-kanban-scrum-board.md` โดยเติมช่องว่างที่ยังไม่มี
implementation หลัง Phase 2 และกำหนด default decisions ให้แต่ละ implementation lane ใช้
contract เดียวกัน

เป้าหมายคือให้ผู้ใช้คนเดียวจัดการหลาย Project, บันทึกรายละเอียด Issue ครบ, ค้นหาและโฟกัส
งาน, กู้คืน action เสี่ยง และ export/import ข้อมูลได้ โดยไม่เพิ่ม collaboration, Redis,
background worker หรือ public API service ใหม่

## 1. Scope and fixed decisions

- Project selector อยู่ใน Board header และเป็นทางเข้าหลักสำหรับ create, switch, edit และ
  archive Project
- Project ที่ archive แล้วไม่แสดงใน selector ปกติ แต่ข้อมูล Issue, Sprint และ history ยังอยู่
- Workspace เก็บ `activeProjectId`; switch สำเร็จต้อง persist ทันทีและเปิด Project ล่าสุดเมื่อ
  login ครั้งถัดไป
- Project ต้องเหลือ active อย่างน้อยหนึ่งรายการ การ archive active Project จะเลือก Project
  active อื่นโดยอัตโนมัติ
- Checklist เป็น ordered child records ของ Issue ไม่เก็บเป็น local UI state และไม่ใช้ JSON
  opaque field
- การย้าย Issue เข้า Done ขณะ checklist ยังไม่ครบต้องขอ confirmation บน Web; API รับ
  explicit override เพื่อป้องกัน client ข้าม warning โดยไม่ตั้งใจ
- Search/filter ทำ client-side จาก Board aggregate เพื่อให้ผลทันทีและไม่เปลี่ยน persisted rank
  รองรับ 2,000 Issue โดยใช้ pure predicate ที่มี performance test
- Filters ใช้ AND ข้ามชนิด filter และ OR ภายในชนิดเดียวกัน
- Focus เป็น Board mode ใน route เดิม แสดง In progress, blocked และ due ภายใน 7 วัน พร้อม
  blocked reason หรือ due date
- Kanban Done retention มีค่า `7`, `14`, `30` วันต่อ Project ค่าเริ่มต้น `30`; filter
  “Show hidden Done” override การซ่อนชั่วคราว
- Archive Issue มี Undo อย่างน้อย 5 วินาทีโดยเรียก restore endpoint; move มี Undo โดยส่ง move
  command กลับตำแหน่งเดิมด้วย version ล่าสุด
- Permanent delete จะไม่ทำงานจนพ้น Undo window หลัง confirmation การกด Undo ยกเลิกคำสั่ง
  ก่อนส่ง API การลบไม่มี automatic cascade ข้าม aggregate ที่ UI ไม่ได้อธิบาย
- Permanent Project delete ต้องแสดงจำนวน MCP credential และ audit event, ห้ามลบขณะมี MCP
  audit event ที่อายุไม่ครบ 90 วัน และลบ audit ที่พ้น retention ได้หลัง explicit confirmation
- Workspace export เป็น JSON schema version `1` ใช้ ISO 8601, ไม่รวม User identity,
  session, MCP token/hash, idempotency record หรือ audit payload
- Import จำกัด 10 MB ตรวจทุก field ก่อน transaction และรองรับ `replace` กับ `merge`;
  validation failure ต้องไม่เขียนข้อมูล
- Merge ใช้ exported entity IDs เป็น identity: entity ID ซ้ำให้ update domain fields,
  entityใหม่ให้ insert และความสัมพันธ์ต้อง resolve ภายในไฟล์หรือข้อมูลเดิม
- Rich text ยังอยู่นอก MVP; description/checklist/labels render เป็น plain text ผ่าน React
  escaping เท่านั้น

## 2. Delivery slices

### 2.1 Project lifecycle

ครอบคลุม `REQ-002`, `REQ-004`, `REQ-005`

- REST API: create, update name/color/mode, activate, archive และ list active/archived
- Create Project สร้าง default columns `To do`, `In progress`, `Review`, `Done` ใน transaction
- ทุก mutation ใช้ owner scope, optimistic version และ Project advisory lock
- Web selector รองรับ create/switch/edit/archive พร้อม loading, empty และ conflict feedback

### 2.2 Complete Issue and Board behavior

ครอบคลุม `REQ-011` ถึง `REQ-019`, `REQ-021`, `REQ-025` ถึง `REQ-030`, `AC-004`,
`AC-009`, `AC-012`

- Persist checklist item `id`, `title`, `isCompleted`, `rank`, timestamps และ version
- Issue detail แก้ type, priority, labels, Story Point, due date, blocked state/reason และ
  checklist ได้
- Card แสดง field ที่มีข้อมูลด้วย text/icon ไม่ใช้สีอย่างเดียว
- Column header แสดง Issue count และ Story Point total พร้อม WIP over-limit warning
- Card เปิด detail ด้วย Enter/Space และมี action ย้ายไป Column ก่อนหน้า/ถัดไปสำหรับ keyboard
  และ mobile
- Column archive ที่มี Issue ต้องเลือก destination และทำ transaction เดียว ห้ามทำ Issue หาย

### 2.3 Search, filters, Focus and Kanban retention

ครอบคลุม `REQ-050` ถึง `REQ-053`, `REQ-060` ถึง `REQ-065`, `AC-008`, `AC-014`

- Search title/description แบบ case-insensitive
- Filter type, priority, label, due state, blocked state, Sprint และ hidden Done
- แสดง active filter count และ Clear all
- Focus filter รวมสามกลุ่มด้วย OR ภายใน Focus แล้ว AND กับ explicit filters
- Mobile ต่ำกว่า 768 px ใช้ Column selector และ render ทีละ Column

### 2.4 Undo and recovery

ครอบคลุม `REQ-070` ถึง `REQ-075`, `AC-010`, `AC-011`, `AC-013`, `SEC-003`, `SEC-004`

- REST restore Issue สำหรับ browser flow และ reversible move/archive toast action
- Export response มี `schemaVersion`, `exportedAt`, Workspace, Projects, Columns, Issues,
  Checklist และ Sprints
- Import preview validate ก่อน confirm และ import endpoint ทำ replace/merge ใน transaction
- Import preview เป็น read-only endpoint ที่ใช้ schema/ownership checks ชุดเดียวกับ import และ
  ต้องไม่เขียน record ใดลงฐานข้อมูล
- UI อยู่ในหน้า Data & recovery ใต้ Dashboard และ download/upload ใช้ browser APIs

### 2.5 Quality, accessibility and reliability

ครอบคลุม `A11Y-001` ถึง `A11Y-005`, `RSP-001` ถึง `RSP-003`, `PER-001` ถึง
`PER-004`, `REL-001`

- Interactive target หลักมี accessible name, visible focus และขั้นต่ำ 44 x 44 pixels
- DnD ใช้ keyboard sensor พร้อม screen-reader instruction/announcement และ explicit move actions
- Drawer/dialog คืน focus ผ่าน MUI primitives และต้องมี component test สำหรับ keyboard path
- Mapper ข้าม record เดี่ยวที่ผิด contract, แสดง non-blocking warning และคง record ที่เหลือ
- Mutation ใช้ transaction ที่ aggregate boundary และ optimistic failure ต้อง rollback/refetch

## 3. Data and API changes

- เพิ่ม `Project.doneRetentionDays` ค่า default `30`
- เพิ่ม `IssueChecklistItem` relation และ index `(issueId, rank)`
- ขยาย Project DTO ให้ update `name`, `color`, `mode`, `doneRetentionDays` แบบ partial พร้อม
  `version`
- เพิ่ม Project create/activate/archive endpoints
- ขยาย Issue response และ mutation DTO ด้วย checklist; checklist mutation ใช้ Issue version
  เพื่อให้ update ทั้ง Issue aggregate เป็น atomic
- Move Issue DTO เพิ่ม `allowIncompleteChecklist` default `false`
- เพิ่ม `/api/v1/workspace/export` และ `/api/v1/workspace/import`
- เพิ่ม restore endpoint ที่ browser session เรียกได้; MCP contract เดิมยัง project-bound
- OpenAPI artifact และ Orval client ต้อง regenerate หลัง DTO/controller เปลี่ยน

## 4. Verification matrix

| Claim                  | Minimum evidence                                                               |
| ---------------------- | ------------------------------------------------------------------------------ |
| Project lifecycle      | API repository/integration tests และ Web selector tests                        |
| Issue fields/checklist | DTO validation, transaction tests, component interaction tests                 |
| Done warning/WIP       | move integration tests และ UI warning tests                                    |
| Search/filter/Focus    | pure predicate unit tests รวม 2,000 Issue performance assertion                |
| Mobile/keyboard        | component tests และ manual viewport/keyboard checklist                         |
| Undo                   | archive/restore และ reverse-move tests พร้อม toast action test                 |
| Export/import          | invalid schema rollback, 10 MB rejection, replace/merge round trip integration |
| Security               | export secret exclusion test และ unauthenticated endpoint tests                |
| Regression             | root format, typecheck, lint, test, build, Prisma validate/migrate status      |

## 5. Completion gate

Phase 3 ถือว่า implementation complete เมื่อทุก mandatory requirement ข้างต้นมี code และ
automated evidence, generated API client deterministic และ migration apply จากฐานข้อมูลว่างได้

ก่อนเปิด release branch ต้องทำ authenticated browser acceptance อย่างน้อย: Project create/switch/
archive, Issue field/checklist persistence, incomplete-checklist Done warning, WIP warning,
search/filter/Focus, mobile Column selector, keyboard open/move, archive Undo และ export/import
replace round trip หลัง refresh

Production deployment และ merge release เข้า `main` เป็น external-production action ต้องทำหลัง
Product Owner อนุมัติ release handoff เท่านั้น

---
title: MVP Validation Matrix
version: 1.1
date_created: 2026-09-01
last_updated: 2026-09-01
owner: Product owner
tags: [mvp, acceptance, verification, release]
---

# MVP validation matrix

เอกสารนี้เชื่อม acceptance criteria ของ Personal Kanban/Scrum MVP กับหลักฐานล่าสุดบน
`feature/mvp-hardening` สถานะ `Automated pass` หมายถึง code path ผ่าน test ใน local workspace
แต่ไม่แทน Google-authenticated browser acceptance หรือ production smoke

## 1. Acceptance criteria

| Criterion                         | Status                      | Evidence                                                 | Manual release check                                  |
| --------------------------------- | --------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| AC-001 first login bootstrap      | Automated pass              | Auth transaction + Project HTTP exact default workflow   | Login ด้วย account ใหม่/ฐานว่างและเห็น Board พร้อมใช้ |
| AC-002 Backlog title quick-add    | Automated pass              | Sprint Backlog Playwright + create API                   | กด Enter, refresh และตรวจ Task ยังอยู่                |
| AC-003 move/status/rank once      | Automated pass              | Board persistence + cache/Playwright exactly-one request | Drag, refresh และตรวจลำดับ                            |
| AC-004 WIP warning                | Automated pass              | Board integration + toolbar/component tests              | ตั้ง WIP=2 แล้วย้าย Task ที่สาม                       |
| AC-005 start Sprint               | Automated pass              | Sprint HTTP/persistence suites                           | สร้าง/เลือก Task และ start                            |
| AC-006 one active Sprint          | Automated pass              | Sprint domain/HTTP conflict tests                        | ลอง start Sprint ที่สอง                               |
| AC-007 complete/velocity          | Automated pass              | Sprint persistence suite                                 | Complete ทั้ง backlog/next-Sprint destination         |
| AC-008 Focus union                | Automated pass              | Board filter predicate tests                             | ตรวจ in-progress, blocked และ due-soon                |
| AC-009 keyboard Board             | Automated pass              | Playwright Enter + explicit move controls                | ทำ workflow โดยไม่ใช้ mouse                           |
| AC-010 export/replace round-trip  | Automated pass              | PostgreSQL workspace-transfer integration                | Download, replace import, refresh                     |
| AC-011 invalid import rollback    | Automated pass              | Schema/controller/integration rollback tests             | Upload JSON ที่แก้ schemaVersion                      |
| AC-012 incomplete checklist Done  | Automated pass              | Board persistence + Web confirmation path                | ทดสอบ Cancel และ Confirm                              |
| AC-013 archive Undo               | Automated pass              | Restore integration + Web action                         | Archive แล้ว Undo ภายใน 5 วินาที                      |
| AC-014 2,000 Task filter          | Automated pass              | Predicate performance test under 150 ms                  | ไม่บังคับ manual                                      |
| AC-015 unauthenticated protection | Automated + production pass | Global guard and same-origin production 401              | เปิด protected URL ใน incognito                       |
| AC-016 new-device durability      | Integration pass            | PostgreSQL-backed Board/Project/Sprint tests             | Login browser profile ใหม่และเทียบข้อมูล              |
| AC-017 expired session            | Automated pass              | Central 401 redirect tests; no mutation retry            | Expire cookie แล้วกด protected action                 |
| AC-018 disallowed Google email    | Automated pass              | Auth allowlist/verified-email unit tests                 | ใช้ non-allowlisted account ถ้ามี test account        |

## 2. Non-functional gates

| Gate              | Result                       | Evidence                                                                           |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| Formatting        | Passed                       | `corepack pnpm format:check`                                                       |
| Types             | Passed                       | `corepack pnpm typecheck`                                                          |
| Lint              | Passed                       | `corepack pnpm lint`                                                               |
| Unit/integration  | Passed                       | API 96, Web 75, CLI 4 tests                                                        |
| Browser E2E       | Passed                       | Playwright 9/9                                                                     |
| Build             | Passed                       | Web, API, CLI, generated client                                                    |
| Prisma            | Passed                       | schema valid; 7 migrations; none pending                                           |
| Generated client  | Passed                       | two generations produced SHA-1 `000d1a913cdd299fab341bc81141a3c93ec6321c`          |
| Accessibility     | Passed automated gate        | axe serious/critical = 0; keyboard path; 44 px mobile targets                      |
| Performance       | Passed deterministic harness | usable Board under 2.5 s; optimistic move under 100 ms; 2,000 filters under 150 ms |
| Recovery/security | Passed                       | read-only import preview, atomic import, secret exclusion, audit retention, Undo   |

Coverage threshold บังคับกับ 8 authored Phase 3 state/domain modules ที่ประกาศใน CI:
80.01% statements/lines, 79.60% branches และ 84.72% functions โดยไม่รวม generated code และ
unused Minimal starter surface ตาม PRD v1.7

## 3. Authenticated local browser checklist

ใช้ `http://localhost:8083` และ Google account ใน `ALLOWED_GOOGLE_EMAILS`

1. สร้าง Project ใหม่ สลับกลับไปมา refresh แล้วตรวจ Project ล่าสุดยัง active
2. แก้สี/mode/Done retention และ archive Project ที่ไม่ใช่ Project สุดท้าย
3. Quick-add Task จาก Board และ Scrum Backlog แล้ว refresh
4. แก้ Task ทุก field/checklist, duplicate, archive, Undo และ restore จาก Data & recovery
5. ทดสอบ Done confirmation, drag/keyboard move, move Undo, WIP warning และ Column archive
6. ทดสอบ search + type/priority/label/due/blocked/Sprint filters, Focus และ Clear all
7. ทดสอบ Sprint create, bulk-add, reorder, start, complete ทั้งสอง destination และ history
8. ทดสอบ mobile viewport ให้เห็นทีละ Column และสลับ Column ได้
9. Export JSON, import merge, import replace แล้ว refresh ตรวจข้อมูล
10. ตรวจ permanent delete confirmation จากนั้น Undo ก่อนครบ 5 วินาที และยืนยันว่า Project
    ที่มี MCP audit อายุไม่ครบ 90 วันถูกปฏิเสธการลบ

เมื่อ checklist นี้ผ่านจึง merge feature เข้า `develop` และเปิด release branch ได้ Production
deploy/merge `main` ต้องได้รับ Product Owner authorization แยกต่างหาก

---
title: Production Closeout Record
version: 1.4
date_created: 2026-08-31
last_updated: 2026-09-01
owner: Product owner
tags: [production, railway, mcp, recovery, phase-2-gate]
---

# Introduction

เอกสารนี้เป็น gate ก่อนเริ่ม Phase 2: Scrum MVP โดยแยกหลักฐานที่ตรวจอัตโนมัติแล้ว
ออกจากงานที่ต้องใช้ Owner credential, browser session หรือยอมรับ downtime อย่างชัดเจน
ห้ามประกาศ production closeout เสร็จจนกว่ารายการ Required action จะผ่านครบหรือ
Product Owner บันทึกการเลื่อนรายการนั้นอย่างชัดเจน

## 1. Verified production evidence

Automated checks รันกับ production เมื่อ August 31 และ September 1, 2026 และได้ผลดังนี้

| Check              | Evidence                                                       | Result  |
| ------------------ | -------------------------------------------------------------- | ------- |
| Service health     | Web, API และ Postgres มี replica `1/1`                         | Passed  |
| Public HTTPS       | `GET https://kanban.koonporza.com/`                            | `200`   |
| Web liveness       | `GET /health/live`                                             | `200`   |
| Auth boundary      | `GET /api/v1/me` และ `/projects` ไม่มี session                 | `401`   |
| OAuth redirect     | Google callback ใช้ production HTTPS URL                       | Passed  |
| Cookie baseline    | Session cookie เป็น HttpOnly, Secure, SameSite=Lax             | Passed  |
| MCP auth boundary  | Missing และ invalid bearer token ที่ `POST /mcp`               | `401`   |
| Network exposure   | API/Postgres ไม่มี domain หรือ TCP proxy                       | Passed  |
| Custom domain      | Railway verified และ certificate valid                         | Passed  |
| Request logging    | JSON มี request ID, method, path, status, duration             | Passed  |
| Secret log scan    | ไม่พบ synthetic token, Authorization หรือ MCP session header   | Passed  |
| Config drift       | API มี live `PORT`; IaC fix เป็น `3001`                        | Passed  |
| Region placement   | Web, API และ Postgres อยู่ Singapore                           | Passed  |
| Post-region deploy | Postgres, API และ Web deployment ใหม่                          | Success |
| Prisma migration   | API pre-deploy พบ 3 migrations และไม่มีรายการค้าง              | Passed  |
| Public bypass      | Railway-generated Web domain ถูกลบและตอบ `404`                 | Passed  |
| Cloudflare TLS     | Owner ยืนยัน mode `Full`; HTTPS ตอบ `200` โดยไม่ redirect loop | Passed  |

## 2. Authenticated acceptance

รายการนี้ต้องใช้ Google session และ Project token ของ Owner จึงไม่ bypass ด้วย
session forging หรือการอ่านข้อความลับจาก Railway

### 2.1 Required Board acceptance

Board persistence ยังเป็น gate ก่อนเริ่ม Phase 2 และต้องตรวจด้วย Google session ของ
Product Owner

- [ ] สร้าง Task, แก้ไข, drag ข้าม Column, archive, reload และยืนยันข้อมูลคงอยู่

### 2.2 Deferred MCP acceptance

Product Owner เลื่อน production MCP acceptance เมื่อ August 31, 2026 รายการเหล่านี้
ยังไม่ผ่านและต้องเปิดกลับมาทดสอบก่อนประกาศว่า MCP production-ready แต่ไม่ block การ
เริ่ม Phase 2 ตามการตัดสินใจนี้

- [ ] สร้าง production MCP token จากหน้า `/dashboard/mcp-access`
- [ ] เพิ่ม token เข้า helper CLI และเรียก `get_context` ผ่าน public `/mcp`
- [ ] MCP create/read/update/move/archive/restore Task สำเร็จใน Project เดียว
- [ ] Board แสดง MCP mutation ภายใน 15 วินาทีโดยไม่ reload
- [ ] Revoke token แล้ว MCP request ถัดไปตอบ `401`
- [ ] Token ของ Project หนึ่งอ่านหรือแก้ Task ของ Project อื่นไม่ได้

## 3. Backup decision

Railway plan ปัจจุบันแสดงว่า Backups และ PITR ใช้ได้เฉพาะ Pro plan Product Owner
ยืนยันให้ข้าม backup ก่อน Phase 2 เพราะระบบยังไม่มีข้อมูลใช้งานที่ต้องเก็บ และยอมรับ
ความเสี่ยงของ region migration เมื่อ August 31, 2026

- [x] ตรวจ Railway Backups tab และยืนยันว่า plan ปัจจุบันไม่รองรับ backup/PITR
- [x] Product Owner ยอมรับการข้าม backup และความเสี่ยงต่อข้อมูลเริ่มต้น
- [x] Post-region migration ตรวจพบ Prisma migrations ครบและไม่มีรายการค้าง
- [ ] ก่อนมีข้อมูลสำคัญ ให้ upgrade plan หรือเพิ่ม logical export/restore rehearsal ใน
      Phase 3

รายการสุดท้ายเป็น Phase 3 hardening และไม่ block การเริ่ม Phase 2 ตาม Owner waiver นี้

## 4. Region drift gate

Postgres ถูกย้ายจาก `sfo` ไป `asia-southeast1-eqsg3a` หลัง Product Owner ยืนยัน
destructive impact และยอมรับ downtime การตรวจหลังย้ายได้ผลดังนี้

- [x] Product Owner ยอมรับการข้าม backup และข้อมูลเริ่มต้นอาจสูญหาย
- [x] Apply Railway IaC destructive plan หลังตรวจ plan ตรงตาม intent
- [x] Postgres, API และ Web deployment ใหม่เป็น `SUCCESS` ทั้งหมด
- [x] Postgres live config อยู่ Singapore และยัง mount volume เดิม
- [x] API pre-deploy migration และ Railway readiness ผ่าน
- [x] HTTPS, OAuth redirect, MCP auth boundary และ unauthenticated API smoke ผ่าน
- [ ] ยืนยัน authenticated Board ตาม Section 2.1
- [x] บันทึก MCP production acceptance เป็น deferred ตาม Section 2.2

## 5. Final surface hardening

หลัง Board และ recovery checks ผ่านแล้วจึงลด bypass surface และปิด record

- [x] ยืนยัน Cloudflare SSL/TLS mode เป็น `Full` ตาม Railway guidance และไม่มี
      redirect loop ห้ามใช้ `Flexible` หรือ `Full (Strict)`
- [x] ลบ Railway-generated Web domain
      `web-production-4f560e.up.railway.app` หลัง Owner ยืนยัน exact domain
- [x] ยืนยัน Web เหลือเฉพาะ custom domain `kanban.koonporza.com` และตอบ `200`
- [x] รัน network exposure และ secret log scan ซ้ำ
- [x] Merge `hotfix/0.1.4` เข้า `main` และ `develop`, tag และ push ตาม Gitflow
- [x] ยืนยัน GitHub CI ของ `hotfix/0.1.4` เป็น success
- [x] ยืนยัน Railway deployment ล่าสุดทั้งสาม service เป็น success

## 6. Stop condition

Phase 2 เริ่มได้เมื่อ Board acceptance ใน Section 2.1 และ Section 3 ถึง 5 ผ่านครบ ไม่มี
unresolved production data risk และ Implementation Status ระบุ evidence ล่าสุดตรงกับ
live Railway state MCP acceptance ใน Section 2.2 ยังคงเป็น deferred follow-up และห้าม
รายงานว่า production-ready จนกว่าจะผ่านครบ

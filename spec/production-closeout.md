---
title: Production Closeout Record
version: 1.0
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [production, railway, mcp, recovery, phase-2-gate]
---

# Introduction

เอกสารนี้เป็น gate ก่อนเริ่ม Phase 2: Scrum MVP โดยแยกหลักฐานที่ตรวจอัตโนมัติแล้ว
ออกจากงานที่ต้องใช้ Owner credential, browser session หรือยอมรับ downtime อย่างชัดเจน
ห้ามประกาศ production closeout เสร็จจนกว่ารายการ Required action จะผ่านครบ

## 1. Verified production evidence

Automated checks รันกับ production เมื่อ August 31, 2026 และได้ผลดังนี้

| Check             | Evidence                                                     | Result  |
| ----------------- | ------------------------------------------------------------ | ------- |
| Service health    | Web, API และ Postgres มี replica `1/1`                       | Passed  |
| Public HTTPS      | `GET https://kanban.koonporza.com/`                          | `200`   |
| Web liveness      | `GET /health/live`                                           | `200`   |
| Auth boundary     | `GET /api/v1/me` และ `/projects` ไม่มี session               | `401`   |
| OAuth redirect    | Google callback ใช้ production HTTPS URL                     | Passed  |
| Cookie baseline   | Session cookie เป็น HttpOnly, Secure, SameSite=Lax           | Passed  |
| MCP auth boundary | Missing และ invalid bearer token ที่ `POST /mcp`             | `401`   |
| Network exposure  | API/Postgres ไม่มี domain หรือ TCP proxy                     | Passed  |
| Custom domain     | Railway verified และ certificate valid                       | Passed  |
| Request logging   | JSON มี request ID, method, path, status, duration           | Passed  |
| Secret log scan   | ไม่พบ synthetic token, Authorization หรือ MCP session header | Passed  |
| Config drift      | API มี live `PORT`; IaC fix เป็น `3001`                      | Patched |

## 2. Required authenticated acceptance

รายการนี้ต้องใช้ Google session และ Project token ของ Owner จึงไม่ควร bypass ด้วย
session forging หรือการอ่านข้อความลับจาก Railway

- [ ] สร้าง Task, แก้ไข, drag ข้าม Column, archive, reload และยืนยันข้อมูลคงอยู่
- [ ] สร้าง production MCP token จากหน้า `/dashboard/mcp-access`
- [ ] เพิ่ม token เข้า helper CLI และเรียก `get_context` ผ่าน public `/mcp`
- [ ] MCP create/read/update/move/archive/restore Task สำเร็จใน Project เดียว
- [ ] Board แสดง MCP mutation ภายใน 15 วินาทีโดยไม่ reload
- [ ] Revoke token แล้ว MCP request ถัดไปตอบ `401`
- [ ] Token ของ Project หนึ่งอ่านหรือแก้ Task ของ Project อื่นไม่ได้

## 3. Backup and restore gate

Railway volume backup เป็น recovery layer ก่อนย้าย region หรือเริ่ม Phase 2 ข้อมูล
production ต้องไม่ถูก overwrite ระหว่าง rehearsal

- [ ] `railway postgres pitr schedule list` แสดง Daily, Weekly และ Monthly
- [ ] มี manual recovery point ชื่อหรือ record ว่า `pre-phase-2-closeout`
- [ ] Restore production snapshot หรือ logical dump เข้า isolated local/test database
- [ ] ตรวจ migration version และ row counts ของ Owner, Project, Column, Issue และ MCP
      metadata โดย raw MCP token ต้องไม่อยู่ในข้อมูล
- [ ] บันทึก recovery point, ระยะเวลา restore และ verification result ในเอกสารนี้

Railway OAuth ปัจจุบันอ่าน schedule ได้แต่แก้ไม่ได้และค่าที่อ่านยังเป็น empty array
ดังนั้นผลจาก staged operator call ยังไม่ถือเป็นหลักฐานว่า schedule เปิดจริง

## 4. Region drift gate

Live Postgres อยู่ `sfo` แต่ Web/API และ IaC desired state อยู่ Singapore การเปลี่ยน
region ของ service ที่มี volume เป็น destructive-risk operation และมี downtime

- [ ] Backup และ isolated restore rehearsal ผ่านก่อน
- [ ] กำหนด downtime window ประมาณ 5–15 นาที
- [ ] ย้าย Postgres/volume ไป Singapore ด้วย Railway-supported migration flow
- [ ] ตรวจ readiness, migration version, row counts, login, Board และ MCP หลังย้าย
- [ ] ยืนยัน Board request latency กลับสู่ค่าปกติ

## 5. Final surface hardening

หลัง authenticated และ recovery checks ผ่านแล้วจึงลด bypass surface และปิด record

- [ ] ยืนยัน Cloudflare SSL/TLS mode เป็น Full หรือ Full (Strict) และไม่มี redirect loop
- [ ] ลบ Railway-generated Web domain เมื่อ Owner ยืนยัน exact domain
- [ ] รัน network exposure และ secret log scan ซ้ำ
- [ ] Merge `hotfix/0.1.2` เข้า `main` และ `develop`, tag และ push ตาม Gitflow
- [ ] ยืนยัน GitHub CI และ Railway deployment ล่าสุดเป็น success

## 6. Stop condition

Phase 2 เริ่มได้เมื่อ Section 2 ถึง 5 ผ่านครบ ไม่มี unresolved production data risk และ
Implementation Status ระบุ evidence ล่าสุดตรงกับ live Railway state

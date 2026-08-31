---
title: Scrum MVP UX Specification
version: 1.1
date_created: 2026-09-01
last_updated: 2026-09-01
owner: Product owner
tags: [design, ux, scrum, sprint, phase-2]
---

# Introduction

เอกสารนี้กำหนดประสบการณ์ผู้ใช้สำหรับ Scrum MVP ใน Phase 2 ตั้งแต่การเปลี่ยน
Project เป็น Scrum mode การวางแผนและเริ่ม Sprint การทำงานบน Scrum Board ไปจนถึง
การ complete Sprint และดู velocity โดยใช้ visual language ของ Minimal TypeScript
และ MUI ที่มีอยู่ในระบบ

## 1. Purpose and scope

สเปกนี้แปลง `REQ-003`, `REQ-040` ถึง `REQ-048` และ `AC-005` ถึง `AC-007`
เป็น flow, component state และพฤติกรรมที่นำไป implement และทดสอบได้ ขอบเขตนี้
ไม่เปลี่ยน Kanban Board, Project ownership หรือ Board column configuration เดิม

### 1.1 Fixed product decisions

การ implement ต้องใช้การตัดสินใจต่อไปนี้เป็นข้อกำหนดคงที่

- Story Point ที่เป็น `null` ต้องนับเป็น `0` ใน planned, completed, incomplete และ
  velocity metrics
- Issue ที่ไม่เสร็จต้องย้ายไป Backlog หรือ Planned Sprint อื่นเมื่อ complete Sprint
- ระบบต้องบล็อกการเปลี่ยน Project จาก `scrum` เป็น `kanban` ขณะที่มี Active Sprint
- Scrum Board ต้องแสดงเฉพาะ Issue ใน Active Sprint โดยค่าเริ่มต้น
- เมื่อไม่มี Active Sprint, Scrum Board ต้องแสดง planning call to action (CTA)
  และห้ามแสดง Issue จาก Backlog ทั้งหมดแทน Board
- UI ต้อง reuse Minimal/MUI component, spacing, typography, color token, dialog,
  snackbar และ loading pattern ที่มีอยู่

## 2. Information architecture

Scrum mode ต้องเพิ่ม planning context โดยไม่ทำให้ผู้ใช้หลุดจาก Project ปัจจุบัน
หน้า Project ใช้ navigation ระดับเดียวกันสำหรับมุมมองต่อไปนี้

- **Board**: แสดง Active Sprint เท่านั้น หรือ planning CTA เมื่อไม่มี Active Sprint
- **Sprints workspace**: รวม workflow mode control, Backlog, Planned/Active Sprint และ
  Sprint history ในหน้าเดียวเพื่อให้ single-user MVP วางแผนและ review โดยไม่สลับหลาย route

Header ของ Scrum Project ต้องแสดงชื่อ Project, badge **Scrum**, ชื่อ Sprint ที่ active
เมื่อมี และช่วงวันที่ Sprint โดยไม่ใช้สีเป็นตัวสื่อสถานะเพียงอย่างเดียว

## 3. Core user flows

Flow ต่อไปนี้ครอบคลุม planning, execution และ review ของ Scrum MVP

### 3.1 Change Project mode

ผู้ใช้เปลี่ยน workflow mode จาก **Project settings** โดยระบบต้องป้องกัน state ที่
ทำให้ Active Sprint สูญเสียบริบท

1. เปิด **Sprints workspace** และกด **Enable Scrum**
2. ระบบบันทึก workflow mode ด้วย optimistic version
3. แสดง snackbar **Project changed to Scrum** และเปิด **Board**
4. เมื่อยังไม่มี Active Sprint แสดง planning CTA ตามหัวข้อ 4.2

เมื่อผู้ใช้กด **Switch to Kanban** ขณะที่มี Active Sprint ระบบต้องปิดการกด action และแสดงข้อความ
**Complete the active Sprint before switching to Kanban.** ใกล้ field ระบบต้อง
ตรวจเงื่อนไขนี้ซ้ำฝั่ง server และแสดง error เดิมหาก state เปลี่ยนระหว่าง request

### 3.2 Create and plan a Sprint

หน้า **Backlog** ต้องให้ผู้ใช้สร้าง Planned Sprint และเห็น capacity ก่อนเริ่มงาน

1. กด **Create Sprint**
2. กรอก **Sprint name**, **Goal**, **Start date** และ **End date**
3. กด **Create Sprint** เพื่อสร้าง Sprint สถานะ `planned`
4. เลือก Issue จาก Backlog แล้วกด **Add to Sprint** หรือ drag Issue เข้า Sprint
5. ตรวจ summary ที่แสดง planned Issue count และ planned Story Point

Form ต้อง require name, start date และ end date ส่วน goal ใช้ค่า empty string ได้
End date ต้องไม่อยู่ก่อน start date ระบบต้องแสดง inline validation ก่อน submit
และคงค่าที่ผู้ใช้กรอกไว้เมื่อ API ปฏิเสธ request

Planned Sprint card ต้องแสดง name, goal, date range, Issue count และ planned Story
Point ค่า Story Point ที่ไม่มีค่าต้องรวมเป็น `0` โดยไม่เปลี่ยนค่าจริงของ Issue

### 3.3 Start a Sprint

ผู้ใช้เริ่ม Sprint จาก Planned Sprint card หรือ Sprint planning panel ได้เมื่อ Sprint
มี Issue อย่างน้อยหนึ่งรายการและ Project ไม่มี Active Sprint

1. กด **Start Sprint**
2. ตรวจ planned Issue count และ planned Story Point ใน confirmation dialog
3. กด **Start Sprint** ใน dialog เพื่อยืนยัน
4. แสดง snackbar **Sprint started** และนำผู้ใช้ไป **Board**

ปุ่ม **Start Sprint** ต้อง disabled พร้อม helper text เมื่อ Sprint ว่าง หากมี Active
Sprint อยู่แล้ว ระบบต้อง disabled ปุ่มของ Planned Sprint อื่นและแสดง
**Complete the active Sprint before starting another Sprint.**

เมื่อ start สำเร็จ ระบบต้อง snapshot planned Issue count และ planned Story Point
พร้อมเปลี่ยนสถานะเป็น `active` การตอบ `409` ต้องไม่เปลี่ยน UI เป็น active และต้อง
refetch Sprint state ก่อนแสดงข้อความ conflict

### 3.4 Use the Active Sprint Board

Scrum Board reuse Board column, task card, detail dialog, drag-and-drop และ keyboard
interaction เดิม แต่ query เริ่มต้นต้อง scope ด้วย Active Sprint

- แสดง Sprint name, goal, date range, Issue count และ planned Story Point ใน header
- แสดงเฉพาะ non-archived Issue ที่มี `sprintId` ตรงกับ Active Sprint
- ให้ผู้ใช้เพิ่ม Issue จาก Backlog ผ่าน **Add from backlog**
- ให้ผู้ใช้นำ Issue ออกจาก Sprint ผ่าน **Move to backlog** ใน Issue detail
- ให้ผู้ใช้แก้ Story Point 0–100 หรือเว้นว่างเป็น `null` จาก Issue detail
- **Clear Column** ต้องกระทบเฉพาะ Issue ใน Active Sprint และ **Delete Column** ต้อง disabled
  ใน Scrum mode เพื่อรักษา Issue ของ Backlog หรือ Sprint อื่นที่ซ่อนอยู่
- คง optimistic move, WIP warning, refetch ทุก 15 วินาที และ refetch เมื่อ focus
- ใช้ empty column state เดิมเมื่อ Active Sprint มี Issue แต่บาง Column ว่าง

การเพิ่มหรือนำ Issue ออกจาก Active Sprint ต้องอัปเดต count และ point summary หลัง
server ยืนยัน ค่า planning snapshot ที่บันทึกตอน start ต้องไม่เปลี่ยนตามการแก้ไข
ระหว่าง Sprint

### 3.5 Complete a Sprint

ผู้ใช้ complete Active Sprint จาก Sprint header โดยต้องเลือกปลายทางของ Issue ที่ยัง
ไม่อยู่ใน Done category

1. กด **Complete Sprint**
2. ตรวจ completed และ incomplete summary ใน confirmation dialog
3. เลือก **Move to backlog** หรือ **Move to another Sprint**
4. เมื่อเลือก Sprint ให้เลือกได้เฉพาะ Planned Sprint อื่นใน Project เดียวกัน
5. กด **Complete Sprint** เพื่อยืนยัน
6. แสดง snackbar **Sprint completed** และเปิด **Sprint history**

Dialog ต้องแสดง completed Story Point, incomplete Story Point, completed Issue count
และ incomplete Issue count โดย Story Point ที่เป็น `null` นับเป็น `0` หากไม่มี
incomplete Issue ระบบต้องซ่อน destination field และ complete ได้ทันที

ระบบต้องปฏิเสธ Active Sprint ปัจจุบัน, Completed Sprint และ Sprint จาก Project อื่น
เป็น destination การ complete ต้องเป็น transaction เดียว การล้มเหลวต้องคง Sprint
เป็น active และคง Issue ทุกใบไว้ที่เดิม

### 3.6 Review Sprint history

หน้า **Sprint history** ต้องช่วยให้ผู้ใช้เห็นผลลัพธ์แต่ละรอบโดยไม่ต้องคำนวณเอง

- เรียง Completed Sprint จาก completion date ล่าสุดไปเก่าสุด
- แสดง name, goal, date range, completion date และ status **Completed**
- แสดง velocity จาก completed Story Point
- แสดง planned, completed และ incomplete Issue count กับ Story Point
- แสดง `0` เมื่อ Issue ไม่มี Story Point หรือ Sprint ไม่มี completed points

## 4. Component states

ทุกหน้าต้องใช้ state pattern เดียวกับส่วน Kanban และ MCP access ที่มีอยู่ เพื่อให้
loading, empty, success และ failure มีพฤติกรรมสม่ำเสมอ

### 4.1 Backlog and planning states

หน้า Backlog ต้องแยก Issue ที่ยังไม่เข้า Sprint ออกจาก Planned Sprint อย่างชัดเจน

- **Loading**: แสดง skeleton สำหรับ Sprint card และ Issue row โดยรักษาขนาด layout
- **Backlog empty**: แสดง **No backlog issues** พร้อม **Create issue**
- **No Planned Sprint**: แสดง **No planned Sprint** พร้อม **Create Sprint**
- **Planned Sprint empty**: แสดง drop zone และข้อความ
  **Add at least one issue before starting this Sprint.**
- **Active Sprint exists**: แสดง Active Sprint summary และปิด start action ของ Sprint
  อื่น
- **Error**: แสดง inline retry state โดยไม่ซ่อนข้อมูลจาก response ล่าสุดที่สำเร็จ

### 4.2 Board states

หน้า Board ต้องไม่ใช้ Backlog เป็น fallback เพราะจะทำให้ผู้ใช้เข้าใจผิดว่า Issue
เหล่านั้นอยู่ใน Sprint

- **No Active Sprint**: แสดง `EmptyContent` พร้อม title **No active Sprint**,
  description **Plan a Sprint and add at least one issue to start.** และ primary CTA
  **Plan Sprint** ที่เปิดหน้า Backlog
- **Active Sprint loading**: แสดง Board skeleton และห้ามแสดงข้อมูล Kanban เดิม
- **Active Sprint empty after load**: แสดง warning state พร้อม **Add from backlog**
- **Active Sprint loaded**: แสดง Board columns และ Issue ของ Sprint เท่านั้น
- **Load error**: แสดง error state พร้อม **Retry** และรักษา navigation ของ Project

### 4.3 Dialog and action states

Dialog ต้องป้องกัน duplicate mutation และบอกผลลัพธ์ในตำแหน่งที่ผู้ใช้หาเจอ

- Disable primary action และแสดง progress ขณะ request ทำงาน
- Disable close ผ่าน backdrop และ Escape เฉพาะช่วง mutation ที่ commit อยู่
- แสดง field error ใต้ input ที่เกี่ยวข้อง
- แสดง form-level error เหนือ actions เมื่อ error ไม่ผูกกับ field
- ปิด dialog หลัง server ยืนยัน success เท่านั้น
- คืน focus ไปยัง control ที่เปิด dialog เมื่อปิดหรือยกเลิก

## 5. Accessibility and responsive behavior

Scrum UI ต้องใช้งานได้ด้วย keyboard, screen reader และ viewport ที่รองรับในระบบเดิม
โดยไม่ลดความสามารถของ Kanban Board

- ใช้ heading hierarchy ที่สื่อความสัมพันธ์ระหว่าง Backlog, Sprint และ Issue
- ให้ button และ icon button มี accessible name ที่ตรงกับ visible action
- ให้ date field มี label ถาวร และประกาศ validation ผ่าน `aria-describedby`
- ให้ Sprint status ใช้ text หรือ icon ร่วมกับสี และรักษา contrast ตาม MUI theme
- ให้ dialog มี title, description และ initial focus ที่เหมาะสม
- ประกาศ success และ non-blocking error ผ่าน snackbar live region
- ย้าย Issue ด้วย keyboard ได้ทั้งระหว่าง Column และระหว่าง Backlog กับ Sprint
- เมื่อ drag สำเร็จ ให้ประกาศชื่อ Issue และ destination ผ่าน live region
- บน viewport แคบ ให้ Sprint summary wrap เป็นแนวตั้งและรักษา action หลักไว้ก่อน
  secondary action
- รักษา touch target อย่างน้อย 44 x 44 CSS pixels สำหรับ action ที่แตะบ่อย

## 6. Errors and optimistic conflict handling

PostgreSQL และ API เป็น source of truth การเปลี่ยน state ฝั่ง UI ต้อง rollback หรือ
refetch เมื่อ server ไม่ยอมรับ mutation

- **Validation error (`400`)**: คง form input และแสดง field หรือ form-level message
- **Unauthenticated (`401`)**: ใช้ session-expired flow เดิมและห้าม retry mutation
- **Forbidden (`403`)**: แสดงข้อความทั่วไปและไม่เปิดเผยข้อมูล Project อื่น
- **Not found (`404`)**: ปิด stale detail view, refetch collection และแจ้งว่า entity
  ไม่มีอยู่แล้ว
- **Version conflict (`409`)**: rollback optimistic state, refetch Sprint และ Issue,
  แล้วแสดง **This Sprint changed elsewhere. Review the latest data and try again.**
- **Active Sprint conflict (`409`)**: refetch Project Sprints และนำผู้ใช้ไป Active
  Sprint ที่ server คืนเป็น state ล่าสุด
- **Network or server error**: rollback optimistic change, รักษา dialog หรือ current
  page context และแสดง **Could not save changes. Try again.**

Create, start และ complete Sprint ต้องไม่แสดง success ก่อน server ตอบ การเพิ่มหรือ
นำ Issue ออกจาก Sprint ทำ optimistic update ได้เมื่อเก็บ previous state สำหรับ rollback
และ block duplicate submit ด้วย mutation key เดียวกัน

## 7. Acceptance mapping

การตรวจรับต้องเชื่อม interaction ในเอกสารนี้กลับไปยัง PRD โดยตรง

- **REQ-003**: Flow 3.1 รองรับ `kanban` และ `scrum` พร้อมบล็อกการเปลี่ยน mode เมื่อมี
  Active Sprint
- **REQ-040**: Flow 3.2 เก็บ name, goal, start date และ end date ของ Sprint
- **REQ-041**: Flow 3.3 ป้องกัน Project มี Active Sprint มากกว่าหนึ่งรายการ
- **REQ-042**: Flow 3.3 เปิด start action เมื่อ Sprint มี Issue อย่างน้อยหนึ่งรายการ
- **REQ-043**: Flow 3.2 และ 3.3 แสดง planned Issue count และ Story Point ก่อน start
- **REQ-044**: Flow 3.4 รองรับ **Add from backlog** และ **Move to backlog**
- **REQ-045**: Flow 3.5 บังคับเลือก Backlog หรือ Planned Sprint อื่นเป็น destination
- **REQ-046**: Flow 3.5 บันทึก completed, incomplete, Issue count และ completion date
- **REQ-047**: Flow 3.6 แสดง history และ velocity
- **REQ-048**: Flow 3.4 และ Board states บังคับ Active Sprint scope โดยไม่ fallback
  ไป Backlog
- **AC-005**: เริ่ม Planned Sprint ที่มี Issue แล้ว Board แสดงเฉพาะ Issue ของ Sprint
- **AC-006**: ปุ่มและ API ปฏิเสธการเริ่ม Sprint ที่สองจนกว่า Active Sprint จะ complete
- **AC-007**: Complete Sprint บันทึก velocity และย้าย Issue ที่ไม่เสร็จไป destination
  ที่เลือกใน transaction เดียว

## 8. Manual test checklist

ผู้ทดสอบต้องใช้ Project ที่มี Issue ทั้งแบบมีและไม่มี Story Point แล้วทำรายการต่อไปนี้
บน desktop browser เป้าหมาย

1. เปลี่ยน Project จาก Kanban เป็น Scrum และตรวจว่า Board แสดง **No active Sprint**
   กับ **Plan Sprint** แทน Backlog
2. สร้าง Sprint โดยเว้น field ที่บังคับและใช้ end date ก่อน start date แล้วตรวจ inline
   validation กับค่าที่กรอกไว้
3. สร้าง Planned Sprint ที่ถูกต้องและตรวจว่า Sprint card แสดง Issue count กับ planned
   Story Point โดยค่า `null` นับเป็น `0`
4. ตรวจว่า Sprint ว่างเริ่มไม่ได้ จากนั้นเพิ่ม Issue อย่างน้อยหนึ่งรายการและเริ่ม Sprint
5. ตรวจว่า Board แสดงเฉพาะ Issue ใน Active Sprint และคง state หลัง reload
6. เพิ่ม Issue จาก Backlog เข้า Active Sprint แล้วนำออกด้วย **Move to backlog**
7. สร้าง Planned Sprint ที่สองและตรวจว่าเริ่มไม่ได้ขณะที่ Sprint แรก active
8. กลับหน้า **Sprints workspace** และตรวจว่าเปลี่ยนเป็น Kanban ไม่ได้ขณะที่ Sprint active
9. ย้าย Issue บางรายการไป Done แล้วกด **Complete Sprint**
10. เลือก **Move to backlog**, complete และตรวจ velocity, metrics กับปลายทางของงานค้าง
11. ทำ Sprint อีกครั้ง เลือก **Move to another Sprint** และตรวจว่างานค้างไป Planned
    Sprint ที่เลือก
12. เปิด **Sprint history** และตรวจลำดับ, completion date, planned, completed,
    incomplete และ velocity
13. จำลอง version conflict แล้วตรวจว่า optimistic state rollback, ข้อมูล refetch และ
    snackbar แสดงข้อความ conflict
14. ทำ flow create, start, add, remove และ complete ด้วย keyboard พร้อมตรวจ focus order,
    dialog focus และ screen reader announcement
15. ตั้ง Story Point จาก task detail, reload และตรวจว่า point กับ Sprint metrics ยังคงอยู่
16. ใช้ Clear Column ใน Active Sprint และตรวจว่า Backlog/Sprint อื่นไม่ถูก archive จากนั้น
    ตรวจว่า Delete Column ถูก disabled พร้อมคำอธิบาย Kanban-only
17. ทดสอบ viewport แคบและตรวจว่า summary, action และ dialog ใช้งานได้โดยไม่เกิด
    horizontal overflow ที่บัง control

## 9. References

เอกสารนี้ใช้ข้อกำหนดและ boundary จากแหล่งต่อไปนี้

- [Personal Kanban and Scrum Board Product Requirements](./spec-design-personal-kanban-scrum-board.md)
- [Personal Kanban System Architecture](./spec-architecture-kanban-system.md)
- [Personal Kanban PostgreSQL Data Specification](./spec-data-kanban-postgresql.md)

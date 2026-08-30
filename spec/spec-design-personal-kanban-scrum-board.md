---
title: Personal Kanban and Scrum Board Product Requirements
version: 1.4
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [product, design, kanban, scrum, personal-productivity]
---

# Introduction

เอกสารนี้กำหนด Product Requirements Document (PRD) สำหรับเว็บแอปจัดการงาน
ส่วนตัวที่รวม Kanban และ Scrum ไว้ในผลิตภัณฑ์เดียว เป้าหมายคือให้ผู้ใช้รวบรวม
งานใน Backlog วางแผน Sprint ติดตามงานบน Board และทบทวนผลงานได้โดยไม่ต้องใช้
เครื่องมือที่ออกแบบมาสำหรับทีมขนาดใหญ่

ผลิตภัณฑ์รุ่นแรกเป็นแบบ single-user และ server-backed ผู้ใช้ต้อง login ด้วย Google
email ที่อยู่ใน allowlist ก่อนเข้าถึงข้อมูล โดย Next.js, NestJS API และ PostgreSQL
deploy บน Railway ข้อมูลต้อง sync ผ่าน PostgreSQL และมีระบบสำรองกับกู้คืนด้วยไฟล์ JSON

## 1. Purpose & scope

ข้อกำหนดนี้ครอบคลุมประสบการณ์ตั้งแต่การบันทึกงานจนถึงการปิด Sprint รวมถึง
โครงสร้างข้อมูล พฤติกรรมของ Board เกณฑ์การยอมรับ และแนวทางทดสอบ เอกสารนี้มีไว้
สำหรับ product owner, designer, developer, tester และ AI coding agent ที่จะนำไป
ออกแบบหรือพัฒนาระบบ

### 1.1 Product vision

ผลิตภัณฑ์ต้องเป็นพื้นที่ทำงานส่วนตัวที่ทำให้ผู้ใช้เห็นว่า “ต้องทำอะไรต่อ” ได้
ภายในไม่เกิน 10 วินาที และอัปเดตสถานะงานได้โดยไม่ขัดจังหวะการทำงานปัจจุบัน

### 1.2 Target user

ผู้ใช้หลักคือคนที่ดูแลงานของตนเองหลายประเภท เช่น งานประจำ โปรเจกต์ส่วนตัว
การเรียน หรือเป้าหมายระยะยาว และต้องการใช้ทั้ง flow ต่อเนื่องแบบ Kanban กับ
รอบเวลาทำงานแบบ Scrum โดยไม่ต้องมีระบบสมาชิกหรือสิทธิ์การเข้าถึงหลายระดับ

### 1.3 Goals

MVP ต้องทำให้วงจรจัดการงานส่วนตัวครบตั้งแต่รับงานจนเสร็จ โดยมีเป้าหมายดังนี้

- รวบรวมและจัดลำดับงานใน Backlog เดียวต่อ Project
- วางแผน Sprint พร้อมเป้าหมาย ช่วงเวลา และ Story Point
- เปลี่ยนสถานะงานด้วย drag and drop บน Board
- ควบคุมงานระหว่างทำด้วย Work in Progress (WIP) limit
- ค้นหา กรอง และมองเห็นงานเร่งด่วนหรืองานติดขัดได้ทันที
- สรุปผล Sprint และเก็บข้อมูล velocity สำหรับการวางแผนรอบถัดไป
- สำรองและกู้คืนข้อมูลทั้งหมดได้โดยไม่พึ่งบริการภายนอก
- เข้าถึงข้อมูลชุดเดียวกันอย่างปลอดภัยผ่าน `kanban.koonporza.com`

### 1.4 Non-goals for MVP

ความสามารถต่อไปนี้อยู่นอกขอบเขต MVP เพื่อรักษาความเรียบง่ายและลดระยะเวลา
พัฒนา

- การทำงานร่วมกันแบบหลายผู้ใช้ การ mention และ activity feed
- การเชื่อมต่อ Jira, GitHub, Slack, Google Calendar หรือบริการภายนอก
- การแจ้งเตือนผ่านอีเมล โทรศัพท์ หรือ push notification
- ระบบชำระเงิน subscription และสิทธิ์ตามแผนราคา
- Gantt chart, resource planning และ portfolio management
- AI สร้างงาน แบ่งงาน หรือจัดลำดับความสำคัญอัตโนมัติ
- Native mobile application และ offline-first mode

### 1.5 Success metrics

หลังเปิดใช้ MVP เป็นเวลา 30 วัน ผลิตภัณฑ์ถือว่าตอบโจทย์เมื่อผ่านเกณฑ์ต่อไปนี้

- ผู้ใช้สามารถสร้างงานแรกและเห็นงานบน Board ภายใน 2 นาที
- การสร้างหรือย้ายงานทั่วไปใช้ interaction ไม่เกิน 3 ครั้ง
- อย่างน้อย 80% ของงานที่ปิดเสร็จมีสถานะผ่าน Board ตามลำดับที่กำหนด
- ผู้ใช้ปิด Sprint พร้อม review ได้อย่างน้อย 3 Sprint ติดต่อกัน
- ไม่มีการสูญหายของข้อมูลหลัง refresh หรือปิดและเปิด browser ใหม่
- ผู้ใช้ที่ login ต้องเห็นข้อมูลล่าสุดเมื่อเปิดจากอุปกรณ์อื่น
- Export แล้ว Import กลับต้องคืนข้อมูลที่ผู้ใช้สร้างได้ครบ 100%

## 2. Definitions

คำต่อไปนี้มีความหมายคงที่ตลอดเอกสาร เพื่อป้องกันความคลาดเคลื่อนระหว่างการ
ออกแบบและพัฒนา

- **Workspace**: พื้นที่เก็บข้อมูลระดับสูงสุดของผู้ใช้หนึ่งคน
- **Project**: กลุ่มงานที่มี Backlog, Sprint และ Board ของตนเอง
- **Backlog**: รายการงานที่ยังไม่ถูกนำเข้าสู่ Active Sprint
- **Sprint**: รอบเวลาทำงานที่มีวันเริ่ม วันสิ้นสุด และ Sprint Goal
- **Active Sprint**: Sprint ที่กำลังดำเนินการ โดยหนึ่ง Project มีได้หนึ่งรายการ
- **Issue**: หน่วยงานบนระบบ เช่น Task, Story, Bug หรือ Chore
- **Board**: มุมมอง Issue ตามสถานะใน Active Sprint หรือ Kanban flow
- **Column**: สถานะของ Issue บน Board
- **WIP limit**: จำนวน Issue สูงสุดที่อนุญาตใน Column หนึ่ง
- **Story Point**: คะแนนเชิงสัมพัทธ์สำหรับประมาณขนาดหรือความซับซ้อนของงาน
- **Velocity**: ผลรวม Story Point ของ Issue ที่อยู่ในสถานะ Done เมื่อปิด Sprint
- **Blocked**: สถานะกำกับว่า Issue ไม่สามารถเดินหน้าต่อได้ พร้อมเหตุผล
- **Rank**: ลำดับของ Issue ภายใน Backlog หรือ Column
- **Server-backed**: รูปแบบที่ PostgreSQL ฝั่ง server เป็น source of truth
- **Owner**: ผู้ใช้คนเดียวที่มีสิทธิ์เข้าถึง Workspace ใน MVP

## 3. Requirements, constraints & guidelines

ข้อกำหนดส่วนนี้แบ่งเป็น product behavior, usability, data, security และข้อจำกัด
ของ MVP ทุก requirement ที่ขึ้นต้นด้วย `REQ` เป็นข้อบังคับ เว้นแต่ระบุเป็น
phase หลัง MVP อย่างชัดเจน

### 3.1 Workspace and project requirements

Workspace และ Project ต้องช่วยแยกบริบทของงานโดยไม่เพิ่มขั้นตอนที่ไม่จำเป็น

- **REQ-001**: ระบบต้องสร้าง Workspace เริ่มต้นและ Project แรกให้อัตโนมัติเมื่อ
  เปิดใช้งานครั้งแรก
- **REQ-002**: ผู้ใช้ต้องสร้าง แก้ไขชื่อ เปลี่ยนสี และ archive Project ได้
- **REQ-003**: Project ต้องเลือก workflow mode เป็น `kanban` หรือ `scrum` ได้
- **REQ-004**: การ archive Project ต้องไม่ลบ Issue, Sprint หรือประวัติเดิม
- **REQ-005**: ระบบต้องเปิด Project ล่าสุดที่ผู้ใช้เคยใช้งานเมื่อกลับเข้าแอป
- **REQ-006**: ผู้ใช้ที่ยังไม่ login ต้องไม่สามารถเข้าถึง Project หรือ Issue ได้
- **REQ-007**: Production ต้องรับเฉพาะ Google email ที่ verified และอยู่ใน
  `ALLOWED_GOOGLE_EMAILS`; MVP ไม่มี local registration
- **REQ-008**: ผู้ใช้ต้อง login ด้วย Google, ใช้ server-side session และ logout ได้
- **REQ-009**: ระบบต้องสร้าง Workspace และ Project เริ่มต้นหลัง Owner login ครั้งแรก

### 3.2 Issue and backlog requirements

Issue ต้องบันทึกได้เร็ว แต่มีข้อมูลเพียงพอสำหรับจัดลำดับและลงมือทำ

- **REQ-010**: ผู้ใช้ต้องสร้าง Issue ด้วย title เพียงช่องเดียวได้
- **REQ-011**: Issue ต้องรองรับ title, description, type, priority, status,
  Story Point, labels, due date, blocked state และ blocked reason
- **REQ-012**: Issue type ต้องมีค่า `task`, `story`, `bug` และ `chore`
- **REQ-013**: Priority ต้องมีค่า `urgent`, `high`, `medium`, `low` และ `none`
- **REQ-014**: ผู้ใช้ต้องแก้ไข duplicate, archive และ restore Issue ได้
- **REQ-015**: ผู้ใช้ต้อง reorder Issue ใน Backlog ด้วย drag and drop ได้
- **REQ-016**: ผู้ใช้ต้องเลือกหลาย Issue แล้วเพิ่มเข้าสู่ Sprint เดียวกันได้
- **REQ-017**: ระบบต้องมี quick-add ที่คง context ของ Project และตำแหน่งปัจจุบัน
- **REQ-018**: ผู้ใช้ต้องเพิ่ม checklist และทำเครื่องหมายแต่ละรายการว่าเสร็จได้
- **REQ-019**: ระบบต้องเตือนก่อนปิด Issue เป็น Done เมื่อ checklist ยังไม่ครบ
  แต่ผู้ใช้ต้องยืนยันเพื่อดำเนินการต่อได้

### 3.3 Board requirements

Board ต้องให้ผู้ใช้เข้าใจสถานะงานและเปลี่ยน flow ได้โดยตรง

- **REQ-020**: Board เริ่มต้นต้องมี `To do`, `In progress`, `Review` และ `Done`
- **REQ-021**: ผู้ใช้ต้องเพิ่ม เปลี่ยนชื่อ reorder และ archive Column ได้
- **REQ-022**: Column แรกต้องจัดเป็นสถานะเริ่มต้น และ Column สุดท้ายต้องจัดเป็น
  Done category เสมอ
- **REQ-023**: ผู้ใช้ต้องย้าย Issue ระหว่าง Column และ reorder ภายใน Column ด้วย
  drag and drop ได้
- **REQ-024**: การย้าย Issue ต้องบันทึกทันทีและคงสถานะหลัง refresh
- **REQ-025**: ผู้ใช้ต้องตั้ง WIP limit ให้แต่ละ Column ที่ไม่ใช่ Done ได้
- **REQ-026**: เมื่อจำนวน Issue เกิน WIP limit ระบบต้องแสดง warning ชัดเจน แต่
  ไม่บล็อกการย้ายใน MVP
- **REQ-027**: Board ต้องแสดงจำนวน Issue และ Story Point รวมของแต่ละ Column
- **REQ-028**: Card ต้องแสดง title, type, priority, Story Point, labels, due date
  และ blocked indicator เท่าที่ข้อมูลมี
- **REQ-029**: ผู้ใช้ต้องเปิด Issue detail จาก Card โดยไม่ออกจาก Board context
- **REQ-030**: ผู้ใช้ keyboard สามารถย้าย Card ไป Column ก่อนหน้าหรือถัดไปได้

### 3.4 Scrum requirements

Scrum mode ต้องรองรับวงจร planning, execution และ review โดยไม่บังคับพิธีการ
ที่ออกแบบมาสำหรับทีม

- **REQ-040**: ผู้ใช้ต้องสร้าง Sprint พร้อม name, goal, start date และ end date
- **REQ-041**: Project ต้องมี Active Sprint ได้ไม่เกินหนึ่ง Sprint
- **REQ-042**: ผู้ใช้ต้องเริ่ม Sprint ได้เมื่อ Sprint มี Issue อย่างน้อยหนึ่งรายการ
- **REQ-043**: ระบบต้องแสดง planned Story Point และจำนวน Issue ก่อนเริ่ม Sprint
- **REQ-044**: ผู้ใช้ต้องเพิ่มหรือนำ Issue ออกจาก Active Sprint ได้
- **REQ-045**: ผู้ใช้ต้อง complete Sprint และเลือกว่าจะย้าย Issue ที่ไม่เสร็จไป
  Backlog หรือ Sprint ถัดไป
- **REQ-046**: เมื่อ complete Sprint ระบบต้องบันทึก completed Story Point,
  incomplete Story Point, Issue count และ completion date
- **REQ-047**: ผู้ใช้ต้องดู Sprint history และค่า velocity ของ Sprint ที่ปิดแล้ว
- **REQ-048**: Scrum Board ต้องแสดงเฉพาะ Issue ใน Active Sprint โดยค่าเริ่มต้น

### 3.5 Kanban requirements

Kanban mode ต้องรองรับ flow ต่อเนื่องโดยไม่ต้องสร้าง Sprint

- **REQ-050**: Kanban Board ต้องแสดง Issue ที่ไม่ถูก archive ทั้งหมดของ Project
- **REQ-051**: Kanban mode ต้องใช้ WIP limit และ Board filters ชุดเดียวกับ Scrum
- **REQ-052**: ผู้ใช้ต้องตั้งค่าให้ Done Issue ถูกซ่อนอัตโนมัติหลัง 7, 14 หรือ 30 วัน
- **REQ-053**: ผู้ใช้ต้องเปิดดู Done Issue ที่ถูกซ่อนได้จาก filter

### 3.6 Search, filter, and focus requirements

การค้นหาและกรองต้องตอบสนองทันทีและช่วยให้ผู้ใช้ลดจำนวนข้อมูลบนหน้าจอ

- **REQ-060**: ผู้ใช้ต้องค้นหา Issue จาก title และ description ได้
- **REQ-061**: ผู้ใช้ต้องกรองตาม type, priority, label, due state, blocked state
  และ Sprint ได้
- **REQ-062**: ระบบต้องรวม filter หลายชนิดด้วยเงื่อนไข AND
- **REQ-063**: ระบบต้องแสดงจำนวน filter ที่ active และล้างทั้งหมดได้ในครั้งเดียว
- **REQ-064**: Query และ filter ต้องไม่แก้ไขลำดับจริงของ Issue
- **REQ-065**: ผู้ใช้ต้องเปิดมุมมอง `Focus` ที่แสดงงาน `In progress`, งาน blocked
  และงานที่ครบกำหนดภายใน 7 วันได้

### 3.7 Undo, backup, and recovery requirements

การกระทำที่เสี่ยงและการจัดเก็บข้อมูลต้องให้ผู้ใช้กู้คืนได้

- **REQ-070**: ระบบต้องมี undo สำหรับการย้าย archive และ delete แบบถาวรเป็นเวลา
  อย่างน้อย 5 วินาทีหลังการกระทำ
- **REQ-071**: การลบ Project, Sprint หรือ Issue แบบถาวรต้องมี confirmation
- **REQ-072**: ผู้ใช้ต้อง export Workspace ทั้งหมดเป็นไฟล์ JSON ได้
- **REQ-073**: ผู้ใช้ต้อง import JSON ที่ระบบเคย export และเลือก `replace` หรือ
  `merge` ได้
- **REQ-074**: ระบบต้องตรวจ schema version ก่อน import และไม่แก้ข้อมูลเดิมเมื่อ
  validation ล้มเหลว
- **REQ-075**: ระบบต้องสร้าง timestamp ของการเปลี่ยนแปลงและ export ด้วย ISO 8601

### 3.8 Accessibility and responsive requirements

ฟังก์ชันหลักต้องใช้งานได้โดยไม่พึ่ง mouse และต้องอ่านได้บนหน้าจอหลายขนาด

- **A11Y-001**: ฟังก์ชันหลักต้องผ่าน WCAG 2.2 ระดับ AA
- **A11Y-002**: Interactive element ต้องมี focus indicator ที่มองเห็นชัด
- **A11Y-003**: Drag and drop ต้องมี keyboard alternative และ screen reader
  announcement
- **A11Y-004**: สีต้องไม่เป็นตัวบอก status, type หรือ priority เพียงอย่างเดียว
- **A11Y-005**: Modal และ drawer ต้อง trap focus และคืน focus เมื่อปิด
- **RSP-001**: Desktop ตั้งแต่ 1024 px ต้องแสดงหลาย Column ในแนวนอน
- **RSP-002**: Mobile ต่ำกว่า 768 px ต้องสลับดูทีละ Column และเปลี่ยน Column ได้
  โดยไม่ต้องลาก Card ระยะไกล
- **RSP-003**: Touch target ต้องมีขนาดอย่างน้อย 44 x 44 CSS pixels

### 3.9 Performance and reliability requirements

MVP ต้องตอบสนองเร็วสำหรับข้อมูลส่วนตัวขนาดทั่วไปและต้องไม่เสียข้อมูลระหว่าง
การกระทำปกติ

- **PER-001**: First usable screen บนอุปกรณ์ระดับกลางต้องแสดงภายใน 2.5 วินาที
  เมื่อข้อมูลมีไม่เกิน 2,000 Issue
- **PER-002**: การย้าย Card ต้องแสดงผลบนหน้าจอภายใน 100 milliseconds
- **PER-003**: Search และ filter ต้องแสดงผลภายใน 150 milliseconds สำหรับ 2,000
  Issue
- **PER-004**: การเขียนข้อมูลต้องเป็น atomic operation ในระดับ aggregate ที่แก้ไข
- **REL-001**: ระบบต้อง recover จากข้อมูล record เดี่ยวที่อ่านไม่ได้โดยแจ้งผู้ใช้
  และเก็บ record ที่เหลือไว้

### 3.10 Security and privacy requirements

ข้อมูลของผู้ใช้ต้องส่งเฉพาะผ่าน authenticated application flow และจัดเก็บใน
PostgreSQL ที่กำหนด

- **SEC-001**: MVP ต้องส่งเนื้อหา Project หรือ Issue เฉพาะระหว่าง Browser, Railway
  Web, Railway API และ Railway PostgreSQL
- **SEC-002**: ระบบต้อง sanitize rich text หรือ Markdown ก่อน render
- **SEC-003**: ไฟล์ import ต้องมีข้อจำกัดขนาด 10 MB และต้องตรวจชนิดข้อมูลทุก field
- **SEC-004**: ระบบต้องไม่เก็บ token, password หรือ secret ไว้ใน export file
- **SEC-005**: ถ้ามี telemetry ในอนาคต ผู้ใช้ต้อง opt in ก่อนและ payload ต้องไม่มี
  title หรือ description ของ Issue

### 3.11 Product constraints and guidelines

ข้อจำกัดต่อไปนี้กำหนดขอบเขตการตัดสินใจสำหรับการพัฒนา MVP

- **CON-001**: MVP ต้องเป็น single-user โดยมี Owner authorization หนึ่งบัญชี
- **CON-002**: MVP ต้องเชื่อมต่อ network เพื่ออ่านและเขียนข้อมูลหลัก
- **CON-003**: PostgreSQL schema และ export format ต้องมี version และ migration
- **CON-004**: การเปลี่ยน status และ rank ต้องไม่สร้างข้อมูลซ้ำ
- **GUD-001**: ใช้ progressive disclosure โดยให้ Issue title เป็นข้อมูลบังคับเพียง
  รายการเดียวใน quick-add
- **GUD-002**: แสดง destructive action แยกจาก primary action และต้องไม่ใช้สีอย่าง
  เดียวเป็นตัวสื่อความหมาย
- **GUD-003**: ใช้ optimistic UI เฉพาะเมื่อมี rollback path ที่ชัดเจน
- **GUD-004**: UI ต้อง reuse หรือ adapt component, layout และ theme จาก
  `~/Minimal_TypeScript_v7.0.0/next-ts/src` ก่อนสร้าง reusable component ใหม่
- **GUD-005**: Source ที่นำมาจาก Minimal ต้องอยู่ภายใน repository และห้ามสร้าง
  runtime dependency ไปยัง absolute path บนเครื่องพัฒนา
- **GUD-006**: Board surface ต้อง reuse และ adapt implementation จาก
  `~/Minimal_TypeScript_v7.0.0/next-ts/src/sections/kanban` เป็น baseline ห้ามสร้าง
  Kanban board ใหม่จากศูนย์โดยไม่มีเหตุผลด้าน requirement หรือ accessibility

## 4. Interfaces & data contracts

MVP ใช้ domain model ด้านล่างเป็น contract กลางระหว่าง UI, persistence และ
import/export implementation สามารถเพิ่ม internal field ได้ แต่ห้ามเปลี่ยน
ความหมายของ field ที่กำหนดโดยไม่มี schema migration

### 4.1 Core entities

Entity ทุกชนิดต้องใช้ string ID ที่ไม่ซ้ำ มี `createdAt` และ `updatedAt` ในรูปแบบ
ISO 8601 และเก็บวันที่ตาม timezone ของผู้ใช้เมื่อแสดงผล

```ts
type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  projectIds: string[];
  activeProjectId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectMode = 'kanban' | 'scrum';

type Project = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  mode: ProjectMode;
  columnIds: string[];
  activeSprintId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ColumnCategory = 'todo' | 'in_progress' | 'done';

type BoardColumn = {
  id: string;
  projectId: string;
  name: string;
  category: ColumnCategory;
  rank: string;
  wipLimit: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type IssueType = 'task' | 'story' | 'bug' | 'chore';
type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

type Issue = {
  id: string;
  projectId: string;
  sprintId: string | null;
  columnId: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  storyPoints: number | null;
  labelIds: string[];
  checklist: ChecklistItem[];
  dueDate: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  rank: string;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChecklistItem = {
  id: string;
  text: string;
  isCompleted: boolean;
  rank: string;
};

type SprintStatus = 'planned' | 'active' | 'completed';

type Sprint = {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  completedAt: string | null;
  plannedPoints: number;
  completedPoints: number;
  createdAt: string;
  updatedAt: string;
};

type Label = {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};
```

### 4.2 Export contract

ไฟล์ export ต้องเป็น JSON object หนึ่งรายการที่มี schema version และข้อมูลครบทุก
entity ผู้ใช้ต้องสามารถนำไฟล์เดิมกลับเข้าแอปโดยไม่สูญเสียความสัมพันธ์ระหว่างข้อมูล

```ts
type WorkspaceExport = {
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  workspace: Workspace;
  projects: Project[];
  columns: BoardColumn[];
  issues: Issue[];
  sprints: Sprint[];
  labels: Label[];
};
```

### 4.3 Primary navigation

Navigation ต้องสะท้อน workflow ของผู้ใช้และไม่ซ่อน action หลักไว้หลายระดับ

- **Project switcher**: เลือก สร้าง และ archive Project
- **Focus**: แสดงงานระหว่างทำ งาน blocked และงานใกล้ครบกำหนด
- **Backlog**: จัดลำดับ Issue และวางแผน Sprint
- **Board**: ดำเนินงานใน Kanban flow หรือ Active Sprint
- **Sprints**: ดู Sprint history และ velocity
- **Settings**: ตั้งค่า appearance, backup, restore และข้อมูล Project

### 4.4 Key interaction flows

Flow หลักต้องมีผลลัพธ์และ fallback ที่คาดเดาได้

1. **Capture work**: ผู้ใช้กด quick-add, ใส่ title, กด Enter และเห็น Issue ใน
   Backlog หรือ Column ปัจจุบันทันที
2. **Plan Sprint**: ผู้ใช้สร้าง Sprint, เลือก Issue จาก Backlog, ตรวจ capacity และ
   เริ่ม Sprint
3. **Execute work**: ผู้ใช้ลาก Issue ระหว่าง Column, เปิดรายละเอียด และ mark blocked
   เมื่อพบอุปสรรค
4. **Complete Sprint**: ผู้ใช้ตรวจงาน Done, เลือกปลายทางของงานค้าง และยืนยันปิด
   Sprint
5. **Recover data**: ผู้ใช้ export Workspace และ import กลับด้วยโหมด replace หรือ
   merge

## 5. Acceptance criteria

MVP พร้อมใช้งานเมื่อ acceptance criteria ต่อไปนี้ผ่านทั้งหมดบน browser เป้าหมาย

- **AC-001**: Given Owner login ครั้งแรก, When หน้าแรกโหลดเสร็จ, Then ระบบต้องมี
  Workspace, Project และ Board เริ่มต้นพร้อมใช้งาน
- **AC-002**: Given ผู้ใช้อยู่ใน Backlog, When กรอก title และกด Enter, Then Issue
  ใหม่ต้องปรากฏและยังอยู่หลัง refresh
- **AC-003**: Given Board มี Issue, When ผู้ใช้ย้าย Card ไป Column อื่น, Then status
  และ rank ต้องเปลี่ยนเพียงครั้งเดียวและคงอยู่หลัง reload
- **AC-004**: Given Column มี WIP limit เท่ากับ 2 และมี Issue อยู่แล้ว 2 รายการ,
  When ย้าย Issue ที่สามเข้ามา, Then Board ต้องแสดง warning โดยไม่ทำข้อมูลหาย
- **AC-005**: Given Project อยู่ใน Scrum mode และไม่มี Active Sprint, When ผู้ใช้
  เริ่ม Sprint ที่มี Issue อย่างน้อยหนึ่งรายการ, Then Sprint ต้องเป็น active และ
  Board ต้องแสดง Issue ของ Sprint นั้น
- **AC-006**: Given มี Active Sprint อยู่, When ผู้ใช้พยายามเริ่ม Sprint อื่น, Then
  ระบบต้องปฏิเสธและระบุให้ complete Active Sprint ก่อน
- **AC-007**: Given Active Sprint มีทั้ง Done และ incomplete Issue, When complete
  Sprint, Then ระบบต้องบันทึก velocity และย้าย incomplete Issue ไปปลายทางที่เลือก
- **AC-008**: Given ผู้ใช้เปิด Focus, When มี blocked หรือ due-soon Issue, Then ระบบ
  ต้องแสดง Issue เหล่านั้นพร้อมเหตุผลหรือ due date
- **AC-009**: Given ผู้ใช้ใช้ keyboard เท่านั้น, When focus อยู่บน Card, Then ผู้ใช้
  ต้องเปิดรายละเอียดและย้าย Card ไป Column ข้างเคียงได้
- **AC-010**: Given Workspace มีข้อมูล, When export แล้ว import ด้วยโหมด replace,
  Then จำนวน entity และค่าของ field ที่ผู้ใช้แก้ไขต้องตรงกับก่อน export
- **AC-011**: Given import file มี schema ไม่ถูกต้อง, When ผู้ใช้เริ่ม import, Then
  ระบบต้องแจ้ง validation error และข้อมูลปัจจุบันต้องไม่เปลี่ยน
- **AC-012**: Given Issue มี checklist ไม่ครบ, When ผู้ใช้ย้ายไป Done, Then ระบบต้อง
  เตือนและให้ผู้ใช้เลือกย้อนกลับหรือยืนยันต่อ
- **AC-013**: Given ผู้ใช้ archive Issue, When กด Undo ภายใน 5 วินาที, Then Issue ต้อง
  กลับมาตำแหน่งเดิม
- **AC-014**: Given มี Issue 2,000 รายการ, When ค้นหาหรือเปลี่ยน filter, Then ผลลัพธ์
  ต้องแสดงภายใน 150 milliseconds ใน test environment ที่กำหนด
- **AC-015**: Given ผู้ใช้ยังไม่ login, When เปิด protected route, Then ระบบต้องพาไป
  หน้า login และไม่คืน domain data
- **AC-016**: Given Owner login บนอุปกรณ์ใหม่, When เปิด Project, Then ระบบต้องแสดง
  ข้อมูลล่าสุดจาก PostgreSQL
- **AC-017**: Given server-side session หมดอายุ, When ผู้ใช้เรียก protected action,
  Then ระบบต้องพาไป login ใหม่โดยไม่ทำ mutation ซ้ำ
- **AC-018**: Given Google email ไม่อยู่ใน allowlist, When authentication สำเร็จ,
  Then ระบบต้องปฏิเสธการเข้าถึงและไม่สร้าง session

## 6. Test automation strategy

การทดสอบต้องเน้น domain invariants และ flow ที่เสี่ยงต่อการสูญหายของข้อมูลก่อน
รายละเอียด visual styling

- **Unit tests**: ทดสอบ rank calculation, Sprint transition, velocity, WIP count,
  filter predicates, schema validation และ merge conflict policy
- **Component tests**: ทดสอบ Issue form, Card, Column, filter bar, Sprint dialog
  และ import validation state
- **Integration tests**: ทดสอบ PostgreSQL transaction, migration, export/import
  round trip, Google identity allowlist, session และการ rollback optimistic update
- **End-to-end tests**: ทดสอบ first-run, create-and-move Issue, plan-and-complete
  Sprint, keyboard workflow และ backup recovery
- **Accessibility tests**: ใช้ automated rule checks ร่วมกับ manual keyboard และ
  screen reader smoke test
- **Performance tests**: สร้าง fixture 2,000 Issue แล้ววัด Board render, search,
  filter และ drag response
- **Coverage requirement**: Domain logic และ persistence layer ต้องมี branch
  coverage อย่างน้อย 90%; โค้ดทั้งหมดต้องมี line coverage อย่างน้อย 80%
- **CI requirement**: ทุก change ต้องผ่าน lint, typecheck, unit, integration และ
  production build ก่อน merge

## 7. Rationale & context

การรวม Kanban และ Scrum ช่วยให้ผู้ใช้เลือกวิธีทำงานตามลักษณะ Project โดยไม่ต้อง
ย้ายข้อมูลระหว่างหลายแอป Kanban เหมาะกับงานต่อเนื่อง ส่วน Scrum เหมาะกับงานที่มี
เป้าหมายและช่วงเวลาชัดเจน

MVP เลือก single-user แบบ server-backed เพราะผู้ใช้ต้องเข้าถึงผ่าน domain ส่วนตัว
และต้องการ durable persistence บน Railway การมี Owner account หนึ่งบัญชียังคงลด
ความซับซ้อนของ membership และ permission ขณะที่ PostgreSQL ทำให้ข้อมูล sync ระหว่าง
อุปกรณ์และรองรับ transaction ของ Sprint ได้

WIP limit ใน MVP เป็น warning แทน hard block เพราะผู้ใช้คนเดียวต้องสามารถรับมือ
กรณีฉุกเฉินได้ ขณะเดียวกัน warning ยังช่วยสะท้อน bottleneck โดยไม่ทำให้ workflow
หยุดชะงัก

## 8. Dependencies & external integrations

MVP พึ่ง Railway สำหรับ Web, API และ PostgreSQL และใช้ Cloudflare เป็น DNS provider
ของ `kanban.koonporza.com`

### Technology platform dependencies

Platform ต้องรองรับเว็บแอปแบบ responsive, authenticated REST API และ relational
transaction ที่เชื่อถือได้

- **PLT-001**: Modern evergreen browser ที่รองรับ Web Crypto และ File API
- **PLT-002**: Next.js frontend และ NestJS Express API บน Node.js
- **PLT-003**: PostgreSQL, Prisma migration และ typed runtime validation

### Infrastructure dependencies

ระบบ host เป็นข้อบังคับของ MVP และต้องลด public service surface ให้เหลือ frontend
เพียงจุดเดียว

- **INF-001**: Railway Web service สำหรับ Next.js
- **INF-002**: Railway private API service สำหรับ NestJS
- **INF-003**: Railway PostgreSQL service ที่ไม่เปิด public TCP proxy
- **INF-004**: HTTPS custom domain `kanban.koonporza.com` ผ่าน Cloudflare DNS

### External systems and third-party services

MVP ใช้ infrastructure และ identity integration ที่เป็นข้อบังคับ แต่ไม่มี business
integration

- **EXT-001**: Railway สำหรับ hosting, private networking และ PostgreSQL
- **SVC-001**: Cloudflare สำหรับ DNS และ optional proxy
- **SVC-002**: Google OpenID Connect สำหรับ login เท่านั้น
- **DAT-001**: Railway PostgreSQL เป็น authoritative data source
- **COM-001**: ไม่มีข้อกำหนด compliance เฉพาะ นอกเหนือจาก privacy และ
  accessibility requirements ในเอกสารนี้

## 9. Examples & edge cases

ตัวอย่างและ edge case ต่อไปนี้ต้องถูกนำไปใช้ระหว่างออกแบบ behavior และสร้าง test
fixture

### 9.1 Example personal workflow

ตัวอย่างนี้แสดงการใช้ Scrum mode สำหรับโปรเจกต์ส่วนตัวหนึ่งรายการ

1. ผู้ใช้สร้าง Project ชื่อ `Portfolio website` และเลือก Scrum mode
2. ผู้ใช้เพิ่ม Story ชื่อ `Publish case study` พร้อม 5 Story Point
3. ผู้ใช้สร้าง Sprint ชื่อ `Launch sprint` ระยะเวลา 7 วัน
4. ผู้ใช้เพิ่ม Story เข้า Sprint และเริ่ม Sprint
5. ผู้ใช้ย้าย Story จาก `To do` ไป `In progress`, `Review` และ `Done`
6. ผู้ใช้ complete Sprint และเห็น velocity เท่ากับ 5

### 9.2 Required edge cases

ระบบต้องมีพฤติกรรมที่แน่นอนสำหรับกรณีผิดปกติหรือข้อมูลขอบเขต

- Title มีเฉพาะ whitespace ต้องถูกปฏิเสธ
- Issue title ยาวเกิน 200 ตัวอักษรต้องแสดง validation ก่อนบันทึก
- Description ยาวต้องไม่ทำให้ Card สูงเกิน layout ที่กำหนด
- Due date ก่อนวันที่สร้างต้องบันทึกได้ แต่ต้องแสดงว่า overdue
- Story Point เท่ากับ 0 ต้องตีความเป็น “ประเมินแล้วว่าไม่มี point” ไม่ใช่ `null`
- การ archive Column ที่ยังมี Issue ต้องบังคับเลือก Column ปลายทางก่อน
- การลด WIP limit ต่ำกว่าจำนวน Issue ปัจจุบันต้องแสดง warning ทันที
- การเปลี่ยน Scrum เป็น Kanban ขณะมี Active Sprint ต้องถูกปฏิเสธ
- การ import entity ID ซ้ำในโหมด merge ต้องใช้ record ที่ `updatedAt` ใหม่กว่า
- การ import file ที่ถูกตัดกลางคันต้องไม่แก้ข้อมูลปัจจุบัน
- การปิด browser ระหว่าง drag ต้องคงสถานะล่าสุดที่ PostgreSQL commit สำเร็จ
- วันที่เปลี่ยนผ่าน daylight saving time ต้องไม่เลื่อนวันใน UI
- Project ที่ไม่มี Issue ต้องแสดง empty state พร้อม quick-add action
- Filter ที่ไม่พบผลลัพธ์ต้องแสดงวิธีล้าง filter โดยไม่ลบ query ของผู้ใช้ทันที

## 10. Validation criteria

ก่อนประกาศ MVP ต้องมีหลักฐานยืนยันตามเกณฑ์ต่อไปนี้

- Requirement `REQ-001` ถึง `REQ-075` ที่อยู่ใน MVP ต้องเชื่อมกับ test case หรือ
  manual verification record อย่างน้อยหนึ่งรายการ
- Acceptance criteria `AC-001` ถึง `AC-014` ต้องผ่านทั้งหมด
- Lint, typecheck, automated tests และ production build ต้องจบด้วย exit code 0
- Export/import round-trip ต้องผ่าน fixture ที่มี Project, Column, Issue, Sprint,
  Label และ checklist ครบทุกชนิด
- Migration test ต้องอ่าน schema version ก่อนหน้าได้อย่างน้อยหนึ่ง version เมื่อมี
  migration แรก
- Keyboard-only review ต้องทำ core workflow ได้โดยไม่มี dead end
- Automated accessibility scan ต้องไม่มี critical หรือ serious violation
- Performance test ต้องผ่าน threshold ใน `PER-001` ถึง `PER-003`
- ไม่มี Issue title หรือ description ใน logs, telemetry หรือ third-party request

## 11. Delivery phases

การส่งมอบแบ่งเป็น phase ที่แต่ละช่วงสร้างประโยชน์ได้และมี stop condition ชัดเจน

### Phase 0: Foundation

Phase นี้สร้างฐานข้อมูลและ navigation ก่อนลงรายละเอียดของ Board

- Domain model และ schema validation
- Owner authentication, PostgreSQL migration และ seed Project
- Next.js Web, NestJS API และ Railway-compatible health endpoints
- Application shell, Project switcher และ responsive navigation
- Stop condition: login และ reload แล้ว Workspace กับ Project คงอยู่ใน PostgreSQL

### Phase 1: Kanban MVP

Phase นี้สร้างวงจร capture และ flow management ที่ใช้งานได้จริง

- Backlog, quick-add และ Issue detail
- Board columns, drag and drop, rank และ WIP warning
- Search, filters, Focus view และ keyboard alternatives
- Stop condition: ผู้ใช้จัดการ Project แบบ Kanban ได้ครบโดยข้อมูลไม่หาย

### Phase 2: Scrum MVP

Phase นี้เพิ่ม planning และ review บนฐาน Kanban ที่ผ่านการตรวจแล้ว

- Sprint planning, Active Sprint และ Sprint Board
- Complete Sprint, incomplete work handling, history และ velocity
- Stop condition: acceptance criteria ของ Sprint ผ่านครบ

### Phase 3: Recovery and hardening

Phase นี้ปิดความเสี่ยงด้านข้อมูล การเข้าถึง และประสิทธิภาพก่อนใช้งานจริง

- Export/import, merge, undo และ destructive confirmations
- Accessibility, responsive, performance และ data corruption handling
- Stop condition: validation criteria ทั้งหมดผ่าน

## 12. Open decisions

รายการต่อไปนี้ไม่บล็อกการเริ่ม Phase 0 แต่ต้องตัดสินใจก่อนเริ่ม phase ที่เกี่ยวข้อง

- **DEC-001**: เลือก database backup retention ตาม Railway plan
- **DEC-002**: ยืนยัน BIGINT gap ranking และ rebalance threshold
- **DEC-003**: กำหนด merge behavior เมื่อ import มี entity ที่ถูก archive แล้ว
- **DEC-004**: ตัดสินใจว่า Markdown description รองรับ image attachment ในรุ่นใด
- **DEC-005**: กำหนด browser support matrix และ performance test device

## 13. Related specifications / further reading

เอกสาร implementation เพิ่มเติมต้องอ้างอิง requirement ID จาก PRD นี้เพื่อให้
trace การตัดสินใจและ test coverage ได้

- [System architecture](./spec-architecture-kanban-system.md)
- [Technology stack specification](./spec-architecture-technology-stack.md)
- UX and interaction specification: ยังไม่สร้าง
- [PostgreSQL data specification](./spec-data-kanban-postgresql.md)
- [Railway deployment specification](./spec-infrastructure-railway-deployment.md)
- Test plan: ยังไม่สร้าง

## 14. Next steps

ขั้นตอนต่อไปคือยืนยัน product assumptions ที่มีผลต่อ architecture แล้วแตก PRD เป็น
implementation plan ที่จัดลำดับตาม Phase 0 ถึง Phase 3

1. ยืนยันว่า Project แรกต้องเป็น Kanban หรือ Scrum โดยค่าเริ่มต้น
2. ลงทะเบียน Google OAuth client และกำหนด email allowlist ใน environment
3. สร้าง UX specification พร้อม wireframe สำหรับ Backlog, Board และ Issue detail
4. Scaffold pnpm workspace สำหรับ Next.js Web และ NestJS API
5. แตก requirement เป็น implementation tasks พร้อม test mapping

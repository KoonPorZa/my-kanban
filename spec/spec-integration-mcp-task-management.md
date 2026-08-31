---
title: MCP Task Management Integration Specification
version: 1.1
date_created: 2026-08-31
last_updated: 2026-08-31
owner: Product owner
tags: [integration, mcp, ai, task-management, security, cli]
---

# Introduction

เอกสารนี้กำหนด Remote Model Context Protocol (MCP) integration สำหรับให้ AI
clients จัดการ Task ใน My Kanban production อย่างปลอดภัย MCP รองรับ Codex CLI และ
Claude Code CLI เป็น clients แรก โดยทุก MCP connection ถูกจำกัดให้อยู่ใน Project
เดียวตลอด session และไม่มีความสัมพันธ์กับ Git repository หรือ working directory

MCP เป็น adapter อีกช่องทางหนึ่งของ application layer เดียวกับ REST API จึงต้อง
ใช้ authorization, validation, transaction และ concurrency rules ชุดเดียวกัน
MCP ห้ามเรียก Prisma หรือแก้ PostgreSQL โดยตรง

## 1. Purpose and scope

ข้อกำหนดนี้ครอบคลุม MCP transport, Project-scoped token, tool contract, audit,
rate limit, Web proxy, Board synchronization และ macOS helper CLI ข้อกำหนดนี้ไม่
ครอบคลุมการให้ AI วางแผนหรือจัดลำดับงานเองโดยอัตโนมัตินอกเหนือจาก tool call ที่
ผู้ใช้อนุญาตใน AI client

### 1.1 Desired outcome

ผู้ใช้ต้องเปิด Codex CLI หรือ Claude Code CLI แล้วให้ session นั้นอ่านและจัดการ
Task ของ Project ที่เลือกได้ โดย AI ต้องไม่เห็นหรือเปลี่ยนไปยัง Project อื่นแม้จะ
ส่ง Project ID เองหรือเรียก tool ซ้ำด้วย input ที่ดัดแปลง

### 1.2 Supported clients

MVP รองรับ clients ที่ใช้ Streamable HTTP และ bearer authentication

- Codex CLI
- Claude Code CLI
- MCP-compatible client อื่นที่ผู้ใช้ตั้งค่าเอง โดยไม่รับประกัน helper CLI

## 2. Definitions

คำต่อไปนี้เป็น contract บังคับของ MCP integration

- **MCP access token**: Secret แบบ bearer ที่ผูกกับ Project เดียว
- **MCP session**: Connection lifecycle ระหว่าง client กับ `/mcp`
- **Task**: ชื่อใน MCP contract ของ `Issue` aggregate ภายในระบบ
- **Project binding**: Project ที่ resolve จาก token ฝั่ง server และเปลี่ยนไม่ได้
- **Token alias**: ชื่อที่ผู้ใช้ตั้งใน helper CLI เพื่อเลือก credential
- **Client label**: ชื่อ token ที่ช่วยระบุ client หรืออุปกรณ์ใน audit log
- **Full Task access**: อ่าน สร้าง แก้ไข ย้าย archive และ restore Task
- **Atomic batch**: ทุก Task ในคำสั่งเดียวสำเร็จพร้อมกันหรือ rollback ทั้งหมด
- **Helper CLI**: macOS command `kanban` สำหรับเก็บ token และเปิด AI client

## 3. Requirements, constraints, and guidelines

ข้อกำหนดทุกข้อในส่วนนี้เป็น requirement สำหรับ MCP MVP

### 3.1 Project isolation requirements

Project boundary ต้องมาจาก credential ฝั่ง server และห้ามเปลี่ยนตาม input ของ client

- **MCP-001**: MCP access token หนึ่งตัวต้องผูกกับ Project เดียว
- **MCP-002**: Server ต้อง resolve Project จาก token และห้ามรับ `projectId` เป็น
  authority จาก tool input
- **MCP-003**: MCP session ต้องเปลี่ยน Project ระหว่าง connection ไม่ได้
- **MCP-004**: การเข้าถึง entity ต้อง scope ด้วย Project binding ฝั่ง server ทุกครั้ง
- **MCP-005**: Token ที่ไม่ตรง Project, หมดอายุ หรือถูก revoke ต้องถูกปฏิเสธ
- **MCP-006**: Project binding ต้องไม่พึ่ง Git repository, current working
  directory หรือชื่อ local folder
- **MCP-007**: หากต้องใช้หลาย Project พร้อมกัน ผู้ใช้ต้องเปิดหลาย client sessions
  และใช้ token คนละตัว

### 3.2 Token lifecycle requirements

Token lifecycle ต้องรองรับหลาย client โดยลดความเสียหายเมื่อ credential รั่ว

- **MCP-010**: Project หนึ่งต้องสร้าง token ได้หลายตัว
- **MCP-011**: Token ต้องมี client label เพื่อแยก Codex, Claude Code หรืออุปกรณ์
- **MCP-012**: Token ทุกตัวต้องหมดอายุเมื่อครบ 90 วันและห้ามเปลี่ยนอายุ
- **MCP-013**: Web UI ต้องแสดง raw token เพียงครั้งเดียวหลังสร้าง
- **MCP-014**: Database ต้องเก็บ token hash และ prefix เท่านั้น ห้ามเก็บ raw token
- **MCP-015**: Owner ต้อง revoke token รายตัวได้ทันทีโดยไม่กระทบ token อื่น
- **MCP-016**: Token list ต้องแสดง label, Project, created time, expiry,
  last-used time และ revoked state โดยไม่แสดง secret
- **MCP-017**: การสร้างและ revoke token ทำได้เฉพาะ Web UI ที่ผ่าน Google session
- **MCP-018**: Helper CLI ต้องสร้างหรือ revoke production token ไม่ได้

### 3.3 Tool access requirements

Tool surface เปิด full Task access แต่คงโครงสร้าง Board และ Project เป็น read-only

- **MCP-020**: MCP ต้องอ่าน Project metadata และ Board Columns ของ Project ที่ผูก
  ได้
- **MCP-021**: MCP ต้องอ่าน ค้นหา และ list Task ที่ active หรือ archived ได้
- **MCP-022**: MCP ต้องสร้าง Task เดี่ยวด้วย title เป็น field บังคับเพียงรายการเดียว
- **MCP-023**: MCP ต้องมี `create_tasks` สำหรับสร้างไม่เกิน 10 Task ต่อ call
- **MCP-024**: `create_tasks` ต้อง atomic ถ้า Task ใดไม่ผ่าน validation ต้องไม่สร้าง
  Task ทั้งชุด
- **MCP-025**: MCP ต้องแก้ title, description, priority, labels, due date,
  blocked state และ blocked reason ได้ตาม Issue contract
- **MCP-026**: MCP ต้องย้าย Task ระหว่าง Column และกำหนดตำแหน่งภายใน Column ได้
- **MCP-027**: MCP ต้อง archive และ restore Task ได้
- **MCP-028**: Update, move, archive และ restore ต้องทำทีละ Task ต่อ tool call
- **MCP-029**: MCP ต้องไม่มี hard-delete tool
- **MCP-030**: MCP ต้องแก้ Project settings, Column, Column order หรือ WIP limit
  ไม่ได้

### 3.4 Consistency and safety requirements

Mutation ทุกช่องทางต้องใช้ business rules, validation และ concurrency contract เดียวกัน

- **MCP-040**: Mutation ต้องเรียก application service เดียวกับ REST API
- **MCP-041**: Mutation ต้องตรวจ optimistic concurrency ด้วย Task `version`
- **MCP-042**: Mutation ที่ retry ได้ต้องรับ idempotency key
- **MCP-043**: Duplicate idempotency key ใน scope เดิมต้องคืนผลลัพธ์เดิมและห้าม
  สร้างข้อมูลซ้ำ
- **MCP-044**: MCP server ต้อง validate tool input ด้วย schema ก่อนเรียก service
- **MCP-045**: Tool call มีผลทันทีและไม่ต้องยืนยันซ้ำใน Web UI
- **MCP-046**: การอนุมัติ tool call เป็นหน้าที่ของ AI client permission system
- **MCP-047**: Error ต้องไม่เปิดเผย token, hash, cookie, database URL หรือข้อมูลจาก
  Project อื่น

### 3.5 Audit and observability requirements

Audit trail ต้องตอบได้ว่า token ใดเรียก tool อะไรกับ Task ใดและเกิดผลลัพธ์แบบไหน

- **MCP-050**: ทุก authenticated mutation ต้องสร้าง audit event แม้ mutation ถูก
  validation, version หรือ Project authorization ปฏิเสธ
- **MCP-051**: Audit event ต้องมี Project, token ID, client label, tool name,
  Task ID เมื่อมี, request ID, outcome, timestamp และ changed field names
- **MCP-052**: Audit event ต้องไม่เก็บ raw token หรือ Task description ทั้งฉบับ
- **MCP-053**: Audit event ต้องเก็บอย่างน้อย 90 วัน
- **MCP-054**: Owner ต้องอ่านและ filter audit events จาก Project settings ได้
- **MCP-055**: Log ฝั่ง application ต้องใช้ request ID เดียวกับ audit event

### 3.6 Transport and deployment requirements

Remote client ใช้ public Web origin เดียว ส่วน NestJS API ยังคง private บน Railway

- **MCP-060**: Production endpoint ต้องเป็น
  `https://kanban.koonporza.com/mcp`
- **MCP-061**: Endpoint ต้องใช้ MCP Streamable HTTP transport
- **MCP-062**: Web service ต้อง proxy `/mcp` ไป NestJS API ผ่าน Railway private
  network
- **MCP-063**: API service ต้องไม่มี public domain เพิ่มจาก MCP
- **MCP-064**: Token ต้องส่งผ่าน `Authorization: Bearer <token>` เท่านั้น
- **MCP-065**: Production ต้องรับ MCP ผ่าน HTTPS เท่านั้น
- **MCP-066**: MCP endpoint ต้องมี rate limit แยกจาก Browser REST endpoints
- **MCP-067**: Server ต้องตรวจ `Origin` เมื่อ request มี header นี้ และปฏิเสธ origin
  ที่ไม่อนุญาต

### 3.7 Board synchronization requirements

MVP ใช้ polling ที่คาดเดาได้เพื่อสะท้อน mutation จาก MCP กลับเข้า Board

- **MCP-070**: Board query ต้อง refetch ทุก 15 วินาทีเมื่อหน้าเปิดอยู่
- **MCP-071**: Board query ต้อง refetch เมื่อ browser กลับมา focus
- **MCP-072**: MCP MVP ไม่ต้องเพิ่ม WebSocket หรือ Server-Sent Events
- **MCP-073**: Task ที่ MCP เปลี่ยนต้องปรากฏใน Web หลัง refetch โดยไม่ต้อง login ใหม่

### 3.8 Helper CLI requirements

Helper ลดขั้นตอนเลือก Project โดยไม่สร้าง authorization boundary ชุดใหม่

- **CLI-001**: MVP helper CLI รองรับ macOS เท่านั้น
- **CLI-002**: Binary command ต้องชื่อ `kanban`
- **CLI-003**: CLI ต้องเก็บ token ใน macOS Keychain และห้ามเก็บ raw token ในไฟล์
- **CLI-004**: CLI ต้องรับ token แบบ hidden input เพื่อไม่บันทึกใน shell history
- **CLI-005**: `kanban project add <alias>` ต้องตรวจ token กับ server ก่อนเก็บ
- **CLI-006**: `kanban project list` ต้องแสดง alias, Project name, expiry และ
  last-used time โดยไม่แสดง token
- **CLI-007**: `kanban project remove <alias>` ต้องลบ local Keychain credential
  เท่านั้นและไม่ revoke server token
- **CLI-008**: `kanban codex <alias> [-- args]` ต้องเปิด Codex CLI ด้วย token ที่เลือก
- **CLI-009**: `kanban claude <alias> [-- args]` ต้องเปิด Claude Code CLI ด้วย token
  ที่เลือก
- **CLI-010**: Child process ต้องได้รับ token ผ่าน environment เฉพาะ process tree
  ของ session นั้น
- **CLI-011**: CLI ต้องยืนยัน Project identity จาก server ก่อนเปิด child process
- **CLI-012**: CLI ต้องไม่อ่านหรือแก้ Git configuration
- **CLI-013**: Codex global config และ Claude user config ต้องอ่าน bearer token จาก
  environment ชื่อ `KANBAN_MCP_TOKEN`
- **CLI-014**: Helper ต้องไม่สร้าง project-scoped `.codex/config.toml`, `.mcp.json`
  หรือไฟล์ credential ใน working directory
- **CLI-015**: Helper ต้องแทนค่า `KANBAN_MCP_TOKEN` ของ child process ด้วย token ของ
  alias ที่เลือกและไม่แก้ environment ถาวรของ shell

## 4. Interfaces and data contracts

ส่วนนี้กำหนด tool surface ขั้นต่ำ โดย schema ราย field ต้อง derive จาก OpenAPI และ
domain DTO เดียวกับ REST API

### 4.1 MCP tools

MVP expose tool ต่อไปนี้โดยไม่มี input field สำหรับเลือกหรือเปลี่ยน Project

| Tool           | Access | Purpose                                      |
| -------------- | ------ | -------------------------------------------- |
| `get_context`  | Read   | คืน Project และ Column ที่ token ผูกอยู่     |
| `list_tasks`   | Read   | list Task พร้อม filter และ cursor pagination |
| `search_tasks` | Read   | ค้น Task ภายใน Project                       |
| `get_task`     | Read   | อ่าน Task เดี่ยว                             |
| `create_task`  | Write  | สร้าง Task เดี่ยว                            |
| `create_tasks` | Write  | สร้าง Task แบบ atomic สูงสุด 10 รายการ       |
| `update_task`  | Write  | แก้ Task เดี่ยวพร้อม version                 |
| `move_task`    | Write  | ย้าย Task เดี่ยวพร้อม version                |
| `archive_task` | Write  | archive Task เดี่ยว                          |
| `restore_task` | Write  | restore Task เดี่ยว                          |

### 4.2 Tool input contract

ทุก Task mutation รับ `idempotencyKey` และ mutation ของ record ที่มีอยู่ต้องรับ
`version` ห้าม tool ใดรับ `projectId`, Workspace ID หรือ token ผ่าน arguments

| Tool           | Required input                                | Optional input                                      |
| -------------- | --------------------------------------------- | --------------------------------------------------- |
| `get_context`  | None                                          | None                                                |
| `list_tasks`   | None                                          | column, archived state, priority, cursor, page size |
| `search_tasks` | query                                         | archived state, cursor, page size                   |
| `get_task`     | `taskId`                                      | include archived                                    |
| `create_task`  | `idempotencyKey`, title                       | Task fields, column, before/after Task              |
| `create_tasks` | `idempotencyKey`, `tasks` 1-10 items          | default column                                      |
| `update_task`  | `idempotencyKey`, `taskId`, `version`, patch  | None                                                |
| `move_task`    | `idempotencyKey`, `taskId`, `version`, column | before/after Task                                   |
| `archive_task` | `idempotencyKey`, `taskId`, `version`         | None                                                |
| `restore_task` | `idempotencyKey`, `taskId`, `version`         | target column, before/after Task                    |

Mutation success ต้องคืน Task version ล่าสุดและ `replayed: boolean` เพื่อให้ client
แยก idempotent replay ออกจากการทำงานครั้งแรก Batch validation error ต้องระบุ index
ของ item ที่ผิดโดยไม่สร้าง Task ใด

Cross-Project ID ต้องตอบ generic `not_found`; stale version ตอบ `conflict`; input ผิด
ตอบ `invalid_request`; token หมดอายุหรือ revoke ตอบ `unauthorized`; rate limit ตอบ
`rate_limited` Error data ต้องมี request ID และไม่มี metadata จาก Project อื่น

### 4.3 Authentication contract

Client ส่ง bearer token ทุก request และ server คืนข้อมูล Project context หลัง
initialize โดยไม่รับ Project selector จาก client

```http
Authorization: Bearer mkp_<prefix>_<secret>
```

Raw token ต้องมี entropy อย่างน้อย 256 bits Prefix มีไว้ค้น record เท่านั้นและไม่
ถือเป็น secret Server hash secret ก่อน lookup หรือ comparison และใช้ constant-time
comparison เมื่อมีการเปรียบเทียบ bytes

### 4.4 Helper CLI contract

CLI ใช้ alias เป็น local identifier เท่านั้น Alias ไม่ถูกส่งเป็น authorization และ
ไม่มีผลต่อ Project binding ฝั่ง server

```text
kanban project add work
kanban codex work
kanban claude work -- --continue
```

Codex ตั้ง MCP server ระดับ user ครั้งเดียวใน `~/.codex/config.toml` และอ่าน token
จาก environment ที่ helper ส่งเข้า child process

```toml
[mcp_servers.my_kanban]
url = "https://kanban.koonporza.com/mcp"
bearer_token_env_var = "KANBAN_MCP_TOKEN"
```

Claude Code ตั้ง HTTP MCP server ระดับ user ครั้งเดียว โดยเก็บ environment placeholder
ไม่ใช่ raw token

```sh
claude mcp add --transport http --scope user my-kanban \
  https://kanban.koonporza.com/mcp \
  --header 'Authorization: Bearer ${KANBAN_MCP_TOKEN}'
```

Helper ต้องตรวจว่า client binary และ MCP config พร้อมก่อน launch หาก config ขาดให้
แสดงคำสั่ง setup ที่ไม่เปิดเผย token และจบด้วย non-zero exit code

## 5. Acceptance criteria

MCP MVP ถือว่าผ่านเมื่อ isolation, mutation safety และ helper behavior ผ่านกรณีต่อไปนี้

- **AC-MCP-001**: Given token ของ Project A, When AI เรียก list หรือ mutation ด้วย
  Task ID ของ Project B, Then server ต้องตอบ not found หรือ forbidden โดยไม่รั่ว
  metadata ของ Project B
- **AC-MCP-002**: Given MCP session ที่ initialize ด้วย token A, When client พยายาม
  ส่ง Project B ใน input, Then Project binding ต้องยังเป็น Project A
- **AC-MCP-003**: Given `create_tasks` มี 11 รายการ, When เรียก tool, Then server ต้อง
  ปฏิเสธทั้ง request และไม่สร้าง Task
- **AC-MCP-004**: Given Task หนึ่งใน batch ไม่ผ่าน validation, When เรียก
  `create_tasks`, Then database ต้องไม่มี Task จาก batch นั้น
- **AC-MCP-005**: Given token ถูก revoke หรือครบ 90 วัน, When เรียก MCP, Then server
  ต้องปฏิเสธก่อนอ่าน Task
- **AC-MCP-006**: Given MCP mutation สำเร็จ, When เปิด audit log, Then ต้องพบ token
  label, tool, Task, outcome และ request ID
- **AC-MCP-007**: Given Board เปิดอยู่, When MCP สร้าง Task, Then Task ต้องปรากฏใน
  UI ภายใน 15 วินาที
- **AC-MCP-008**: Given Keychain มี token สอง Project, When เปิด `kanban codex a`
  และ `kanban claude b`, Then แต่ละ process ต้องเห็นเฉพาะ Project ของ alias ตนเอง
- **AC-MCP-009**: Given user เปิด CLI จาก directory ที่ไม่ใช่ Git repository,
  When helper เริ่ม session, Then MCP ต้องทำงานตาม Project token ได้

## 6. Test automation strategy

MCP tests ต้องครอบคลุม protocol, domain reuse และ security isolation

- Contract tests ตรวจ initialize, tools/list และ tool calls ผ่าน Streamable HTTP
- Integration tests ใช้ PostgreSQL จริงและสร้างสอง Project เพื่อทดสอบ isolation
- Mutation tests ตรวจ version conflict, idempotency และ atomic batch rollback
- Security tests ตรวจ expired, revoked, malformed และ cross-Project token usage
- Audit tests ตรวจ success, validation failure และ cross-Project authorization
  failure จาก valid token; invalid-token request ตรวจใน redacted security log
- Proxy tests ตรวจ `/mcp` ผ่าน Web origin และ private API destination
- CLI tests mock macOS `security` command และ child-process environment
- Manual smoke tests เปิด Codex และ Claude Code ด้วย alias คนละ Project

## 7. Rationale and context

Token เป็น Project capability ที่กำหนด authorization boundary ตั้งแต่เริ่ม session
ทำให้ AI client ไม่ต้องเลือก Project และลดโอกาสเขียนงานผิด Project การมีหลาย token
ต่อ Project ช่วย revoke แยก client หรือเครื่อง ส่วน helper CLI แก้ปัญหา usability
โดยไม่ผูก Kanban Project กับ source repository

การใช้ `/mcp` บน Web origin เดิมรักษา public surface เดียวของระบบ NestJS API และ
PostgreSQL ยังอยู่บน Railway private network และ MCP adapter reuse application
services เดียวกับ REST จึงไม่เกิด business rule สองชุด

## 8. Dependencies and external integrations

Implementation พึ่ง protocol, client configuration และ credential store ต่อไปนี้

- Model Context Protocol Streamable HTTP specification
- Official MCP TypeScript SDK
- Codex CLI project and user MCP configuration
- Claude Code HTTP MCP configuration
- macOS Keychain ผ่าน `/usr/bin/security`
- Railway Web proxy, private API และ PostgreSQL

### 8.1 Selected implementation

Phase 1A pin official `@modelcontextprotocol/sdk` ที่ version `1.30.0` และ `zod` ที่
version `3.25.76` ใน API และ helper CLI โดยใช้ stateful
`StreamableHTTPServerTransport` ตาม protocol version `2025-06-18` Transport และ
`McpServer` ถูกสร้างแยกต่อ session และ server revalidate bearer token ทุก request

## 9. Non-goals

MCP MVP ไม่ครอบคลุมความสามารถต่อไปนี้

- การแก้ Project, Column, Column order หรือ WIP limit
- การ hard delete Task
- การให้ AI เลือกหรือเปลี่ยน Project ภายใน session
- การผูก Project กับ Git repository หรือ local directory
- Linux หรือ Windows helper CLI
- OAuth authorization server สำหรับ third-party users
- MCP prompts, resources หรือ server-initiated notifications
- WebSocket, SSE หรือ real-time push ไป Board

## 10. Validation criteria

เอกสาร implementation ถือว่าผ่านเมื่อมี evidence ต่อไปนี้

- MCP SDK และ protocol version ถูก pin ใน lockfile
- Tool schemas derive จาก domain DTO และไม่มี Project selector
- Integration tests พิสูจน์ cross-Project isolation
- Token plaintext ไม่ปรากฏใน database, logs, Git หรือ CLI config
- Codex และ Claude Code เชื่อม production-like local endpoint ได้
- macOS Keychain เก็บและลบ token ตาม alias ได้
- Board refetch แสดง MCP mutation ภายใน 15 วินาที

## 11. Related specifications and references

เอกสารและแหล่งอ้างอิงต่อไปนี้เป็น source of truth ของ contract ที่เกี่ยวข้อง

- [Product requirements](./spec-design-personal-kanban-scrum-board.md)
- [System architecture](./spec-architecture-kanban-system.md)
- [Technology stack](./spec-architecture-technology-stack.md)
- [PostgreSQL data specification](./spec-data-kanban-postgresql.md)
- [Railway deployment specification](./spec-infrastructure-railway-deployment.md)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [OpenAI Codex configuration reference](https://developers.openai.com/codex/config-reference)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

## 12. Implementation status and next steps

Phase 1A local implementation เสร็จแล้วตามลำดับต่อไปนี้

1. เพิ่ม MCP token, mutation idempotency และ audit tables ใน Prisma migration
2. ทำ Project token management REST API และ Web settings UI
3. ทำ `McpModule`, Streamable HTTP endpoint และ Web `/mcp` proxy
4. reuse Board/Issues application services พร้อม Project-bound reads/mutations
5. เพิ่ม Board polling ทุก 15 วินาทีและ refetch on focus
6. สร้าง macOS helper CLI และ Codex/Claude launch adapters
7. รัน protocol, cross-Project isolation, idempotency, atomic batch, audit, revoke,
   proxy และ CLI automated tests ผ่านทั้งหมด

งานถัดไปคือ authenticated browser smoke ของ token UI, manual Codex/Claude smoke ผ่าน
local `/mcp`, จากนั้นจึง deploy Railway services และผูก Cloudflare production domain

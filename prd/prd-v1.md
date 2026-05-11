# 📄 PRD：frp-manager（v1）

## 🧠 产品定位

> 一个用于可视化管理 frpc.yml 的轻量工具，替代手动编辑 YAML + 手动重启 frpc 的流程。

一句话：

> **Stop editing frpc.yml manually.**

---

## 🎯 目标用户

* 自建 frp 内网穿透用户
* 个人开发者 / 小团队
* 有 VPS + frpc 的用户
* 经常改端口映射的人

---

## 💥 核心痛点

当前 frp 使用方式：

* 打开 vim / nano
* 找 YAML
* 改 proxy
* 手动 restart frpc
* 容易写错 / 端口冲突 / 忘记格式

👉 痛点总结：

> ❌ 配置难改
> ❌ 易出错
> ❌ 没 UI
> ❌ 没校验
> ❌ 没 diff

---

## 🚀 产品目标（v1）

### ✔ 必须做到

* 可视化管理 proxy
* CRUD proxy
* 自动生成 frpc.yml
* 一键 reload frpc
* 配置备份

---

### ❌ 不做（非常重要）

* 多用户系统
* frps 管理
* 多节点控制
* SaaS 平台
* 插件系统

👉 v1 只做一件事：

> “让改 frpc.yml 变成点按钮”

---

## 🧩 核心功能模块

---

## 1️⃣ Proxy 管理

### 功能

* 新增 proxy
* 编辑 proxy
* 删除 proxy
* 列表展示

### 字段

```ts id="p1"
name
type (tcp/http/https/stcp)
local_ip
local_port
remote_port
custom_domains
```

---

## 2️⃣ 配置生成

* 从 UI → 生成 frpc.yml
* 自动格式化 YAML
* 保持结构稳定

---

## 3️⃣ 配置校验

* remote_port 是否冲突
* name 是否重复
* port 是否合法
* 必填字段检查

---

## 4️⃣ 一键 reload

```text id="p2"
POST /system/reload
→ systemctl reload frpc
```

---

## 5️⃣ 备份系统

每次 save：

```text id="p3"
frpc.yml → frpc.yml.bak.timestamp
```

---

## 6️⃣ YAML 预览（差异）

* UI 修改前后 diff
* 用户确认后保存

---

## 🧱 用户流程（核心体验）

```text id="flow1"
打开 UI
   ↓
查看 proxy 列表
   ↓
点击 Add Proxy
   ↓
填写表单
   ↓
预览 YAML diff
   ↓
点击 Save
   ↓
自动写入 frpc.yml
   ↓
自动 reload frpc
```

---

# 🏗 项目架构（最终推荐）

你现在选的是：

> React + TypeScript + Node/Nest + npm workspace

---

## 📦 总体架构

```text id="arch1"
            React UI
               ↓
        NestJS API Layer
               ↓
        Config Core Engine
               ↓
         frpc.yml (real file)
               ↓
         systemctl reload frpc
```

---

## 📁 Monorepo 结构

```text id="arch2"
frp-manager/
│
├── apps/
│   ├── web/                 # React UI
│   │   ├── pages/
│   │   ├── features/
│   │   ├── shared/
│   │   └── main.tsx
│   │
│   └── api/                 # NestJS API
│       ├── modules/
│       │   ├── proxy/
│       │   ├── config/
│       │   └── system/
│       │
│       ├── controllers/
│       ├── services/
│       └── main.ts
│
├── packages/
│   ├── shared/              # types (Proxy DTO)
│   └── config-core/         # YAML 核心逻辑（最重要）
│
├── config/
│   └── frpc.yml             # 👈 真实配置文件
│
├── backups/
│   └── frpc/                # 自动备份
│
├── scripts/
│   ├── reload-frpc.sh
│   └── backup.sh
│
├── package.json
└── README.md
```

---

# 🧠 config-core（系统核心）

这是整个项目的“灵魂”。

## 职责

* 读取 frpc.yml
* 写入 frpc.yml
* proxy 增删改
* 校验冲突
* diff 生成
* backup

---

## 内部结构

```text id="core1"
config-core/
├── src/
│   ├── parser.ts          # YAML parse/stringify
│   ├── proxy.service.ts   # CRUD
│   ├── validator.ts       # 校验逻辑
│   ├── diff.ts            # 差异计算
│   └── backup.ts          # 备份系统
```

---

# ⚙️ API 设计（NestJS）

## Proxy

```http id="api1"
GET    /proxies
POST   /proxies
PUT    /proxies/:name
DELETE /proxies/:name
```

---

## Config

```http id="api2"
GET  /config/preview
GET  /config/yaml
POST /config/save
```

---

## System

```http id="api3"
POST /system/reload
GET  /system/status
```

---

# 🎨 前端结构（React）

```text id="ui1"
src/
├── pages/
│   ├── Dashboard
│   ├── Proxies
│   ├── ConfigPreview
│   └── Settings
│
├── features/
│   ├── proxy/
│   ├── config/
│   └── system/
│
├── shared/
│   ├── ui/
│   ├── hooks/
│   └── api/
```

---

# 🧱 UI 核心页面

## 1️⃣ Proxy List

* 表格
* edit / delete
* status badge

---

## 2️⃣ Proxy Editor

* form
* type selector
* port input
* validation

---

## 3️⃣ YAML Preview

```diff id="ui2"
+ new proxy
- old proxy
```

---

## 4️⃣ System Panel

* reload button
* status indicator

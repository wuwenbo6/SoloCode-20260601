# CO-CODE - 实时协作编辑器

基于 WebRTC 的 P2P 实时协作代码编辑器，支持多人同时编辑、多光标同步、版本控制等功能。

## 功能特性

- 🚀 **实时协作** - 基于 WebRTC 的 P2P 连接，毫秒级延迟
- 👥 **多用户光标** - 每个用户的光标位置实时同步，用不同颜色区分
- 📝 **代码编辑器** - 基于 CodeMirror 6，支持语法高亮
- 📦 **版本控制** - 每 5 分钟自动保存版本，随时回溯历史记录
- 🔒 **安全加密** - 房间密码保护，数据端到端加密
- 🌐 **STUN/TURN** - 集成 STUN 和 TURN 服务器，确保各种网络环境下的连接

## 技术栈

### 前端
- React 18 + TypeScript
- Vite
- Zustand（状态管理）
- CodeMirror 6（代码编辑器）
- Socket.io-client（WebSocket 信令）
- Tailwind CSS（样式）
- Lucide React（图标）

### 后端
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Socket.io（WebSocket 信令）
- node-cron（定时任务）
- coturn（TURN 服务器）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 Docker 服务

```bash
docker-compose up -d
```

这会启动：
- PostgreSQL 16（数据库）
- coturn（TURN 服务器）

### 3. 初始化数据库

```bash
npm run db:init
```

### 4. 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev

# 或者分别启动
npm run client:dev  # 前端 (http://localhost:5173)
npm run server:dev  # 后端 (http://localhost:3001)
```

## 项目结构

```
├── api/                    # 后端代码
│   ├── config/            # 配置管理
│   ├── controllers/       # API 控制器
│   ├── cron/              # 定时任务
│   ├── routes/            # API 路由
│   ├── services/          # 业务逻辑
│   ├── types/             # TypeScript 类型
│   ├── websocket/         # WebSocket 信令
│   ├── app.ts             # Express 应用
│   └── server.ts          # 服务器入口
├── src/                    # 前端代码
│   ├── components/        # React 组件
│   │   ├── Editor/       # 编辑器组件
│   │   ├── Room/         # 房间组件
│   │   └── Sidebar/      # 侧边栏组件
│   ├── hooks/             # 自定义 Hooks
│   ├── pages/             # 页面组件
│   ├── store/             # Zustand 状态管理
│   ├── types/             # TypeScript 类型
│   └── utils/             # 工具函数
├── prisma/                 # 数据库 Schema
├── docker-compose.yml      # Docker 配置
└── package.json
```

## 核心功能说明

### 房间系统
- 用户可以创建房间或加入现有房间
- 每个房间有唯一的 6 位房间号
- 支持设置房间密码保护

### WebRTC P2P 连接
- 使用 Socket.io 作为信令服务器
- 支持 STUN 和 TURN 服务器
- Mesh 网络拓扑，每个用户与其他所有用户建立 P2P 连接
- 通过 RTCDataChannel 传输编辑内容和光标位置

### 实时文本同步
- 编辑器内容通过 RTCDataChannel 实时同步
- 支持文本变更和完整内容同步两种模式
- 最后写入者获胜策略（可后续升级为 CRDT）

### 多用户光标显示
- 每个用户的光标位置实时同步
- 12 种预设颜色确保视觉区分
- 光标附带用户名标签
- 支持选择区域高亮

### 版本控制
- 每 5 分钟自动保存版本到后端
- 支持手动保存版本
- 版本历史列表展示
- 支持版本预览和恢复
- 区分自动保存和手动保存

## API 接口

### 房间相关
- `POST /api/rooms` - 创建房间
- `GET /api/rooms/:roomId` - 获取房间信息
- `POST /api/rooms/:roomId/join` - 加入房间
- `GET /api/rooms/ice-servers` - 获取 ICE 服务器配置

### 版本相关
- `GET /api/rooms/:roomId/versions` - 获取版本列表
- `GET /api/rooms/:roomId/versions/:versionId` - 获取版本详情
- `POST /api/rooms/:roomId/versions` - 保存版本
- `POST /api/rooms/:roomId/versions/:versionId/restore` - 恢复版本

## 配置说明

### 环境变量

复制 `.env.example` 为 `.env` 并配置：

```env
# 服务器配置
PORT=3001
CLIENT_URL=http://localhost:5173

# 数据库配置
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cocode?schema=public"

# STUN/TURN 配置
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=
TURN_USERNAME=
TURN_CREDENTIAL=
```

### STUN/TURN 服务器

默认使用 Google 的 STUN 服务器。如需使用 TURN 服务器，可以：

1. 使用 docker-compose 启动 coturn 服务
2. 或者配置自己的 TURN 服务器

## 开发说明

### 代码规范
- 使用 TypeScript 严格模式
- ESLint 代码检查
- Prettier 代码格式化

### 运行测试

```bash
npm run lint    # 代码检查
npm run check   # TypeScript 类型检查
```

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 许可证

MIT

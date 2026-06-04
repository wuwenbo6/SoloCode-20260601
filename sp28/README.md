# SSH Web 终端管理平台

一个基于 Go + Vue3 的 Web SSH 终端管理平台，支持会话录制、回放、权限控制和多人观看等功能。

## 功能特性

### 🔐 权限控制
- 用户需申请访问目标服务器
- 管理员审批通过后才能连接
- 支持设置过期时间，过期自动回收权限
- JWT 认证体系

### 💻 SSH 终端
- 基于 WebSocket 代理 SSH 流
- 使用 xterm.js 实现完整终端体验
- 支持终端大小自适应
- 实时连接状态显示

### 📹 会话录制
- 使用 ttyrec 格式录制终端操作
- 录制文件存储到 MinIO 对象存储
- 支持会话回放
- 播放速度调节（0.25x - 4x）

### 📺 广播模式
- 支持多人同时观看同一会话
- 实时直播终端操作
- 观看人数统计

## 技术栈

### 后端
- **Go 1.21**
- **Gin** - Web 框架
- **GORM** - ORM 框架
- **SQLite** - 数据库
- **MinIO SDK** - 对象存储
- **Gorilla WebSocket** - WebSocket 支持
- **x/crypto/ssh** - SSH 客户端

### 前端
- **Vue 3**
- **Vite** - 构建工具
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **Element Plus** - UI 组件库
- **xterm.js** - 终端组件
- **Axios** - HTTP 客户端

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 停止服务
docker-compose down
```

访问地址：
- 前端: http://localhost:5173
- 后端 API: http://localhost:8080
- MinIO Console: http://localhost:9001 (admin / minioadmin)

### 方式二：本地开发

#### 启动 MinIO
```bash
# 使用 Docker 启动 MinIO
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

#### 启动后端
```bash
cd backend
go mod download
go run cmd/server/main.go
```

#### 启动前端
```bash
cd frontend
npm install
npm run dev
```

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| user | user123 | 普通用户 |

## 使用指南

### 1. 管理员添加服务器
1. 使用 admin 账号登录
2. 进入"管理后台" -> "服务器管理"
3. 点击"添加服务器"，填写 SSH 连接信息

### 2. 用户申请权限
1. 登录后进入"权限申请"页面
2. 选择目标服务器和申请时长
3. 填写申请理由并提交

### 3. 管理员审批
1. 进入"管理后台" -> "权限审批"
2. 查看待审批的申请
3. 点击"通过"或"拒绝"

### 4. 连接 SSH
1. 审批通过后，进入"终端连接"页面
2. 选择服务器并点击"连接"
3. 开始使用 SSH 终端

### 5. 观看直播
1. 进入"直播观看"页面
2. 查看正在进行的会话列表
3. 点击"加入观看"即可实时观看

### 6. 播放录像
1. 进入"录像回放"页面
2. 选择要回放的会话
3. 支持播放/暂停、快进快退、速度调节

## 项目结构

```
sp28/
├── backend/                    # Go 后端
│   ├── cmd/
│   │   └── server/
│   │       └── main.go        # 入口文件
│   ├── internal/
│   │   ├── config/            # 配置
│   │   ├── handler/           # HTTP 处理器
│   │   ├── middleware/        # 中间件
│   │   ├── model/             # 数据模型
│   │   ├── recorder/          # ttyrec 录制
│   │   ├── repository/        # 数据访问
│   │   └── service/           # 业务逻辑
│   ├── Dockerfile
│   ├── .env
│   └── go.mod
├── frontend/                   # Vue3 前端
│   ├── src/
│   │   ├── api/               # API 接口
│   │   ├── components/        # 组件
│   │   ├── router/            # 路由
│   │   ├── stores/            # 状态管理
│   │   ├── styles/            # 样式
│   │   ├── views/             # 页面视图
│   │   ├── App.vue
│   │   └── main.js
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   └── package.json
└── docker-compose.yml         # Docker Compose 配置
```

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `GET /api/auth/me` - 获取当前用户信息

### 服务器
- `GET /api/servers` - 获取服务器列表
- `POST /api/servers` - 创建服务器（管理员）
- `PUT /api/servers/:id` - 更新服务器（管理员）
- `DELETE /api/servers/:id` - 删除服务器（管理员）

### 权限
- `POST /api/access/request` - 申请权限
- `GET /api/access/grants/me` - 我的权限
- `GET /api/access/requests` - 申请列表
- `POST /api/access/requests/:id/approve` - 通过申请（管理员）
- `POST /api/access/requests/:id/reject` - 拒绝申请（管理员）

### SSH
- `GET /api/ssh/connect?server_id=:id` - WebSocket 连接 SSH
- `GET /api/ssh/active` - 活跃会话列表
- `GET /api/ssh/broadcast/:id` - 加入直播观看

### 回放
- `GET /api/playback` - 录像列表
- `GET /api/playback/:id` - 获取录制帧
- `GET /api/playback/:id/speed` - 按速度获取帧数据
- `GET /api/playback/:id/info` - 录像信息

## 注意事项

1. **SSH 服务器配置**: 确保目标 SSH 服务器允许从后端服务器访问
2. **安全建议**: 生产环境请修改默认密码和 JWT Secret
3. **MinIO**: 生产环境建议使用专用的 MinIO 集群
4. **防火墙**: 确保 WebSocket 连接可以正常建立

## License

MIT

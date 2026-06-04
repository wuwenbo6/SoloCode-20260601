# 全栈博客系统

基于 **Apollo Server + Node.js + Prisma + PostgreSQL** 后端和 **Next.js + Apollo Client** 前端的GraphQL博客系统。

## 功能特性

### 核心功能
- ✅ **文章管理**：创建、编辑、删除文章
- ✅ **审核流程**：文章创建 → 提交审核 → 管理员审核 → 发布
- ✅ **定时发布**：作者可设定未来时间自动发布
- ✅ **版本历史**：每次编辑生成新版本，支持对比和回滚
- ✅ **评论系统**：评论发表后需管理员审核才能显示
- ✅ **嵌套评论**：支持无限级回复
- ✅ **评论互动**：支持点赞、踩功能
- ✅ **全文搜索**：基于PostgreSQL的全文搜索，支持标题、内容、标签搜索
- ✅ **实时通知**：GraphQL Subscription 实现新评论实时通知
- ✅ **权限控制**：
  - 作者：可编辑/删除自己的文章
  - 管理员：可审核文章和评论

### 数据模型
- **User（用户）**：邮箱、密码、姓名、角色（AUTHOR/ADMIN）
- **Post（文章）**：标题、正文、标签、状态、定时发布时间、全文搜索向量
- **Comment（评论）**：内容、状态、父评论、回复、点赞、踩
- **PostVersion（文章版本）**：记录每次编辑的历史版本
- **CommentReaction（评论反应）**：记录用户对评论的点赞/踩

## 项目结构

```
sp15/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── index.js        # 服务入口（Apollo Server + WebSocket）
│   │   ├── schema.js       # GraphQL Schema 定义
│   │   ├── resolvers.js    # GraphQL Resolvers
│   │   ├── prisma.js       # Prisma 客户端
│   │   └── auth.js         # 认证工具函数
│   ├── prisma/
│   │   └── schema.prisma   # Prisma 数据模型
│   ├── package.json
│   └── .env
└── frontend/               # 前端应用
    ├── app/
    │   ├── page.tsx        # 首页（文章列表）
    │   ├── layout.tsx      # 根布局
    │   ├── login/          # 登录页
    │   ├── register/       # 注册页
    │   ├── posts/          # 文章相关页面
    │   │   ├── new/        # 新建文章
    │   │   └── [id]/       # 文章详情
    │   ├── my-posts/       # 我的文章
    │   └── admin/
    │       └── comments/   # 评论审核（管理员）
    ├── components/
    │   └── Navbar.tsx      # 导航栏
    ├── context/
    │   └── AuthContext.tsx # 认证上下文
    ├── graphql/
    │   ├── queries.ts      # GraphQL 查询
    │   └── mutations.ts    # GraphQL 变更
    └── lib/
        └── apollo.tsx      # Apollo Client 配置
```

## 快速开始

### 前置要求
- Node.js 18+
- PostgreSQL 数据库

### 1. 启动后端服务

```bash
cd backend

# 安装依赖
npm install

# 配置数据库连接
# 编辑 .env 文件中的 DATABASE_URL

# 生成 Prisma Client
npm run prisma:generate

# 执行数据库迁移
npm run prisma:migrate

# 启动开发服务器
npm run dev
```

后端服务将在 `http://localhost:4000/graphql` 启动

### 2. 启动前端服务

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端应用将在 `http://localhost:3000` 启动

## GraphQL API

### 查询 (Query)
- `me`: 获取当前用户信息
- `posts`: 获取文章列表（可按状态筛选）
- `post`: 获取单篇文章详情
- `myPosts`: 获取当前用户的文章
- `pendingComments`: 获取待审核评论（管理员）
- `postVersions`: 获取文章版本历史
- `searchPosts`: 全文搜索文章

### 变更 (Mutation)
- `register` / `login`: 用户注册/登录
- `createPost` / `updatePost` / `deletePost`: 文章CRUD（支持定时发布）
- `submitForReview`: 提交文章审核
- `schedulePost`: 设置定时发布时间
- `reviewPost`: 审核文章（管理员）
- `rollbackToVersion`: 回滚到历史版本
- `createComment`: 创建评论（支持嵌套回复）
- `reactToComment`: 评论点赞/踩
- `reviewComment`: 审核评论（管理员）

### 订阅 (Subscription)
- `newComment`: 新评论通知
- `commentReviewed`: 评论审核结果通知

## 权限说明

| 操作 | 作者 | 管理员 |
|------|------|--------|
| 创建文章 | ✅ | ✅ |
| 编辑自己的文章 | ✅ | ✅ |
| 编辑他人的文章 | ❌ | ✅ |
| 删除自己的文章 | ✅ | ✅ |
| 删除他人的文章 | ❌ | ✅ |
| 提交审核 | ✅ | ✅ |
| 审核文章 | ❌ | ✅ |
| 发表评论 | ✅ | ✅ |
| 审核评论 | ❌ | ✅ |

## 测试账号

注册后默认角色为 **AUTHOR**（作者）。如需创建管理员账号，可直接在数据库中修改 `role` 字段为 `ADMIN`。

# 分布式计算集群管理系统

基于 WebTransport 的分布式计算集群，包含 Go 后端和 Vue3 前端。

## 功能特性

- 🚀 **WebTransport 通信**：节点间使用 WebTransport 进行高性能通信
- 💓 **心跳检测**：每秒发送心跳，5秒超时标记节点下线
- 📊 **节点监控**：实时监控 CPU、内存、任务数
- 🎯 **任务分片**：任务自动分片分配给多个节点并行计算
- 🔄 **故障恢复**：节点下线后任务自动重新分配
- 📈 **实时进度**：任务进度实时推送到前端
- 🧮 **PI 计算**：示例任务为高精度 PI 计算
- 🏷️ **任务版本号**：每个分片有递增版本号，避免网络分区时重复分配
- 🚫 **去重机制**：Master 维护去重表，拒绝重复的分片结果
- ⏹️ **任务撤销**：节点故障后发送撤销消息，旧版本任务立即停止执行
- 💾 **流式聚合**：分片结果写入临时文件，最终聚合时流式读取，避免大结果集内存溢出
- 🎯 **任务优先级**：支持 4 级优先级（低/普通/高/紧急），高优先级任务插队执行
- 🏷️ **节点亲和性**：支持亲和性标签、反亲和性标签、首选节点指定
- 📜 **任务日志**：Worker 实时收集执行日志，Master 聚合后通过 WebSocket 推送到前端，支持实时查看和历史回溯

## 项目结构

```
.
├── backend/                 # Go 后端
│   ├── proto/              # 消息协议定义
│   ├── master/             # Master 节点
│   ├── worker/             # Worker 节点
│   └── start_workers.sh    # 启动 10 个 Worker 脚本
└── frontend/               # Vue3 前端
    ├── src/
    │   ├── components/     # 组件
    │   └── utils/          # 工具
    └── ...
```

## 运行说明

### 1. 启动 Master 节点

```bash
cd backend
go run master/main.go
```

Master 运行在:
- WebTransport: `https://localhost:4433/webtransport`
- WebSocket: `ws://localhost:8080/ws`

### 2. 启动 Worker 节点

方式一：启动单个 Worker
```bash
cd backend
go run worker/main.go worker-1
```

方式二：启动 10 个 Worker
```bash
cd backend
chmod +x start_workers.sh
./start_workers.sh
```

### 3. 启动前端

```bash
cd frontend
npm run dev
```

前端访问: `http://localhost:3000`

## 使用流程

1. 启动 Master 节点
2. 启动若干 Worker 节点（建议10个）
3. 打开前端页面
4. 在"任务提交"区域选择计算精度，点击"提交任务"
5. 观察节点状态变化和任务进度
6. 可以随时终止某个 Worker 来测试故障恢复功能

## 技术栈

### 后端
- Go 1.21+
- quic-go / webtransport-go
- gorilla/websocket

### 前端
- Vue 3
- Vite
- WebSocket (原生)
